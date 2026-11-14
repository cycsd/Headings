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
	/** 節點內容區最大高度 (px)，超過在節點內垂直捲動；0 為不限制 */
	maxNodeHeight: number;
	/** 開檔時是否只展開到固定層數；關閉就全部展開 */
	defaultExpandEnabled: boolean;
	/** 開檔時 root 以下展開幾層；0 為只展開 root、其他全部收合 */
	defaultExpandDepth: number;
	/** 節點的邊框與背景是否套用分支顏色；關閉就用主題預設的邊框與背景 */
	nodeStyle: Record<NodeStyleKey, boolean>;
	/** 節點內編輯器是否用自訂尺寸；關閉就跟著節點最大寬度 / 最大高度 */
	editorSizeEnabled: boolean;
	/** 編輯器固定寬度 (px) */
	editorWidth: number;
	/** 編輯器最大高度 (px)，超過在節點內捲動；0 為不限制（實際以視窗高度一半兜底） */
	editorMaxHeight: number;
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
	maxNodeHeight: 320,
	defaultExpandEnabled: false,
	defaultExpandDepth: 1,
	nodeStyle: { branchBorder: true, branchBackground: true },
	editorSizeEnabled: false,
	editorWidth: 360,
	editorMaxHeight: 320,
};

export const MAX_NODE_WIDTH_RANGE = { min: 160, max: 1200, step: 20 } as const;
/** 0 代表不限制；滑桿從 0 跳到 120 */
export const MAX_NODE_HEIGHT_RANGE = { min: 0, max: 1200, step: 20, minLimit: 120 } as const;
export const EDITOR_WIDTH_RANGE = { min: 200, max: 1200, step: 20 } as const;
/** 0 代表不限制；滑桿從 0 跳到 120 */
export const EDITOR_HEIGHT_RANGE = { min: 0, max: 1200, step: 20, minLimit: 120 } as const;

/** 高度滑桿：0 為不限制，0 到下限之間的值拉到下限 */
export const normalizeHeight = (value: number, minLimit: number = MAX_NODE_HEIGHT_RANGE.minLimit): number =>
	value > 0 && value < minLimit ? minLimit : value;

/** 進入編輯時編輯器的尺寸：開了自訂就用自訂值，否則跟著節點的最大寬度 / 最大高度 */
export const editorSize = (settings: HeadingsSettings): { width: number; maxHeight: number } =>
	settings.editorSizeEnabled
		? { width: settings.editorWidth, maxHeight: settings.editorMaxHeight }
		: { width: settings.maxNodeWidth, maxHeight: settings.maxNodeHeight };
/** root 以下展開幾層；0 代表只展開 root */
export const EXPAND_DEPTH_RANGE = { min: 0, max: 9, step: 1 } as const;

/** 讀一個整數欄位並夾進範圍；不是數字就用預設值。回傳是否需要改寫 */
const readClamped = (value: unknown, fallback: number, min: number, max: number): { value: number; migrated: boolean } => {
	if (typeof value === "number" && Number.isFinite(value)) {
		const clamped = Math.min(max, Math.max(min, Math.round(value)));
		return { value: clamped, migrated: clamped !== value };
	}
	return { value: fallback, migrated: value !== undefined };
};

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

	/** 高度欄位：夾範圍後，0 以上、下限以下的值沒有意義，拉到下限 */
	const readHeight = (value: unknown, fallback: number, range: { min: number; max: number; minLimit: number }): number => {
		const read = readClamped(value, fallback, range.min, range.max);
		const normalized = normalizeHeight(read.value, range.minLimit);
		if (read.migrated || normalized !== read.value) migrated = true;
		return normalized;
	};
	const maxNodeHeight = readHeight(data.maxNodeHeight, DEFAULT_SETTINGS.maxNodeHeight, MAX_NODE_HEIGHT_RANGE);

	let editorSizeEnabled = DEFAULT_SETTINGS.editorSizeEnabled;
	if (typeof data.editorSizeEnabled === "boolean") editorSizeEnabled = data.editorSizeEnabled;
	else if (data.editorSizeEnabled !== undefined) migrated = true;
	const width = readClamped(data.editorWidth, DEFAULT_SETTINGS.editorWidth, EDITOR_WIDTH_RANGE.min, EDITOR_WIDTH_RANGE.max);
	const editorWidth = width.value;
	if (width.migrated) migrated = true;
	const editorMaxHeight = readHeight(data.editorMaxHeight, DEFAULT_SETTINGS.editorMaxHeight, EDITOR_HEIGHT_RANGE);

	let defaultExpandEnabled = DEFAULT_SETTINGS.defaultExpandEnabled;
	let rawDepth = data.defaultExpandDepth;
	if (typeof data.defaultExpandEnabled === "boolean") {
		defaultExpandEnabled = data.defaultExpandEnabled;
	} else if (data.defaultExpandEnabled !== undefined) {
		migrated = true;
	} else if (typeof rawDepth === "number") {
		// 舊格式：depth 0 = 全部展開、N = 展開到第 N 層（含 root）。轉成開關 + root 以下層數
		migrated = true;
		defaultExpandEnabled = rawDepth > 0;
		rawDepth = rawDepth > 0 ? rawDepth - 1 : DEFAULT_SETTINGS.defaultExpandDepth;
	}
	const depth = readClamped(rawDepth, DEFAULT_SETTINGS.defaultExpandDepth, EXPAND_DEPTH_RANGE.min, EXPAND_DEPTH_RANGE.max);
	const defaultExpandDepth = depth.value;
	if (depth.migrated) migrated = true;

	const nodeStyle = readToggles(data.nodeStyle, NODE_STYLE_KEYS, DEFAULT_SETTINGS.nodeStyle);

	const known = new Set([
		"nodeTypes", "defaultLitTypes", "defaultLayout", "maxNodeWidth", "maxNodeHeight",
		"defaultExpandEnabled", "defaultExpandDepth", "nodeStyle", "editorSizeEnabled", "editorWidth", "editorMaxHeight",
	]);
	for (const key of Object.keys(data)) {
		if (!known.has(key)) migrated = true;
	}

	return {
		settings: {
			nodeTypes, defaultLitTypes, defaultLayout, maxNodeWidth, maxNodeHeight, defaultExpandEnabled, defaultExpandDepth, nodeStyle,
			editorSizeEnabled, editorWidth, editorMaxHeight,
		},
		migrated,
	};
};

/** 設定中被勾選的 section 型別 */
export const enabledNodeTypes = (settings: HeadingsSettings): PromotableSectionType[] =>
	PROMOTABLE_SECTION_TYPES.filter((type) => settings.nodeTypes[type]);

/** 設定中預設要顯示內容的型別 */
export const defaultLitTypes = (settings: HeadingsSettings): ContentSectionType[] =>
	CONTENT_SECTION_TYPES.filter((type) => settings.defaultLitTypes[type]);
