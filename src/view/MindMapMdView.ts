import { type CachedMetadata, ItemView, MarkdownRenderChild, TFile, type ViewStateResult, WorkspaceLeaf } from "obsidian";
import type MindMapMdPlugin from "../main";
import MindMapEditorView from "./MindMapEditorView.svelte";
import { mount, unmount } from "svelte";
import type { ComponentState, MindMapMdViewState, MindMapMdViewStateSave } from "./MindMapMd"
import { Effect } from "effect";
import type { NoSuchElementException } from "effect/Cause";
import { cachedRead, getFileByPath } from "../extension/vault";

export const VIEW_TYPE_MINDMAPMD = "mindmap-md-view";


export class MindMapMdView extends ItemView {
    private mindMapEditorView: ReturnType<typeof MindMapEditorView> | undefined;
    public file: TFile | undefined | null;
    // public fileCache: CachedMetadata | null | undefined;
    public state: MindMapMdViewState = {
        filePath: null,
        file: null,
        doc: null,
    };

    getViewType(): string {
        return VIEW_TYPE_MINDMAPMD;
    }
    getDisplayText(): string {
        return "Mind Map MD";
    }
    constructor(leaf: WorkspaceLeaf, private plugin: MindMapMdPlugin) {
        super(leaf);
        // if (this.plugin.currentFile) {
        //     this.state = {
        //         filePath: this.plugin.currentFile.name,
        //     }
        //     this.file = this.plugin.currentFile;
        // }
    }

    async onOpen() {
        // Attach the Svelte component to the ItemViews content element and provide the needed props.

        // obsidian 一打開執行 onOpen 時 leaf.getViewState() 中的 state 是 undefined 的，所以在 onOpen 時無法取得之前存在 workspace.json 中的 state 資訊。
        // console.log("on obsidian open", this.leaf.getViewState(), this.contentEl);

        this.mindMapEditorView = mount(MindMapEditorView, {
            target: this.contentEl,
            props: {

                plugin: this.plugin,
                view: this,
            }
        });

        // console.log("on obsidain opened:", this.mindMapEditorView);
        // }

        // Since the component instance is typed, the exported `increment` method is known to TypeScript.
        // this.mindMapEditorView?.increment();
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
        // console.log("setState", state, result);


        const setComponentState = Effect.gen(this, function* () {
            const component = yield* Effect.fromNullable(this.mindMapEditorView)

            const { file, cache, doc } = yield* this.getComponentState(state);

            component.setState({
                file,
                cache,
                doc,
            });

            // console.log("Component state set with file and cache:", state, cache);
            this.state = {
                ...state,
                file,
            }

        })


        await Effect.runPromiseExit(setComponentState);

        const savedState = this.stateMapping2Save(this.state);
        console.log("Saving state to workspace.json", savedState);
        await super.setState(savedState, result);
        return
    }

    // 這裡不能回傳不可被序列化的物件(ex: TFile)，否則 workspace.json 不會正常存檔，且 obsidian 不會報錯。
    getState(): Record<string, unknown> {
        return this.stateMapping2Save(this.state);
    }

    getComponentState(state: MindMapMdViewState) {
        return Effect.gen(this, function* () {
            const file = yield* Effect.fromNullable(state.file)
                .pipe(
                    Effect.orElse(() => Effect.fromNullable(state.filePath)
                        .pipe(Effect.flatMap(path => getFileByPath(this.plugin.app.vault, path))),
                    ));

            const cache = yield* Effect.fromNullable(this.plugin.app.metadataCache.getFileCache(file))

            const doc = yield* Effect.fromNullable(state.doc).pipe(
                Effect.orElse(() => cachedRead(this.plugin.app.vault, file))
            );

            return { file, cache, doc };
        });
    }

    stateMapping2Save(state: MindMapMdViewState): MindMapMdViewStateSave {
        return {
            filePath: state.filePath,
        }
    }
}