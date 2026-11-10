import type { LayoutId } from "../layout/layout";
import type { TreeNode } from "../core/tree";

/** ItemView 與 Svelte 之間共享的反應式狀態；view 改這個物件，LayoutHost 就重新渲染 */
export type HostState = {
	layoutId: LayoutId;
	tree: TreeNode | null;
	maxNodeWidth: number;
};

export function createHostState(init: HostState): HostState {
	const state = $state(init);
	return state;
}
