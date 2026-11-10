/**
 * 純資料的樹模型，不 import obsidian。
 *
 * - adapter 層把 CachedMetadata 轉成「完整樹」(HeadingNode)，每個 section 都是候選節點。
 * - promote() 依 policy 決定哪些候選節點升為子節點，產出 layout 要用的 TreeNode。
 */

/** 文件內的 offset 區間 [from, to) */
export type Range = {
    from: number;
    to: number;
};

export type NodeKind = "root" | "heading" | "section" | "listItem";

/** list item 本身（不含子 list），children 為巢狀子 item */
export type ListItemNode = {
    kind: "listItem";
    id: string;
    range: Range;
    /** item 的 markdown 原文（含 list 符號，不含子 list），已去除縮排 */
    text: string;
    children: ListItemNode[];
};

/** heading 底下的一個 section，為候選節點。只有 list 型別會有 children */
export type SectionNode = {
    kind: "section";
    id: string;
    /** obsidian SectionCache.type */
    type: string;
    range: Range;
    children: ListItemNode[];
};

/** 完整樹的 heading 節點。root 是檔案本身，level 為 0 */
export type HeadingNode = {
    kind: "root" | "heading";
    id: string;
    level: number;
    title: string;
    /** heading 那一行的區間；root 為 {0,0} */
    range: Range;
    /** 標題到下一個標題前的所有 sections，依原文順序 */
    sections: SectionNode[];
    children: HeadingNode[];
};

/** promote 之後給 layout 用的節點 */
export type TreeNode = {
    id: string;
    kind: NodeKind;
    /** heading level；root 為 0；section / listItem 無 */
    level?: number;
    /** heading 標題文字；升級節點為 null（直接顯示全部內容） */
    title: string | null;
    /** 節點自身的區間：heading 行 / section / list item */
    range: Range;
    /** kind 為 section 時的 obsidian section type */
    sectionType?: string;
    /** list item 去縮排後的原文，僅 kind 為 listItem 時有值 */
    text?: string;
    /** 留在內容區（未升級）的 sections，只有 heading / root 會有 */
    sections: SectionNode[];
    children: TreeNode[];
};

/** 決定一個候選 section 是否升為子節點 */
export type PromotePolicy = (section: SectionNode) => boolean;

export const promoteNone: PromotePolicy = () => false;

/** 依型別清單決定是否升級 */
export const promoteTypes = (types: Iterable<string>): PromotePolicy => {
    const set = new Set(types);
    return (section) => set.has(section.type);
};

const listItemToTreeNode = (item: ListItemNode): TreeNode => ({
    id: item.id,
    kind: "listItem",
    title: null,
    range: item.range,
    text: item.text,
    sections: [],
    children: item.children.map(listItemToTreeNode),
});

const sectionToTreeNode = (section: SectionNode): TreeNode => ({
    id: section.id,
    kind: "section",
    title: null,
    range: section.range,
    sectionType: section.type,
    sections: [],
    children: section.children.map(listItemToTreeNode),
});

/**
 * 將完整樹依 policy 轉成 layout 用的 TreeNode。
 * 升級的 sections 排在子 heading 之前（因為 sections 在原文中位於子 heading 之前），
 * 其餘 sections 留在 node.sections 當作內容。
 */
export const promote = (root: HeadingNode, policy: PromotePolicy): TreeNode => {
    const convert = (node: HeadingNode): TreeNode => {
        const promoted: TreeNode[] = [];
        const kept: SectionNode[] = [];
        for (const section of node.sections) {
            if (policy(section)) {
                promoted.push(sectionToTreeNode(section));
            } else {
                kept.push(section);
            }
        }
        return {
            id: node.id,
            kind: node.kind,
            level: node.level,
            title: node.title,
            range: node.range,
            sections: kept,
            children: [...promoted, ...node.children.map(convert)],
        };
    };
    return convert(root);
};

/**
 * 節點在畫面上要渲染的內容區間。
 * heading：標題行到最後一個留下的 section 結尾；沒有 section 就只有標題行。
 * section / listItem：自身區間。
 */
export const contentRange = (node: TreeNode): Range => {
    const last = node.sections.at(-1);
    return last ? { from: node.range.from, to: Math.max(node.range.to, last.range.to) } : node.range;
};

/** 節點數（含自身） */
export const countNodes = (node: TreeNode): number =>
    1 + node.children.reduce((sum, child) => sum + countNodes(child), 0);
