import { type CachedMetadata, ItemView, MarkdownRenderChild, TFile, type ViewStateResult, WorkspaceLeaf } from "obsidian";
import type MindMapMdPlugin from "../src/main";
import MindMapEditorView from "./MindMapEditorView.svelte";
import { mount, unmount } from "svelte";


export const VIEW_TYPE_MINDMAPMD = "mindmap-md-view";

type MindMapMdViewState = {
    fileName: string;
    file?: TFile;
}
export class MindMapMdView extends ItemView {
    private mindMapEditorView: ReturnType<typeof MindMapEditorView> | undefined;
    public file: TFile | undefined | null;
    // public fileCache: CachedMetadata | null | undefined;
    public state: MindMapMdViewState | null = null;
    getViewType(): string {
        return VIEW_TYPE_MINDMAPMD;
    }
    getDisplayText(): string {
        return "Mind Map MD";
    }
    constructor(leaf: WorkspaceLeaf, private plugin: MindMapMdPlugin) {
        super(leaf);
        if (this.plugin.currentFile) {
            this.state = {
                fileName: this.plugin.currentFile.name,
            }
            this.file = this.plugin.currentFile;
        }
    }

    async onOpen() {
        // Attach the Svelte component to the ItemViews content element and provide the needed props.

        // obsidian 一打開執行 onOpen 時 leaf.getViewState() 中的 state 是 undefined 的，所以在 onOpen 時無法取得之前存在 workspace.json 中的 state 資訊。
        console.log("on obsidian open", this.leaf.getViewState(), this.getState());

        this.file = this.plugin.currentFile;
        this.state = {
            fileName: this.file?.name || "",
        };

        if (this.file) {
            this.mindMapEditorView = mount(MindMapEditorView, {
                target: this.contentEl,
                props: {
                    startCount: 5,
                    plugin: this.plugin,
                    view: this,
                }
            });
        }
        console.log("Opening After Mount", this.plugin.currentMarkdownEditor);

        // Since the component instance is typed, the exported `increment` method is known to TypeScript.
        this.mindMapEditorView?.increment();
    }

    async onClose() {
        if (this.mindMapEditorView) {
            // Remove the MindMapEditorView from the ItemView.
            unmount(this.mindMapEditorView);
        }
    }

    //如果想要 refresh 畫面可能可以藉由這個來控制
    async setState(state: MindMapMdViewState, result: ViewStateResult) {
        // console.log("setState", state, result);
        // this.fileName = state.fileName;
        // 如果是 obsidian 一開始開啟 vault 會找 workspace.json ，如果看到 view type 是這個 plugin
        // 會先執行 onOpen
        // 才會再來執行 setState ，將之前存在 workspace.json 中的 state 取出來，並 setState 給 view
        // 所以應該在這邊也要可以 mount view 元件，因為 onOpen 還沒有辦法取得之前的 state 資訊。
        console.log("setState", state, result);
        this.state = state;
        await super.setState(state, result);
        return
    }
    getState(): Record<string, unknown> {
        return {
            fileName: this.state?.fileName,
        };
    }
}