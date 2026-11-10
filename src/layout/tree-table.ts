import type { TreeNode } from "../core/tree";
import { visibleChildren, type Layout, type LayoutOptions } from "./layout";

/** CSS grid 中的一個 cell，用 grid-column / grid-row 的起點與 span 定位（都從 0 起算） */
export type TreeTableCell = {
    node: TreeNode;
    depth: number;
    row: number;
    rowSpan: number;
    colSpan: number;
    /** 所屬頂層分支的序號，用來決定顏色 */
    branch: number;
};

export type TreeTablePlacement = {
    /** 欄數，至少 1 */
    columns: number;
    /** 不含 root；root 另外畫成 header 列 */
    cells: TreeTableCell[];
};

export const countLeaves = (node: TreeNode, options?: LayoutOptions): number => {
    const children = visibleChildren(node, options);
    if (children.length === 0) return 1;
    return children.reduce((sum, child) => sum + countLeaves(child, options), 0);
};

export const maxDepth = (node: TreeNode, options?: LayoutOptions, depth = 1): number => {
    const children = visibleChildren(node, options);
    if (children.length === 0) return depth;
    return Math.max(...children.map((child) => maxDepth(child, options, depth + 1)));
};

/**
 * 將樹狀結構攤平成一維 cell 清單。
 * 沒有子節點的 node 其 colSpan 補滿剩餘欄位，讓每一列右側都能對齊到最後一欄。
 */
export const treeTableLayout: Layout<TreeTablePlacement> = (root, options) => {
    const topLevel = visibleChildren(root, options);
    const columns = topLevel.length > 0 ? Math.max(...topLevel.map((child) => maxDepth(child, options))) : 1;
    const cells: TreeTableCell[] = [];

    const place = (node: TreeNode, depth: number, row: number, branch: number): number => {
        const leaves = countLeaves(node, options);
        const children = visibleChildren(node, options);
        const colSpan = children.length === 0 ? columns - depth : 1;

        cells.push({ node, depth, row, rowSpan: leaves, colSpan, branch });

        let childRow = row;
        for (const child of children) {
            childRow = place(child, depth + 1, childRow, branch);
        }
        return row + leaves;
    };

    let rowCursor = 0;
    topLevel.forEach((node, branch) => {
        rowCursor = place(node, 0, rowCursor, branch);
    });

    return { columns, cells };
};
