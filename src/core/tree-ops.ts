import type { TreeNode } from "./tree";

/**
 * 針對「子樹收合集合」的純運算：展開到第 N 層、收合其他、聚焦子樹。
 * 全部回傳新的 Set，不改輸入；view 層再把結果寫回 HostState。
 */

/** 以 id 找節點，找不到回傳 null */
export const findNode = (root: TreeNode, id: string): TreeNode | null => {
    if (root.id === id) return root;
    for (const child of root.children) {
        const found = findNode(child, id);
        if (found) return found;
    }
    return null;
};

/** root 到目標節點的路徑（含兩端）；找不到回傳空陣列 */
export const pathTo = (root: TreeNode, id: string): TreeNode[] => {
    if (root.id === id) return [root];
    for (const child of root.children) {
        const path = pathTo(child, id);
        if (path.length > 0) return [root, ...path];
    }
    return [];
};

/** 樹的最大深度，root 為 0；只有 root 時為 0 */
export const maxDepth = (root: TreeNode): number =>
    root.children.reduce((max, child) => Math.max(max, 1 + maxDepth(child)), 0);

/** 走訪子樹內每個節點並附上深度（root 為 0） */
const walk = (root: TreeNode, visit: (node: TreeNode, depth: number) => void, depth = 0) => {
    visit(root, depth);
    for (const child of root.children) walk(child, visit, depth + 1);
};

/**
 * 展開到第 depth 層：深度 >= depth 且有子節點的收合，其餘展開。
 * depth 為 0 代表全部展開。只動 root 子樹內的節點，子樹外的收合狀態照舊。
 */
export const withDepth = (root: TreeNode, depth: number, current: ReadonlySet<string>): Set<string> => {
    const next = new Set(current);
    walk(root, (node, d) => {
        if (node.children.length === 0) return;
        if (depth > 0 && d >= depth) next.add(node.id);
        else next.delete(node.id);
    });
    return next;
};

/**
 * 收合其他節點：路徑上的節點（祖先與目標）保持展開，其他有子節點的全部收合。
 * 「其他」包含目標的後代，所以結果是只看到目標的直接子節點；點 root 等於收合到第 1 層。
 * 目標不在 root 底下時原樣回傳。
 */
export const collapseOthers = (root: TreeNode, id: string, current: ReadonlySet<string>): Set<string> => {
    const path = pathTo(root, id);
    if (path.length === 0) return new Set(current);
    const onPath = new Set(path.map((node) => node.id));

    const next = new Set(current);
    walk(root, (node) => {
        if (onPath.has(node.id)) next.delete(node.id);
        else if (node.children.length > 0) next.add(node.id);
    });
    return next;
};

/** 展開目標與其所有後代 */
export const expandSubtree = (target: TreeNode, current: ReadonlySet<string>): Set<string> => {
    const next = new Set(current);
    walk(target, (node) => next.delete(node.id));
    return next;
};

/** 收合目標與其所有有子節點的後代 */
export const collapseSubtree = (target: TreeNode, current: ReadonlySet<string>): Set<string> => {
    const next = new Set(current);
    walk(target, (node) => {
        if (node.children.length > 0) next.add(node.id);
    });
    return next;
};

/**
 * 「展開一層 / 收合一層」的下一個層數。current 為 0 代表全部展開。
 * 往上到最大深度即為全部（0）；往下最少到 1；從全部往下等於最大深度減 1。
 */
export const stepDepth = (current: number, delta: 1 | -1, max: number): number => {
    if (max <= 1) return 0;
    if (delta > 0) {
        if (current === 0) return 0;
        const next = current + 1;
        return next >= max ? 0 : next;
    }
    const next = current === 0 ? max - 1 : current - 1;
    return Math.max(1, next);
};

/** 展開目標的所有祖先（不含目標自己），讓目標在佈局裡看得到 */
export const expandPath = (root: TreeNode, id: string, current: ReadonlySet<string>): Set<string> => {
    const next = new Set(current);
    const path = pathTo(root, id);
    for (const node of path.slice(0, -1)) next.delete(node.id);
    return next;
};
