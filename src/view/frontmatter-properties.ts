import { type App, getFrontMatterInfo, parseYaml, setIcon } from "obsidian";

/**
 * 把 YAML 區塊畫成 Obsidian「屬性」的樣子（唯讀）。
 *
 * MarkdownRenderer 遇到 frontmatter 只會產生被 CSS 藏起來的 pre.frontmatter，
 * 而編輯器裡的屬性面板（MetadataEditor）不是公開 API。這裡用 parseYaml 解析後，
 * 以 Obsidian 自己的 class 名稱組 DOM，讓主題的屬性樣式直接套上。
 */

type PropertyType = "text" | "multitext" | "number" | "checkbox" | "date" | "datetime" | "tags" | "aliases";

const PROPERTY_ICONS: Record<PropertyType, string> = {
    text: "align-left",
    multitext: "list",
    number: "binary",
    checkbox: "check-square",
    date: "calendar",
    datetime: "clock",
    tags: "tags",
    aliases: "forward",
};

const KEY_TYPES: Record<string, PropertyType> = {
    tags: "tags",
    aliases: "aliases",
    cssclasses: "multitext",
};

const PROPERTY_TYPES = new Set<string>(Object.keys(PROPERTY_ICONS));

/** 使用者在 Obsidian 裡指定過的屬性型別；這是未公開的介面，拿不到就用值推斷 */
type TypeManagerApp = App & {
    metadataTypeManager?: { getAssignedType?: (key: string) => string | null | undefined };
};

const assignedType = (app: App, key: string): PropertyType | null => {
    try {
        const type = (app as TypeManagerApp).metadataTypeManager?.getAssignedType?.(key);
        return type && PROPERTY_TYPES.has(type) ? (type as PropertyType) : null;
    } catch {
        return null;
    }
};

const inferType = (key: string, value: unknown): PropertyType => {
    const byKey = KEY_TYPES[key.toLowerCase()];
    if (byKey) return byKey;
    if (Array.isArray(value)) return "multitext";
    if (typeof value === "boolean") return "checkbox";
    if (typeof value === "number") return "number";
    if (typeof value === "string") {
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return "date";
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return "datetime";
    }
    return "text";
};

const toText = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
};

const toList = (value: unknown): string[] => {
    if (value === null || value === undefined) return [];
    return (Array.isArray(value) ? value : [value]).map(toText);
};

/** 解析失敗或不是 frontmatter 時回傳 null，讓呼叫端退回一般 markdown 渲染 */
export const parseFrontmatter = (text: string): Record<string, unknown> | null => {
    const info = getFrontMatterInfo(text);
    if (!info.exists) return null;
    try {
        const parsed: unknown = parseYaml(info.frontmatter);
        if (parsed === null || parsed === undefined) return {};
        if (typeof parsed !== "object" || Array.isArray(parsed)) return null;
        return parsed as Record<string, unknown>;
    } catch {
        return null;
    }
};

const renderValue = (container: HTMLElement, type: PropertyType, value: unknown) => {
    switch (type) {
        case "checkbox": {
            const input = container.createEl("input", { cls: "metadata-input-checkbox", type: "checkbox" });
            input.checked = value === true;
            input.disabled = true;
            return;
        }
        case "number": {
            const input = container.createEl("input", { cls: "metadata-input metadata-input-number", type: "number" });
            input.value = toText(value);
            input.readOnly = true;
            return;
        }
        case "date":
        case "datetime": {
            const input = container.createEl("input", {
                cls: `metadata-input metadata-input-text mod-${type}`,
                type: type === "date" ? "date" : "datetime-local",
            });
            input.value = toText(value);
            input.readOnly = true;
            return;
        }
        case "multitext":
        case "tags":
        case "aliases": {
            const list = container.createDiv({ cls: "multi-select-container" });
            for (const item of toList(value)) {
                const pill = list.createDiv({ cls: "multi-select-pill" });
                pill.createSpan({ cls: "multi-select-pill-content" }).createSpan({ text: item });
            }
            return;
        }
        default: {
            const text = container.createDiv({ cls: "metadata-input-longtext mod-truncate", text: toText(value) });
            text.setAttr("placeholder", "Empty");
        }
    }
};

export const renderProperties = (app: App, el: HTMLElement, frontmatter: Record<string, unknown>) => {
    const entries = Object.entries(frontmatter).filter(([key]) => key !== "position");
    const container = el.createDiv({ cls: "metadata-container", attr: { "data-property-count": String(entries.length) } });
    const props = container.createDiv({ cls: "metadata-content" }).createDiv({ cls: "metadata-properties" });
    for (const [key, value] of entries) {
        const type = assignedType(app, key) ?? inferType(key, value);
        const row = props.createDiv({ cls: "metadata-property", attr: { "data-property-key": key, "data-property-type": type } });
        const keyEl = row.createDiv({ cls: "metadata-property-key" });
        setIcon(keyEl.createSpan({ cls: "metadata-property-icon" }), PROPERTY_ICONS[type]);
        const keyInput = keyEl.createEl("input", { cls: "metadata-property-key-input", type: "text" });
        keyInput.value = key;
        keyInput.readOnly = true;
        renderValue(row.createDiv({ cls: "metadata-property-value" }), type, value);
    }
};
