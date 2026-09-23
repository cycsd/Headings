import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import type { TFile } from "obsidian";
import { createTreeNode } from "../../src/view/tree";
import { obsidianMarkdownAllSyntaxExampleMetadata as metadata } from "../fixtures/obsidian-markdown-fixture";

const file = { name: "Obsidian Markdown All Syntax Example.md" } as unknown as TFile;

// second-level heading titles in document order, used to assert sibling ordering under the level-1 root heading
const level2HeadingTitles = [
    "1. 文字格式",
    "2. 標題層級",
];

const level1HeadingTitles = [
    "3. 連結（Wikilink / Markdown Link）",
    "4. 清單",
    "5. 引用與水平線",
    "6. Callout",
    "7. 程式碼",
    "8. 表格",
    "9. 數學公式（LaTeX）",
    "10. Mermaid 圖",
    "11. 嵌入（Embeds）",
    "12. 區塊連結（Block ID）",
    "13. 腳註（Footnotes）",
    "14. 註解（Comments）",
    "15. 標籤（Tags）",
    "16. HTML 內嵌",
    "17. 查詢區塊（Query）",
    "18. 參考範例（屬性與連結）",
];

describe("createTreeNode", () => {
    const root = Effect.runSync(createTreeNode(metadata, file));

    it("root 的 heading 是檔名、level 為 0", () => {
        expect(root.heading.heading).toBe(file.name);
        expect(root.heading.level).toBe(0);
    });

    it("應包含 2 個子標題 [Obsidian Markdown 語法總覽,H1]", () => {
        expect(root.children).toHaveLength(2);
        const [firstChild] = root.children as { heading: { heading: string; level: number } }[];
        expect(firstChild!.heading.heading).toBe("Obsidian Markdown 語法總覽");
        expect(firstChild!.heading.level).toBe(1);
    });

    it("level 2 標題依序成為 level 1 標題的 children", () => {
        const [firstChild] = root.children as { children: { heading: { heading: string; level: number } }[] }[];
        const titles = firstChild!.children.map((c) => c.heading.heading);
        expect(titles).toEqual(level2HeadingTitles);
    });

    it("「2. 標題層級」底下的 H1~H6 依 level 遞增巢狀嵌套", () => {
        const [firstChild] = root.children as { children: { heading: { heading: string }; children: unknown[] }[] }[];
        const headingLevelSection = firstChild!.children.find((c) => c.heading.heading === "2. 標題層級")!;

        let node = headingLevelSection as unknown as { heading: { heading: string; level: number }; children: any[] };
        for (const [expectedHeading, expectedLevel] of [
            ["H1", 1],
            ["H2", 2],
            ["H3", 3],
            ["H4", 4],
            ["H5", 5],
            ["H6", 6],
        ] as const) {
            expect(node.children).toHaveLength(1);
            node = node.children[0];
            expect(node.heading.heading).toBe(expectedHeading);
            expect(node.heading.level).toBe(expectedLevel);
        }
    });

    it("每個標題的 sections 應為該標題到下一個標題前的內容", () => {
        const [firstChild] = root.children as { children: { heading: { heading: string }; sections: { type: string }[] }[] }[];
        const textFormatSection = firstChild!.children.find((c) => c.heading.heading === "1. 文字格式")!;

        // "1. 文字格式" 之後、"2. 標題層級" 之前共有 3 個 paragraph 與 1 個 thematicBreak
        expect(textFormatSection.sections.map((s) => s.type)).toEqual([
            "paragraph",
            "paragraph",
            "paragraph",
            "thematicBreak",
        ]);
    });
});
