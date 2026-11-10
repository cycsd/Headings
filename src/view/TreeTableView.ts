import { type CachedMetadata, type IconName, ItemView, MarkdownRenderer, TFile, type ViewStateResult, WorkspaceLeaf } from "obsidian";
import { mount, unmount } from "svelte";
import { Effect, pipe } from "effect";
import type HeadingsPlugin from "../main";
import TreeTable from "./TreeTable.svelte";
import { PluginDocumentService } from "../service/document-service";
import { getFileCached } from "../extension/app";
import { getActiveViewOfType } from "../extension/workspace";
import { EditorView } from "@codemirror/view";
import { history, redo, undo } from "@codemirror/commands";
import { buildTree } from "../adapter/obsidian-tree";
import { promote, promoteNone, promoteTypes, type PromotePolicy } from "../core/tree";
import { SECTION_TYPES } from "../core/section-types";


export type TreeTableViewState = {
    filePath: string | null;
    file: TFile | null;
    doc: string | null;
};

export const VIEW_TYPE_TREETABLE = "tree-table-view";

//obsidian base 使用 list-tree 當作 icon
export const VIEW_ICON_TREETABLE: IconName = "list-tree";


export class TreeTableView extends ItemView {
    private treeTable: ReturnType<typeof TreeTable> | undefined;
    private docService: PluginDocumentService = PluginDocumentService.create(this.plugin);

    public state: TreeTableViewState = {
        filePath: null,
        file: null,
        doc: null,
    };
    private editor_view: EditorView | undefined;

    constructor(leaf: WorkspaceLeaf, private plugin: HeadingsPlugin) {
        super(leaf);
    }

    getViewType(): string {
        return VIEW_TYPE_TREETABLE;
    }

    getDisplayText(): string {
        return "Tree table";
    }

    getIcon(): IconName {
        return VIEW_ICON_TREETABLE;
    }

    async onOpen() {
        this.treeTable = mount(TreeTable, {
            target: this.contentEl,
            props: {
                // plugin: this.plugin,
                // view: this,
                // docService: this.docService,
                onRenderMarkdown: (text: string) => (element) => {
                    element.replaceChildren();
                    MarkdownRenderer.render(this.plugin.app, text, element, this.state.file!.path, this);
                    // const markdownPreviewView = new MarkdownPreviewView(element);
                    // markdownPreviewView.set(text, true);

                },
                getText: (from: number, to: number) => this.editor_view?.state.sliceDoc(from, to) ?? "",
            },
        });

        // 檔案變動時（metadataCache.changed → docService.send）重建目前檔案的樹
        this.docService.subscribe((file, doc, cached) => {
            if (file.path !== this.state.file?.path) return false;
            this.setDocument(doc);
            this.render(file, doc, cached);
            return true;
        });

        let prev_save_action: number | null = null;
        this.editor_view = new EditorView({
            doc: "",
            extensions: [
                history(),
                EditorView.updateListener.of((update) => {
                    // if (
                    //     !update.docChanged ||
                    //     update.transactions.some((tr) =>
                    //         tr.annotation(external_edit_annotation),
                    //     )
                    // ) {
                    //     return;
                    // }
                    if (prev_save_action !== null) {
                        cancelAnimationFrame(prev_save_action);
                    }
                    prev_save_action = requestAnimationFrame(async () => {
                        // await docService.save(
                        //     getfile()!,
                        //     update.state.doc.toString(),
                        // );
                    });
                }),
            ],
        });

        // this.registerEvent(
        //     this.app.workspace.on("active-leaf-change", () => {
        //         this.refresh();
        //     }),
        // );

        this.registerEvent(
            this.app.metadataCache.on("changed", (file, doc, cached) => {
                this.docService.send(file, doc, cached);
            }),
        );

        await this.refresh();
    }

    async setState(state: TreeTableViewState, result: ViewStateResult) {
        if (state) {
            this.state = state;
            await this.refresh();
        }
    }

    async onClose() {
        if (this.treeTable) {
            await unmount(this.treeTable);
        }
    }

    // 依 state.file 讀取 doc 與 cache，重建樹並交給 TreeTable 顯示（設定變更時也走這裡）
    async refresh() {
        const program = Effect.gen({ self: this }, function* () {
            const file = yield* Effect.fromNullishOr(this.state.file);
            const { doc, cached } = yield* getFileCached(this.app, file);
            this.setDocument(doc);
            this.render(file, doc, cached);
        });

        await Effect.runPromiseExit(program);
    }

    /** 把原文放進 editor，之後 TreeTable 透過 getText 取片段 */
    private setDocument(doc: string) {
        const editor = this.editor_view;
        if (!editor || editor.state.doc.toString() === doc) return;
        editor.dispatch({
            changes: { from: 0, to: editor.state.doc.length, insert: doc },
        });
    }

    /** 唯一的建樹路徑：adapter 建完整樹 → 依設定 promote → 交給 layout / view */
    private render(file: TFile, doc: string, cached: CachedMetadata) {
        if (!this.treeTable) return;
        const tree = promote(buildTree(cached, doc, file.name), this.promotePolicy());
        this.treeTable.refresh(tree);
    }

    /** 設定 → policy 的轉換只發生在 view 層，core 不認識 settings */
    private promotePolicy(): PromotePolicy {
        return this.plugin.settings.listAsNode ? promoteTypes([SECTION_TYPES.list]) : promoteNone;
    }
}
