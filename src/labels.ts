import { t } from "./i18n";
import type { PromotableSectionType } from "./core/section-types";
import type { LayoutId } from "./layout/layout";
import type { NodeStyleKey } from "./settings-model";

/** 設定頁與 view 選單共用的顯示文字 */
export const sectionTypeLabel: Record<PromotableSectionType, () => string> = {
	paragraph: () => t("sectionTypeParagraph"),
	list: () => t("sectionTypeList"),
	blockquote: () => t("sectionTypeBlockquote"),
	callout: () => t("sectionTypeCallout"),
	code: () => t("sectionTypeCode"),
	table: () => t("sectionTypeTable"),
	math: () => t("sectionTypeMath"),
	html: () => t("sectionTypeHtml"),
	footnoteDefinition: () => t("sectionTypeFootnoteDefinition"),
};

/** 內容區 icon 的文字：可升級型別之外還有 frontmatter */
export const contentTypeLabel = (type: string): string => {
	if (type === "yaml") return t("sectionTypeYaml");
	const label = (sectionTypeLabel as Record<string, () => string>)[type];
	return label ? label() : type;
};

export const layoutLabel: Record<LayoutId, () => string> = {
	mindmap: () => t("layoutMindmap"),
	"tree-table": () => t("layoutTreeTable"),
	outline: () => t("layoutOutline"),
};

export const nodeStyleLabel: Record<NodeStyleKey, () => string> = {
	branchBorder: () => t("settingBranchBorderName"),
	branchBackground: () => t("settingBranchBackgroundName"),
};
