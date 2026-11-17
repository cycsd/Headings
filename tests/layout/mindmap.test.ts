import { describe, expect, it } from "vitest";
import type { TreeNode } from "../../src/core/tree";
import { DEFAULT_NODE_SIZE, PELE_SPACING, mindmapLayout, type MindmapPlacement, type Size } from "../../src/layout/mindmap";

const node = (id: string, children: TreeNode[] = []): TreeNode => ({
    id,
    kind: id === "root" ? "root" : "heading",
    level: id === "root" ? 0 : 1,
    title: id,
    range: { from: 0, to: 0 },
    sections: [],
    children,
});

const size = (w: number, h: number): Size => ({ w, h });
const find = (p: MindmapPlacement, id: string) => p.nodes.find((n) => n.node.id === id)!;
const centerY = (p: MindmapPlacement, id: string) => find(p, id).y + find(p, id).h / 2;
const PAD = 24;
const { w: W, h: H } = DEFAULT_NODE_SIZE;

describe("mindmapLayout", () => {
    it("只有根節點：一個節點、沒有邊線、寬高是尺寸加留白", () => {
        const p = mindmapLayout(node("root"));
        expect(p.nodes).toHaveLength(1);
        expect(p.edges).toEqual([]);
        expect(find(p, "root")).toMatchObject({ x: PAD, y: PAD, side: 0, branch: -1, depth: 0 });
        expect(p.width).toBe(W + PAD * 2);
        expect(p.height).toBe(H + PAD * 2);
    });

    it("兩個等高分支一左一右，垂直中心與根對齊", () => {
        const p = mindmapLayout(node("root", [node("a"), node("b")]));
        expect(find(p, "a").side).toBe(1);
        expect(find(p, "b").side).toBe(-1);
        expect(centerY(p, "a")).toBe(centerY(p, "root"));
        expect(centerY(p, "b")).toBe(centerY(p, "root"));
        // 根層水平間距用 branchGapX
        expect(find(p, "a").x).toBe(find(p, "root").x + W + PELE_SPACING.branchGapX);
        expect(find(p, "b").x + W + PELE_SPACING.branchGapX).toBe(find(p, "root").x);
    });

    it("四個等高分支切成 2 右 2 左，前面的往右", () => {
        const p = mindmapLayout(node("root", ["a", "b", "c", "d"].map((id) => node(id))));
        expect(["a", "b"].map((id) => find(p, id).side)).toEqual([1, 1]);
        expect(["c", "d"].map((id) => find(p, id).side)).toEqual([-1, -1]);
    });

    it("分支高度不等時切點讓兩側高度最接近", () => {
        const sizes = new Map([["a", size(100, 100)], ["b", size(100, 10)], ["c", size(100, 10)]]);
        const p = mindmapLayout(node("root", [node("a"), node("b"), node("c")]), { sizes });
        // 右 [a]=100 vs 左 [b,c]=10+28+10=48 → 差 52；右 [a,b]=138 vs 左 [c]=10 → 差 128
        expect(find(p, "a").side).toBe(1);
        expect(find(p, "b").side).toBe(-1);
        expect(find(p, "c").side).toBe(-1);
    });

    it("同一側的分支以 branchGapY 分隔並以根為中心", () => {
        const p = mindmapLayout(node("root", [node("a"), node("b"), node("c"), node("d")]));
        const a = find(p, "a");
        const b = find(p, "b");
        expect(b.y - (a.y + a.h)).toBe(PELE_SPACING.branchGapY);
        expect((centerY(p, "a") + centerY(p, "b")) / 2).toBe(centerY(p, "root"));
    });

    it("葉節點兄弟用 gapY，兄弟之一有子節點時用 groupGap", () => {
        const p = mindmapLayout(node("root", [node("a", [node("a1"), node("a2"), node("a3", [node("a3x")])])]));
        const a1 = find(p, "a1");
        const a2 = find(p, "a2");
        const a3 = find(p, "a3");
        expect(a2.y - (a1.y + a1.h)).toBe(PELE_SPACING.gapY);
        expect(a3.y - (a2.y + a2.h)).toBe(PELE_SPACING.groupGap);
    });

    it("父節點的垂直中心在第一個與最後一個子節點中心的中點，水平距離用 gapX", () => {
        const sizes = new Map([["a1", size(80, 20)], ["a3", size(80, 60)]]);
        const p = mindmapLayout(node("root", [node("a", [node("a1"), node("a2"), node("a3")])]), { sizes });
        const a = find(p, "a");
        expect(centerY(p, "a")).toBe((centerY(p, "a1") + centerY(p, "a3")) / 2);
        expect(find(p, "a1").x).toBe(a.x + a.w + PELE_SPACING.gapX);
    });

    it("整個分支繼承根分支的 side 與 branch 序號", () => {
        const p = mindmapLayout(node("root", [node("a", [node("a1", [node("a1x")])]), node("b", [node("b1")])]));
        expect(find(p, "a1x")).toMatchObject({ side: 1, branch: 0, depth: 3 });
        expect(find(p, "b1")).toMatchObject({ side: -1, branch: 1, depth: 2 });
    });

    it("收合的節點不展開子孫，邊線也不畫", () => {
        const tree = node("root", [node("a", [node("a1"), node("a2")]), node("b")]);
        const p = mindmapLayout(tree, { collapsed: new Set(["a"]) });
        expect(p.nodes.map((n) => n.node.id).sort()).toEqual(["a", "b", "root"]);
        expect(p.edges).toHaveLength(2);
    });

    it("邊線數量是節點數減一，從父節點側邊連到子節點側邊", () => {
        const p = mindmapLayout(node("root", [node("a", [node("a1")]), node("b")]));
        expect(p.edges).toHaveLength(p.nodes.length - 1);
        const edge = p.edges.find((e) => e.from === "root" && e.to === "a")!;
        const root = find(p, "root");
        const a = find(p, "a");
        expect(edge.branch).toBe(0);
        expect(edge.path).toBe(
            `M ${root.x + root.w} ${root.y + root.h / 2} C ${(root.x + root.w + a.x) / 2} ${root.y + root.h / 2} ${(root.x + root.w + a.x) / 2} ${a.y + a.h / 2} ${a.x} ${a.y + a.h / 2}`,
        );
    });

    it("所有節點都在留白之內，寬高把所有節點包起來", () => {
        const sizes = new Map([["b", size(300, 90)]]);
        const p = mindmapLayout(node("root", [node("a", [node("a1"), node("a2")]), node("b")]), { sizes });
        for (const n of p.nodes) {
            expect(n.x).toBeGreaterThanOrEqual(PAD);
            expect(n.y).toBeGreaterThanOrEqual(PAD);
            expect(n.x + n.w).toBeLessThanOrEqual(p.width - PAD);
            expect(n.y + n.h).toBeLessThanOrEqual(p.height - PAD);
        }
    });

    it("沒有量測到的節點用 defaultSize，可以自訂", () => {
        const p = mindmapLayout(node("root", [node("a")]), { defaultSize: size(50, 10), sizes: new Map([["a", size(70, 30)]]) });
        expect(find(p, "root")).toMatchObject({ w: 50, h: 10 });
        expect(find(p, "a")).toMatchObject({ w: 70, h: 30 });
    });

    it("同一層兄弟的方框不重疊", () => {
        const sizes = new Map([["a2", size(200, 120)]]);
        const p = mindmapLayout(node("root", [node("a", [node("a1"), node("a2"), node("a3")]), node("b", [node("b1"), node("b2")])]), { sizes });
        const overlaps = (m: { x: number; y: number; w: number; h: number }, n: typeof m) =>
            m.x < n.x + n.w && n.x < m.x + m.w && m.y < n.y + n.h && n.y < m.y + m.h;
        for (const m of p.nodes) {
            for (const n of p.nodes) {
                if (m !== n) expect(overlaps(m, n), `${m.node.id} overlaps ${n.node.id}`).toBe(false);
            }
        }
    });
});
