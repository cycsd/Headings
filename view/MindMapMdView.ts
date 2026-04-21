import { ItemView, MarkdownRenderChild, TFile, WorkspaceLeaf } from "obsidian";
import type MyPlugin from "../src/main";
import MindMapEditorView from "./MindMapEditorView.svelte";
import { mount, unmount } from "svelte";


export const VIEW_TYPE_MINDMAPMD = "mindmap-md-view";

export class MindMapMdView extends ItemView {
    private mindMapEditorView: ReturnType<typeof MindMapEditorView> | undefined;
    public file: TFile | undefined | null;
    getViewType(): string {
        return VIEW_TYPE_MINDMAPMD;
    }
    getDisplayText(): string {
        return "Mind Map MD";
    }
    constructor(leaf: WorkspaceLeaf, private plugin: MyPlugin) {
        super(leaf);
    }

    async onOpen() {
        // Attach the Svelte component to the ItemViews content element and provide the needed props.
        this.file = this.plugin.currentFile;
        this.mindMapEditorView = mount(MindMapEditorView, {
            target: this.contentEl,
            props: {
                startCount: 5,
                plugin: this.plugin,
            }
        });

        // Since the component instance is typed, the exported `increment` method is known to TypeScript.
        this.mindMapEditorView.increment();
    }

    async onClose() {
        if (this.mindMapEditorView) {
            // Remove the MindMapEditorView from the ItemView.
            unmount(this.mindMapEditorView);
        }
    }
}