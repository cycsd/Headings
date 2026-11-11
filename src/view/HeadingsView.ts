import { type CachedMetadata, type IconName, ItemView, MarkdownRenderer, Menu, Platform, TFile, type ViewStateResult, WorkspaceLeaf } from "obsidian";
import { mount, unmount } from "svelte";
import { Effect } from "effect";
import type HeadingsPlugin from "../main";
import LayoutHost from "./LayoutHost.svelte";
import { createHostState, resetNodeState, type HostState } from "./host-state.svelte";
import { LAYOUT_REGISTRY, availableLayoutIds } from "./layout-registry";
import { FM_LAYOUT_KEY, FM_NODES_KEY, resolveLayoutId, resolveNodeTypes } from "./view-config";
import { EMBED_ICON, LINK_ICON } from "./section-icons";
import { parseFrontmatter, renderProperties } from "./frontmatter-properties";
import { PluginDocumentService } from "../service/document-service";
import { getFileCached } from "../extension/app";
import { buildLinks, buildTree } from "../adapter/obsidian-tree";
import { promote, promoteTypes, type TreeNode } from "../core/tree";
import { PROMOTABLE_SECTION_TYPES, type PromotableSectionType } from "../core/section-types";
import type { LayoutId } from "../layout/layout";
import { layoutLabel, sectionTypeLabel } from "../labels";
import { defaultLitTypes } from "../settings-model";
import { t } from "../i18n";
import {
    applyCollapseOthers,
    applyCollapseSubtree,
    applyDepth,
    applyExpandSubtree,
    setFocus,
    stepExpandDepth,
    visibleMaxDepth,
    visibleRoot,
} from "./tree-state";


export type HeadingsViewState = {
    filePath: string | null;
    file: TFile | null;
    doc: string | null;
};

export const VIEW_TYPE_HEADINGS = "headings-view";

//obsidian base 使用 list-tree 當作 icon
export const VIEW_ICON_HEADINGS: IconName = "list-tree";

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
        defaultLit: new Set(defaultLitTypes(this.plugin.settings)),
        branchBorder: this.plugin.settings.nodeStyle.branchBorder,
        branchBackground: this.plugin.settings.nodeStyle.branchBackground,
    });
    private docService: PluginDocumentService = PluginDocumentService.create(this.plugin);

    /** 目前顯示中的檔案內容；YAML 寫入後 metadataCache.changed 會再推一次新的 */
    private loaded: Loaded | null = null;
    /** 開檔或換檔後第一次建樹時套用設定的預設展開深度 */
    private applyDefaultDepth = true;
    /** 使用者在這個 view 上剛改過、尚未等到 cache 更新的 override */
    private pendingLayout: LayoutId | null = null;
    private pendingNodeTypes: PromotableSectionType[] | null = null;

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
                    // YAML 區塊畫成屬性面板；不是合法 frontmatter 就退回 markdown 渲染
                    renderFrontmatter: (text: string) => (element: HTMLElement) => {
                        element.replaceChildren();
                        const frontmatter = parseFrontmatter(text);
                        if (frontmatter) renderProperties(this.app, element, frontmatter);
                        else void MarkdownRenderer.render(this.plugin.app, text, element, this.state.file?.path ?? "", this);
                    },
                },
                getText: (from: number, to: number) => this.loaded?.doc.slice(from, to) ?? "",
                onRenderMarkdown: (text: string) => (element: HTMLElement) => {
                    element.replaceChildren();
                    void MarkdownRenderer.render(this.plugin.app, text, element, this.state.file?.path ?? "", this);
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

    async setState(state: HeadingsViewState, result: ViewStateResult) {
        if (state) {
            const fileChanged = state.file?.path !== this.state.file?.path;
            this.state = state;
            this.pendingLayout = null;
            this.pendingNodeTypes = null;
            // 節點 id 只在同一個檔案內穩定，換檔案就清掉
            if (fileChanged) {
                resetNodeState(this.hostState);
                this.applyDefaultDepth = true;
            }
            await this.refresh();
        }
    }

    async onClose() {
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
        this.loaded = loaded;
        // cache 更新後 YAML 已經是新值，pending 可以放掉
        this.pendingLayout = null;
        this.pendingNodeTypes = null;
        this.render();
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
        this.hostState.tree = promote(buildTree(cached, doc, file.name), promoteTypes(this.currentNodeTypes()), buildLinks(cached));
        if (this.applyDefaultDepth) {
            this.applyDefaultDepth = false;
            applyDepth(this.hostState, this.plugin.settings.defaultExpandDepth);
        }
    }

    /** 指令「展開一層 / 收合一層」 */
    stepExpandDepth(delta: 1 | -1) {
        stepExpandDepth(this.hostState, delta);
    }

    /** header 的「展開層級」選單：1 層 … 最大深度、全部 */
    private showExpandDepthMenu(evt: MouseEvent) {
        const max = visibleMaxDepth(this.hostState);
        const current = this.hostState.expandDepth;
        const menu = new Menu();
        for (let depth = 1; depth < max; depth++) {
            menu.addItem((item) =>
                item
                    .setTitle(t("menuExpandDepthLevel").replace("{n}", String(depth)))
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

    /** 節點右鍵 / 「…」選單：收合其他、以此為根、展開 / 收合子樹 */
    private showNodeMenu(node: TreeNode, evt: MouseEvent) {
        const state = this.hostState;
        const isVisibleRoot = visibleRoot(state)?.id === node.id;
        const menu = new Menu();
        menu.addItem((item) =>
            item.setTitle(t("nodeMenuCollapseOthers")).setIcon("fold-vertical").onClick(() => applyCollapseOthers(state, node.id)),
        );
        menu.addItem((item) =>
            item
                .setTitle(t("nodeMenuFocus"))
                .setIcon("crosshair")
                // 葉節點當根沒東西可畫；已經是根就沒必要
                .setDisabled(node.children.length === 0 || isVisibleRoot)
                .onClick(() => setFocus(state, node.id)),
        );
        menu.addSeparator();
        menu.addItem((item) =>
            item
                .setTitle(t("nodeMenuExpandSubtree"))
                .setIcon("chevrons-up-down")
                .setDisabled(node.children.length === 0)
                .onClick(() => applyExpandSubtree(state, node.id)),
        );
        menu.addItem((item) =>
            item
                .setTitle(t("nodeMenuCollapseSubtree"))
                .setIcon("chevrons-down-up")
                .setDisabled(node.children.length === 0)
                .onClick(() => applyCollapseSubtree(state, node.id)),
        );
        menu.showAtMouseEvent(evt);
    }

    /**
     * 節點內連結的選單：同檔案的 #片段 連結開不了別的心智圖所以略過，
     * 解析不到檔案的顯示但不可點，點了在新的分割 leaf 開該檔的 Headings 視圖。
     */
    private showLinksMenu(node: TreeNode, evt: MouseEvent) {
        const sourcePath = this.state.file?.path ?? "";
        const menu = new Menu();
        let count = 0;
        for (const link of node.links) {
            const linkpath = link.target.split("#")[0] ?? "";
            if (linkpath === "") continue;
            const target = this.app.metadataCache.getFirstLinkpathDest(linkpath, sourcePath);
            count += 1;
            menu.addItem((item) => {
                item.setTitle(link.display).setIcon(link.embed ? EMBED_ICON : LINK_ICON);
                if (target) {
                    item.onClick(() => void this.openInSplit(target));
                } else {
                    item.setDisabled(true);
                }
            });
        }
        if (count === 0) return;
        menu.showAtMouseEvent(evt);
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
        menu.showAtMouseEvent(evt);
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
