import { type IconName, ItemView, MarkdownView, TFile, type ViewStateResult, WorkspaceLeaf } from "obsidian";
import { mount, unmount } from "svelte";
import { Effect } from "effect";
import type HeadingsPlugin from "../main";
import TreeTableHost from "./TreeTableHost.svelte";
import { PluginDocumentService } from "../service/document-service";
import { getFileCached } from "../extension/app";
import { getActiveViewOfType } from "../extension/workspace";

export type TreeTableViewState = {
    filePath: string | null;
    file: TFile | null;
    doc: string | null;
};

export const VIEW_TYPE_TREETABLE = "tree-table-view";

//obsidian base 使用 list-tree 當作 icon
export const VIEW_ICON_TREETABLE: IconName = "list-tree";


export class TreeTableView extends ItemView {
    private treeTableHost: ReturnType<typeof TreeTableHost> | undefined;
    private docService: PluginDocumentService = PluginDocumentService.create(this.plugin);

    public state: TreeTableViewState = {
        filePath: null,
        file: null,
        doc: null,
    };

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
        this.treeTableHost = mount(TreeTableHost, {
            target: this.contentEl,
            props: {
                plugin: this.plugin,
                view: this,
                docService: this.docService,
            },
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
        this.state = state;
        await this.refresh();
    }

    async onClose() {
        if (this.treeTableHost) {
            await unmount(this.treeTableHost);
        }
    }

    // 依目前 active 的 markdown 檔案，將對應的 file/cache 推送給 TreeTableHost 顯示
    private async refresh() {
        const program = Effect.gen({ self: this }, function* () {
            console.log("Refreshing TreeTableView with file:", this.state);
            const { doc, cached } = yield* getFileCached(this.app, this.state.file!);
            yield* Effect.promise(() => this.docService.send(this.state.file!, doc, cached));
        });

        await Effect.runPromiseExit(program);
    }
}
