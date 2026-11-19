/**
 * 節點顯示的尺寸上限（一般顯示）與展開時的內容高度。純函式，不碰 DOM、不 import obsidian。
 *
 * 一般顯示的上限用「視圖大小」換算，單位是內容座標、不隨縮放變（縮放只是相機，跟著變每次滾輪都會整張圖重排）：
 * - 最大節點寬度設定為 0（自動）：閱讀寬度 = 視圖寬的一半，夾在 MIN_AUTO_WIDTH 到 MAX_AUTO_WIDTH。
 * - 節點最大高度設定為 0（自動）：視圖高的 60%，至少 MIN_AUTO_HEIGHT。
 * - 設定有填數字就直接用。
 */

export type Viewport = { w: number; h: number };

/** 視圖還沒量到尺寸（分頁在背景、寬高為 0）時的估計值 */
export const DEFAULT_VIEWPORT: Viewport = { w: 800, h: 600 };

export const READING_WIDTH_RATIO = 0.5;
export const MIN_AUTO_WIDTH = 280;
export const MAX_AUTO_WIDTH = 720;
export const AUTO_HEIGHT_RATIO = 0.6;
export const MIN_AUTO_HEIGHT = 200;
/** 展開與進入編輯器的高度上限：目前畫面可見高度（內容座標）的這個比例 */
export const EXPAND_HEIGHT_RATIO = 0.8;
/** 視窗大小變化超過這個比例才重算上限 */
export const VIEWPORT_CHANGE_THRESHOLD = 0.2;
/** 視圖大小停止變動多久（毫秒）才重算 */
export const VIEWPORT_SETTLE_MS = 300;

const clamp = (value: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, value));

/** 量到的視圖尺寸可用就用，否則退回估計值 */
export const usableViewport = (size: Viewport): Viewport => (size.w > 0 && size.h > 0 ? size : DEFAULT_VIEWPORT);

export const effectiveMaxWidth = (setting: number, viewport: Viewport): number =>
	setting > 0 ? setting : Math.round(clamp(viewport.w * READING_WIDTH_RATIO, MIN_AUTO_WIDTH, MAX_AUTO_WIDTH));

export const effectiveMaxHeight = (setting: number, viewport: Viewport): number =>
	setting > 0 ? setting : Math.round(Math.max(MIN_AUTO_HEIGHT, viewport.h * AUTO_HEIGHT_RATIO));

/** 視圖尺寸變化是否大到要重算（任一邊的相對變化超過門檻） */
export const viewportChanged = (prev: Viewport, next: Viewport, threshold = VIEWPORT_CHANGE_THRESHOLD): boolean => {
	const rel = (a: number, b: number) => (a === 0 ? (b === 0 ? 0 : 1) : Math.abs(b - a) / a);
	return rel(prev.w, next.w) > threshold || rel(prev.h, next.h) > threshold;
};

/** 被裁掉的像素高換成「約幾行」：無條件進位，有被裁就至少 1 行 */
export const hiddenLineCount = (hiddenPx: number, lineHeight: number): number =>
	hiddenPx <= 0 ? 0 : Math.max(1, Math.ceil(hiddenPx / Math.max(1, lineHeight)));

/**
 * 展開與編輯器的最大寬度：沒有固定上限，只靠佈局預算（節點自己的邊緣加 gap、完整在視窗內的後代，見 node-budget.ts）；
 * 沒有預算（樹狀表格、大綱）才用一般顯示上限。不會比節點現在的寬窄；短內容仍然貼合，上限只在內容很長時才有作用。
 */
export const wideMaxWidth = (input: { nodeWidth: number; displayMax: number; budgetWidth: number | null }): number =>
	Math.max(input.nodeWidth, input.budgetWidth ?? input.displayMax);

export type ExpandInput = {
	/** 節點目前的外框高 */
	nodeHeight: number;
	/** 內容區目前的高 */
	contentHeight: number;
	/** 目前畫面可見的高度，內容座標 */
	visibleHeight: number;
	/** 佈局預算允許的節點外框最大高；null = 不限 */
	budgetHeight: number | null;
};

/**
 * 使用者點出內容時，內容區的最大高度（上限，不是剛好裝下的高度）：min(可見高度的 80%，預算) 換成內容區的高，
 * 內容比它短就貼合、比它長就在內容區裡捲動（再點「還有約 N 行」才展開到全部）。
 * 存上限而不是剛好裝下的值，之後使用者再點亮其他型別內容變多，節點自己會長到上限，不用重算。
 * 空間不夠時寧可推出畫面也不比現在小。
 */
export const expandContentMaxHeight = (input: ExpandInput): number => {
	const extra = Math.max(0, input.nodeHeight - input.contentHeight);
	const outer = Math.max(input.nodeHeight, Math.min(input.visibleHeight * EXPAND_HEIGHT_RATIO, input.budgetHeight ?? Infinity));
	return Math.max(input.contentHeight, Math.round(outer - extra));
};
