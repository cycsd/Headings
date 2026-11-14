import { SvelteMap, SvelteSet } from "svelte/reactivity";
import type { LayoutId } from "../layout/layout";
import type { TreeNode } from "../core/tree";

export type RevealMode = "center" | "ensure";

export type DragState = {
	sourceId: string;
	/** 來源與它所有後代的 id，畫面上一起淡化 */
	subtreeIds: ReadonlySet<string>;
	/** 來源節點未縮放的尺寸，落點佔位框用同樣大小 */
	size: { w: number; h: number };
	/** 游標位置（螢幕座標） */
	x: number;
	y: number;
	/** 游標下合法的目標節點，沒有就 null */
	overId: string | null;
};

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
	/** 點選的節點 id，麵包屑顯示它的路徑；null 為還沒選 */
	selectedId: string | null;
	/** 要求佈局把節點帶到畫面上；seq 遞增讓同一個 id 也能再觸發。center 置中、ensure 只在看不到時最小平移 */
	reveal: { id: string; seq: number; mode: RevealMode } | null;
	/** 正在節點內編輯的節點 id */
	editingId: string | null;
	/** 拖曳中的狀態；物件在整段拖曳裡不換，只改欄位，讀 sourceId 的節點才不會跟著游標重算 */
	drag: DragState | null;
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
		selectedId: null,
		reveal: null,
		editingId: null,
		drag: null,
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
	state.selectedId = null;
	state.reveal = null;
	state.editingId = null;
	state.drag = null;
}
