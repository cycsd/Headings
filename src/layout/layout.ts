import type { TreeNode } from "../core/tree";

/** 可選的佈局；也是 YAML `headings-layout` 的值 */
export const LAYOUT_IDS = ["mindmap", "tree-table", "outline"] as const;
export type LayoutId = (typeof LAYOUT_IDS)[number];

/** 所有佈局共用的輸入選項 */
export type LayoutOptions = {
    /** 子樹被收合的節點 id；收合的節點在佈局中視為葉節點 */
    collapsed?: ReadonlySet<string>;
};

/** 佈局是純函式：樹 + 選項 → 放置結果。不碰 DOM。 */
export type Layout<Out, Options extends LayoutOptions = LayoutOptions> = (root: TreeNode, options?: Options) => Out;

export const isCollapsed = (node: TreeNode, options?: LayoutOptions): boolean =>
    options?.collapsed?.has(node.id) ?? false;

/** 佈局要走訪的子節點（收合時為空） */
export const visibleChildren = (node: TreeNode, options?: LayoutOptions): TreeNode[] =>
    isCollapsed(node, options) ? [] : node.children;
