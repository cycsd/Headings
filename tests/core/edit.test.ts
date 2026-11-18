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
    applyPatches,
    canMove,
    canDrop,
    moveNode,
    taskLineOffsets,
    toggleTask,
    shiftHeadingLevels,
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

    it("來源是任務清單項：新的帶空的 [ ]（不複製 [x]）；符號跟隨來源，有序清單用 -", () => {
        const item = (text: string, from = 0) =>
            ({ id: "x", kind: "listItem", title: null, text, range: { from, to: from + text.length }, sections: [], links: [], children: [] }) as TreeNode;
        const inserted = (text: string, make: typeof insertSibling) => make(text, item(text), options)!.patch.insert;
        expect(inserted("- [x] done", insertSibling)).toBe("\n- [ ] ");
        expect(inserted("- [ ] todo", insertChild)).toBe("\n\t- [ ] ");
        expect(inserted("- [/] doing", insertSibling)).toBe("\n- [ ] ");
        expect(inserted("* star", insertSibling)).toBe("\n* ");
        expect(inserted("+ [x] plus task", insertSibling)).toBe("\n+ [ ] ");
        expect(inserted("1. [x] numbered task", insertSibling)).toBe("\n2. [ ] ");
        expect(inserted("1. numbered", insertSibling)).toBe("\n2. ");
        expect(inserted("- plain", insertSibling)).toBe("\n- ");
    });

    describe("有序清單的編號", () => {
        const lines = ["1. a", "2. b", "3. c"];
        const build = () => {
            let from = 0;
            return lines.map((text) => {
                const n = { id: `S:list:0:${from}`, kind: "listItem", title: null, text, range: { from, to: from + text.length }, sections: [], links: [], children: [] } as TreeNode;
                from += text.length + 1;
                return n;
            });
        };
        const text = lines.join("\n");

        it("新增兄弟：新項是來源加一，後面的兄弟依序順延，補丁一起套得到整齊的編號", () => {
            const [a, b, c] = build();
            const result = insertSibling(text, a!, { placeholder: "", following: [b!, c!] })!;
            expect(result.patch.insert).toBe("\n2. ");
            expect(applyPatches(text, [result.patch, ...(result.extra ?? [])])).toBe("1. a\n2. \n3. b\n4. c");
        });

        it("加在最後一項後面：沒有後續兄弟，只有新項", () => {
            const [, , c] = build();
            const result = insertSibling(text, c!, { placeholder: "", following: [] })!;
            expect(result.patch.insert).toBe("\n4. ");
            expect(result.extra).toBeUndefined();
        });

        it("全寫 1. 的清單視為不維護編號：新項同數字、不重排", () => {
            const lazy = ["1. a", "1. b"];
            const first = { id: "S:list:0:0", kind: "listItem", title: null, text: lazy[0], range: { from: 0, to: 4 }, sections: [], links: [], children: [] } as TreeNode;
            const second = { ...first, id: "S:list:0:1", text: lazy[1], range: { from: 5, to: 9 } } as TreeNode;
            const result = insertSibling(lazy.join("\n"), first, { placeholder: "", following: [second] })!;
            expect(result.patch.insert).toBe("\n1. ");
            expect(result.extra).toBeUndefined();
        });

        it("分隔符號跟隨來源（1) 維持 1)）；位數變多時只換數字", () => {
            const nine = { id: "S:list:0:0", kind: "listItem", title: null, text: "9) a", range: { from: 0, to: 4 }, sections: [], links: [], children: [] } as TreeNode;
            const ten = { ...nine, id: "S:list:0:1", text: "10) b", range: { from: 5, to: 10 } } as TreeNode;
            const doc = "9) a\n10) b";
            const result = insertSibling(doc, nine, { placeholder: "", following: [ten] })!;
            expect(result.patch.insert).toBe("\n10) ");
            expect(applyPatches(doc, [result.patch, ...(result.extra ?? [])])).toBe("9) a\n10) \n11) b");
        });

        it("新增子項：有序來源接在最後一個有序子項後面、沒有就從 1 起；無序來源的子項維持 -", () => {
            const parent = { id: "S:list:0:0", kind: "listItem", title: null, text: "1. p", range: { from: 0, to: 4 }, sections: [], links: [], children: [] } as TreeNode;
            expect(insertChild("1. p", parent, { placeholder: "" })!.patch.insert).toBe("\n\t1. ");
            const kid = { ...parent, id: "S:list:0:0:0", text: "3. k", range: { from: 5, to: 9 } } as TreeNode;
            expect(insertChild("1. p\n   3. k", { ...parent, children: [kid] }, { placeholder: "" })!.patch.insert).toContain("4. ");
            const bullet = { ...parent, text: "- p" } as TreeNode;
            expect(insertChild("- p", bullet, { placeholder: "" })!.patch.insert).toBe("\n\t- ");
        });
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

    it("刪清單最後一項：清單與下一段之間的空行留著，下一段不會黏進清單", () => {
        const lists = byTitle(tree(), "4. 清單");
        const itemC = lists.children.find((c) => c.kind === "listItem" && c.text?.startsWith("- 項目 C"))!;
        expect(applyPatch(doc, deleteNode(doc, itemC)!)).toContain("  - 子項目 B-2\n\n有序清單：");
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

describe("taskLineOffsets / toggleTask", () => {
    it("列出核取方塊所在行的起點，程式碼圍欄裡的不算", () => {
        const text = "- [ ] a\n- plain\n  - [x] b\n```\n- [ ] not\n```\n1. [-] c";
        expect(taskLineOffsets(text)).toEqual([0, 16, 44]);
    });

    it("空格變 x、其他狀態變空格；不是核取方塊回傳 null；長度不變", () => {
        const text = "- [ ] a\n- [x] b\n- [-] c\n- plain";
        expect(applyPatch(text, toggleTask(text, 0)!)).toBe("- [x] a\n- [x] b\n- [-] c\n- plain");
        expect(applyPatch(text, toggleTask(text, 10)!)).toBe("- [ ] a\n- [ ] b\n- [-] c\n- plain");
        expect(applyPatch(text, toggleTask(text, 16)!)).toBe("- [ ] a\n- [x] b\n- [ ] c\n- plain");
        expect(toggleTask(text, 26)).toBeNull();
    });

    it("在真實文件上：待辦清單的子任務", () => {
        const at = doc.indexOf("- [ ] 子任務 1");
        expect(applyPatch(doc, toggleTask(doc, at + 3)!)).toContain("  - [x] 子任務 1\n  - [x] 子任務 2");
    });
});

describe("moveNode", () => {
    const listItemOf = (root: TreeNode, headingTitle: string, prefix: string): TreeNode => {
        const h = byTitle(root, headingTitle);
        const found = h.children.find((c) => c.kind === "listItem" && c.text?.startsWith(prefix));
        if (!found) throw new Error(`no list item ${prefix}`);
        return found;
    };

    it("heading 搬到另一個 heading 底下：成為最後一個子節點，層級整體位移", () => {
        const root = tree();
        const h5 = byTitle(root, "5. 引用與水平線");
        const h2 = byTitle(root, "2. 標題層級");
        // 2. 標題層級 底下有 # H1 … ###### H6 子標題，h5（h2）搬進去變 h3，最後面
        const next = applyPatches(doc, moveNode(doc, h5, h2)!.patches);
        expect(next).not.toContain("\n## 5. 引用與水平線");
        expect(next).toContain("### 5. 引用與水平線\n\n> 這是引用。");
        // fixture 裡 2. 標題層級 底下的「# H1 … ###### H6」是真的 h1–h6，不是它的子節點，所以它的子樹到 H1 之前就結束
        expect(next.indexOf("### 5. 引用與水平線")).toBeGreaterThan(next.indexOf("## 2. 標題層級"));
        expect(next.indexOf("### 5. 引用與水平線")).toBeLessThan(next.indexOf("\n# H1"));
    });

    it("heading 子樹裡的標題跟著位移，程式碼圍欄裡的 # 不動", () => {
        const shifted = shiftHeadingLevels("## A\n\n```\n# not heading\n```\n\n### B\n###### C", 1);
        expect(shifted).toBe("### A\n\n```\n# not heading\n```\n\n#### B\n###### C");
        expect(shiftHeadingLevels("### A\n#### B", -2)).toBe("# A\n## B");
    });

    it("list item 搬到另一個 list item 底下：縮排改成目標加一層，巢狀子項跟著縮", () => {
        const root = tree();
        const itemB = listItemOf(root, "4. 清單", "- 項目 B");
        const itemA = listItemOf(root, "4. 清單", "- 項目 A");
        const next = applyPatches(doc, moveNode(doc, itemB, itemA)!.patches);
        expect(next).toContain("- 項目 A\n  - 項目 B\n    - 子項目 B-1\n    - 子項目 B-2\n- 項目 C");
    });

    it("list item 搬到 heading 底下：去掉縮排，放在該 heading 內容區最後、子 heading 之前", () => {
        const root = tree();
        const sub = listItemOf(root, "4. 清單", "- 項目 B").children[0]!;
        const h1 = byTitle(root, "1. 文字格式");
        const next = applyPatches(doc, moveNode(doc, sub, h1)!.patches);
        expect(next).toContain("---\n\n- 子項目 B-1\n\n## 2. 標題層級");
        expect(next).toContain("- 項目 B\n  - 子項目 B-2");
    });

    it("搬到自己的父節點底下等於移到最後", () => {
        const root = tree();
        const itemA = listItemOf(root, "4. 清單", "- 項目 A");
        const lists = byTitle(root, "4. 清單");
        const next = applyPatches(doc, moveNode(doc, itemA, lists)!.patches);
        expect(next).toContain("無序清單：\n\n- 項目 B\n  - 子項目 B-1");
        // 內容區最後面是這一節結尾的 ---，所以搬過去的清單會在 --- 之後
        expect(next).toContain("- [x] 子任務 2\n\n---\n\n- 項目 A\n\n## 5.");
    });

    it("不合法的搬移回傳 null：搬到自己 / 子孫、heading 進 list item、target 是升級段落、root 當 source", () => {
        const root = tree();
        const h4 = byTitle(root, "4. 清單");
        const itemA = listItemOf(root, "4. 清單", "- 項目 A");
        expect(moveNode(doc, h4, h4)).toBeNull();
        expect(moveNode(doc, h4, itemA)).toBeNull();
        expect(moveNode(doc, byTitle(root, "1. 文字格式"), itemA)).toBeNull();
        expect(moveNode(doc, root, h4)).toBeNull();
        const withCode = promote(buildTree(metadata, doc, fileName), promoteTypes(["code"]), []);
        const code = byTitle(withCode, "7. 程式碼").children.find((c) => c.kind === "section")!;
        expect(canMove(byTitle(withCode, "1. 文字格式"), code)).toBe(false);
        expect(canMove(code, byTitle(withCode, "1. 文字格式"))).toBe(true);
    });
});

describe("moveNode before / after（插在兄弟之間）", () => {
    const listItemOf = (root: TreeNode, headingTitle: string, prefix: string): TreeNode => {
        const found = byTitle(root, headingTitle).children.find((c) => c.kind === "listItem" && c.text?.startsWith(prefix));
        if (!found) throw new Error(`no list item ${prefix}`);
        return found;
    };

    it("heading 插在另一個 heading 前面：寫在目標那一行之前、層級改成跟目標一樣，nodeStart 落在標題上", () => {
        const root = tree();
        const h5 = byTitle(root, "5. 引用與水平線");
        const h2 = byTitle(root, "2. 標題層級");
        const move = moveNode(doc, h5, h2, "before")!;
        const next = applyPatches(doc, move.patches);
        expect(next).toContain("## 5. 引用與水平線\n\n> 這是引用。");
        expect(next.indexOf("## 5. 引用與水平線")).toBeLessThan(next.indexOf("## 2. 標題層級"));
        expect(next.slice(move.nodeStart, move.nodeStart + 6)).toBe("## 5. ");
        // 前面那一節結尾的 --- 跟搬過來的標題之間空一行
        expect(next).toContain("---\n\n## 5. 引用與水平線");
    });

    it("heading 插在另一個 heading 後面：寫在目標整個子樹之後（含尾端的 ---）", () => {
        const root = tree();
        const h1 = byTitle(root, "1. 文字格式");
        const h5 = byTitle(root, "5. 引用與水平線");
        const move = moveNode(doc, h1, h5, "after")!;
        const next = applyPatches(doc, move.patches);
        expect(next.indexOf("## 1. 文字格式")).toBeGreaterThan(next.indexOf("## 5. 引用與水平線"));
        expect(next.indexOf("## 1. 文字格式")).toBeLessThan(next.indexOf("## 6. Callout"));
        expect(next.slice(move.nodeStart, move.nodeStart + 6)).toBe("## 1. ");
    });

    it("子 heading 插到上一層旁邊會升級：### 搬到 ## 旁變 ##，子樹跟著位移", () => {
        const root = tree();
        const h2 = byTitle(root, "2. 標題層級");
        // 2. 標題層級 底下的 # H1 是真的 h1，所以拿 fixture 另一處：把 h2 自己插到 # H1 後面，變成 h1
        const h1 = byTitle(root, "H1");
        const next = applyPatches(doc, moveNode(doc, h2, h1, "after")!.patches);
        // # H1 的子樹一路到檔尾，所以搬到它後面就是檔尾
        expect(next).toMatch(/\n\n# 2\. 標題層級\n?$/);
        expect(next).toContain("---\n\n# H1");
    });

    it("list item 插在另一項前面 / 後面：縮排跟目標一樣、從行首插入、兄弟之間只隔一個換行", () => {
        const root = tree();
        const itemC = listItemOf(root, "4. 清單", "- 項目 C");
        const itemA = listItemOf(root, "4. 清單", "- 項目 A");
        const before = moveNode(doc, itemC, itemA, "before")!;
        const next = applyPatches(doc, before.patches);
        expect(next).toContain("無序清單：\n\n- 項目 C\n- 項目 A\n- 項目 B\n  - 子項目 B-1");
        expect(next.slice(before.nodeStart, before.nodeStart + 6)).toBe("- 項目 C");

        const sub1 = listItemOf(root, "4. 清單", "- 項目 B").children[0]!;
        const sub2 = listItemOf(root, "4. 清單", "- 項目 B").children[1]!;
        const after = moveNode(doc, sub1, sub2, "after")!;
        const swapped = applyPatches(doc, after.patches);
        expect(swapped).toContain("- 項目 B\n  - 子項目 B-2\n  - 子項目 B-1\n- 項目 C");
        expect(swapped.slice(after.nodeStart, after.nodeStart + 9)).toBe("- 子項目 B-1");
        // 項目 C 原本是清單最後一項，刪掉它之後清單與下一段之間的空行要留著
        expect(next).toContain("  - 子項目 B-2\n\n有序清單：");
    });

    it("最後一個子標題插到父節點後面（插入點落在剪掉的範圍內）：下一個標題不能黏到段落後面", () => {
        const text = "## Packing list\n\n- Passport\n\n### Budget\nbudget paragraph\n## Notes for later\n\nThe rate.\n";
        const pos = (s: string) => text.indexOf(s);
        const point = (offset: number) => ({ line: 0, col: 0, offset });
        const pos2 = (from: string, to: string) => ({ start: point(pos(from)), end: point(pos(to) + to.length) });
        const cache = {
            headings: [
                { heading: "Packing list", level: 2, position: pos2("## Packing list", "## Packing list") },
                { heading: "Budget", level: 3, position: pos2("### Budget", "### Budget") },
                { heading: "Notes for later", level: 2, position: pos2("## Notes for later", "## Notes for later") },
            ],
            sections: [
                { type: "heading", position: pos2("## Packing list", "## Packing list") },
                { type: "list", position: pos2("- Passport", "- Passport") },
                { type: "heading", position: pos2("### Budget", "### Budget") },
                { type: "paragraph", position: pos2("budget paragraph", "budget paragraph") },
                { type: "heading", position: pos2("## Notes for later", "## Notes for later") },
                { type: "paragraph", position: pos2("The rate.", "The rate.") },
            ],
        } as unknown as CachedMetadata;
        const root = buildTree(cache, text, "t.md");
        const packing = byTitle(root, "Packing list");
        const budget = byTitle(root, "Budget");
        const move = moveNode(text, budget, packing, "after")!;
        const next = applyPatches(text, move.patches);
        expect(next).toBe("## Packing list\n\n- Passport\n\n## Budget\nbudget paragraph\n\n## Notes for later\n\nThe rate.\n");
        expect(next.slice(move.nodeStart, move.nodeStart + 9)).toBe("## Budget");
    });

    it("巢狀 list item 插到上一層旁邊會減一層縮排", () => {
        const root = tree();
        const sub1 = listItemOf(root, "4. 清單", "- 項目 B").children[0]!;
        const itemB = listItemOf(root, "4. 清單", "- 項目 B");
        const next = applyPatches(doc, moveNode(doc, sub1, itemB, "after")!.patches);
        expect(next).toContain("- 項目 B\n  - 子項目 B-2\n- 子項目 B-1\n- 項目 C");
    });

    it("種類不同、root、自己 / 子孫都不能插前後；原地（相鄰兄弟）由 canDrop 擋掉", () => {
        const root = tree();
        const h4 = byTitle(root, "4. 清單");
        const h5 = byTitle(root, "5. 引用與水平線");
        const itemA = listItemOf(root, "4. 清單", "- 項目 A");
        const itemB = listItemOf(root, "4. 清單", "- 項目 B");
        expect(moveNode(doc, itemA, h4, "before")).toBeNull();
        expect(moveNode(doc, h4, itemA, "after")).toBeNull();
        expect(moveNode(doc, h4, root, "after")).toBeNull();
        expect(moveNode(doc, h4, h4, "before")).toBeNull();
        expect(moveNode(doc, h4, itemA, "before")).toBeNull();
        expect(canDrop(root, h4, h5, "before")).toBe(false);
        expect(canDrop(root, h5, h4, "after")).toBe(false);
        expect(canDrop(root, h4, h5, "after")).toBe(true);
        expect(canDrop(root, itemA, itemB, "before")).toBe(false);
        expect(canDrop(root, itemA, itemB, "after")).toBe(true);
        expect(canDrop(root, itemA, itemB, "into")).toBe(true);
    });
});

describe("moveNode.nodeStart", () => {
    it("搬過去之後的起點落在節點文字上，往前搬與往後搬都對", () => {
        const root = tree();
        const h5 = byTitle(root, "5. 引用與水平線");
        const h2 = byTitle(root, "2. 標題層級");
        const back = moveNode(doc, h5, h2)!;
        expect(applyPatches(doc, back.patches).slice(back.nodeStart, back.nodeStart + 7)).toBe("### 5. ");

        const h1 = byTitle(root, "1. 文字格式");
        const h6 = byTitle(root, "6. Callout");
        const forward = moveNode(doc, h1, h6)!;
        expect(applyPatches(doc, forward.patches).slice(forward.nodeStart, forward.nodeStart + 7)).toBe("### 1. ");

        const lists = byTitle(root, "4. 清單");
        const itemB = lists.children.find((c) => c.kind === "listItem" && c.text?.startsWith("- 項目 B"))!;
        const itemA = lists.children.find((c) => c.kind === "listItem" && c.text?.startsWith("- 項目 A"))!;
        const nested = moveNode(doc, itemB, itemA)!;
        expect(applyPatches(doc, nested.patches).slice(nested.nodeStart, nested.nodeStart + 6)).toBe("- 項目 B");
    });
});
