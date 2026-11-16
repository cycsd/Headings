import { contentRange, type TreeNode } from "./tree";

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

/**
 * 含文件位置 offset 的最深節點；heading 的範圍算到留在內容區的最後一個 section，和畫面上畫的一致。
 * 同檔案的 #標題 / #^區塊 連結解析成位置後，用這個決定要跳到哪個節點；找不到回傳 null。
 */
export const nodeAtOffset = (root: TreeNode, offset: number): TreeNode | null => {
    for (const child of root.children) {
        const found = nodeAtOffset(child, offset);
        if (found) return found;
    }
    const { from, to } = contentRange(root);
    return from <= offset && (offset < to || offset === from) ? root : null;
};

/** 子樹內所有節點的 id（含 root） */
export const allIds = (root: TreeNode): Set<string> => {
    const ids = new Set<string>();
    const walkIds = (node: TreeNode) => {
        ids.add(node.id);
        node.children.forEach(walkIds);
    };
    walkIds(root);
    return ids;
};

/**
 * 搜尋過濾：只留命中的節點和它們的祖先，其他子樹整個拿掉；root 一定留著。
 * hits 是命中的 id（不含只是路過的祖先），依文件順序（前序）。沒變動的子樹沿用原物件，佈局才不會整棵重畫。
 */
export const filterTree = (root: TreeNode, match: (node: TreeNode) => boolean): { tree: TreeNode; hits: string[] } => {
    const hits: string[] = [];
    const prune = (node: TreeNode): TreeNode | null => {
        const hit = node !== root && match(node);
        if (hit) hits.push(node.id);
        const children = node.children.map(prune).filter((child): child is TreeNode => child !== null);
        if (!hit && children.length === 0) return null;
        const unchanged = children.length === node.children.length && children.every((child, i) => child === node.children[i]);
        return unchanged ? node : { ...node, children };
    };
    const tree = prune(root) ?? { ...root, children: [] };
    return { tree, hits };
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

/** 拖曳落點預覽用的佔位節點 id；佈局把它當一般節點排，節點元件畫成虛線框 */
export const DROP_PLACEHOLDER_ID = "__drop_placeholder__";

/**
 * 回傳一棵多一個佔位節點的樹：into 放在 target 的 children 最後，before / after 插在 target 父節點的 children 裡 target 的前 / 後。
 * 只淺拷貝 root 到被改 children 的那個節點的路徑，其他節點共用。target 不存在、或 target 是 root 卻要插前後，就原樣回傳。
 */
export const withDropPlaceholder = (root: TreeNode, targetId: string, position: "into" | "before" | "after" = "into"): TreeNode =>
    insertNodeAt(root, targetId, position, {
        id: DROP_PLACEHOLDER_ID,
        kind: "section",
        sectionType: "paragraph",
        title: null,
        range: { from: 0, to: 0 },
        sections: [],
        links: [],
        children: [],
    });

/** 把任意節點放進樹：位置規則與路徑拷貝同 withDropPlaceholder（拖曳佔位與新增節點的虛擬節點共用） */
export const insertNodeAt = (root: TreeNode, targetId: string, position: "into" | "before" | "after", placeholder: TreeNode): TreeNode => {
    let path = pathTo(root, targetId);
    if (path.length === 0) return root;
    let children: TreeNode[];
    if (position === "into") {
        children = [...path[path.length - 1]!.children, placeholder];
    } else {
        if (path.length < 2) return root;
        const target = path[path.length - 1]!;
        path = path.slice(0, -1);
        children = [...path[path.length - 1]!.children];
        const index = children.findIndex((c) => c.id === target.id);
        children.splice(position === "before" ? index : index + 1, 0, placeholder);
    }
    let rebuilt: TreeNode = { ...path[path.length - 1]!, children };
    for (let i = path.length - 2; i >= 0; i--) {
        const node = path[i]!;
        rebuilt = { ...node, children: node.children.map((c) => (c.id === path[i + 1]!.id ? rebuilt : c)) };
    }
    return rebuilt;
};

/** 新增節點在編輯期間的虛擬節點 id：檔案還沒寫入，畫面上先放這個節點讓使用者打字，離開編輯才寫入 */
export const NEW_NODE_ID = "__new_node__";

/**
 * 新增節點的虛擬節點：anchor 是新增動作所在的節點，position 是 after（兄弟）或 into（子節點），text 是編輯器起始文字。
 * 種類跟寫入檔案後會長成的一樣：標題層級同兄弟 / 加一層、清單項、升級段落。
 */
export const makeNewNode = (anchor: TreeNode, position: "after" | "into", text: string): TreeNode => {
    const base = { id: NEW_NODE_ID, range: { from: 0, to: 0 }, sections: [], links: [], children: [] };
    if (anchor.kind === "listItem") return { ...base, kind: "listItem", title: null, text };
    if (anchor.kind === "section") return { ...base, kind: "section", title: null, sectionType: "paragraph" };
    const level = position === "after" ? (anchor.level ?? 1) : Math.min(6, (anchor.level ?? 0) + 1);
    return { ...base, kind: "heading", level, title: "" };
};
