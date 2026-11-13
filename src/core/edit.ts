import type { Range, TreeNode } from "./tree";
import { contentRange } from "./tree";

/**
 * 編輯操作的純函式：輸入樹與原文，輸出文字補丁。不碰 DOM、不碰 Obsidian。
 * 補丁由 DocumentEditor 套到文件鏡像再寫回檔案。
 */

export type TextPatch = { from: number; to: number; insert: string };

/** 預設縮排單位：Obsidian 預設用 Tab 縮排清單 */
export const DEFAULT_INDENT_UNIT = "\t";

/** 子樹在文件中的範圍：節點起點到最後一個後代（含自己的 sections）的結尾 */
export const subtreeRange = (node: TreeNode): Range => {
    let to = contentRange(node).to;
    for (const child of node.children) to = Math.max(to, subtreeRange(child).to);
    return { from: node.range.from, to };
};

/**
 * 節點的編輯範圍，也就是進編輯器的那段原文。
 * - heading / root：標題行到第一個子 heading 之前的全部內容，含已升級成節點的段落。
 * - list item：只有自己這一項，不含巢狀子項。
 * - 其他升級段落：自己那一段。
 */
export const editRange = (node: TreeNode): Range => {
    if (node.kind === "listItem" || node.kind === "section") return node.range;
    let to = contentRange(node).to;
    for (const child of node.children) {
        if (child.kind === "heading") break;
        to = Math.max(to, subtreeRange(child).to);
    }
    return { from: node.range.from, to };
};

/** offset 所在行的開頭 offset */
const lineStart = (doc: string, offset: number): number => doc.lastIndexOf("\n", offset - 1) + 1;

/** offset 所在行的前導空白 */
export const lineIndent = (doc: string, offset: number): string => {
    const start = lineStart(doc, offset);
    return /^[ \t]*/.exec(doc.slice(start, offset + 1))?.[0] ?? "";
};

/**
 * 進編輯器的文字：list item 的 range 從「-」開始，第一行本來就沒有縮排，其餘行扣掉第一行的縮排量；其他節點原樣。
 * indent 是寫回時要補回去的字串。
 */
export const editText = (doc: string, node: TreeNode): { text: string; indent: string } => {
    const range = editRange(node);
    const raw = doc.slice(range.from, range.to);
    if (node.kind !== "listItem") return { text: raw, indent: "" };
    const indent = lineIndent(doc, range.from);
    if (indent === "") return { text: raw, indent };
    const text = raw
        .split("\n")
        .map((line, i) => (i === 0 ? line : line.startsWith(indent) ? line.slice(indent.length) : line.replace(/^[ \t]+/, "")))
        .join("\n");
    return { text, indent };
};

/** 編輯器的文字寫回：第一行接在原本的縮排後面，其餘非空行補回縮排 */
export const commitEdit = (doc: string, node: TreeNode, text: string): TextPatch => {
    const range = editRange(node);
    const { indent } = editText(doc, node);
    const insert = indent === "" ? text : text.split("\n").map((line, i) => (i === 0 || line === "" ? line : indent + line)).join("\n");
    return { from: range.from, to: range.to, insert };
};

/** 從文件裡既有的巢狀清單項目偵測縮排單位（取最短的前導空白），沒有就用 Tab */
export const detectIndentUnit = (doc: string): string => {
    let unit: string | null = null;
    for (const match of doc.matchAll(/^([ \t]+)(?:[-*+]|\d+[.)]) /gm)) {
        const indent = match[1]!;
        if (unit === null || indent.length < unit.length) unit = indent;
    }
    return unit ?? DEFAULT_INDENT_UNIT;
};

const headingPrefix = (level: number): string => "#".repeat(Math.min(6, Math.max(1, level))) + " ";

export type InsertOptions = {
    /** 清單縮排單位；沒給就從文件偵測 */
    indentUnit?: string;
    /** 新段落的佔位文字；cache 不會為空行建 section，所以一定要有內容 */
    placeholder: string;
};

export type Insertion = {
    patch: TextPatch;
    /** 新節點文字的起點，cache 更新後用它找到新節點 */
    nodeStart: number;
};

/**
 * 新增兄弟：插在節點整個子樹之後。heading 同層級前綴、list item 同縮排、升級段落放佔位文字。
 * root 沒有兄弟，回傳 null。
 */
export const insertSibling = (doc: string, node: TreeNode, options: InsertOptions): Insertion | null => {
    if (node.kind === "root") return null;
    const at = subtreeRange(node).to;
    if (node.kind === "listItem") {
        const indent = lineIndent(doc, node.range.from);
        // list item 的 range 從「-」開始，不含縮排，所以新節點的起點要跳過縮排
        return { patch: { from: at, to: at, insert: `\n${indent}- ` }, nodeStart: at + 1 + indent.length };
    }
    const body = node.kind === "heading" ? headingPrefix(node.level ?? 1) : options.placeholder;
    return { patch: { from: at, to: at, insert: `\n\n${body}` }, nodeStart: at + 2 };
};

/**
 * 新增子節點：加在子樹最後面。heading 層級加一（最多 6，root 為 1）、list item 縮排再加一層。
 * 升級段落不能有子節點，回傳 null。
 */
export const insertChild = (doc: string, node: TreeNode, options: InsertOptions): Insertion | null => {
    if (node.kind === "section") return null;
    const at = subtreeRange(node).to;
    if (node.kind === "listItem") {
        const indent = lineIndent(doc, node.range.from) + (options.indentUnit ?? detectIndentUnit(doc));
        return { patch: { from: at, to: at, insert: `\n${indent}- ` }, nodeStart: at + 1 + indent.length };
    }
    const level = (node.level ?? 0) + 1;
    return { patch: { from: at, to: at, insert: `\n\n${headingPrefix(level)}` }, nodeStart: at + 2 };
};

/**
 * 刪除節點含子樹，連同後面的空行一起吃掉；刪到檔尾就改吃前面的空行，避免留下多餘空白。
 * root 不能刪，回傳 null。
 */
export const deleteNode = (doc: string, node: TreeNode): TextPatch | null => {
    if (node.kind === "root") return null;
    const range = subtreeRange(node);
    let { from, to } = range;
    while (to < doc.length && doc[to] === "\n") to += 1;
    if (to >= doc.length) {
        while (from > 0 && doc[from - 1] === "\n") from -= 1;
    }
    return { from, to, insert: "" };
};

/** 補丁套到文字上（測試與鏡像用） */
export const applyPatch = (doc: string, patch: TextPatch): string => doc.slice(0, patch.from) + patch.insert + doc.slice(patch.to);
