import type { CachedMetadata, HeadingCache, ListItemCache, Pos, ReferenceCache, SectionCache } from "obsidian";
import type { HeadingNode, LinkRef, ListItemNode, Range, SectionNode } from "../core/tree";
import { SECTION_TYPES } from "../core/section-types";

/**
 * 將 Obsidian 的 CachedMetadata 轉成 core 的完整樹。
 * 這是唯一一個同時認識 obsidian 型別與 core 型別的地方。
 *
 * 規則：
 * - 標題到下一個標題前的 sections 都屬於該標題。
 * - 下一個標題 level 較大 (ex: 3 > 2) 時成為當前標題的子標題。
 * - list section 依 ListItemCache.parent 組出巢狀 list item。
 * - id 在這裡就決定好，與 promote policy 無關，所以切換設定時 id 不變。
 */
export const buildTree = (cache: CachedMetadata, doc: string, fileName: string): HeadingNode => {
    const root: HeadingNode = {
        kind: "root",
        id: ROOT_ID,
        level: 0,
        title: fileName,
        range: { from: 0, to: 0 },
        sections: [],
        children: [],
    };

    const headings = cache.headings ?? [];
    const sections = cache.sections ?? [];
    const listItemsByRange = buildListItems(cache.listItems ?? [], doc);

    // 先把 heading 攤平成節點，再依 section 順序分配
    const flat: HeadingNode[] = [root, ...headings.map((h) => headingToNode(h))];

    // sections 依序分配：遇到 heading section 就換到下一個 heading 節點
    let current = 0;
    for (const section of sections) {
        if (section.type === SECTION_TYPES.heading) {
            current += 1;
            continue;
        }
        const owner = flat[current];
        if (!owner) break;
        owner.sections.push(sectionToNode(section, listItemsByRange));
    }

    // 依 level 收斂成樹
    const [, ...rest] = flat;
    const stack: HeadingNode[] = [root];
    for (const node of rest) {
        let container = stack.at(-1);
        while (container && container !== root && container.level >= node.level) {
            stack.pop();
            container = stack.at(-1);
        }
        container?.children.push(node);
        stack.push(node);
    }

    assignIds(root, ROOT_ID);
    return root;
};

export const ROOT_ID = "root";

const toRange = (pos: Pos): Range => ({ from: pos.start.offset, to: pos.end.offset });

/** 有 scheme 的（http://、obsidian://、mailto:）不是 vault 內的檔案，開不了心智圖 */
const hasScheme = (target: string) => /^[a-z][a-z0-9+.-]*:/i.test(target);

const toLinkRef = (ref: ReferenceCache, embed: boolean): LinkRef => ({
    target: ref.link,
    display: ref.displayText || ref.link,
    range: toRange(ref.position),
    embed,
});

/** 文件內所有內部連結與 embed，依位置排序；交給 promote 分配到節點 */
export const buildLinks = (cache: CachedMetadata): LinkRef[] =>
    [
        ...(cache.links ?? []).map((ref) => toLinkRef(ref, false)),
        ...(cache.embeds ?? []).map((ref) => toLinkRef(ref, true)),
    ]
        .filter((link) => !hasScheme(link.target))
        .sort((a, b) => a.range.from - b.range.from);

const headingToNode = (h: HeadingCache): HeadingNode => ({
    kind: "heading",
    id: "",
    level: h.level,
    title: h.heading,
    range: toRange(h.position),
    sections: [],
    children: [],
});

const sectionToNode = (s: SectionCache, listItems: ListItemNode[]): SectionNode => {
    const range = toRange(s.position);
    const children =
        s.type === SECTION_TYPES.list
            ? listItems.filter((item) => item.range.from >= range.from && item.range.to <= range.to)
            : [];
    return { kind: "section", id: "", type: s.type, range, children };
};

/**
 * 依 ListItemCache.parent 組出 list item 的樹狀結構，回傳最外層 item。
 * parent < 0 表示該 item 為 list 的最外層，parent >= 0 則為父 item 所在的行號。
 */
const buildListItems = (items: ListItemCache[], doc: string): ListItemNode[] => {
    const sorted = [...items].sort((a, b) => a.position.start.offset - b.position.start.offset);
    const byLine = new Map<number, ListItemNode>();
    const roots: ListItemNode[] = [];
    for (const item of sorted) {
        const range = toRange(item.position);
        const node: ListItemNode = {
            kind: "listItem",
            id: "",
            range,
            text: dedent(doc.slice(range.from, range.to)),
            children: [],
        };
        byLine.set(item.position.start.line, node);
        const parent = item.parent < 0 ? undefined : byLine.get(item.parent);
        if (parent) {
            parent.children.push(node);
        } else {
            roots.push(node);
        }
    }
    return roots;
};

/**
 * 只去掉 item 第一行的縮排量（巢狀 item 的 position 從行首算起），其餘行扣掉同樣寬度，
 * 保留原文的相對縮排；不處理的話 4 格以上的縮排會被 MarkdownRenderer 當成程式碼區塊。
 */
const dedent = (text: string): string => {
    const indent = /^[ \t]*/.exec(text)?.[0].length ?? 0;
    if (indent === 0) return text;
    const leading = new RegExp(`^[ \\t]{0,${indent}}`);
    return text
        .split("\n")
        .map((line) => line.replace(leading, ""))
        .join("\n");
};

/**
 * 穩定 id：
 * - heading：父 id + "/" + 標題文字，同名兄弟加 "~n"
 * - section：父 id + ":" + type + ":" + 該型別內的序號
 * - listItem：父 id + ":" + 序號
 */
const assignIds = (node: HeadingNode, id: string) => {
    node.id = id;

    const typeCount = new Map<string, number>();
    for (const section of node.sections) {
        const n = typeCount.get(section.type) ?? 0;
        typeCount.set(section.type, n + 1);
        assignListItemIds(section.children, (section.id = `${id}:${section.type}:${n}`));
    }

    const titleCount = new Map<string, number>();
    for (const child of node.children) {
        const n = titleCount.get(child.title) ?? 0;
        titleCount.set(child.title, n + 1);
        assignIds(child, `${id}/${child.title}${n > 0 ? `~${n}` : ""}`);
    }
};

const assignListItemIds = (items: ListItemNode[], parentId: string) => {
    items.forEach((item, i) => {
        item.id = `${parentId}:${i}`;
        assignListItemIds(item.children, item.id);
    });
};
