import { countNodes, type TreeNode } from "../core/tree";
import { visibleChildren, type Layout, type LayoutOptions } from "./layout";

/**
 * 大綱佈局：縱向排列、依深度縮排，連線由 view 用 CSS 畫。
 * 這裡只決定每一列要畫哪些線，不算座標，所以不需要量尺寸，手機上最省。
 * 連線的尺寸常數參考 Pele outline 模式：INDENT 28 / STEM 12 / BEND 8。
 */

export const OUTLINE_INDENT = 28;
export const OUTLINE_STEM = 12;
export const OUTLINE_BEND = 8;

export type OutlineRow = {
    node: TreeNode;
    /** root 為 0 */
    depth: number;
    /** 所屬頂層分支的序號（root 為 -1） */
    branch: number;
    /**
     * 深度 1..depth-1 的祖先是否還有後續兄弟，決定該欄要不要畫通過的垂直主幹。
     * 長度為 max(0, depth - 1)；最後一欄（depth - 1）畫的是轉角，不在這裡。
     */
    trunks: boolean[];
    /** 是不是父節點的最後一個可見子節點（決定轉角是 └ 還是 ├） */
    isLast: boolean;
    hasChildren: boolean;
    collapsed: boolean;
    /** 收合時被隱藏的後代數 */
    hiddenDescendants: number;
};

export type OutlinePlacement = {
    rows: OutlineRow[];
};

export const outlineLayout: Layout<OutlinePlacement> = (root, options) => {
    const rows: OutlineRow[] = [];

    const walk = (node: TreeNode, depth: number, branch: number, trunks: boolean[], isLast: boolean) => {
        const children = visibleChildren(node, options);
        const collapsed = node.children.length > 0 && children.length === 0;
        rows.push({
            node,
            depth,
            branch,
            trunks,
            isLast,
            hasChildren: node.children.length > 0,
            collapsed,
            hiddenDescendants: collapsed ? countNodes(node) - 1 : 0,
        });
        // root 的子節點沒有祖先主幹；更深的子節點多一欄，記錄自己這層之後還有沒有兄弟
        const childTrunks = depth === 0 ? [] : [...trunks, !isLast];
        children.forEach((child, i) => {
            walk(child, depth + 1, depth === 0 ? i : branch, childTrunks, i === children.length - 1);
        });
    };

    walk(root, 0, -1, [], true);
    return { rows };
};
