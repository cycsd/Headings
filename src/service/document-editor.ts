import { EditorState, type StateCommand, type Transaction } from "@codemirror/state";
import { history, redo, undo } from "@codemirror/commands";
import type { App, TFile } from "obsidian";
import type { TextPatch } from "../core/edit";

/**
 * 文件鏡像：一份 headless 的 CodeMirror EditorState，帶 history。
 * core/edit 算出的補丁先套到鏡像，再用 vault.process 寫回檔案；undo / redo 也走同一條路。
 * 寫回時發現檔案內容跟鏡像套補丁前的內容不同（別的視窗改過），丟 DocumentConflictError 並把鏡像重設成檔案內容。
 */
export class DocumentConflictError extends Error {
    constructor() {
        super("document changed outside the Headings view");
        this.name = "DocumentConflictError";
    }
}

/** transaction 的 ChangeSet 轉成以舊文件為準的補丁 */
const changesToPatches = (tr: Transaction): TextPatch[] => {
    const patches: TextPatch[] = [];
    tr.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
        patches.push({ from: fromA, to: toA, insert: inserted.toString() });
    });
    return patches;
};

export class DocumentEditor {
    private state: EditorState;

    constructor(
        private app: App,
        readonly file: TFile,
        doc: string,
    ) {
        this.state = DocumentEditor.create(doc);
    }

    private static create(doc: string): EditorState {
        return EditorState.create({ doc, extensions: [history()] });
    }

    get doc(): string {
        return this.state.doc.toString();
    }

    /** 外部改動進來：內容不同才重設，重設會清掉歷史 */
    reset(doc: string) {
        if (doc !== this.doc) this.state = DocumentEditor.create(doc);
    }

    /** 套補丁並寫回；回傳實際套上的補丁（以套之前的文件為準），呼叫端用來搬節點狀態 */
    async apply(patches: TextPatch[]): Promise<TextPatch[]> {
        const before = this.doc;
        const tr = this.state.update({ changes: patches.map((p) => ({ from: p.from, to: p.to, insert: p.insert })) });
        await this.commit(before, tr.state);
        return changesToPatches(tr);
    }

    /** 回傳這次復原實際改了什麼（以復原前的文件為準）；沒東西可復原回傳 null */
    undo(): Promise<TextPatch[] | null> {
        return this.run(undo);
    }

    redo(): Promise<TextPatch[] | null> {
        return this.run(redo);
    }

    private async run(command: StateCommand): Promise<TextPatch[] | null> {
        const before = this.doc;
        let tr: Transaction | null = null;
        const handled = command({ state: this.state, dispatch: (t) => (tr = t) });
        if (!handled || !tr) return null;
        await this.commit(before, (tr as Transaction).state);
        return changesToPatches(tr);
    }

    /** 檔案內容必須等於 before 才寫入 after；不等就是外部改過 */
    private async commit(before: string, next: EditorState) {
        let conflict: string | null = null;
        const after = next.doc.toString();
        await this.app.vault.process(this.file, (data) => {
            if (data !== before) {
                conflict = data;
                return data;
            }
            return after;
        });
        if (conflict !== null) {
            this.state = DocumentEditor.create(conflict);
            throw new DocumentConflictError();
        }
        this.state = next;
    }
}
