import { t } from "./i18n";
import type { PromotableSectionType } from "./core/section-types";
import type { LayoutId } from "./layout/layout";

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

export const layoutLabel: Record<LayoutId, () => string> = {
	mindmap: () => t("layoutMindmap"),
	"tree-table": () => t("layoutTreeTable"),
	outline: () => t("layoutOutline"),
};
