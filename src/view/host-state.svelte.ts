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
	/** 子樹被收合的節點 */
	collapsed: SvelteSet<string>;
	/** 點開 icon 列的節點 */
	iconsOpen: SvelteSet<string>;
	/** 每個節點被點亮（顯示內容）的 section 型別 */
	litTypes: SvelteMap<string, ReadonlySet<string>>;
};

export function createHostState(init: Pick<HostState, "layoutId" | "tree" | "maxNodeWidth">): HostState {
	const state = $state<HostState>({
		...init,
		showIcons: false,
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
}
