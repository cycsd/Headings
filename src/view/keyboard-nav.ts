import type { TreeNode } from "../core/tree";
import { pathTo } from "../core/tree-ops";
import { visibleChildren, type LayoutId } from "../layout/layout";
import { mindmapLayout, type Side } from "../layout/mindmap";

/**
 * 方向鍵在節點間移動：只在看得到的節點間走，到邊界回傳 null。
 * - 大綱 / 樹狀表格：上下是上一列 / 下一列（DFS 順序），左父、右第一個子。
 * - 心智圖：上下是同側兄弟；左右依節點在哪一側，根節點左右各到該側第一個子。
 */
export type NavKey = "up" | "down" | "left" | "right";

const flatten = (root: TreeNode, collapsed: ReadonlySet<string>): TreeNode[] => {
	const out: TreeNode[] = [];
	const walk = (node: TreeNode) => {
		out.push(node);
		for (const child of visibleChildren(node, { collapsed })) walk(child);
	};
	walk(root);
	return out;
};

const firstChild = (node: TreeNode, collapsed: ReadonlySet<string>): TreeNode | null => visibleChildren(node, { collapsed })[0] ?? null;

const parentOf = (root: TreeNode, id: string): TreeNode | null => {
	const path = pathTo(root, id);
	return path.length >= 2 ? path[path.length - 2]! : null;
};

const stepSibling = (siblings: TreeNode[], id: string, delta: 1 | -1): TreeNode | null => {
	const index = siblings.findIndex((n) => n.id === id);
	if (index < 0) return null;
	return siblings[index + delta] ?? null;
};

const navigateList = (root: TreeNode, collapsed: ReadonlySet<string>, selectedId: string, key: NavKey): TreeNode | null => {
	const rows = flatten(root, collapsed);
	const index = rows.findIndex((n) => n.id === selectedId);
	if (index < 0) return null;
	switch (key) {
		case "up":
			return rows[index - 1] ?? null;
		case "down":
			return rows[index + 1] ?? null;
		case "left":
			return parentOf(root, selectedId);
		case "right":
			return firstChild(rows[index]!, collapsed);
	}
};

const navigateMindmap = (root: TreeNode, collapsed: ReadonlySet<string>, selectedId: string, key: NavKey): TreeNode | null => {
	const placement = mindmapLayout(root, { collapsed });
	const sides = new Map<string, Side>(placement.nodes.map((p) => [p.node.id, p.side]));
	const current = placement.nodes.find((p) => p.node.id === selectedId);
	if (!current) return null;
	const node = current.node;
	const parent = parentOf(root, selectedId);

	if (key === "up" || key === "down") {
		if (!parent) return null;
		// 根節點的子節點分兩側，上下只在同一側走
		const siblings = visibleChildren(parent, { collapsed }).filter((n) => sides.get(n.id) === current.side);
		return stepSibling(siblings, selectedId, key === "down" ? 1 : -1);
	}

	const toward: Side = key === "right" ? 1 : -1;
	if (!parent) {
		return visibleChildren(node, { collapsed }).find((n) => sides.get(n.id) === toward) ?? null;
	}
	// 子節點在自己的側邊方向，父節點在反方向
	return toward === current.side ? firstChild(node, collapsed) : parent;
};

export const navigate = (
	root: TreeNode,
	collapsed: ReadonlySet<string>,
	layoutId: LayoutId,
	selectedId: string,
	key: NavKey,
): TreeNode | null => (layoutId === "mindmap" ? navigateMindmap(root, collapsed, selectedId, key) : navigateList(root, collapsed, selectedId, key));
