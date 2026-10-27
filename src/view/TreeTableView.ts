import { type IconName, ItemView, MarkdownPreviewView, MarkdownRenderer, MarkdownView, TFile, type ViewStateResult, WorkspaceLeaf } from "obsidian";
import { mount, unmount } from "svelte";
import { Effect, pipe } from "effect";
import type HeadingsPlugin from "../main";
import TreeTableHost from "./TreeTableHost.svelte";
import TreeTable from "./TreeTable.svelte";
import { PluginDocumentService } from "../service/document-service";
import { getFileCached } from "../extension/app";
import { getActiveViewOfType } from "../extension/workspace";
import { EditorView } from "@codemirror/view";
import { history, redo, undo } from "@codemirror/commands";
import { createTreeNode, pareTreeNode } from "./tree";


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

                }
            },
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

    private async refresh() {
        const program = Effect.gen({ self: this }, function* () {
            const editor = yield* Effect.fromNullishOr(this.editor_view);

            const table = yield* Effect.fromNullishOr(this.treeTable);                           
            const { doc, cached } = yield* getFileCached(this.app, this.state.file!);
            // yield* Effect(() => {
            // this.docService.send(this.state.file!, doc, cached)
            // });
            editor.dispatch({
                changes: {
                    from: 0,
                    to: editor.state.doc.length,
                    insert: doc,
                }
            }
            )
            const root = yield* createTreeNode(cached, this.state.file!);
            const paredRoot = yield* pareTreeNode(root, (from, to) => this.editor_view!.state.sliceDoc(from, to));
            table.refresh(paredRoot);
        });

        await Effect.runPromiseExit(program);
    }
}
