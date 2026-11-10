import { describe, expect, it } from "vitest";
import type { TreeNode } from "../../src/core/tree";
import { outlineLayout } from "../../src/layout/outline";

const node = (id: string, children: TreeNode[] = []): TreeNode => ({
    id,
    kind: id === "root" ? "root" : "heading",
    level: id === "root" ? 0 : 1,
    title: id,
    range: { from: 0, to: 0 },
    sections: [],
    children,
});

// root
//  ├─ a
//  │   ├─ a1
//  │   └─ a2
//  │       └─ a2x
//  └─ b
//      └─ b1
const tree = () => node("root", [node("a", [node("a1"), node("a2", [node("a2x")])]), node("b", [node("b1")])]);

describe("outlineLayout", () => {
    it("列的順序是深度優先，深度與分支序號正確", () => {
        const { rows } = outlineLayout(tree());
        expect(rows.map((r) => r.node.id)).toEqual(["root", "a", "a1", "a2", "a2x", "b", "b1"]);
        expect(rows.map((r) => r.depth)).toEqual([0, 1, 2, 2, 3, 1, 2]);
        expect(rows.map((r) => r.branch)).toEqual([-1, 0, 0, 0, 0, 1, 1]);
    });

    it("isLast 標記父節點的最後一個子節點", () => {
        const { rows } = outlineLayout(tree());
        const byId = Object.fromEntries(rows.map((r) => [r.node.id, r]));
        expect(byId.a!.isLast).toBe(false);
        expect(byId.b!.isLast).toBe(true);
        expect(byId.a1!.isLast).toBe(false);
        expect(byId.a2!.isLast).toBe(true);
        expect(byId.a2x!.isLast).toBe(true);
    });

    it("trunks 記錄祖先欄位是否要畫通過的主幹", () => {
        const { rows } = outlineLayout(tree());
        const byId = Object.fromEntries(rows.map((r) => [r.node.id, r]));
        expect(byId.root!.trunks).toEqual([]);
        expect(byId.a!.trunks).toEqual([]);
        // a 之後還有 b，所以 a 的子節點那一欄要畫主幹
        expect(byId.a1!.trunks).toEqual([true]);
        // a2 是 a 的最後一個，a2x 的第二欄不畫
        expect(byId.a2x!.trunks).toEqual([true, false]);
        // b 是最後一個，b1 的欄不畫
        expect(byId.b1!.trunks).toEqual([false]);
    });

    it("trunks 長度永遠是 depth - 1（root 與第一層為 0）", () => {
        const { rows } = outlineLayout(tree());
        for (const row of rows) {
            expect(row.trunks).toHaveLength(Math.max(0, row.depth - 1));
        }
    });

    it("收合的節點不展開子孫，並記錄隱藏數量", () => {
        const { rows } = outlineLayout(tree(), { collapsed: new Set(["a"]) });
        expect(rows.map((r) => r.node.id)).toEqual(["root", "a", "b", "b1"]);
        const a = rows[1]!;
        expect(a).toMatchObject({ hasChildren: true, collapsed: true, hiddenDescendants: 3 });
        expect(rows[2]).toMatchObject({ collapsed: false, hiddenDescendants: 0 });
    });

    it("葉節點 hasChildren 為 false 且不算收合", () => {
        const { rows } = outlineLayout(tree());
        const a1 = rows.find((r) => r.node.id === "a1")!;
        expect(a1).toMatchObject({ hasChildren: false, collapsed: false, hiddenDescendants: 0 });
    });
});
