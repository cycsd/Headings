import { EditorState, type StateCommand } from "@codemirror/state";
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

    async apply(patches: TextPatch[]): Promise<void> {
        const before = this.doc;
        const next = this.state.update({ changes: patches.map((p) => ({ from: p.from, to: p.to, insert: p.insert })) }).state;
        await this.commit(before, next);
    }

    undo(): Promise<boolean> {
        return this.run(undo);
    }

    redo(): Promise<boolean> {
        return this.run(redo);
    }

    private async run(command: StateCommand): Promise<boolean> {
        const before = this.doc;
        let next: EditorState | null = null;
        const handled = command({ state: this.state, dispatch: (tr) => (next = tr.state) });
        if (!handled || !next) return false;
        await this.commit(before, next);
        return true;
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
