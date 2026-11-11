import {
	CONTENT_SECTION_TYPES,
	PROMOTABLE_SECTION_TYPES,
	type ContentSectionType,
	type PromotableSectionType,
} from "./core/section-types";
import { LAYOUT_IDS, type LayoutId } from "./layout/layout";

/**
 * 設定的資料模型與遷移，不 import obsidian，方便單元測試。
 * settings.ts 只負責 UI。
 */
export interface HeadingsSettings {
	/** 哪些 section 型別要升為節點（heading 一定是節點） */
	nodeTypes: Record<PromotableSectionType, boolean>;
	/** 節點在使用者還沒手動切換前，預設顯示哪些型別的內容 */
	defaultLitTypes: Record<ContentSectionType, boolean>;
	/** 檔案 YAML 沒有指定佈局時的預設值，桌面與手機分開 */
	defaultLayout: {
		desktop: LayoutId;
		mobile: LayoutId;
	};
	/** 節點最大寬度 (px)，超過的 code / table 在節點內橫向捲動 */
	maxNodeWidth: number;
	/** 節點的邊框與背景是否套用分支顏色；關閉就用主題預設的邊框與背景 */
	nodeStyle: Record<NodeStyleKey, boolean>;
}

export const NODE_STYLE_KEYS = ["branchBorder", "branchBackground"] as const;
export type NodeStyleKey = (typeof NODE_STYLE_KEYS)[number];

export const DEFAULT_SETTINGS: HeadingsSettings = {
	nodeTypes: Object.fromEntries(PROMOTABLE_SECTION_TYPES.map((type) => [type, false])) as Record<PromotableSectionType, boolean>,
	defaultLitTypes: Object.fromEntries(CONTENT_SECTION_TYPES.map((type) => [type, false])) as Record<ContentSectionType, boolean>,
	defaultLayout: {
		desktop: "mindmap",
		mobile: "outline",
	},
	maxNodeWidth: 320,
	nodeStyle: { branchBorder: true, branchBackground: true },
};

export const MAX_NODE_WIDTH_RANGE = { min: 160, max: 1200, step: 20 } as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isLayoutId = (value: unknown): value is LayoutId =>
	typeof value === "string" && (LAYOUT_IDS as readonly string[]).includes(value);

/**
 * 把 loadData() 讀到的任意資料轉成完整的 HeadingsSettings。
 * - 缺的欄位補預設值，型別不對的欄位丟掉。
 * - 舊版 `listAsNode: boolean` 遷移成 `nodeTypes.list`。
 * 回傳 migrated 代表資料有被改寫，呼叫端應該存回去。
 */
export const migrateSettings = (raw: unknown): { settings: HeadingsSettings; migrated: boolean } => {
	const data = isRecord(raw) ? raw : {};
	let migrated = !isRecord(raw);

	/** 讀一組 type → boolean 的開關，缺的補預設、型別錯的與不認識的 key 都算 migrated */
	const readToggles = <T extends string>(raw: unknown, keys: readonly T[], defaults: Record<T, boolean>): Record<T, boolean> => {
		const result = { ...defaults };
		const record = isRecord(raw) ? raw : {};
		for (const key of keys) {
			const value = record[key];
			if (typeof value === "boolean") {
				result[key] = value;
			} else if (value !== undefined) {
				migrated = true;
			}
		}
		for (const key of Object.keys(record)) {
			if (!(keys as readonly string[]).includes(key)) migrated = true;
		}
		return result;
	};

	const rawNodeTypes = isRecord(data.nodeTypes) ? data.nodeTypes : {};
	const nodeTypes = readToggles(data.nodeTypes, PROMOTABLE_SECTION_TYPES, DEFAULT_SETTINGS.nodeTypes);
	const defaultLitTypes = readToggles(data.defaultLitTypes, CONTENT_SECTION_TYPES, DEFAULT_SETTINGS.defaultLitTypes);

	if ("listAsNode" in data) {
		if (typeof data.listAsNode === "boolean" && !("list" in rawNodeTypes)) {
			nodeTypes.list = data.listAsNode;
		}
		migrated = true;
	}

	const rawLayout = isRecord(data.defaultLayout) ? data.defaultLayout : {};
	const defaultLayout = { ...DEFAULT_SETTINGS.defaultLayout };
	for (const platform of ["desktop", "mobile"] as const) {
		const value = rawLayout[platform];
		if (isLayoutId(value)) {
			defaultLayout[platform] = value;
		} else if (value !== undefined) {
			migrated = true;
		}
	}

	let maxNodeWidth = DEFAULT_SETTINGS.maxNodeWidth;
	if (typeof data.maxNodeWidth === "number" && Number.isFinite(data.maxNodeWidth)) {
		maxNodeWidth = Math.min(MAX_NODE_WIDTH_RANGE.max, Math.max(MAX_NODE_WIDTH_RANGE.min, data.maxNodeWidth));
		if (maxNodeWidth !== data.maxNodeWidth) migrated = true;
	} else if (data.maxNodeWidth !== undefined) {
		migrated = true;
	}

	const nodeStyle = readToggles(data.nodeStyle, NODE_STYLE_KEYS, DEFAULT_SETTINGS.nodeStyle);

	const known = new Set(["nodeTypes", "defaultLitTypes", "defaultLayout", "maxNodeWidth", "nodeStyle"]);
	for (const key of Object.keys(data)) {
		if (!known.has(key)) migrated = true;
	}

	return { settings: { nodeTypes, defaultLitTypes, defaultLayout, maxNodeWidth, nodeStyle }, migrated };
};

/** 設定中被勾選的 section 型別 */
export const enabledNodeTypes = (settings: HeadingsSettings): PromotableSectionType[] =>
	PROMOTABLE_SECTION_TYPES.filter((type) => settings.nodeTypes[type]);

/** 設定中預設要顯示內容的型別 */
export const defaultLitTypes = (settings: HeadingsSettings): ContentSectionType[] =>
	CONTENT_SECTION_TYPES.filter((type) => settings.defaultLitTypes[type]);
