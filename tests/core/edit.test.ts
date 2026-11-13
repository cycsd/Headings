import { describe, expect, it } from "vitest";
import type { CachedMetadata } from "obsidian";
import { buildLinks, buildTree } from "../../src/adapter/obsidian-tree";
import { promote, promoteTypes, type TreeNode } from "../../src/core/tree";
import { findNode } from "../../src/core/tree-ops";
import {
    applyPatch,
    commitEdit,
    deleteNode,
    detectIndentUnit,
    editRange,
    editText,
    insertChild,
    insertSibling,
    subtreeRange,
} from "../../src/core/edit";
import {
    obsidianMarkdownAllSyntaxExampleDoc as doc,
    obsidianMarkdownAllSyntaxExampleMetadata as fixtureMetadata,
} from "../fixtures/obsidian-markdown-fixture";

const metadata = fixtureMetadata as unknown as CachedMetadata;
const fileName = "Obsidian Markdown All Syntax Example.md";

/** list 升級成節點，這樣 heading 底下才會同時有留下的 section 與升級的子節點 */
const tree = (): TreeNode => promote(buildTree(metadata, doc, fileName), promoteTypes(["list"]), buildLinks(buildTreeCache()));
const buildTreeCache = () => metadata;

const byTitle = (root: TreeNode, title: string): TreeNode => {
    const walk = (node: TreeNode): TreeNode | null => {
        if (node.title === title) return node;
        for (const child of node.children) {
            const found = walk(child);
            if (found) return found;
        }
        return null;
    };
    const found = walk(root);
    if (!found) throw new Error(`no node titled ${title}`);
    return found;
};

const slice = (range: { from: number; to: number }) => doc.slice(range.from, range.to);

describe("editRange / subtreeRange", () => {
    it("heading 的編輯範圍含升級的 list，到下一個 heading 之前", () => {
        const lists = byTitle(tree(), "4. 清單");
        const text = slice(editRange(lists));
        expect(text.startsWith("## 4. 清單")).toBe(true);
        expect(text).toContain("- 項目 C");
        expect(text).toContain("- [x] 子任務 2");
        expect(text).not.toContain("## 5.");
    });

    it("list item 只有自己這一項，不含巢狀子項", () => {
        const lists = byTitle(tree(), "4. 清單");
        const itemB = lists.children.find((c) => c.kind === "listItem" && c.text?.startsWith("- 項目 B"))!;
        expect(slice(editRange(itemB))).toBe("- 項目 B");
        expect(slice(subtreeRange(itemB))).toBe("- 項目 B\n  - 子項目 B-1\n  - 子項目 B-2");
    });

    it("root 的編輯範圍是 frontmatter 到第一個 heading 之前", () => {
        const root = tree();
        const text = slice(editRange(root));
        expect(text.startsWith("---\ntitle:")).toBe(true);
        expect(text).not.toContain("# Obsidian Markdown");
    });
});

describe("editText / commitEdit", () => {
    it("巢狀 list item 去掉縮排進編輯器，寫回時補回", () => {
        const lists = byTitle(tree(), "4. 清單");
        const itemB = lists.children.find((c) => c.kind === "listItem" && c.text?.startsWith("- 項目 B"))!;
        const sub = itemB.children[0]!;
        const edit = editText(doc, sub);
        expect(edit).toEqual({ text: "- 子項目 B-1", indent: "  " });

        const patch = commitEdit(doc, sub, "- 子項目 B-1 改\n  - 新增孫項");
        // range 從「-」開始，第一行的縮排在 range 外面不動；之後的行補回「  」
        expect(patch.insert).toBe("- 子項目 B-1 改\n    - 新增孫項");
        expect(applyPatch(doc, patch)).toContain("- 項目 B\n  - 子項目 B-1 改\n    - 新增孫項\n  - 子項目 B-2");
    });

    it("heading 原樣進出", () => {
        const h = byTitle(tree(), "5. 引用與水平線");
        const { text, indent } = editText(doc, h);
        expect(indent).toBe("");
        expect(text.startsWith("## 5. 引用與水平線")).toBe(true);
        const patch = commitEdit(doc, h, "## 5. 改名\n\n新內容");
        // heading 5 的編輯範圍含它結尾的 ---，所以整段被新內容取代
        expect(applyPatch(doc, patch)).toContain("## 5. 改名\n\n新內容\n\n## 6. Callout");
    });
});

describe("insertSibling / insertChild", () => {
    const options = { placeholder: "新段落" };

    it("heading 兄弟插在整個子樹之後，同層級", () => {
        const h = byTitle(tree(), "4. 清單");
        const result = insertSibling(doc, h, options)!;
        const next = applyPatch(doc, result.patch);
        // 每節結尾的 --- 是 thematicBreak section，屬於前一個 heading，所以新兄弟插在它後面
        expect(next).toContain("- [x] 子任務 2\n\n---\n\n## \n\n## 5.");
        expect(next.slice(result.nodeStart, result.nodeStart + 3)).toBe("## ");
    });

    it("heading 子節點層級加一，加在子樹最後", () => {
        const h = byTitle(tree(), "4. 清單");
        const result = insertChild(doc, h, options)!;
        expect(applyPatch(doc, result.patch)).toContain("- [x] 子任務 2\n\n---\n\n### \n\n## 5.");
    });

    it("list item 兄弟同縮排、子項再縮一層，縮排單位從文件偵測", () => {
        expect(detectIndentUnit(doc)).toBe("  ");
        const lists = byTitle(tree(), "4. 清單");
        const itemB = lists.children.find((c) => c.kind === "listItem" && c.text?.startsWith("- 項目 B"))!;
        const sub = itemB.children[1]!;
        const sibling = insertSibling(doc, sub, options)!;
        expect(applyPatch(doc, sibling.patch)).toContain("  - 子項目 B-2\n  - \n- 項目 C");
        const child = insertChild(doc, sub, options)!;
        expect(applyPatch(doc, child.patch)).toContain("  - 子項目 B-2\n    - \n- 項目 C");
        expect(applyPatch(doc, insertSibling(doc, itemB, options)!.patch)).toContain("  - 子項目 B-2\n- \n- 項目 C");
        // 新節點的起點要落在「-」上（list item 的 range 不含縮排），cache 更新後才找得到它
        expect(applyPatch(doc, sibling.patch).slice(sibling.nodeStart, sibling.nodeStart + 2)).toBe("- ");
        expect(applyPatch(doc, child.patch).slice(child.nodeStart, child.nodeStart + 2)).toBe("- ");
    });

    it("升級段落的兄弟放佔位文字，不能加子節點；root 沒有兄弟", () => {
        const root = promote(buildTree(metadata, doc, fileName), promoteTypes(["code"]), []);
        const code = byTitle(root, "7. 程式碼").children.find((c) => c.kind === "section")!;
        const result = insertSibling(doc, code, options)!;
        expect(applyPatch(doc, result.patch).slice(result.nodeStart, result.nodeStart + 3)).toBe("新段落");
        expect(insertChild(doc, code, options)).toBeNull();
        expect(insertSibling(doc, root, options)).toBeNull();
    });

    it("最上層 heading 的兄弟是同層級；root 的子節點是 h1", () => {
        const root = tree();
        const h1 = root.children[0]!;
        expect(insertSibling(doc, h1, options)!.patch.insert).toBe("\n\n# ");
        expect(insertChild(doc, root, options)!.patch.insert).toBe("\n\n# ");
    });
});

describe("deleteNode", () => {
    it("刪掉子樹與後面的空行，前後段落接起來", () => {
        const h = byTitle(tree(), "5. 引用與水平線");
        const next = applyPatch(doc, deleteNode(doc, h)!);
        expect(next).not.toContain("## 5. 引用與水平線");
        expect(next).toContain("- [x] 子任務 2\n\n---\n\n## 6. Callout");
    });

    it("刪 list item 連子項一起，兄弟接上", () => {
        const lists = byTitle(tree(), "4. 清單");
        const itemB = lists.children.find((c) => c.kind === "listItem" && c.text?.startsWith("- 項目 B"))!;
        expect(applyPatch(doc, deleteNode(doc, itemB)!)).toContain("- 項目 A\n- 項目 C");
    });

    it("刪最後一個節點時改吃前面的空行；root 不能刪", () => {
        const root = tree();
        const last = byTitle(root, "18. 參考範例（屬性與連結）");
        const next = applyPatch(doc, deleteNode(doc, last)!);
        expect(next.endsWith("---\n")).toBe(false);
        expect(next.endsWith("---")).toBe(true);
        expect(deleteNode(doc, root)).toBeNull();
        expect(findNode(root, last.id)).not.toBeNull();
    });
});
