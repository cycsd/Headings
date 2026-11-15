/**
 * 每個檔案記住的視圖狀態：收合、聚焦、展開層數、各節點點亮的內容型別。
 * 存在外掛 data.json 的 fileViews 底下，以檔案路徑為 key。不 import obsidian，方便測試。
 */
export type FileViewMemory = {
	collapsed: string[];
	focusId: string | null;
	expandDepth: number;
	/** 節點 id → 點亮的 section 型別 */
	lit: Record<string, string[]>;
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
	return { collapsed: raw.collapsed, focusId: raw.focusId, expandDepth: raw.expandDepth, lit };
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
});

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
			const oldest = this.entries.keys().next().value;
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
