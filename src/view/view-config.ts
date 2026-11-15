import { LAYOUT_IDS, type LayoutId } from "../layout/layout";
import { PROMOTABLE_SECTION_TYPES, type PromotableSectionType } from "../core/section-types";
import { isMindmapDirection, type HeadingsSettings } from "../settings-model";
import type { MindmapDirection } from "../layout/mindmap";

/**
 * 「這個檔案想怎麼被看」的解析：檔案 YAML 優先，沒有就退回全域設定。
 * 純函式，不碰 obsidian，frontmatter 以 CachedMetadata.frontmatter 的物件傳入。
 */

/** YAML 屬性：佈局，值為 LayoutId */
export const FM_LAYOUT_KEY = "headings-layout";
/** YAML 屬性：升為節點的 section 型別清單 */
export const FM_NODES_KEY = "headings-nodes";
/** YAML 屬性：心智圖方向，值為 both / right */
export const FM_MINDMAP_DIRECTION_KEY = "headings-mindmap-direction";

export type Frontmatter = Record<string, unknown> | undefined | null;

const isLayoutId = (value: unknown): value is LayoutId =>
	typeof value === "string" && (LAYOUT_IDS as readonly string[]).includes(value);

const isPromotable = (value: unknown): value is PromotableSectionType =>
	typeof value === "string" && (PROMOTABLE_SECTION_TYPES as readonly string[]).includes(value);

/** YAML 指定的佈局；沒有或不合法回傳 undefined */
export const frontmatterLayout = (fm: Frontmatter): LayoutId | undefined => {
	const value = fm?.[FM_LAYOUT_KEY];
	return isLayoutId(value) ? value : undefined;
};

/**
 * YAML 指定的節點型別；沒有這個屬性回傳 undefined（代表要用全域設定）。
 * 有屬性但不是陣列也視為沒有；陣列中不認識的型別會被略過。
 */
export const frontmatterNodeTypes = (fm: Frontmatter): PromotableSectionType[] | undefined => {
	const value = fm?.[FM_NODES_KEY];
	if (!Array.isArray(value)) return undefined;
	return PROMOTABLE_SECTION_TYPES.filter((type) => value.some((v) => isPromotable(v) && v === type));
};

/**
 * 決定要用的佈局：
 * 1. YAML 指定且已註冊
 * 2. 全域設定依平台的預設值且已註冊
 * 3. 已註冊的第一個
 */
export const resolveLayoutId = (
	fm: Frontmatter,
	settings: HeadingsSettings,
	isMobile: boolean,
	available: readonly LayoutId[],
): LayoutId => {
	const fromFile = frontmatterLayout(fm);
	if (fromFile && available.includes(fromFile)) return fromFile;
	const fromSettings = settings.defaultLayout[isMobile ? "mobile" : "desktop"];
	if (available.includes(fromSettings)) return fromSettings;
	return available[0] ?? "tree-table";
};

/** YAML 指定的心智圖方向；沒有或不合法回傳 undefined */
export const frontmatterMindmapDirection = (fm: Frontmatter): MindmapDirection | undefined => {
	const value = fm?.[FM_MINDMAP_DIRECTION_KEY];
	return isMindmapDirection(value) ? value : undefined;
};

/** 決定心智圖方向：YAML 有指定就用 YAML，否則用全域設定 */
export const resolveMindmapDirection = (fm: Frontmatter, settings: HeadingsSettings): MindmapDirection =>
	frontmatterMindmapDirection(fm) ?? settings.mindmapDirection;

/** 決定要升為節點的型別：YAML 有指定就用 YAML，否則用全域設定 */
export const resolveNodeTypes = (fm: Frontmatter, settings: HeadingsSettings): PromotableSectionType[] =>
	frontmatterNodeTypes(fm) ?? PROMOTABLE_SECTION_TYPES.filter((type) => settings.nodeTypes[type]);
