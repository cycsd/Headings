import type { TreeNode } from "../core/tree";
import { collapseOthers, collapseSubtree, expandSubtree, findNode, maxDepth, stepDepth, withDepth } from "../core/tree-ops";
import type { HostState } from "./host-state.svelte";

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

const replaceCollapsed = (state: HostState, next: ReadonlySet<string>) => {
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
