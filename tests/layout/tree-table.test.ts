import { describe, expect, it } from "vitest";
import type { CachedMetadata } from "obsidian";
import { buildTree } from "../../src/adapter/obsidian-tree";
import { promote, promoteNone, promoteTypes } from "../../src/core/tree";
import { treeTableLayout } from "../../src/layout/tree-table";
import baseline from "../fixtures/tree-table-baseline.json";
import {
    obsidianMarkdownAllSyntaxExampleDoc as doc,
    obsidianMarkdownAllSyntaxExampleMetadata as fixtureMetadata,
} from "../fixtures/obsidian-markdown-fixture";

const metadata = fixtureMetadata as unknown as CachedMetadata;
const fileName = "Obsidian Markdown All Syntax Example.md";

describe("treeTableLayout", () => {
    it("listAsNode 關閉時輸出與重構前的 buildCells 完全一致", () => {
        const tree = promote(buildTree(metadata, doc, fileName), promoteNone);
        const { columns, cells } = treeTableLayout(tree);

        expect(columns).toBe(baseline.columns);
        expect(
            cells.map((c) => ({
                title: doc.slice(c.node.range.from, c.node.range.to),
                depth: c.depth,
                row: c.row,
                rowSpan: c.rowSpan,
                colSpan: c.colSpan,
            })),
        ).toEqual(baseline.cells);
    });

    it("升級 list 後，list item 直接排在 heading 底下的下一欄，沒有「清單」中間節點", () => {
        const tree = promote(buildTree(metadata, doc, fileName), promoteTypes(["list"]));
        const { cells } = treeTableLayout(tree);

        const listHeading = cells.find((c) => c.node.title === "4. 清單")!;
        const under = cells.filter((c) => c.node.id.startsWith(listHeading.node.id + ":"));
        expect(under.length).toBeGreaterThan(0);
        expect(under.every((c) => c.node.kind === "listItem")).toBe(true);
        expect(under[0]!.depth).toBe(listHeading.depth + 1);
        expect(under[0]!.node.text).toBe("- 項目 A");
    });

    it("收合的節點視為葉節點，colSpan 補滿右側，子孫不出現", () => {
        const tree = promote(buildTree(metadata, doc, fileName), promoteNone);
        const overview = tree.children[0]!;
        const { columns, cells } = treeTableLayout(tree, { collapsed: new Set([overview.id]) });

        const cell = cells.find((c) => c.node.id === overview.id)!;
        expect(cell.rowSpan).toBe(1);
        expect(cell.colSpan).toBe(columns);
        expect(cells.some((c) => c.node.id.startsWith(overview.id + "/"))).toBe(false);
    });

    it("只有 root 時 columns 為 1、沒有 cell", () => {
        const tree = promote(buildTree({}, "", "empty.md"), promoteNone);
        expect(treeTableLayout(tree)).toEqual({ columns: 1, cells: [] });
    });
});
