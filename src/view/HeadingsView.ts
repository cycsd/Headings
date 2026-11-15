import { type CachedMetadata, type IconName, ItemView, Keymap, MarkdownRenderer, Menu, type PaneType, Platform, resolveSubpath, TFile, type ViewStateResult, WorkspaceLeaf } from "obsidian";
import { mount, unmount } from "svelte";
import { Effect } from "effect";
import type HeadingsPlugin from "../main";
import LayoutHost from "./LayoutHost.svelte";
import { createHostState, resetNodeState, watchFileMemory, type HostState } from "./host-state.svelte";
import { LAYOUT_REGISTRY, availableLayoutIds } from "./layout-registry";
import { FM_LAYOUT_KEY, FM_MINDMAP_DIRECTION_KEY, FM_NODES_KEY, resolveLayoutId, resolveMindmapDirection, resolveNodeTypes } from "./view-config";
import type { MindmapDirection } from "../layout/mindmap";
import { EMBED_ICON, LINK_ICON } from "./section-icons";
import { parseFrontmatter, renderProperties } from "./frontmatter-properties";
import { PluginDocumentService } from "../service/document-service";
import { getFileCached } from "../extension/app";
import { buildLinks, buildTree } from "../adapter/obsidian-tree";
import { promote, promoteTypes, type TreeNode } from "../core/tree";
import { nodeAtOffset } from "../core/tree-ops";
import { taskLineOffsets, type DropPosition } from "../core/edit";
import { PROMOTABLE_SECTION_TYPES, type PromotableSectionType } from "../core/section-types";
import type { LayoutId } from "../layout/layout";
import { layoutLabel, sectionTypeLabel } from "../labels";
import { defaultLitTypes, editorSize, type HeadingsSettings, type SearchMode } from "../settings-model";
import { t } from "../i18n";
import { NodeEditing } from "./node-editing";
import type { NodeCommand } from "./node-ui";
import {
    applyCollapseOthers,
    applyCollapseSubtree,
    applyDepth,
    applyExpandSubtree,
    openSearch,
    restoreNodeState,
    revealNode,
    setFocus,
    setSearchMode,
    snapshotNodeState,
    stepExpandDepth,
    visibleMaxDepth,
    visibleRoot,
} from "./tree-state";

/** 設定 → HostState 的編輯器尺寸欄位 */
const editorSizeState = (settings: HeadingsSettings): Pick<HostState, "editorSizeEnabled" | "editorWidth" | "editorMaxHeight"> => {
    const { width, maxHeight } = editorSize(settings);
    return { editorSizeEnabled: settings.editorSizeEnabled, editorWidth: width, editorMaxHeight: maxHeight };
};

export type HeadingsViewState = {
    filePath: string | null;
    file: TFile | null;
    doc: string | null;
};

export const VIEW_TYPE_HEADINGS = "headings-view";

//obsidian base 使用 list-tree 當作 icon
export const VIEW_ICON_HEADINGS: IconName = "list-tree";

/** 節點狀態變動後多久寫一次每檔記錄 (ms) */
const MEMORY_SAVE_DELAY = 500;

type Loaded = { file: TFile; doc: string; cached: CachedMetadata };

/**
 * 統一的 Headings 視圖：一個 ItemView，依檔案 YAML 或全域設定挑佈局，
 * 佈局元件透過 LayoutHost 動態切換。
 */
export class HeadingsView extends ItemView {
    private host: ReturnType<typeof LayoutHost> | undefined;
    private hostState: HostState = createHostState({
        layoutId: availableLayoutIds[0] ?? "tree-table",
        tree: null,
        maxNodeWidth: this.plugin.settings.maxNodeWidth,
        maxNodeHeight: this.plugin.settings.maxNodeHeight,
        mindmapDirection: this.plugin.settings.mindmapDirection,
        ...editorSizeState(this.plugin.settings),
        defaultLit: new Set(defaultLitTypes(this.plugin.settings)),
        branchBorder: this.plugin.settings.nodeStyle.branchBorder,
        branchBackground: this.plugin.settings.nodeStyle.branchBackground,
    });
    private docService: PluginDocumentService = PluginDocumentService.create(this.plugin);
    /** 節點編輯：進出編輯模式、新增 / 刪除、復原；離開編輯後把編輯中收到的檔案內容補套上 */
    private editing = new NodeEditing(
        this.app,
        this.hostState,
        (from, to) => this.loaded?.doc.slice(from, to) ?? "",
        () => {
            if (this.pendingLoaded) this.applyLoaded(this.pendingLoaded);
        },
    );
    /** 編輯中收到的最後一份檔案內容 */
    private pendingLoaded: Loaded | null = null;

    /** 目前顯示中的檔案內容；YAML 寫入後 metadataCache.changed 會再推一次新的 */
    private loaded: Loaded | null = null;
    /** 開檔或換檔後第一次建樹時套用設定的預設展開深度 */
    private applyDefaultDepth = true;
    /** 使用者在這個 view 上剛改過、尚未等到 cache 更新的 override */
    private pendingLayout: LayoutId | null = null;
    private pendingMindmapDirection: MindmapDirection | null = null;
    private pendingNodeTypes: PromotableSectionType[] | null = null;
    /** 正在記錄狀態的檔案路徑；換檔後到第一次建樹之間是 null，那段期間的清空不算變動 */
    private memoryPath: string | null = null;
    private memorySaveTimer: number | null = null;
    private stopMemoryWatch: (() => void) | null = null;

    public state: HeadingsViewState = {
        filePath: null,
        file: null,
        doc: null,
    };

    constructor(leaf: WorkspaceLeaf, private plugin: HeadingsPlugin) {
        super(leaf);
    }

    getViewType(): string {
        return VIEW_TYPE_HEADINGS;
    }

    getDisplayText(): string {
        return this.state.file ? `${t("viewHeadings")}: ${this.state.file.basename}` : t("viewHeadings");
    }

    getIcon(): IconName {
        return VIEW_ICON_HEADINGS;
    }

    async onOpen() {
        // 佈局元件靠 flex 吃滿內容區的高度，不依賴 height: 100% 的百分比解析
        this.contentEl.addClass("headings-view-content");
        this.contentEl.setCssProps({ display: "flex", "flex-direction": "column", overflow: "hidden" });

        this.host = mount(LayoutHost, {
            target: this.contentEl,
            props: {
                state: this.hostState,
                actions: {
                    showLinks: (node: TreeNode, evt: MouseEvent) => this.showLinksMenu(node, evt),
                    showNodeMenu: (node: TreeNode, evt: MouseEvent) => this.showNodeMenu(node, evt),
                    edit: (id: string) => this.editing.startEdit(id),
                    mountEditor: (node: TreeNode, onHeight: (height: number) => void) => this.editing.mountEditor(node, onHeight),
                    measureEditor: (node: TreeNode, nodeEl: HTMLElement | undefined) => this.editing.measureEditor(node, nodeEl),
                    command: (command: NodeCommand, node: TreeNode) => void this.editing.run(command, node),
                    moveNode: (sourceId: string, targetId: string, position: DropPosition) => void this.editing.move(sourceId, targetId, position),
                    openSearch: () => this.showSearch(),
                    setSearchMode: (mode: SearchMode) => this.setSearchMode(mode),
                    // YAML 區塊畫成屬性面板；不是合法 frontmatter 就退回 markdown 渲染
                    renderFrontmatter: (text: string) => (element: HTMLElement) => {
                        element.replaceChildren();
                        const frontmatter = parseFrontmatter(text);
                        if (frontmatter) renderProperties(this.app, element, frontmatter);
                        else void MarkdownRenderer.render(this.plugin.app, text, element, this.state.file?.path ?? "", this);
                    },
                },
                getText: (from: number, to: number) => this.loaded?.doc.slice(from, to) ?? "",
                // 跟 Canvas 文字節點一樣包在閱讀模式容器裡，主題的標題字級、標籤膠囊、callout 等樣式才會套上
                onRenderMarkdown: (text: string, from: number) => (element: HTMLElement) => {
                    element.replaceChildren();
                    const host = element.createDiv({ cls: "markdown-embed-content" }).createDiv({ cls: "markdown-preview-view markdown-rendered" });
                    void MarkdownRenderer.render(this.plugin.app, text, host, this.state.file?.path ?? "", this);
                    const onClick = (evt: MouseEvent) => {
                        const target = evt.target;
                        if (!(target instanceof Element)) return;
                        // 內部連結：這不是 Markdown 視圖，Obsidian 不會替我們處理點擊，自己交給 openLinkText；同檔案的片段連結直接在視圖裡跳
                        const link = target.closest<HTMLAnchorElement>("a.internal-link");
                        if (link) {
                            evt.preventDefault();
                            const href = link.dataset.href ?? link.getAttribute("href");
                            if (href) void this.followLink(href, Keymap.isModEvent(evt));
                            return;
                        }
                        // 核取方塊：渲染出來的第 n 個對應原文第 n 個任務行；點了直接切換並寫回，畫面等 cache 更新重畫
                        if (!(target instanceof HTMLInputElement) || !target.classList.contains("task-list-item-checkbox")) return;
                        evt.stopPropagation();
                        const boxes = Array.from(host.querySelectorAll<HTMLInputElement>("input.task-list-item-checkbox"));
                        const line = taskLineOffsets(text)[boxes.indexOf(target)];
                        if (line === undefined) return;
                        void this.editing.toggleTask(from + line);
                    };
                    host.addEventListener("click", onClick);
                    return () => host.removeEventListener("click", onClick);
                },
            },
        });

        // 只有一種佈局時不顯示切換按鈕，第二種加進 registry 後自然出現
        if (LAYOUT_REGISTRY.length > 1) {
            this.addAction("layout-dashboard", t("menuLayout"), (evt) => this.showLayoutMenu(evt));
        }
        this.addAction("blocks", t("menuNodeTypes"), (evt) => this.showNodeTypesMenu(evt));
        this.addAction("layers", t("menuExpandDepth"), (evt) => this.showExpandDepthMenu(evt));
        const iconsAction = this.addAction("tags", t("menuShowIcons"), () => {
            this.hostState.showIcons = !this.hostState.showIcons;
            iconsAction.toggleClass("is-active", this.hostState.showIcons);
        });
        this.addAction("search", t("commandSearchNodes"), () => this.showSearch());

        // 節點狀態變了就排程寫入每檔記錄
        this.stopMemoryWatch = watchFileMemory(this.hostState, () => this.scheduleMemorySave());
        // 重開 Obsidian 時 setState 可能早於 metadata cache 建好；cache 好了再補讀一次
        this.registerEvent(
            this.app.metadataCache.on("resolved", () => {
                if (!this.loaded && this.state.file) void this.refresh();
            }),
        );

        // 檔案變動時（metadataCache.changed → docService.send）重建目前檔案的樹
        this.docService.subscribe((file, doc, cached) => {
            if (file.path !== this.state.file?.path) return false;
            this.applyLoaded({ file, doc, cached });
            return true;
        });

        this.registerEvent(
            this.app.metadataCache.on("changed", (file, doc, cached) => {
                void this.docService.send(file, doc, cached);
            }),
        );

        await this.refresh();
    }

    /** 存進 workspace.json 的只有路徑：TFile 不能序列化，重開 Obsidian 時在 setState 解析回來 */
    getState(): Record<string, unknown> {
        return { filePath: this.state.file?.path ?? this.state.filePath ?? null };
    }

    async setState(state: HeadingsViewState, result: ViewStateResult) {
        if (state) {
            const file = state.file instanceof TFile ? state.file : this.resolveFile(state.filePath);
            const next: HeadingsViewState = { filePath: file?.path ?? state.filePath ?? null, file, doc: state.doc ?? null };
            const fileChanged = next.file?.path !== this.state.file?.path;
            // 換檔前先把上一個檔案的記錄寫掉
            if (fileChanged) this.flushMemorySave();
            this.state = next;
            this.pendingLayout = null;
            this.pendingNodeTypes = null;
            this.pendingMindmapDirection = null;
            // 節點 id 只在同一個檔案內穩定，換檔案就清掉；清掉到第一次建樹之間不記錄
            if (fileChanged) {
                this.memoryPath = null;
                resetNodeState(this.hostState);
                this.applyDefaultDepth = true;
            }
            await this.refresh();
        }
    }

    private resolveFile(path: string | null | undefined): TFile | null {
        if (!path) return null;
        const file = this.app.vault.getAbstractFileByPath(path);
        return file instanceof TFile ? file : null;
    }

    async onClose() {
        this.flushMemorySave();
        this.stopMemoryWatch?.();
        this.stopMemoryWatch = null;
        if (this.host) {
            await unmount(this.host);
        }
    }

    // 依 state.file 讀取 doc 與 cache 重新渲染（設定變更時也走這裡）
    async refresh() {
        const program = Effect.gen({ self: this }, function* () {
            const file = yield* Effect.fromNullishOr(this.state.file);
            const { doc, cached } = yield* getFileCached(this.app, file);
            this.applyLoaded({ file, doc, cached });
        });

        await Effect.runPromiseExit(program);
    }

    /** 名字避開 Component.load() */
    private applyLoaded(loaded: Loaded) {
        // 編輯中不重建樹，離開編輯後再套最後一份；寫回時鏡像仍是進入時的快照，才能偵測外部改動
        if (this.editing.isEditing) {
            this.pendingLoaded = loaded;
            return;
        }
        this.pendingLoaded = null;
        this.loaded = loaded;
        // cache 更新後 YAML 已經是新值，pending 可以放掉
        this.pendingLayout = null;
        this.pendingNodeTypes = null;
        this.render();
        this.editing.onLoaded(loaded.file, loaded.doc);
    }

    /** 唯一的建樹路徑：adapter 建完整樹 → 依 YAML / 設定 promote → 交給 LayoutHost */
    private render() {
        if (!this.loaded) return;
        const { file, doc, cached } = this.loaded;
        this.hostState.layoutId = this.currentLayoutId();
        this.hostState.maxNodeWidth = this.plugin.settings.maxNodeWidth;
        this.hostState.defaultLit = new Set(defaultLitTypes(this.plugin.settings));
        this.hostState.branchBorder = this.plugin.settings.nodeStyle.branchBorder;
        this.hostState.branchBackground = this.plugin.settings.nodeStyle.branchBackground;
        this.hostState.maxNodeHeight = this.plugin.settings.maxNodeHeight;
        this.hostState.mindmapDirection = this.currentMindmapDirection();
        Object.assign(this.hostState, editorSizeState(this.plugin.settings));
        this.hostState.tree = promote(buildTree(cached, doc, file.name), promoteTypes(this.currentNodeTypes()), buildLinks(cached));
        if (this.applyDefaultDepth) {
            this.applyDefaultDepth = false;
            // 有記住的狀態就用記住的；沒有才套設定的預設層數（root 以下幾層；內部 depth 從 root 算起且 0 = 全部，所以加 1）
            const memory = this.plugin.settings.rememberFileViews ? this.plugin.fileViews.get(file.path) : undefined;
            if (memory) {
                restoreNodeState(this.hostState, memory);
            } else {
                const { defaultExpandEnabled, defaultExpandDepth } = this.plugin.settings;
                applyDepth(this.hostState, defaultExpandEnabled ? defaultExpandDepth + 1 : 0);
            }
            // 從這裡開始的變動才屬於這個檔案
            this.memoryPath = file.path;
        }
    }

    /** 指令「展開一層 / 收合一層」 */
    stepExpandDepth(delta: 1 | -1) {
        stepExpandDepth(this.hostState, delta);
    }

    /** 標題列按鈕、指令、Mod+F：開搜尋列，模式用上次記住的（已開著就把焦點要回來） */
    showSearch() {
        openSearch(this.hostState, this.plugin.settings.searchMode);
    }

    /** 搜尋列的漏斗鈕：切換搜尋 / 過濾，並記住給下次開啟用 */
    private setSearchMode(mode: SearchMode) {
        setSearchMode(this.hostState, mode);
        if (this.plugin.settings.searchMode !== mode) {
            this.plugin.settings.searchMode = mode;
            void this.plugin.saveSettings();
        }
    }

    /** 節點狀態變了：延遲一下再寫，連按 Space 不會每下都寫檔 */
    private scheduleMemorySave() {
        if (this.memoryPath === null || !this.plugin.settings.rememberFileViews) return;
        if (this.memorySaveTimer !== null) window.clearTimeout(this.memorySaveTimer);
        this.memorySaveTimer = window.setTimeout(() => this.flushMemorySave(), MEMORY_SAVE_DELAY);
    }

    /** 立刻把目前檔案的狀態寫進記錄（換檔、關閉視圖時） */
    private flushMemorySave() {
        if (this.memorySaveTimer !== null) {
            window.clearTimeout(this.memorySaveTimer);
            this.memorySaveTimer = null;
        }
        const path = this.memoryPath;
        if (path === null || !this.plugin.settings.rememberFileViews) return;
        void this.plugin.rememberFileView(path, snapshotNodeState(this.hostState));
    }

    /** header 的「展開層級」選單：1 層 … 最大深度、全部 */
    private showExpandDepthMenu(evt: MouseEvent) {
        const max = visibleMaxDepth(this.hostState);
        const current = this.hostState.expandDepth;
        const menu = new Menu();
        // 選單上的數字是 root 以下幾層，與設定一致；內部 depth 1 = 只展開 root
        for (let depth = 1; depth < max; depth++) {
            menu.addItem((item) =>
                item
                    .setTitle(depth === 1 ? t("expandDepthRootOnly") : t("menuExpandDepthLevel").replace("{n}", String(depth - 1)))
                    .setChecked(current === depth)
                    .onClick(() => applyDepth(this.hostState, depth)),
            );
        }
        menu.addItem((item) =>
            item
                .setTitle(t("menuExpandDepthAll"))
                .setChecked(current === 0)
                .onClick(() => applyDepth(this.hostState, 0)),
        );
        menu.showAtMouseEvent(evt);
    }

    /** 在 Markdown 編輯器裡定位到節點那一行的行首（根節點到檔案開頭）；分頁的尋找與開啟交給 docService */
    private async locateInMarkdown(node: TreeNode) {
        const file = this.loaded?.file;
        if (!file) return;
        const offset = node.kind === "root" ? 0 : node.range.from;
        await this.docService.reveal(file, offset, offset);
    }

    /**
     * 節點右鍵 / 「…」選單：定位、編輯與結構操作、收合其他、以此為根、展開 / 收合子樹。
     * 過濾模式裡兄弟與後代被藏起來，結構操作與收合相關的項目變灰（留在原位，讓人知道有這個功能）；以此為根是繼續縮小範圍，保留。
     */
    private showNodeMenu(node: TreeNode, evt: MouseEvent) {
        const state = this.hostState;
        const isVisibleRoot = visibleRoot(state)?.id === node.id;
        const filtering = state.search?.mode === "filter";
        const menu = new Menu();
        menu.addItem((item) => item.setTitle(t("nodeMenuLocate")).setIcon("file-text").onClick(() => void this.locateInMarkdown(node)));
        menu.addSeparator();
        menu.addItem((item) => item.setTitle(t("nodeMenuEdit")).setIcon("pencil").onClick(() => this.editing.startEdit(node.id)));
        menu.addItem((item) =>
            item
                .setTitle(t("nodeMenuAddSibling"))
                .setIcon("list-plus")
                .setDisabled(filtering || node.kind === "root")
                .onClick(() => void this.editing.run("addSibling", node)),
        );
        menu.addItem((item) =>
            item
                .setTitle(t("nodeMenuAddChild"))
                .setIcon("git-branch-plus")
                .setDisabled(filtering || node.kind === "section")
                .onClick(() => void this.editing.run("addChild", node)),
        );
        menu.addItem((item) =>
            item
                .setTitle(t("nodeMenuDelete"))
                .setIcon("trash")
                .setDisabled(filtering || node.kind === "root")
                .onClick(() => void this.editing.run("delete", node)),
        );
        menu.addSeparator();
        menu.addItem((item) =>
            item.setTitle(t("nodeMenuCollapseOthers")).setIcon("fold-vertical").setDisabled(filtering).onClick(() => applyCollapseOthers(state, node.id)),
        );
        menu.addItem((item) =>
            item
                .setTitle(t("nodeMenuFocus"))
                .setIcon("crosshair")
                // heading 與 list item 都能當根（葉節點也可以，用來單獨看一段內容）；升級的一般段落不行；已經是根就沒必要
                .setDisabled(!(node.kind === "heading" || node.kind === "root" || node.kind === "listItem") || isVisibleRoot)
                .onClick(() => setFocus(state, node.id)),
        );
        menu.addSeparator();
        menu.addItem((item) =>
            item
                .setTitle(t("nodeMenuExpandSubtree"))
                .setIcon("chevrons-up-down")
                .setDisabled(filtering || node.children.length === 0)
                .onClick(() => applyExpandSubtree(state, node.id)),
        );
        menu.addItem((item) =>
            item
                .setTitle(t("nodeMenuCollapseSubtree"))
                .setIcon("chevrons-down-up")
                .setDisabled(filtering || node.children.length === 0)
                .onClick(() => applyCollapseSubtree(state, node.id)),
        );
        menu.showAtMouseEvent(evt);
    }

    /**
     * 節點內連結的選單：同檔案的 #片段 連結在這個視圖裡跳到對應節點；
     * 其他檔案的連結在新的分割 leaf 開該檔的 Headings 視圖，解析不到檔案的顯示但不可點。
     */
    private showLinksMenu(node: TreeNode, evt: MouseEvent) {
        if (node.links.length === 0) return;
        const sourcePath = this.state.file?.path ?? "";
        const menu = new Menu();
        for (const link of node.links) {
            const linkpath = link.target.split("#")[0] ?? "";
            menu.addItem((item) => {
                item.setTitle(link.display).setIcon(link.embed ? EMBED_ICON : LINK_ICON);
                if (linkpath === "") {
                    item.onClick(() => void this.followLink(link.target));
                    return;
                }
                const target = this.app.metadataCache.getFirstLinkpathDest(linkpath, sourcePath);
                if (target) item.onClick(() => void this.openInSplit(target));
                else item.setDisabled(true);
            });
        }
        menu.showAtMouseEvent(evt);
    }

    /** 跟著連結走：同檔案的 #標題 / #^區塊 對得到節點就在視圖裡選取並帶到畫面上，否則交給 Obsidian 開 */
    private async followLink(target: string, newLeaf: PaneType | boolean = false) {
        if (target.startsWith("#") && this.revealSubpath(target)) return;
        await this.app.workspace.openLinkText(target, this.state.file?.path ?? "", newLeaf);
    }

    /** 把 #片段 解析成文件位置，找含該位置的最深節點；解析不到或沒有對應節點回傳 false */
    private revealSubpath(subpath: string): boolean {
        const tree = this.hostState.tree;
        const cached = this.loaded?.cached;
        if (!tree || !cached) return false;
        const resolved = resolveSubpath(cached, subpath);
        if (!resolved) return false;
        const node = nodeAtOffset(tree, resolved.start.offset);
        if (!node) return false;
        revealNode(this.hostState, node.id);
        return true;
    }

    private async openInSplit(file: TFile) {
        const leaf = this.app.workspace.getLeaf("split");
        const state: HeadingsViewState = { filePath: file.path, file, doc: null };
        await leaf.setViewState({ type: VIEW_TYPE_HEADINGS, active: true, state });
        await this.app.workspace.revealLeaf(leaf);
    }

    private currentLayoutId(): LayoutId {
        return this.pendingLayout
            ?? resolveLayoutId(this.loaded?.cached.frontmatter, this.plugin.settings, Platform.isMobile, availableLayoutIds);
    }

    private currentNodeTypes(): PromotableSectionType[] {
        return this.pendingNodeTypes ?? resolveNodeTypes(this.loaded?.cached.frontmatter, this.plugin.settings);
    }

    private currentMindmapDirection(): MindmapDirection {
        return this.pendingMindmapDirection ?? resolveMindmapDirection(this.loaded?.cached.frontmatter, this.plugin.settings);
    }

    /** 佈局選單：三種佈局，加一個「心智圖只往右」的勾選項（任何佈局下都看得到，只在心智圖生效） */
    private showLayoutMenu(evt: MouseEvent) {
        const current = this.currentLayoutId();
        const menu = new Menu();
        for (const entry of LAYOUT_REGISTRY) {
            menu.addItem((item) =>
                item
                    .setTitle(layoutLabel[entry.id]())
                    .setIcon(entry.icon)
                    .setChecked(entry.id === current)
                    .onClick(() => this.chooseLayout(entry.id)),
            );
        }
        menu.addSeparator();
        const right = this.currentMindmapDirection() === "right";
        menu.addItem((item) =>
            item
                .setTitle(t("menuMindmapRight"))
                .setIcon("arrow-right-from-line")
                .setChecked(right)
                .onClick(() => this.chooseMindmapDirection(right ? "both" : "right")),
        );
        menu.showAtMouseEvent(evt);
    }

    private chooseMindmapDirection(direction: MindmapDirection) {
        this.pendingMindmapDirection = direction;
        this.render();
        void this.writeFrontmatter(FM_MINDMAP_DIRECTION_KEY, direction);
    }

    private showNodeTypesMenu(evt: MouseEvent) {
        const current = new Set(this.currentNodeTypes());
        const menu = new Menu();
        for (const type of PROMOTABLE_SECTION_TYPES) {
            menu.addItem((item) =>
                item
                    .setTitle(sectionTypeLabel[type]())
                    .setChecked(current.has(type))
                    .onClick(() => {
                        const next = new Set(current);
                        if (next.has(type)) next.delete(type); else next.add(type);
                        this.chooseNodeTypes(PROMOTABLE_SECTION_TYPES.filter((t) => next.has(t)));
                    }),
            );
        }
        menu.showAtMouseEvent(evt);
    }

    /** 先立即套用，再寫進 YAML；cache 更新後會以 YAML 的值重算 */
    private chooseLayout(id: LayoutId) {
        this.pendingLayout = id;
        this.render();
        void this.writeFrontmatter(FM_LAYOUT_KEY, id);
    }

    private chooseNodeTypes(types: PromotableSectionType[]) {
        this.pendingNodeTypes = types;
        this.render();
        void this.writeFrontmatter(FM_NODES_KEY, types);
    }

    /** 只在使用者實際改動時寫入；沒有 frontmatter 的檔案會被建立一個 */
    private async writeFrontmatter(key: string, value: unknown) {
        const file = this.state.file;
        if (!file) return;
        try {
            await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
                fm[key] = value;
            });
        } catch (error) {
            console.error("headings: failed to write frontmatter", error);
        }
    }
}
