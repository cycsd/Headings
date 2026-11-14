import type { TreeNode } from "../core/tree";
import { visibleChildren, type Layout, type LayoutOptions } from "./layout";

/**
 * 左右平衡的心智圖佈局，演算法參考 obsidianmd/pele 的 mindmap render：
 * - 根節點置中，前幾個分支往右、其餘往左，切點選兩側高度最接近處。
 * - 子樹由下往上疊，父節點的 anchor 在第一個與最後一個子節點 anchor 的中點。
 * - 節點是 HTML，尺寸由 view 量測後透過 options.sizes 傳進來，所以這裡是兩段式：
 *   第一次用 defaultSize 排，量到實際尺寸後再排一次。
 * 純函式，不碰 DOM。
 */

export type Size = { w: number; h: number };

export type MindmapSpacing = {
    /** 葉節點兄弟之間的垂直間距 */
    gapY: number;
    /** 兄弟之一有子節點時的垂直間距 */
    groupGap: number;
    /** 根節點底下分支之間的垂直間距 */
    branchGapY: number;
    /** 父子之間的水平間距 */
    gapX: number;
    /** 根節點與分支之間的水平間距 */
    branchGapX: number;
};

/** Pele 的常數 */
export const PELE_SPACING: MindmapSpacing = { gapY: 8, groupGap: 18, branchGapY: 28, gapX: 36, branchGapX: 52 };

export const DEFAULT_NODE_SIZE: Size = { w: 160, h: 36 };

export type MindmapOptions = LayoutOptions & {
    /** 量測到的節點尺寸，缺的用 defaultSize */
    sizes?: ReadonlyMap<string, Size>;
    defaultSize?: Size;
    spacing?: Partial<MindmapSpacing>;
    /** 四周留白 */
    padding?: number;
    /**
     * 固定根的直接子節點左右分配（拖曳中用，不然塞進落點佔位會讓分支跳邊）。
     * 不在表裡的節點（佔位）跟前一個兄弟同側，沒有前一個就跟後一個；沒給就依高度自動切。
     */
    sides?: ReadonlyMap<string, Side>;
};

/** 1 右、-1 左、0 根 */
export type Side = -1 | 0 | 1;

export type PlacedNode = {
    node: TreeNode;
    /** 左上角 */
    x: number;
    y: number;
    w: number;
    h: number;
    side: Side;
    /** 所屬頂層分支的序號（根為 -1），用來決定顏色 */
    branch: number;
    depth: number;
};

export type MindmapEdge = {
    from: string;
    to: string;
    branch: number;
    /** SVG path d：三次貝茲曲線，控制點在水平中點 */
    path: string;
};

export type MindmapPlacement = {
    nodes: PlacedNode[];
    edges: MindmapEdge[];
    width: number;
    height: number;
};

type Child = { sub: Sub; dy: number; side?: Side; branch?: number };

/** 量測完的子樹；extentTop / extentBottom 相對於自身 anchor（垂直中心） */
type Sub = {
    node: TreeNode;
    w: number;
    h: number;
    children: Child[];
    extentTop: number;
    extentBottom: number;
};

const extentOf = (sub: Sub) => sub.extentBottom - sub.extentTop;

/** 把子樹由上往下疊，回傳每個子樹 anchor 相對於堆疊頂端的位置與總高 */
const stack = (subs: Sub[], gap: (prev: Sub, next: Sub) => number) => {
    let y = 0;
    const anchors: number[] = [];
    subs.forEach((sub, i) => {
        if (i > 0) y += gap(subs[i - 1]!, sub);
        anchors.push(y - sub.extentTop);
        y += extentOf(sub);
    });
    return { anchors, height: y };
};

/** 選切點 k：前 k 個往右、其餘往左，使兩側高度最接近；同分時右側多 */
const splitIndex = (subs: Sub[], gap: number): number => {
    const n = subs.length;
    if (n <= 1) return n;
    const heights = subs.map(extentOf);
    const groupHeight = (hs: number[]) => hs.reduce((a, b) => a + b, 0) + Math.max(0, hs.length - 1) * gap;
    let best = 1;
    let bestDiff = Infinity;
    for (let k = 1; k <= n; k++) {
        const diff = Math.abs(groupHeight(heights.slice(0, k)) - groupHeight(heights.slice(k)));
        if (diff <= bestDiff) {
            bestDiff = diff;
            best = k;
        }
    }
    return best;
};

const measure = (node: TreeNode, depth: number, options: MindmapOptions, spacing: MindmapSpacing): Sub => {
    const size = options.sizes?.get(node.id) ?? options.defaultSize ?? DEFAULT_NODE_SIZE;
    const subs = visibleChildren(node, options).map((child) => measure(child, depth + 1, options, spacing));
    const base: Sub = { node, w: size.w, h: size.h, children: [], extentTop: -size.h / 2, extentBottom: size.h / 2 };
    if (subs.length === 0) return base;
    if (depth === 0) return measureRoot(base, subs, spacing, options.sides);

    const { anchors, height } = stack(subs, (a, b) => (a.children.length || b.children.length ? spacing.groupGap : spacing.gapY));
    const anchor = (anchors[0]! + anchors.at(-1)!) / 2;
    base.children = subs.map((sub, i) => ({ sub, dy: anchors[i]! - anchor }));
    base.extentTop = Math.min(-anchor, -size.h / 2);
    base.extentBottom = Math.max(height - anchor, size.h / 2);
    return base;
};

/** 固定分配：查表；查不到的跟前一個兄弟同側，都查不到就跟後一個，再不然往右 */
const fixedSides = (subs: Sub[], sides: ReadonlyMap<string, Side>): Side[] => {
    const result: (Side | undefined)[] = subs.map((sub) => sides.get(sub.node.id));
    for (let i = 0; i < result.length; i++) if (result[i] === undefined) result[i] = result[i - 1];
    for (let i = result.length - 1; i >= 0; i--) if (result[i] === undefined) result[i] = result[i + 1];
    return result.map((side) => side ?? 1);
};

/** 根節點：分支切成左右兩組（依高度切、或照 sides 固定），各自疊好後置中對齊根的 anchor */
const measureRoot = (base: Sub, subs: Sub[], spacing: MindmapSpacing, sides?: ReadonlyMap<string, Side>): Sub => {
    let groups: { side: Side; subs: Sub[] }[];
    if (sides) {
        const assigned = fixedSides(subs, sides);
        groups = [
            { side: 1, subs: subs.filter((_, i) => assigned[i] === 1) },
            { side: -1, subs: subs.filter((_, i) => assigned[i] !== 1) },
        ];
    } else {
        const k = splitIndex(subs, spacing.branchGapY);
        groups = [
            { side: 1, subs: subs.slice(0, k) },
            { side: -1, subs: subs.slice(k) },
        ];
    }
    let top = base.extentTop;
    let bottom = base.extentBottom;
    for (const group of groups) {
        if (group.subs.length === 0) continue;
        const { anchors, height } = stack(group.subs, () => spacing.branchGapY);
        const center = height / 2;
        group.subs.forEach((sub, i) => {
            base.children.push({ sub, dy: anchors[i]! - center, side: group.side, branch: subs.indexOf(sub) });
        });
        top = Math.min(top, -center);
        bottom = Math.max(bottom, height - center);
    }
    base.extentTop = top;
    base.extentBottom = bottom;
    return base;
};

type Link = { from: PlacedNode; to: PlacedNode };

const place = (
    sub: Sub,
    cx: number,
    cy: number,
    side: Side,
    depth: number,
    branch: number,
    spacing: MindmapSpacing,
    nodes: PlacedNode[],
    links: Link[],
): PlacedNode => {
    const placed: PlacedNode = { node: sub.node, x: cx - sub.w / 2, y: cy - sub.h / 2, w: sub.w, h: sub.h, side, branch, depth };
    nodes.push(placed);
    for (const child of sub.children) {
        const childSide = child.side ?? side;
        const childBranch = child.branch ?? branch;
        const gap = depth === 0 ? spacing.branchGapX : spacing.gapX;
        const childCx = cx + childSide * (sub.w / 2 + gap + child.sub.w / 2);
        const target = place(child.sub, childCx, cy + child.dy, childSide, depth + 1, childBranch, spacing, nodes, links);
        links.push({ from: placed, to: target });
    }
    return placed;
};

const round = (value: number) => Math.round(value * 100) / 100;

/** 從父節點靠子節點那一側的邊緣中點，連到子節點靠父節點那一側的邊緣中點 */
export const edgePath = (from: PlacedNode, to: PlacedNode): string => {
    const side = to.side;
    const x1 = from.x + from.w / 2 + side * (from.w / 2);
    const y1 = from.y + from.h / 2;
    const x2 = to.x + to.w / 2 - side * (to.w / 2);
    const y2 = to.y + to.h / 2;
    const mid = (x1 + x2) / 2;
    return `M ${round(x1)} ${round(y1)} C ${round(mid)} ${round(y1)} ${round(mid)} ${round(y2)} ${round(x2)} ${round(y2)}`;
};

export const mindmapLayout: Layout<MindmapPlacement, MindmapOptions> = (root, options = {}) => {
    const spacing: MindmapSpacing = { ...PELE_SPACING, ...options.spacing };
    const padding = options.padding ?? 24;

    const sub = measure(root, 0, options, spacing);
    const nodes: PlacedNode[] = [];
    const links: Link[] = [];
    place(sub, 0, 0, 0, 0, -1, spacing, nodes, links);

    const minX = Math.min(...nodes.map((n) => n.x));
    const minY = Math.min(...nodes.map((n) => n.y));
    const maxX = Math.max(...nodes.map((n) => n.x + n.w));
    const maxY = Math.max(...nodes.map((n) => n.y + n.h));
    for (const node of nodes) {
        node.x = round(node.x + padding - minX);
        node.y = round(node.y + padding - minY);
    }

    const edges: MindmapEdge[] = links.map(({ from, to }) => ({
        from: from.node.id,
        to: to.node.id,
        branch: to.branch,
        path: edgePath(from, to),
    }));

    return { nodes, edges, width: round(maxX - minX + padding * 2), height: round(maxY - minY + padding * 2) };
};
