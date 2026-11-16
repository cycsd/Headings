import type { Range, TreeNode } from "./tree";
import { contentRange } from "./tree";
import { pathTo } from "./tree-ops";

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
    /** 新增兄弟時：來源在同一份清單裡排在後面的兄弟（由 followingSiblings 取得）；有序清單用它接編號與重排 */
    following?: readonly TreeNode[];
};

export type Insertion = {
    patch: TextPatch;
    /** 新節點文字的起點，cache 更新後用它找到新節點 */
    nodeStart: number;
    /** 跟著新增一起套的補丁（有序清單後面兄弟的重新編號）；位置都以原文為準，與 patch 不重疊 */
    extra?: TextPatch[];
};

const ORDERED_MARKER = /^(\d+)([.)])(?=\s)/;

const listSource = (doc: string, node: TreeNode): string => node.text ?? doc.slice(node.range.from, node.range.to);

/** 有序清單項的編號與分隔符號（`1.` 或 `1)`）；不是有序項回傳 null */
const orderedInfo = (doc: string, node: TreeNode): { num: number; delim: string; digits: number } | null => {
    const match = ORDERED_MARKER.exec(listSource(doc, node));
    return match ? { num: Number(match[1]), delim: match[2]!, digits: match[1]!.length } : null;
};

/** 新清單項的起始文字：符號與任務狀態的規則見 insertSibling / insertChild */
const newListItemText = (doc: string, node: TreeNode, marker: string): string => {
    const isTask = /^(?:[-*+]|\d+[.)])[ \t]+\[[^\]]\]/.test(listSource(doc, node));
    return isTask ? `${marker} [ ] ` : `${marker} `;
};

/**
 * 新增兄弟的符號與重新編號：
 * - 無序：跟隨來源的 `-`、`*`、`+`。
 * - 有序：編號是來源加一，後面同一份清單的有序兄弟依序順延（只換數字那幾個字元，補丁放 extra）。
 *   來源與下一個兄弟編號相同（全寫 1. 的懶人寫法）就視為使用者不維護編號：新項用同一個數字、不重排。
 */
const siblingMarker = (doc: string, node: TreeNode, following: readonly TreeNode[]): { marker: string; extra: TextPatch[] } => {
    const info = orderedInfo(doc, node);
    if (!info) return { marker: /^([-*+])\s/.exec(listSource(doc, node))?.[1] ?? "-", extra: [] };
    const next = following[0] ? orderedInfo(doc, following[0]) : null;
    if (next && next.delim === info.delim && next.num === info.num) return { marker: `${info.num}${info.delim}`, extra: [] };
    const extra: TextPatch[] = [];
    let num = info.num + 1;
    for (const sibling of following) {
        const sibInfo = orderedInfo(doc, sibling);
        if (!sibInfo || sibInfo.delim !== info.delim) break;
        num += 1;
        if (sibInfo.num !== num) extra.push({ from: sibling.range.from, to: sibling.range.from + sibInfo.digits, insert: String(num) });
        else break;
    }
    return { marker: `${info.num + 1}${info.delim}`, extra };
};

/** 新增子項的符號：來源是有序清單就接在最後一個有序子項後面（沒有就從 1 起），否則跟隨來源的無序符號 */
const childMarker = (doc: string, node: TreeNode): string => {
    const info = orderedInfo(doc, node);
    if (!info) return /^([-*+])\s/.exec(listSource(doc, node))?.[1] ?? "-";
    const last = node.children.at(-1);
    const lastInfo = last ? orderedInfo(doc, last) : null;
    return `${lastInfo && lastInfo.delim === info.delim ? lastInfo.num + 1 : 1}${info.delim}`;
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
        const { marker, extra } = siblingMarker(doc, node, options.following ?? []);
        return {
            patch: { from: at, to: at, insert: `\n${indent}${newListItemText(doc, node, marker)}` },
            nodeStart: at + 1 + indent.length,
            ...(extra.length > 0 ? { extra } : {}),
        };
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
        return { patch: { from: at, to: at, insert: `\n${indent}${newListItemText(doc, node, childMarker(doc, node))}` }, nodeStart: at + 1 + indent.length };
    }
    const level = (node.level ?? 0) + 1;
    return { patch: { from: at, to: at, insert: `\n\n${headingPrefix(level)}` }, nodeStart: at + 2 };
};

/**
 * 刪除節點含子樹（整行，含自己的換行）。接起來的地方最多留一個空行：前後原本各空一行就吃掉多出來的；
 * 清單最後一項後面的空行要留著，不然下一段會黏進清單變成同一項。刪到檔尾就連前面的空行一起吃掉。
 * root 不能刪，回傳 null。
 */
export const deleteNode = (doc: string, node: TreeNode): TextPatch | null => {
    if (node.kind === "root") return null;
    let { from, to } = subtreeRange(node);
    // list item 的 range 從「-」開始，前面的縮排要一起刪，否則會留在下一行前面變成多餘縮排
    const start = lineStart(doc, from);
    if (/^[ \t]*$/.test(doc.slice(start, from))) from = start;
    if (doc[to] === "\n") to += 1;
    let before = 0;
    while (from - before > 0 && doc[from - before - 1] === "\n") before += 1;
    let after = 0;
    while (to + after < doc.length && doc[to + after] === "\n") after += 1;
    // 接合處的換行總數：中間最多兩個（一個空行），檔尾一個都不留
    let excess = before + after - (to + after >= doc.length ? 0 : 2);
    if (excess > 0) {
        const eatAfter = Math.min(after, excess);
        to += eatAfter;
        from -= Math.min(before, excess - eatAfter);
    }
    return { from, to, insert: "" };
};

/** 清單項的核取方塊：清單符號後面的 `[ ]` / `[x]`（含 Obsidian 的自訂狀態如 `[-]`、`[/]`） */
const TASK_LINE = /^([ \t]*(?:[-*+]|\d+[.)])[ \t]+\[)([^\]])\]/;

/**
 * 一段文字裡每個核取方塊所在行的起點（相對於這段文字），順序跟渲染出來的 checkbox 一致；程式碼圍欄裡的不算。
 * 渲染出來的第 n 個 checkbox 對應這裡的第 n 個，拿來把點擊對回原文。
 */
export const taskLineOffsets = (text: string): number[] => {
    const offsets: number[] = [];
    let fence: string | null = null;
    let offset = 0;
    for (const line of text.split("\n")) {
        const open = /^\s*(```+|~~~+)/.exec(line);
        if (open) {
            const marker = open[1]!;
            if (fence === null) fence = marker[0]!.repeat(3);
            else if (marker.startsWith(fence)) fence = null;
        } else if (fence === null && TASK_LINE.test(line)) {
            offsets.push(offset);
        }
        offset += line.length + 1;
    }
    return offsets;
};

/**
 * 切換 offset 所在行的核取方塊：跟 Obsidian 一樣，空格變 x、其他任何狀態變空格。
 * 那一行不是核取方塊回傳 null。補丁長度不變，不會動到任何節點的位置。
 */
export const toggleTask = (doc: string, offset: number): TextPatch | null => {
    const start = lineStart(doc, offset);
    const end = doc.indexOf("\n", start);
    const line = doc.slice(start, end === -1 ? doc.length : end);
    const match = TASK_LINE.exec(line);
    if (!match) return null;
    const at = start + match[1]!.length;
    return { from: at, to: at + 1, insert: match[2] === " " ? "x" : " " };
};

/** 補丁套到文字上（測試與鏡像用） */
export const applyPatch = (doc: string, patch: TextPatch): string => doc.slice(0, patch.from) + patch.insert + doc.slice(patch.to);

/** 拖曳落點：放進目標底下（最後一個子節點）、插在目標前面、插在目標後面 */
export type DropPosition = "into" | "before" | "after";

/**
 * 「放進去」的種類規則：source 子樹搬到 target 底下成為最後一個子節點。
 * - heading → heading / root：子樹裡每個標題的層級整體位移到 target 層級加一（最多 6）。
 * - list item → list item：縮排改成 target 的縮排加一層；list item → heading：變成該 heading 內容區最後的清單。
 * - 其他升級段落 → heading：搬到該 heading 內容區最後。
 * - 不能搬到自己或自己的子孫底下；heading 不能搬進 list item；升級段落不能搬進 list item；section 不能當 target。
 */
export const canMove = (source: TreeNode, target: TreeNode): boolean => {
    if (source.kind === "root" || target.kind === "section") return false;
    if (source.id === target.id || isDescendant(source, target.id)) return false;
    if (target.kind === "listItem") return source.kind === "listItem";
    return true;
};

/**
 * 「插在前 / 後」的種類規則：只允許同種類（heading↔heading、list item↔list item、section↔section）。
 * 跨種類在文字上會變成別的結構（段落放在 `## H` 前面其實是前一個節點的內容），結果會跟預覽不一致。
 * root 沒有兄弟；不能插在自己或自己子孫的旁邊。
 */
export const canInsertBeside = (source: TreeNode, target: TreeNode): boolean => {
    if (source.kind === "root" || target.kind === "root" || source.kind !== target.kind) return false;
    return source.id !== target.id && !isDescendant(source, target.id);
};

export const canMoveTo = (source: TreeNode, target: TreeNode, position: DropPosition): boolean =>
    position === "into" ? canMove(source, target) : canInsertBeside(source, target);

/**
 * 拖曳時某個落點是否合法：種類規則之外再排除「原地」——插在自己前一個兄弟的後面、或後一個兄弟的前面，搬完等於沒搬。
 * 聚焦時的可見根不能當 before / after 的目標，由呼叫端另外判斷（這裡只看整棵樹）。
 */
export const canDrop = (root: TreeNode, source: TreeNode, target: TreeNode, position: DropPosition): boolean => {
    if (!canMoveTo(source, target, position)) return false;
    if (position === "into") return true;
    const path = pathTo(root, target.id);
    const siblings = path[path.length - 2]?.children ?? [];
    const index = siblings.findIndex((n) => n.id === target.id);
    const neighbour = position === "before" ? siblings[index - 1] : siblings[index + 1];
    return neighbour?.id !== source.id;
};

const isDescendant = (node: TreeNode, id: string): boolean => node.children.some((c) => c.id === id || isDescendant(c, id));

/** 整段文字裡的標題層級全部位移 delta；程式碼圍欄裡的 # 不動 */
export const shiftHeadingLevels = (text: string, delta: number): string => {
    if (delta === 0) return text;
    let fence: string | null = null;
    return text
        .split("\n")
        .map((line) => {
            const open = /^\s*(```+|~~~+)/.exec(line);
            if (open) {
                const marker = open[1]!;
                if (fence === null) fence = marker[0]!.repeat(3);
                else if (marker.startsWith(fence)) fence = null;
                return line;
            }
            if (fence !== null) return line;
            const heading = /^(#{1,6})(\s)/.exec(line);
            if (!heading) return line;
            const level = Math.min(6, Math.max(1, heading[1]!.length + delta));
            return "#".repeat(level) + line.slice(heading[1]!.length);
        })
        .join("\n");
};

/** 把 list item 子樹的縮排從 from 換成 to：第一行（range 從「-」起）直接加 to，其餘行換掉前綴 */
const reindentList = (text: string, from: string, to: string): string =>
    text
        .split("\n")
        .map((line, i) => {
            if (i === 0) return to + line;
            if (line === "") return line;
            if (line.startsWith(from)) return to + line.slice(from.length);
            return to + line.replace(/^[ \t]+/, "");
        })
        .join("\n");

export type Move = {
    /** 剪下與貼上兩個補丁，位置都以原文為準 */
    patches: TextPatch[];
    /** 搬過去之後節點文字的起點（以套完補丁後的文件為準），cache 更新後用它找回節點 */
    nodeStart: number;
};

/**
 * 拖曳搬移：把 source 的整個子樹搬到 target 的指定位置。
 * - into：成為 target 的最後一個子節點，規則見 canMove；heading 層級變 target 加一、list item 縮排加一層。
 * - before / after：成為 target 的兄弟，規則見 canInsertBeside；heading 層級、list item 縮排都改成跟 target 一樣。
 *   before 寫在 target 那一行之前（list item 從行首含縮排），after 寫在 target 整個子樹之後（含尾端的 ---）。
 */
export const moveNode = (
    doc: string,
    source: TreeNode,
    target: TreeNode,
    position: DropPosition = "into",
    indentUnit = detectIndentUnit(doc),
): Move | null => {
    if (!canMoveTo(source, target, position)) return null;
    const cut = deleteNode(doc, source);
    if (!cut) return null;
    const raw = doc.slice(source.range.from, subtreeRange(source).to);
    const before = position === "before";

    /** 搬過去的文字（層級 / 縮排已調好） */
    let body: string;
    let at: number;
    /** list item 行首的縮排；也是 body 第一行的前綴，節點文字從它後面開始 */
    let indent = "";
    if (source.kind === "heading") {
        const level = position === "into" ? (target.kind === "root" ? 1 : (target.level ?? 0) + 1) : (target.level ?? 1);
        body = shiftHeadingLevels(raw, level - (source.level ?? 1));
        at = before ? target.range.from : subtreeRange(target).to;
    } else if (source.kind === "listItem") {
        const fromIndent = lineIndent(doc, source.range.from);
        if (target.kind === "listItem") {
            indent = lineIndent(doc, target.range.from) + (position === "into" ? indentUnit : "");
            body = reindentList(raw, fromIndent, indent);
            at = before ? lineStart(doc, target.range.from) : subtreeRange(target).to;
        } else {
            body = reindentList(raw, fromIndent, "");
            at = editRange(target).to;
        }
    } else {
        body = raw;
        at = before ? target.range.from : position === "after" ? subtreeRange(target).to : editRange(target).to;
    }

    // 清單項之間只隔一個換行，其餘空一行；插前面時分隔接在 body 後面
    const sep = source.kind === "listItem" && target.kind === "listItem" ? "\n" : "\n\n";
    const insert = before ? body + sep : sep + body;
    const lead = (before ? 0 : sep.length) + indent.length;

    // 插入點落在被剪掉的範圍裡（例如搬到自己父節點的最後面）就移到剪掉範圍之後，兩個補丁才不會重疊
    if (at > cut.from && at < cut.to) at = cut.to;
    // 插入點在剪掉範圍之後的話，套完補丁後會往前移剪掉的長度
    const shifted = at >= cut.to ? at - (cut.to - cut.from) : at;
    return { patches: [cut, { from: at, to: at, insert }], nodeStart: shifted + lead };
};

/** 多個互不重疊的補丁一次套上（位置都以原文為準），從後往前套就不用重算 offset */
export const applyPatches = (doc: string, patches: readonly TextPatch[]): string =>
    [...patches].sort((a, b) => b.from - a.from || b.to - a.to).reduce((text, patch) => applyPatch(text, patch), doc);
