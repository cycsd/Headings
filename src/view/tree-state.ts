import type { TreeNode } from "../core/tree";
import { allIds, collapseOthers, collapseSubtree, expandPath, expandSubtree, findNode, maxDepth, stepDepth, withDepth } from "../core/tree-ops";
import type { HostState, RevealMode } from "./host-state.svelte";
import { pruneMemory, withViewport, type FileViewMemory, type ZoomPlatform } from "./view-memory";
import type { SearchMode } from "../settings-model";

/**
 * HostState 上的樹操作：聚焦、展開層級、收合其他。
 * core/tree-ops 算出新的收合集合，這裡負責寫回 SvelteSet；view 與節點選單共用。
 */

/** 目前畫的是哪棵樹：聚焦中就是該子樹，聚焦節點不存在時退回完整樹 */
export const visibleRoot = (state: HostState): TreeNode | null => {
	if (!state.tree) return null;
	if (state.focusId === null) return state.tree;
	return findNode(state.tree, state.focusId) ?? state.tree;
};

/** 寫回收合集合；內容沒變就不動，不然 clear + add 會讓所有讀 collapsed 的 derived（三種佈局的 placement）白白重算 */
const replaceCollapsed = (state: HostState, next: ReadonlySet<string>) => {
	if (next.size === state.collapsed.size && [...next].every((id) => state.collapsed.has(id))) return;
	state.collapsed.clear();
	for (const id of next) state.collapsed.add(id);
};

/** 以節點為根；傳 null 回到完整樹 */
export const setFocus = (state: HostState, id: string | null) => {
	state.focusId = id;
};

/** 展開到第 depth 層（0 = 全部），以目前畫的樹為準 */
export const applyDepth = (state: HostState, depth: number) => {
	const root = visibleRoot(state);
	if (!root) return;
	replaceCollapsed(state, withDepth(root, depth, state.collapsed));
	state.expandDepth = depth;
};

/** 目前畫的樹的最大深度 */
export const visibleMaxDepth = (state: HostState): number => {
	const root = visibleRoot(state);
	return root ? maxDepth(root) : 0;
};

/** 展開一層 / 收合一層 */
export const stepExpandDepth = (state: HostState, delta: 1 | -1) => {
	applyDepth(state, stepDepth(state.expandDepth, delta, visibleMaxDepth(state)));
};

export const applyCollapseOthers = (state: HostState, id: string) => {
	const root = visibleRoot(state);
	if (!root) return;
	replaceCollapsed(state, collapseOthers(root, id, state.collapsed));
};

export const applyExpandSubtree = (state: HostState, id: string) => {
	const target = state.tree ? findNode(state.tree, id) : null;
	if (!target) return;
	replaceCollapsed(state, expandSubtree(target, state.collapsed));
};

export const applyCollapseSubtree = (state: HostState, id: string) => {
	const target = state.tree ? findNode(state.tree, id) : null;
	if (!target) return;
	replaceCollapsed(state, collapseSubtree(target, state.collapsed));
};

/** 點選節點：只更新麵包屑，不移動畫面 */
export const selectNode = (state: HostState, id: string) => {
	state.selectedId = id;
};

/**
 * 從麵包屑選到節點：祖先全部展開、目標在聚焦子樹之外就先離開聚焦，
 * 再設為選取並要求佈局把它帶到畫面上。
 */
export const revealNode = (state: HostState, id: string, mode: RevealMode = "center", flash = true) => {
	if (!state.tree || !findNode(state.tree, id)) return;
	replaceCollapsed(state, expandPath(state.tree, id, state.collapsed));
	const focused = visibleRoot(state);
	if (state.focusId !== null && (!focused || !findNode(focused, id))) setFocus(state, null);
	state.selectedId = id;
	requestReveal(state, id, mode, flash);
};

/** 只要求佈局把（已經看得到的）節點帶到畫面上，不碰收合、聚焦與選取；編輯中節點長大時用 */
export const requestReveal = (state: HostState, id: string, mode: RevealMode, flash: boolean) => {
	state.reveal = { id, seq: (state.reveal?.seq ?? 0) + 1, mode, flash };
};

/** 每檔要記住的部分：收合、聚焦、展開層數、點亮型別，加上目前平台的視口（倍率與參考點位置；其他平台的從 previous 保留） */
export const snapshotNodeState = (state: HostState, platform: ZoomPlatform, previous: FileViewMemory | undefined): FileViewMemory =>
	withViewport(
		{
			collapsed: [...state.collapsed],
			focusId: state.focusId,
			expandDepth: state.expandDepth,
			lit: Object.fromEntries([...state.litTypes].map(([id, types]) => [id, [...types]])),
		},
		previous,
		platform,
		{ zoom: state.zoom, pan: state.pan },
	);

/** 開檔時把記住的狀態套回去；樹上已經沒有的 id 先去掉。要在 state.tree 建好之後叫 */
export const restoreNodeState = (state: HostState, memory: FileViewMemory, platform: ZoomPlatform) => {
	if (!state.tree) return;
	const pruned = pruneMemory(memory, allIds(state.tree));
	replaceCollapsed(state, new Set(pruned.collapsed));
	state.focusId = pruned.focusId;
	state.expandDepth = pruned.expandDepth;
	state.litTypes.clear();
	for (const [id, types] of Object.entries(pruned.lit)) state.litTypes.set(id, new Set(types));
	state.zoom = { ...(pruned.zoom?.[platform] ?? {}) };
	state.pan = { ...(pruned.pan?.[platform] ?? {}) };
};

/** 開搜尋列（mode 是上次記住的）；已經開著就只把焦點要回來（seq 加一），query 與模式保留 */
export const openSearch = (state: HostState, mode: SearchMode) => {
	if (!state.tree) return;
	const prev = state.search;
	state.search = prev ? { ...prev, seq: prev.seq + 1 } : { query: "", mode, current: -1, seq: 1 };
};

export const closeSearch = (state: HostState) => {
	state.search = null;
};

/** 改 query 或模式都從頭算跳轉位置 */
export const setSearchQuery = (state: HostState, query: string) => {
	if (state.search) state.search = { ...state.search, query, current: -1 };
};

export const setSearchMode = (state: HostState, mode: SearchMode) => {
	if (state.search) state.search = { ...state.search, mode, current: -1 };
};

/**
 * Enter / Shift+Enter：跳到下一個 / 上一個命中；還沒跳過就從頭 / 尾開始。order 是 LayoutHost 算好的命中順序。
 * 搜尋模式跟麵包屑選節點一樣真的展開路徑（會被每檔記住）；過濾模式收合本來就被忽略，只選取並帶到畫面上。
 */
export const stepSearch = (state: HostState, order: readonly string[], delta: 1 | -1) => {
	const search = state.search;
	if (!search || order.length === 0) return;
	const n = order.length;
	const current = search.current < 0 ? (delta > 0 ? 0 : n - 1) : (search.current + delta + n) % n;
	const id = order[current]!;
	state.search = { ...search, current };
	if (search.mode === "filter") {
		state.selectedId = id;
		requestReveal(state, id, "center", true);
	} else {
		revealNode(state, id, "center", true);
	}
};
