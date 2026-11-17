import { describe, expect, it } from "vitest";
import type { TreeNode } from "../../src/core/tree";
import { buildIdMap, collectStarts, diffPatch, mapOffset } from "../../src/view/id-remap";

const node = (id: string, from: number, children: TreeNode[] = []): TreeNode => ({
    id,
    kind: id === "root" ? "root" : "heading",
    level: 2,
    title: id,
    range: { from, to: from + 5 },
    sections: [],
    links: [],
    children,
});

describe("mapOffset", () => {
    it("純插入：插入點與之後都往後移，之前不動", () => {
        const insert = [{ from: 10, to: 10, insert: "abc" }];
        expect(mapOffset(5, insert)).toBe(5);
        expect(mapOffset(10, insert)).toBe(13);
        expect(mapOffset(20, insert)).toBe(23);
    });

    it("取代：被編輯的節點留在 from，範圍內其他起點消失，之後的位移", () => {
        const edit = [{ from: 10, to: 20, insert: "x".repeat(4) }];
        expect(mapOffset(10, edit)).toBe(10);
        expect(mapOffset(15, edit)).toBeNull();
        expect(mapOffset(20, edit)).toBe(14);
    });

    it("刪除：from 上的節點也消失；多個補丁累加", () => {
        const del = [{ from: 10, to: 20, insert: "" }];
        expect(mapOffset(10, del)).toBeNull();
        expect(mapOffset(20, del)).toBe(10);
        const two = [{ from: 0, to: 2, insert: "" }, { from: 10, to: 10, insert: "zz" }];
        expect(mapOffset(12, two)).toBe(12);
    });
});

describe("diffPatch", () => {
    it("以行為單位：改一行是取代整行、多一行是純插入、少一行是連換行一起刪；相同回傳空", () => {
        expect(diffPatch("abc", "abc")).toEqual([]);
        expect(diffPatch("## A\n\ntext\n\n## B", "## AA\n\ntext\n\n## B")).toEqual([{ from: 0, to: 4, insert: "## AA" }]);
        expect(diffPatch("x\n\n## B", "x\n\n## New\n\n## B")).toEqual([{ from: 3, to: 3, insert: "## New\n\n" }]);
        expect(diffPatch("x\n\n## B", "x\n\n## B\n\n## New")).toEqual([{ from: 7, to: 7, insert: "\n\n## New" }]);
        expect(diffPatch("x\n## A\n## B", "x\n## B")).toEqual([{ from: 2, to: 7, insert: "" }]);
        expect(diffPatch("x\n## A", "x")).toEqual([{ from: 1, to: 6, insert: "" }]);
        expect(diffPatch("aXb", "ab")).toEqual([{ from: 0, to: 3, insert: "ab" }]);
    });

    it("在 B 前面插入 New：B 讓開而不是被當成改名", () => {
        const old = node("root", 0, [node("root/B", 3)]);
        const patches = diffPatch("x\n\n## B", "x\n\n## New\n\n## B");
        // "x\n\n" 3 字 + "## New\n\n" 8 字 → B 從 3 移到 11
        const next = node("root", 0, [node("root/New", 3), node("root/B", 11)]);
        const map = buildIdMap(collectStarts(old), patches, next);
        expect(map.has("root/B")).toBe(false);
    });

    it("改標題的外部變動：插在標題字後面，標題節點本身留在原位（純插入點在節點起點之後）", () => {
        const old = node("root", 0, [node("root/A", 0, [node("root/A/A1", 20)]), node("root/B", 40)]);
        const patches = diffPatch("## A\n" + "x".repeat(15) + "### A1\n" + "x".repeat(13) + "## B", "## AB\n" + "x".repeat(15) + "### A1\n" + "x".repeat(13) + "## B");
        const next = node("root", 0, [node("root/AB", 0, [node("root/AB/A1", 21)]), node("root/B", 41)]);
        const map = buildIdMap(collectStarts(old), patches, next);
        expect(map.get("root/A")).toBe("root/AB");
        expect(map.get("root/A/A1")).toBe("root/AB/A1");
    });
});

describe("buildIdMap", () => {
    it("改標題後同一個起點的節點換了 id，後代用各自的起點對回去；沒變的不列", () => {
        const old = node("root", 0, [node("root/A", 0, [node("root/A/A1", 20)]), node("root/B", 40)]);
        // 把 A 的標題「A」改成「AA」：A 的範圍 [0,5) 取代成 6 個字，之後全部 +1
        const patches = [{ from: 0, to: 5, insert: "## AA\n" }];
        const next = node("root", 0, [node("root/AA", 0, [node("root/AA/A1", 21)]), node("root/B", 41)]);
        const map = buildIdMap(collectStarts(old), patches, next);
        expect(map.get("root/A")).toBe("root/AA");
        expect(map.get("root/A/A1")).toBe("root/AA/A1");
        expect(map.has("root/B")).toBe(false);
    });

    it("刪掉的節點對到 null", () => {
        const old = node("root", 0, [node("root/A", 0), node("root/B", 20)]);
        const next = node("root", 0, [node("root/B", 0)]);
        const map = buildIdMap(collectStarts(old), [{ from: 0, to: 20, insert: "" }], next);
        expect(map.get("root/A")).toBeNull();
        expect(map.has("root/B")).toBe(false);
    });

    it("搬移的子樹用新位置的 id 換前綴", () => {
        const old = node("root", 0, [node("root/A", 0, [node("root/A/A1", 10)]), node("root/B", 30)]);
        // A 子樹（[0,20)）剪掉貼到 B 後面：B 往前移 20，A 子樹從 B 之後開始
        const patches = [{ from: 0, to: 20, insert: "" }, { from: 35, to: 35, insert: "\n\n" + "x".repeat(18) }];
        const next = node("root", 0, [node("root/B", 10, [node("root/B/A", 17, [node("root/B/A/A1", 27)])])]);
        const map = buildIdMap(collectStarts(old), patches, next, { oldId: "root/A", newStart: 17 });
        expect(map.get("root/A")).toBe("root/B/A");
        expect(map.get("root/A/A1")).toBe("root/B/A/A1");
        // B 本身只是往前移，id 沒變
        expect(map.has("root/B")).toBe(false);
    });
});
