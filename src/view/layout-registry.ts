import type { Component } from "svelte";
import type { IconName } from "obsidian";
import type { LayoutId } from "../layout/layout";
import type { LayoutProps } from "./layout-props";
import TreeTable from "./TreeTable.svelte";
import MindMap from "./MindMap.svelte";
import Outline from "./Outline.svelte";

export type LayoutEntry = {
	id: LayoutId;
	icon: IconName;
	component: Component<LayoutProps>;
};

/**
 * 已實作的佈局。順序即為切換選單的順序，第一個是找不到其他選擇時的退路。
 */
export const LAYOUT_REGISTRY: readonly LayoutEntry[] = [
	{ id: "mindmap", icon: "git-fork", component: MindMap },
	{ id: "tree-table", icon: "list-tree", component: TreeTable },
	{ id: "outline", icon: "list", component: Outline },
];

export const availableLayoutIds: readonly LayoutId[] = LAYOUT_REGISTRY.map((entry) => entry.id);

export const getLayout = (id: LayoutId): LayoutEntry =>
	LAYOUT_REGISTRY.find((entry) => entry.id === id) ?? LAYOUT_REGISTRY[0]!;
