import { MarkdownView, Platform, type CachedMetadata, type TFile } from "obsidian";
import type HeadingsPlugin from "../main";
import { Effect } from "effect";
import { getFileCached } from "../extension/app";
import { EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { NoSuchElementError, UnknownError } from "effect/Cause";



export type Promiseable<T> = T | Promise<T>;

export interface DocumentService {
    getCache(file: TFile): Effect.Effect<{ doc: string, cached: CachedMetadata }, NoSuchElementError | UnknownError, never>;
    subscribe: (callback: (file: TFile, doc: string, cached: CachedMetadata) => Promiseable<boolean>) => void;
    /**
     * return boolean 代表是否有成功送出訊息給訂閱者，成功的定義是訂閱者有收到訊息並且成功處理。
     */
    send: (file: TFile, doc: string, cached: CachedMetadata) => Promiseable<boolean>;
    save: (file: TFile, doc: string) => Promise<string>;
    isStale: (doc: string, cached: CachedMetadata) => boolean;
    openFile: (file: TFile, anchor: number, head: number) => Promise<void>;
    reveal: (file: TFile, anchor: number, head: number) => Promise<void>;
    locate: (file: TFile, anchor: number, head: number) => Promise<MarkdownView>;
}


export class PluginDocumentService implements DocumentService {
    private constructor(private plugin: HeadingsPlugin) {

    }
    /** 定位並把焦點移到編輯器（閱讀模式沒有游標，只捲動並把分頁設為作用中） */
    async reveal(file: TFile, anchor: number, head: number) {
        const view = await this.locate(file, anchor, head);
        this.plugin.app.workspace.setActiveLeaf(view.leaf, { focus: true });
        if (view.getMode() !== "preview") view.editor.focus();
    }

    /**
     * 找到或打開該檔的 Markdown 分頁並定位：先用工作區裡已經開著這個檔案的分頁（任何位置），
     * 沒有才開新的（桌面在旁邊 split、手機開新分頁）。
     */
    async locate(file: TFile, anchor: number, head: number): Promise<MarkdownView> {
        const view = this.findMarkdownView(file) ?? (await this.openMarkdownView(file));
        await this.plugin.app.workspace.revealLeaf(view.leaf);
        this.locate_view(view, anchor, head);
        return view;
    }

    private findMarkdownView(file: TFile): MarkdownView | null {
        const workspace = this.plugin.app.workspace;
        const leaves = workspace.getLeavesOfType("markdown");
        const views = leaves.flatMap((leaf) => (leaf.view instanceof MarkdownView && leaf.view.file?.path === file.path ? [leaf.view] : []));
        // 同一檔開在多個分頁時優先用最近用過的那個
        const recent = workspace.getMostRecentLeaf();
        return views.find((view) => view.leaf === recent) ?? views[0] ?? null;
    }

    private async openMarkdownView(file: TFile): Promise<MarkdownView> {
        const leaf = this.plugin.app.workspace.getLeaf(Platform.isMobile ? "tab" : "split");
        await leaf.openFile(file);
        if (!(leaf.view instanceof MarkdownView)) throw new Error("headings: opened leaf is not a markdown view");
        return leaf.view;
    }

    /** 編輯模式：設游標並捲到中央；閱讀模式：不切模式，用 ephemeral state 捲到那一行 */
    locate_view(view: MarkdownView, anchor: number, head: number) {
        if (view.getMode() === "preview") {
            view.setEphemeralState({ line: view.editor.offsetToPos(anchor).line });
            return;
        }
        const range = EditorSelection.range(anchor, head);
        view.editor.cm.dispatch({
            selection: range,
            effects: EditorView.scrollIntoView(range, { y: "center" }),
        });
    }

    async openFile(file: TFile, anchor: number, head?: number) {
        const view = await this.openMarkdownView(file);
        this.locate_view(view, anchor, head ?? anchor);
    }
    getCache(file: TFile) {
        return Effect.fromNullishOr(this.cachedData)
            .pipe(Effect.catchCause(() => getFileCached(this.plugin.app, file)))
    }

    static create(plugin: HeadingsPlugin): PluginDocumentService {
        return new PluginDocumentService(plugin);
    }
    private subscribers: Set<(file: TFile, doc: string, cached: CachedMetadata) => Promiseable<boolean>> = new Set();

    private cachedData: {
        doc: string,
        cached: CachedMetadata,
    } = {
            doc: "",
            cached: {},
        }

    subscribe(callback: (file: TFile, doc: string, cached: CachedMetadata) => Promiseable<boolean>) {
        this.subscribers.add(callback);
    };

    async send(file: TFile, doc: string, cached: CachedMetadata): Promise<boolean> {
        const results = await Promise.all(Array.from(this.subscribers).map(subscriber => Promise.resolve(subscriber(file, doc, cached))));
        const is_process = results.some(r => r);
        this.cachedData = {
            doc,
            cached,
        };
        return is_process;
    }

    async save(file: TFile, doc: string): Promise<string> {
        //todo vaul.process 效能
        // 再確認 vault.process 是否也只是先寫進 cache,如果是的話這邊應該不用 debouce
        return this.plugin.app.vault.process(file, (data) => doc);
    }

    isStale(doc: string, cached: CachedMetadata): boolean {
        const is_equal = this.cachedData.doc === doc;
        return !is_equal;
    }
}

