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

/** 文件內的一個內部連結或 embed（外部網址在 adapter 就濾掉） */
export type LinkRef = {
    /** 連結目標，例如 "Another Note#Section A"、"#heading"、"image.png" */
    target: string;
    /** 顯示文字，沒有就等於 target */
    display: string;
    range: Range;
    embed: boolean;
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
    /** 落在節點自身範圍內（不含子節點範圍）的連結 */
    links: LinkRef[];
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
    links: [],
    children: item.children.map(listItemToTreeNode),
});

const sectionToTreeNode = (section: SectionNode): TreeNode => ({
    id: section.id,
    kind: "section",
    title: null,
    range: section.range,
    sectionType: section.type,
    sections: [],
    links: [],
    children: section.children.map(listItemToTreeNode),
});

/**
 * 將完整樹依 policy 轉成 layout 用的 TreeNode。
 * 升級的 sections 排在子 heading 之前（因為 sections 在原文中位於子 heading 之前），
 * 其餘 sections 留在 node.sections 當作內容。
 * list 升級時沒有「清單」這個中間節點：list item 直接成為 heading 的子節點（子 item 再往下掛）。
 * links 依位置分配：落在節點內容範圍內、但不在任何後代範圍內的連結屬於該節點。
 */
export const promote = (root: HeadingNode, policy: PromotePolicy, links: readonly LinkRef[] = []): TreeNode => {
    const convert = (node: HeadingNode): TreeNode => {
        const promoted: TreeNode[] = [];
        const kept: SectionNode[] = [];
        for (const section of node.sections) {
            if (!policy(section)) {
                kept.push(section);
            } else if (section.children.length > 0) {
                promoted.push(...section.children.map(listItemToTreeNode));
            } else {
                promoted.push(sectionToTreeNode(section));
            }
        }
        return {
            id: node.id,
            kind: node.kind,
            level: node.level,
            title: node.title,
            range: node.range,
            sections: kept,
            links: [],
            children: [...promoted, ...node.children.map(convert)],
        };
    };
    const tree = convert(root);
    if (links.length > 0) assignLinks(tree, links);
    return tree;
};

const within = (inner: Range, outer: Range) => inner.from >= outer.from && inner.to <= outer.to;

/** 連結是否落在某個後代節點自己的範圍內（list item 的範圍不含子 item，所以要看整個子樹） */
const claimedByDescendant = (node: TreeNode, link: LinkRef): boolean =>
    node.children.some((child) => within(link.range, child.range) || claimedByDescendant(child, link));

const assignLinks = (node: TreeNode, links: readonly LinkRef[]) => {
    const own = contentRange(node);
    node.links = links.filter((link) => within(link.range, own) && !claimedByDescendant(node, link));
    // 子 heading 與升級出去的 section 都在父節點的 contentRange 之外，所以每層都用完整清單再篩
    for (const child of node.children) {
        assignLinks(child, links);
    }
};

/** 節點內容區裡出現過的 section 型別，依原文順序去重 */
export const sectionTypesOf = (node: TreeNode): string[] => {
    const seen = new Set<string>();
    for (const section of node.sections) seen.add(section.type);
    return [...seen];
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
