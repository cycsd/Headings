import { describe, expect, it } from "vitest";
import type { TreeNode } from "../../src/core/tree";
import { collapseOthers, collapseSubtree, expandSubtree, findNode, maxDepth, pathTo, stepDepth, withDepth } from "../../src/core/tree-ops";

const node = (id: string, children: TreeNode[] = []): TreeNode => ({
    id,
    kind: "heading",
    level: 1,
    title: id,
    range: { from: 0, to: 0 },
    sections: [],
    links: [],
    children,
});

// root
//   ├─ A
//   │   ├─ A1
//   │   │   └─ A1a
//   │   └─ A2
//   └─ B
//       └─ B1
const tree = (): TreeNode => node("root", [node("A", [node("A1", [node("A1a")]), node("A2")]), node("B", [node("B1")])]);

describe("findNode / pathTo / maxDepth", () => {
    it("找得到節點與路徑，找不到回傳 null / 空陣列", () => {
        expect(findNode(tree(), "A1a")?.id).toBe("A1a");
        expect(findNode(tree(), "nope")).toBeNull();
        expect(pathTo(tree(), "A1a").map((n) => n.id)).toEqual(["root", "A", "A1", "A1a"]);
        expect(pathTo(tree(), "nope")).toEqual([]);
    });

    it("root 為第 0 層", () => {
        expect(maxDepth(tree())).toBe(3);
        expect(maxDepth(node("solo"))).toBe(0);
    });
});

describe("withDepth", () => {
    it("depth 1 只留 root 展開", () => {
        expect([...withDepth(tree(), 1, new Set())].sort()).toEqual(["A", "A1", "B"]);
    });

    it("depth 2 收合第 2 層以下有子節點的", () => {
        expect([...withDepth(tree(), 2, new Set())]).toEqual(["A1"]);
    });

    it("depth 0 全部展開，並清掉子樹內原有的收合", () => {
        expect(withDepth(tree(), 0, new Set(["A", "B"])).size).toBe(0);
    });

    it("只動子樹內的節點，子樹外的收合保留", () => {
        const root = tree();
        const next = withDepth(findNode(root, "A")!, 1, new Set(["B"]));
        expect([...next].sort()).toEqual(["A1", "B"]);
    });
});

describe("collapseOthers", () => {
    it("路徑上展開、其他有子節點的收合", () => {
        const next = collapseOthers(tree(), "A1", new Set(["A", "A1"]));
        // A 是祖先、A1 是目標 → 展開；B 在路徑外 → 收合；A1a 是葉節點不用收
        expect([...next].sort()).toEqual(["B"]);
    });

    it("目標的後代也收合，只看到目標的直接子節點", () => {
        expect([...collapseOthers(tree(), "A", new Set())].sort()).toEqual(["A1", "B"]);
    });

    it("點 root 等於收合到第 1 層", () => {
        expect([...collapseOthers(tree(), "root", new Set())].sort()).toEqual(["A", "A1", "B"]);
    });

    it("目標不存在時原樣回傳", () => {
        expect([...collapseOthers(tree(), "nope", new Set(["A"]))]).toEqual(["A"]);
    });
});

describe("expandSubtree / collapseSubtree", () => {
    it("展開目標與後代，不碰其他", () => {
        const root = tree();
        const next = expandSubtree(findNode(root, "A")!, new Set(["A", "A1", "B"]));
        expect([...next]).toEqual(["B"]);
    });

    it("收合目標與有子節點的後代", () => {
        const root = tree();
        expect([...collapseSubtree(findNode(root, "A")!, new Set())].sort()).toEqual(["A", "A1"]);
    });
});

describe("stepDepth", () => {
    it("往上到最大深度即為全部", () => {
        expect(stepDepth(1, 1, 3)).toBe(2);
        expect(stepDepth(2, 1, 3)).toBe(0);
        expect(stepDepth(0, 1, 3)).toBe(0);
    });

    it("往下最少到 1，從全部往下是最大深度減 1", () => {
        expect(stepDepth(0, -1, 3)).toBe(2);
        expect(stepDepth(2, -1, 3)).toBe(1);
        expect(stepDepth(1, -1, 3)).toBe(1);
    });

    it("樹只有一層時永遠是全部", () => {
        expect(stepDepth(0, -1, 1)).toBe(0);
        expect(stepDepth(0, 1, 0)).toBe(0);
    });
});
