/**
 * 每個檔案記住的視圖狀態：收合、聚焦、展開層數、各節點點亮的內容型別。
 * 存在外掛 data.json 的 fileViews 底下，以檔案路徑為 key。不 import obsidian，方便測試。
 */
/** 縮放倍率依平台再依佈局分開記：data.json 會跟著 vault 同步，桌面的倍率拿到手機會變一團小字；大綱沒有縮放 */
export type ZoomPlatform = "desktop" | "mobile";
export type ZoomLayout = "mindmap" | "tree-table";
export type ZoomMemory = Partial<Record<ZoomPlatform, Partial<Record<ZoomLayout, number>>>>;
export const ZOOM_PLATFORMS: readonly ZoomPlatform[] = ["desktop", "mobile"];
export const ZOOM_LAYOUTS: readonly ZoomLayout[] = ["mindmap", "tree-table"];

/**
 * 視口位置：不存 panX / panY（畫布座標會隨尺寸量測與留白變動，重開套不準），
 * 存「參考點在視口的相對位置」：心智圖是根節點中心、樹狀表格是表格左上角，0–1 為視口內。
 */
export type PanPoint = { x: number; y: number };
export type PanMemory = Partial<Record<ZoomPlatform, Partial<Record<ZoomLayout, PanPoint>>>>;
/** 每個平台一組目前的視口：倍率與參考點位置，都依佈局分 */
export type ViewportState = { zoom: Partial<Record<ZoomLayout, number>>; pan: Partial<Record<ZoomLayout, PanPoint>> };

export type FileViewMemory = {
	collapsed: string[];
	focusId: string | null;
	expandDepth: number;
	/** 節點 id → 點亮的 section 型別 */
	lit: Record<string, string[]>;
	/** 手動縮放過的倍率；沒縮放過就沒有這個欄位 */
	zoom?: ZoomMemory;
	/** 參考點在視口的相對位置；沒有就用預設擺法（根置中 / 靠左、表格左上） */
	pan?: PanMemory;
};

export type FileViewsData = Record<string, FileViewMemory>;

/** 最多記幾個檔案，超過丟最久沒開的 */
export const MAX_FILE_VIEWS = 200;

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((v) => typeof v === "string");

/** 單筆記錄的格式檢查；不對就整筆丟掉，回傳 null */
const readMemory = (raw: unknown): FileViewMemory | null => {
	if (!isRecord(raw)) return null;
	if (!isStringArray(raw.collapsed)) return null;
	if (raw.focusId !== null && typeof raw.focusId !== "string") return null;
	if (typeof raw.expandDepth !== "number" || !Number.isInteger(raw.expandDepth) || raw.expandDepth < 0) return null;
	if (!isRecord(raw.lit)) return null;
	const lit: Record<string, string[]> = {};
	for (const [id, types] of Object.entries(raw.lit)) {
		if (!isStringArray(types)) return null;
		lit[id] = types;
	}
	const memory: FileViewMemory = { collapsed: raw.collapsed, focusId: raw.focusId, expandDepth: raw.expandDepth, lit };
	const zoom = readPerLayout(raw.zoom, (value) => (typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 10 ? value : undefined));
	if (zoom) memory.zoom = zoom;
	const pan = readPerLayout(raw.pan, readPanPoint);
	if (pan) memory.pan = pan;
	return memory;
};

const isFraction = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= -5 && value <= 5;

/** 參考點相對位置：兩個座標都要是合理的數字（視口外一點點也接受，太離譜就丟） */
const readPanPoint = (value: unknown): PanPoint | undefined =>
	isRecord(value) && isFraction(value.x) && isFraction(value.y) ? { x: value.x, y: value.y } : undefined;

/** 平台 → 佈局 → 值 的表：只留認得的平台 / 佈局與 read 認可的值，其餘略過；什麼都不剩回傳 undefined */
const readPerLayout = <T>(raw: unknown, read: (value: unknown) => T | undefined): Partial<Record<ZoomPlatform, Partial<Record<ZoomLayout, T>>>> | undefined => {
	if (!isRecord(raw)) return undefined;
	const result: Partial<Record<ZoomPlatform, Partial<Record<ZoomLayout, T>>>> = {};
	for (const platform of ZOOM_PLATFORMS) {
		const layouts = raw[platform];
		if (!isRecord(layouts)) continue;
		const entry: Partial<Record<ZoomLayout, T>> = {};
		for (const layout of ZOOM_LAYOUTS) {
			const value = read(layouts[layout]);
			if (value !== undefined) entry[layout] = value;
		}
		if (Object.keys(entry).length > 0) result[platform] = entry;
	}
	return Object.keys(result).length > 0 ? result : undefined;
};

/** 從 data.json 整份資料讀出 fileViews；壞掉的單筆丟掉，超過上限只留最後（最近用過）的 */
export const readFileViews = (data: unknown): FileViewsData => {
	const raw = isRecord(data) ? data.fileViews : undefined;
	if (!isRecord(raw)) return {};
	const entries: [string, FileViewMemory][] = [];
	for (const [path, value] of Object.entries(raw)) {
		const memory = readMemory(value);
		if (memory) entries.push([path, memory]);
	}
	return Object.fromEntries(entries.slice(-MAX_FILE_VIEWS));
};

/** 把記錄裡已經不存在的節點 id 去掉（標題改了、段落刪了） */
export const pruneMemory = (memory: FileViewMemory, ids: ReadonlySet<string>): FileViewMemory => ({
	collapsed: memory.collapsed.filter((id) => ids.has(id)),
	focusId: memory.focusId !== null && ids.has(memory.focusId) ? memory.focusId : null,
	expandDepth: memory.expandDepth,
	lit: Object.fromEntries(Object.entries(memory.lit).filter(([id]) => ids.has(id))),
	...(memory.zoom ? { zoom: memory.zoom } : {}),
	...(memory.pan ? { pan: memory.pan } : {}),
});

/** 目前平台的值併進「平台 → 佈局」表：其他平台保留；目前平台空了就拿掉；整張表空了回傳 undefined */
const mergePlatform = <T>(
	previous: Partial<Record<ZoomPlatform, Partial<Record<ZoomLayout, T>>>> | undefined,
	platform: ZoomPlatform,
	current: Partial<Record<ZoomLayout, T>>,
): Partial<Record<ZoomPlatform, Partial<Record<ZoomLayout, T>>>> | undefined => {
	const merged = { ...previous };
	if (Object.keys(current).length > 0) merged[platform] = { ...current };
	else delete merged[platform];
	return Object.keys(merged).length > 0 ? merged : undefined;
};

/** 把目前平台的視口（倍率與參考點位置）併進記錄；其他平台的保留 */
export const withViewport = (
	memory: Omit<FileViewMemory, "zoom" | "pan">,
	previous: FileViewMemory | undefined,
	platform: ZoomPlatform,
	viewport: ViewportState,
): FileViewMemory => {
	const result: FileViewMemory = { ...memory };
	const zoom = mergePlatform(previous?.zoom, platform, viewport.zoom);
	if (zoom) result.zoom = zoom;
	const pan = mergePlatform(previous?.pan, platform, viewport.pan);
	if (pan) result.pan = pan;
	return result;
};

/** 兩筆記錄內容是否相同（省掉沒變就寫檔） */
export const sameMemory = (a: FileViewMemory | undefined, b: FileViewMemory): boolean =>
	a !== undefined && JSON.stringify(a) === JSON.stringify(b);

/** 以路徑為 key 的 LRU：Map 的插入順序就是最近使用順序，最舊的在最前面 */
export class FileViewStore {
	private entries: Map<string, FileViewMemory>;

	constructor(
		data: FileViewsData = {},
		private readonly limit = MAX_FILE_VIEWS,
	) {
		this.entries = new Map(Object.entries(data));
	}

	/** 讀取並視為最近使用 */
	get(path: string): FileViewMemory | undefined {
		const memory = this.entries.get(path);
		if (memory) {
			this.entries.delete(path);
			this.entries.set(path, memory);
		}
		return memory;
	}

	/** 寫入並視為最近使用；超過上限就丟最舊的 */
	set(path: string, memory: FileViewMemory) {
		this.entries.delete(path);
		this.entries.set(path, memory);
		while (this.entries.size > this.limit) {
			const oldest = this.entries.keys().next().value as string | undefined;
			if (oldest === undefined) break;
			this.entries.delete(oldest);
		}
	}

	/** 檔案改名或搬移：記錄跟著走。回傳是否真的有這筆 */
	rename(from: string, to: string): boolean {
		const memory = this.entries.get(from);
		if (!memory) return false;
		this.entries.delete(from);
		this.entries.set(to, memory);
		return true;
	}

	remove(path: string): boolean {
		return this.entries.delete(path);
	}

	clear() {
		this.entries.clear();
	}

	get size(): number {
		return this.entries.size;
	}

	toJSON(): FileViewsData {
		return Object.fromEntries(this.entries);
	}
}
