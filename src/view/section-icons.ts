import type { IconName } from "obsidian";
import { SECTION_TYPES } from "../core/section-types";

/** 每種 section 型別對應的 lucide icon */
const ICONS: Record<string, IconName> = {
	[SECTION_TYPES.paragraph]: "pilcrow",
	[SECTION_TYPES.list]: "list",
	[SECTION_TYPES.blockquote]: "quote",
	[SECTION_TYPES.callout]: "message-square",
	[SECTION_TYPES.code]: "code",
	[SECTION_TYPES.table]: "table",
	[SECTION_TYPES.math]: "sigma",
	[SECTION_TYPES.html]: "code-xml",
	[SECTION_TYPES.footnoteDefinition]: "asterisk",
};

export const sectionIcon = (type: string): IconName => ICONS[type] ?? "square";

export const LINK_ICON: IconName = "link";
export const EMBED_ICON: IconName = "file-input";
