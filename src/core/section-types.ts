/**
 * Obsidian CachedMetadata 的 SectionCache.type 字串。
 * core 層只認識這些字串，不 import obsidian。
 */
export const SECTION_TYPES = {
    blockquote: "blockquote",
    callout: "callout",
    code: "code",
    comment: "comment",
    element: "element",
    footnoteDefinition: "footnoteDefinition",
    heading: "heading",
    html: "html",
    list: "list",
    math: "math",
    paragraph: "paragraph",
    table: "table",
    text: "text",
    thematicBreak: "thematicBreak",
    yaml: "yaml",
} as const;

export type SectionType = (typeof SECTION_TYPES)[keyof typeof SECTION_TYPES];

/** 可由使用者決定是否升為節點的 section 型別（heading 一定是節點，其餘不顯示） */
export const PROMOTABLE_SECTION_TYPES = [
    SECTION_TYPES.paragraph,
    SECTION_TYPES.list,
    SECTION_TYPES.blockquote,
    SECTION_TYPES.callout,
    SECTION_TYPES.code,
    SECTION_TYPES.table,
    SECTION_TYPES.math,
    SECTION_TYPES.html,
    SECTION_TYPES.footnoteDefinition,
] as const;

export type PromotableSectionType = (typeof PROMOTABLE_SECTION_TYPES)[number];

/** 可以在節點內容區顯示的型別：可升級的 9 種加上 root 的 frontmatter */
export const CONTENT_SECTION_TYPES = [...PROMOTABLE_SECTION_TYPES, SECTION_TYPES.yaml] as const;

export type ContentSectionType = (typeof CONTENT_SECTION_TYPES)[number];
