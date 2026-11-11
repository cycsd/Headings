import { describe, expect, it } from "vitest";
import {
    contentRange,
    promote,
    promoteNone,
    promoteTypes,
    sectionTypesOf,
    type HeadingNode,
    type LinkRef,
    type SectionNode,
} from "../../src/core/tree";

const section = (id: string, type: string, from: number, to: number, children: SectionNode["children"] = []): SectionNode => ({
    kind: "section",
    id,
    type,
    range: { from, to },
    children,
});

// root
//   ├─ A (sections: paragraph, list[item0 ─ item0.0], code)
//   │    └─ A1 (sections: paragraph)
//   └─ B (no sections)
const fixture = (): HeadingNode => ({
    kind: "root",
    id: "root",
    level: 0,
    title: "file.md",
    range: { from: 0, to: 0 },
    sections: [],
    children: [
        {
            kind: "heading",
            id: "root/A",
            level: 1,
            title: "A",
            range: { from: 0, to: 3 },
            sections: [
                section("root/A:paragraph:0", "paragraph", 5, 10),
                section("root/A:list:0", "list", 12, 30, [
                    {
                        kind: "listItem",
                        id: "root/A:list:0:0",
                        range: { from: 12, to: 20 },
                        text: "- item",
                        children: [
                            { kind: "listItem", id: "root/A:list:0:0:0", range: { from: 22, to: 30 }, text: "- sub", children: [] },
                        ],
                    },
                ]),
                section("root/A:code:0", "code", 32, 40),
            ],
            children: [
                {
                    kind: "heading",
                    id: "root/A/A1",
                    level: 2,
                    title: "A1",
                    range: { from: 42, to: 47 },
                    sections: [section("root/A/A1:paragraph:0", "paragraph", 49, 60)],
                    children: [],
                },
            ],
        },
        { kind: "heading", id: "root/B", level: 1, title: "B", range: { from: 62, to: 65 }, sections: [], children: [] },
    ],
});

describe("promote", () => {
    it("promoteNone：所有 sections 留在內容區，children 只有子 heading", () => {
        const tree = promote(fixture(), promoteNone);
        const a = tree.children[0]!;
        expect(tree.kind).toBe("root");
        expect(a.sections.map((s) => s.type)).toEqual(["paragraph", "list", "code"]);
        expect(a.children.map((c) => c.id)).toEqual(["root/A/A1"]);
    });

    it("升級的 sections 排在子 heading 之前，並從 sections 移除", () => {
        const tree = promote(fixture(), promoteTypes(["list", "code"]));
        const a = tree.children[0]!;
        expect(a.sections.map((s) => s.type)).toEqual(["paragraph"]);
        expect(a.children.map((c) => c.id)).toEqual(["root/A:list:0", "root/A:code:0", "root/A/A1"]);
        expect(a.children[0]!.kind).toBe("section");
        expect(a.children[0]!.sectionType).toBe("list");
        expect(a.children[0]!.title).toBeNull();
    });

    it("list 升級後保留巢狀 list item 為子節點", () => {
        const tree = promote(fixture(), promoteTypes(["list"]));
        const list = tree.children[0]!.children[0]!;
        const item = list.children[0]!;
        expect(item.kind).toBe("listItem");
        expect(item.text).toBe("- item");
        expect(item.children.map((c) => c.id)).toEqual(["root/A:list:0:0:0"]);
    });

    it("policy 不影響 id，所以切換設定時節點狀態可以沿用", () => {
        const none = promote(fixture(), promoteNone);
        const some = promote(fixture(), promoteTypes(["paragraph"]));
        expect(none.children[0]!.children.find((c) => c.id === "root/A/A1")).toBeDefined();
        expect(some.children[0]!.children.find((c) => c.id === "root/A/A1")).toBeDefined();
    });

    it("promote 不改動輸入的完整樹", () => {
        const full = fixture();
        const before = JSON.stringify(full);
        promote(full, promoteTypes(["list", "code", "paragraph"]));
        expect(JSON.stringify(full)).toBe(before);
    });
});

describe("contentRange", () => {
    it("heading 的內容區間涵蓋標題行到最後一個留下的 section", () => {
        const tree = promote(fixture(), promoteTypes(["code"]));
        expect(contentRange(tree.children[0]!)).toEqual({ from: 0, to: 30 });
    });

    it("沒有 section 的 heading 只有標題行", () => {
        const tree = promote(fixture(), promoteNone);
        expect(contentRange(tree.children[1]!)).toEqual({ from: 62, to: 65 });
    });

    it("升級節點的內容區間就是自身", () => {
        const tree = promote(fixture(), promoteTypes(["code"]));
        expect(contentRange(tree.children[0]!.children[0]!)).toEqual({ from: 32, to: 40 });
    });
});

describe("promote 的連結分配", () => {
    const link = (target: string, from: number, to: number, embed = false): LinkRef => ({ target, display: target, range: { from, to }, embed });
    // 連結位置：A 的段落 (6-9)、A 的 list item (13-18)、A 的子 item (23-28)、A 的 code (33-38)、A1 的段落 (50-55)
    const links = [link("p", 6, 9), link("item", 13, 18), link("sub", 23, 28), link("code", 33, 38), link("a1", 50, 55)];

    it("不升級時連結都屬於內容所在的 heading，子 heading 的連結不算進父節點", () => {
        const tree = promote(fixture(), promoteNone, links);
        const a = tree.children[0]!;
        expect(a.links.map((l) => l.target)).toEqual(["p", "item", "sub", "code"]);
        expect(a.children[0]!.links.map((l) => l.target)).toEqual(["a1"]);
        expect(tree.links).toEqual([]);
    });

    it("升級的 section 帶走自己範圍內的連結，list 的連結屬於 item 而不是 list 節點", () => {
        const tree = promote(fixture(), promoteTypes(["list", "code"]), links);
        const a = tree.children[0]!;
        expect(a.links.map((l) => l.target)).toEqual(["p"]);
        const [list, code] = a.children;
        expect(list!.links).toEqual([]);
        expect(list!.children[0]!.links.map((l) => l.target)).toEqual(["item"]);
        expect(list!.children[0]!.children[0]!.links.map((l) => l.target)).toEqual(["sub"]);
        expect(code!.links.map((l) => l.target)).toEqual(["code"]);
    });

    it("沒有傳 links 時每個節點的 links 是空陣列", () => {
        const tree = promote(fixture(), promoteTypes(["list"]));
        expect(tree.children[0]!.links).toEqual([]);
        expect(tree.children[0]!.children[0]!.children[0]!.links).toEqual([]);
    });
});

describe("sectionTypesOf", () => {
    it("依原文順序去重", () => {
        const tree = promote(fixture(), promoteNone);
        expect(sectionTypesOf(tree.children[0]!)).toEqual(["paragraph", "list", "code"]);
    });
    it("升級後的型別不再出現", () => {
        const tree = promote(fixture(), promoteTypes(["list"]));
        expect(sectionTypesOf(tree.children[0]!)).toEqual(["paragraph", "code"]);
    });
});
