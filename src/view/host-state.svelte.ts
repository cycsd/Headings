import { SvelteMap, SvelteSet } from "svelte/reactivity";
import type { LayoutId } from "../layout/layout";
import type { TreeNode } from "../core/tree";

/**
 * ItemView 與 Svelte 之間共享的反應式狀態；view 改這個物件，LayoutHost 就重新渲染。
 * 節點層級的狀態都以穩定 id 為 key，三種佈局共用，切換佈局或重新解析時不會丟。
 */
export type HostState = {
	layoutId: LayoutId;
	tree: TreeNode | null;
	maxNodeWidth: number;
	/** view 層級：永遠顯示 icon 列，跳過徽章 */
	showIcons: boolean;
	/** 全域設定：節點還沒被手動切換前預設點亮的型別 */
	defaultLit: ReadonlySet<string>;
	/** 全域設定：節點邊框 / 背景是否套用分支顏色 */
	branchBorder: boolean;
	branchBackground: boolean;
	/** 全域設定：內容區最大高度 (px)，0 為不限制 */
	maxNodeHeight: number;
	/** 聚焦中的節點 id；null 為完整樹 */
	focusId: string | null;
	/** 最後一次套用的展開層數（0 = 全部），「展開一層 / 收合一層」的基準 */
	expandDepth: number;
	/** 子樹被收合的節點 */
	collapsed: SvelteSet<string>;
	/** 點開 icon 列的節點 */
	iconsOpen: SvelteSet<string>;
	/** 每個節點被點亮（顯示內容）的 section 型別 */
	litTypes: SvelteMap<string, ReadonlySet<string>>;
};

export function createHostState(
	init: Pick<HostState, "layoutId" | "tree" | "maxNodeWidth" | "maxNodeHeight" | "defaultLit" | "branchBorder" | "branchBackground">,
): HostState {
	const state = $state<HostState>({
		...init,
		showIcons: false,
		focusId: null,
		expandDepth: 0,
		collapsed: new SvelteSet<string>(),
		iconsOpen: new SvelteSet<string>(),
		litTypes: new SvelteMap<string, ReadonlySet<string>>(),
	});
	return state;
}

/** 換檔案時清掉所有節點層級的狀態 */
export function resetNodeState(state: HostState) {
	state.collapsed.clear();
	state.iconsOpen.clear();
	state.litTypes.clear();
	state.focusId = null;
	state.expandDepth = 0;
}
