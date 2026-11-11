import { describe, expect, it } from "vitest";
import type { CachedMetadata } from "obsidian";
import { buildLinks, buildTree, ROOT_ID } from "../../src/adapter/obsidian-tree";
import type { HeadingNode } from "../../src/core/tree";
import {
    obsidianMarkdownAllSyntaxExampleDoc as doc,
    obsidianMarkdownAllSyntaxExampleMetadata as fixtureMetadata,
} from "../fixtures/obsidian-markdown-fixture";

const metadata = fixtureMetadata as unknown as CachedMetadata;
const fileName = "Obsidian Markdown All Syntax Example.md";

const findHeading = (node: HeadingNode, title: string): HeadingNode | undefined => {
    if (node.title === title) return node;
    for (const child of node.children) {
        const found = findHeading(child, title);
        if (found) return found;
    }
    return undefined;
};

describe("buildTree", () => {
    const root = buildTree(metadata, doc, fileName);

    it("root 是檔名、level 0、kind root", () => {
        expect(root.kind).toBe("root");
        expect(root.id).toBe(ROOT_ID);
        expect(root.title).toBe(fileName);
        expect(root.level).toBe(0);
    });

    it("frontmatter 的 yaml section 屬於 root", () => {
        expect(root.sections.map((s) => s.type)).toEqual(["yaml"]);
    });

    it("root 有 2 個子標題：語法總覽(H1) 與示範用的 H1", () => {
        expect(root.children.map((c) => c.title)).toEqual(["Obsidian Markdown 語法總覽", "H1"]);
        expect(root.children.every((c) => c.level === 1 && c.kind === "heading")).toBe(true);
    });

    it("level 2 標題依序成為 level 1 標題的 children", () => {
        const overview = root.children[0]!;
        expect(overview.children.map((c) => c.title)).toEqual(["1. 文字格式", "2. 標題層級"]);
    });

    it("「2. 標題層級」之後的 H1 回到 root 底下，H2~H6 逐層巢狀", () => {
        let node = root.children[1]!;
        for (const [title, level] of [["H1", 1], ["H2", 2], ["H3", 3], ["H4", 4], ["H5", 5], ["H6", 6]] as const) {
            expect(node.title).toBe(title);
            expect(node.level).toBe(level);
            if (title !== "H6") {
                node = node.children[0]!;
            }
        }
    });

    it("H6 之後的 level 2 標題收斂回示範 H1 底下", () => {
        const h1 = root.children[1]!;
        const titles = h1.children.map((c) => c.title);
        expect(titles[0]).toBe("H2");
        expect(titles).toContain("3. 連結（Wikilink / Markdown Link）");
        expect(titles.at(-1)).toBe("18. 參考範例（屬性與連結）");
    });

    it("每個標題的 sections 是該標題到下一個標題前的內容", () => {
        const section = findHeading(root, "1. 文字格式")!;
        expect(section.sections.map((s) => s.type)).toEqual(["paragraph", "paragraph", "paragraph", "thematicBreak"]);
    });

    it("heading 的 range 是標題那一行", () => {
        const section = findHeading(root, "1. 文字格式")!;
        expect(doc.slice(section.range.from, section.range.to)).toBe("## 1. 文字格式");
    });

    it("list section 依 parent 組出巢狀 list item，item 文字去縮排且不含子 list", () => {
        const lists = findHeading(root, "4. 清單")!.sections.filter((s) => s.type === "list");
        expect(lists).toHaveLength(3);

        const [unordered] = lists;
        expect(unordered!.children.map((i) => i.text)).toEqual(["- 項目 A", "- 項目 B", "- 項目 C"]);
        expect(unordered!.children[1]!.children.map((i) => i.text)).toEqual(["- 子項目 B-1", "- 子項目 B-2"]);
    });

    it("非 list 的 section 沒有 children", () => {
        const code = findHeading(root, "7. 程式碼")!.sections.filter((s) => s.type === "code");
        expect(code.length).toBeGreaterThan(0);
        expect(code.every((s) => s.children.length === 0)).toBe(true);
    });

    it("id 穩定：heading 用標題路徑，section 用型別序號，list item 用序號", () => {
        const overview = root.children[0]!;
        expect(overview.id).toBe("root/Obsidian Markdown 語法總覽");
        const textFormat = overview.children[0]!;
        expect(textFormat.id).toBe("root/Obsidian Markdown 語法總覽/1. 文字格式");
        expect(textFormat.sections.map((s) => s.id)).toEqual([
            `${textFormat.id}:paragraph:0`,
            `${textFormat.id}:paragraph:1`,
            `${textFormat.id}:paragraph:2`,
            `${textFormat.id}:thematicBreak:0`,
        ]);

        const list = findHeading(root, "4. 清單")!.sections.find((s) => s.type === "list")!;
        expect(list.children[1]!.id).toBe(`${list.id}:1`);
        expect(list.children[1]!.children[0]!.id).toBe(`${list.id}:1:0`);
    });

    it("同名兄弟標題的 id 加序號", () => {
        const cache: CachedMetadata = {
            headings: [
                { heading: "A", level: 1, position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 3, offset: 3 } } },
                { heading: "A", level: 1, position: { start: { line: 1, col: 0, offset: 4 }, end: { line: 1, col: 3, offset: 7 } } },
            ],
            sections: [
                { type: "heading", position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 3, offset: 3 } } },
                { type: "heading", position: { start: { line: 1, col: 0, offset: 4 }, end: { line: 1, col: 3, offset: 7 } } },
            ],
        };
        const tree = buildTree(cache, "# A\n# A", "x.md");
        expect(tree.children.map((c) => c.id)).toEqual(["root/A", "root/A~1"]);
    });

    it("沒有 headings 與 sections 的 cache 也能建出只有 root 的樹", () => {
        const tree = buildTree({}, "", "empty.md");
        expect(tree.children).toEqual([]);
        expect(tree.sections).toEqual([]);
    });
});

describe("buildLinks", () => {
    const links = buildLinks(metadata);

    it("links 與 embeds 合併並依位置排序", () => {
        expect(links.length).toBe((metadata.links?.length ?? 0) + (metadata.embeds?.length ?? 0));
        for (let i = 1; i < links.length; i++) {
            expect(links[i]!.range.from).toBeGreaterThanOrEqual(links[i - 1]!.range.from);
        }
    });

    it("embed 標記為 true，一般連結為 false", () => {
        expect(links.find((l) => l.target === "image.png")?.embed).toBe(true);
        expect(links.find((l) => l.target === "Another Note")?.embed).toBe(false);
    });

    it("顯示文字沒有時用 target", () => {
        const custom = links.find((l) => l.display === "自訂顯示名稱")!;
        expect(custom.target).toBe("Another Note");
        const plain = links.find((l) => l.target === "demo.mp3")!;
        expect(plain.display).toBe("demo.mp3");
    });

    it("有 scheme 的目標會被濾掉", () => {
        const cache: CachedMetadata = {
            links: [
                { link: "https://example.com", original: "", displayText: "x", position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 1, offset: 1 } } },
                { link: "obsidian://open?vault=v", original: "", displayText: "y", position: { start: { line: 0, col: 2, offset: 2 }, end: { line: 0, col: 3, offset: 3 } } },
                { link: "Note", original: "", displayText: "z", position: { start: { line: 0, col: 4, offset: 4 }, end: { line: 0, col: 5, offset: 5 } } },
            ],
        };
        expect(buildLinks(cache).map((l) => l.target)).toEqual(["Note"]);
    });

    it("沒有 links 與 embeds 時回傳空陣列", () => {
        expect(buildLinks({})).toEqual([]);
    });
});
