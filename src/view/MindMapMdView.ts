import { type CachedMetadata, type EventRef, type IconName, ItemView, MarkdownRenderChild, TFile, type ViewStateResult, WorkspaceLeaf } from "obsidian";
import type MindMapMdPlugin from "../main";
import MindMapEditorView from "./MindMapEditorView.svelte";
import { mount, unmount } from "svelte";
import type { ComponentState, MindMapMdViewState, MindMapMdViewStateSave } from "./MindMapMd"
import { Effect, Option } from "effect";
import type { NoSuchElementException } from "effect/Cause";
import { cachedRead, getFileByPath } from "../extension/vault";

export const VIEW_TYPE_MINDMAPMD = "mindmap-md-view";

//obsidian base 使用 layout-list 當作 icon
export const VIEW_ICON_MINDMAPMD: IconName = "layout-panel-left";

export class MindMapMdView extends ItemView {
    private mindMapEditorView: ReturnType<typeof MindMapEditorView> | undefined;
    public file: TFile | undefined | null;
    // public fileCache: CachedMetadata | null | undefined;
    public state: MindMapMdViewState = {
        filePath: null,
        file: null,
        doc: null,
    };

    private cacheChagedEventRef: EventRef | null = null;

    getViewType(): string {
        return VIEW_TYPE_MINDMAPMD;
    }
    getDisplayText(): string {
        return this.state.file?.basename ?? "Mind Map MD";
    }
    getIcon(): IconName {
        return VIEW_ICON_MINDMAPMD;
    }
    constructor(leaf: WorkspaceLeaf, private plugin: MindMapMdPlugin) {
        super(leaf);
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
                docService: {
                    save: (doc: string) => {
                        //todo vaul.process 效能
                        // 再確認 vault.process 是否也只是先寫進 cache,如果是的話這邊應該不用 debouce
                        return this.plugin.app.vault.process(this.state.file!, (data) => {
                            return doc;
                        });

                    }
                }
            }
        }
        );

        this.cacheChagedEventRef = this.plugin.app.metadataCache.on("changed", async (file, doc, cached) => {
            const program = Effect.gen(this, function* () {
                const exist_file = yield* Option.fromNullable(this.state.file)
                    .pipe(Option.filter(f => f.path === file.path));

                const component = yield* Effect.fromNullable(this.mindMapEditorView);
                component.setState({
                    file,
                    cached,
                    doc,
                })
            });
            await Effect.runPromise(program);
        });

    }

    async onClose() {
        if (this.mindMapEditorView) {
            // Remove the MindMapEditorView from the ItemView.
            unmount(this.mindMapEditorView);
        }
        if (this.cacheChagedEventRef) {
            this.plugin.app.metadataCache.offref(this.cacheChagedEventRef);
        }
    }

    //如果想要 refresh 畫面可能可以藉由這個來控制
    async setState(state: MindMapMdViewState, result: ViewStateResult) {
        // 如果是 obsidian 一開始開啟 vault 會找 workspace.json ，如果看到 view type 是這個 plugin
        // 會先執行 onOpen
        // 才會再來執行 setState ，將之前存在 workspace.json 中的 state 取出來，並 setState 給 view

        const setComponentState = Effect.gen(this, function* () {
            const component = yield* Effect.fromNullable(this.mindMapEditorView)

            const { file, cached, doc } = yield* this.getComponentState(state);

            component.setState({
                file,
                cached,
                doc,
            });

            this.state = {
                ...state,
                file,
            }

        })


        await Effect.runPromiseExit(setComponentState);

        const savedState = this.stateMapping2Save(this.state);

        await super.setState(savedState, result);

        
        //     this.mindMapEditorView?.focus();
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

            const cached = yield* Effect.fromNullable(this.plugin.app.metadataCache.getFileCache(file))

            const doc = yield* Effect.fromNullable(state.doc).pipe(
                Effect.orElse(() => cachedRead(this.plugin.app.vault, file))
            );

            return { file, cached, doc };
        });
    }

    stateMapping2Save(state: MindMapMdViewState): MindMapMdViewStateSave {
        return {
            filePath: state.filePath,
        }
    }
}