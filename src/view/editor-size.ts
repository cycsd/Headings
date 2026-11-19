/**
 * 節點內編輯器的尺寸：進入編輯時算一次，之後不變（內容多了在編輯器內捲動）。
 * - 關閉自訂尺寸：依內容貼合。寬取原文最長一行的自然寬度，夾在「節點原本的寬（至少 MIN_EDITOR_WIDTH）」與「節點最大寬度」之間；
 *   高用該寬度量原文換行後的高度，夾在「節點原本的高」與「內容最大高度」之間。
 * - 開啟自訂尺寸：寬 = 設定值；高量原文換行後的高度，至少 MIN_EDITOR_LINES 行、不超過「編輯器最大高度」。
 * - 高度上限為 0（自動）時用目前畫面可見高度的 80%（內容座標）。
 * - 關閉自訂時，佈局預算（node-budget.ts）再限制寬高：保留後代與兄弟在視窗內，但不低於節點原本的大小與 MIN_EDITOR_WIDTH。
 *   有預算（心智圖）時寬度直接取可用的最大寬度（進入時定好、打字只會多不會少）；沒有預算（樹狀表格、大綱）仍貼合內容。
 * 這裡算的是掛編輯器前的估算值；CodeMirror 畫完即時預覽後 NodeEditing 會量實際內容高度再修正一次（fitHeight）。
 * 量測交給呼叫端注入（DOM 探針），這裡只做夾值，方便測試。
 */

import { EXPAND_HEIGHT_RATIO } from "./node-limits";

export type Box = { w: number; h: number };

/** 量文字：width 省略 = 不換行的自然寬高（最長一行）；給了 = 在該寬度下換行後的高 */
export type TextMeasurer = (text: string, width?: number) => Box;

export type EditorSizeInput = {
	text: string;
	/** 節點進編輯前的內容框（扣掉內距與邊框）；null = 新增的節點（一掛上就在編輯中，量不到原本的大小） */
	node: Box | null;
	custom: { enabled: boolean; width: number; maxHeight: number };
	/** 關閉自訂時的寬度上限：節點最大寬度扣掉內距與邊框 */
	maxWidth: number;
	/** 關閉自訂時的高度上限；0 = 自動（可見高度的 EXPAND_HEIGHT_RATIO） */
	maxHeight: number;
	/** 目前畫面可見的高度，內容座標（有縮放時要先換算，不能直接用視窗像素） */
	viewportHeight: number;
	/** 佈局預算（節點外框尺寸已換成內容框）：關閉自訂時再限制寬高，保留後代與兄弟在視窗內；沒有就不限制 */
	budget?: { maxWidth: number | null; maxHeight: number | null };
};

export const MIN_EDITOR_LINES = 4;
/** 關閉自訂時的寬度下限；太小的節點打開也要有可用的寬度。跟自訂寬度滑桿的最小值一致 */
export const MIN_EDITOR_WIDTH = 200;
/** 新增的節點：使用者接下來一定會打字，關閉自訂時給這個寬度（仍不超過節點最大寬度）、至少 MIN_EDITOR_LINES 行 */
export const NEW_NODE_EDITOR_WIDTH = 320;

const clamp = (value: number, lo: number, hi: number): number => Math.max(lo, Math.min(Math.max(lo, hi), value));

/** 高度的上下限：畫完再修正時也用同一組 */
export type HeightBounds = { min: number; max: number };

export const heightBounds = (
	input: Pick<EditorSizeInput, "node" | "custom" | "maxHeight" | "viewportHeight" | "budget">,
	measure: TextMeasurer,
): HeightBounds => {
	const cap = (max: number) => (max > 0 ? max : Math.round(input.viewportHeight * EXPAND_HEIGHT_RATIO));
	const lines = () => measure("x").h * MIN_EDITOR_LINES;
	if (input.custom.enabled) return { min: lines(), max: cap(input.custom.maxHeight) };
	const min = input.node ? input.node.h : lines();
	// 預算不夠時寧可推出畫面也不縮到比現在小，所以上限不低於下限
	const max = Math.max(min, Math.min(cap(input.maxHeight), input.budget?.maxHeight ?? Infinity));
	return { min, max };
};

export const resolveEditorBox = (measure: TextMeasurer, input: EditorSizeInput): Box => {
	const bounds = heightBounds(input, measure);
	let w: number;
	if (input.custom.enabled) w = input.custom.width;
	else {
		// 有佈局預算（心智圖）時不設固定上限，只看預算；沒有預算才是節點最大寬度
		const upper = input.budget?.maxWidth ?? input.maxWidth;
		if (input.node) {
			const floor = Math.max(input.node.w, MIN_EDITOR_WIDTH);
			// 有佈局預算（心智圖）：寬度進入時定好、之後打字只會多不會少，所以直接取可用的最大寬度；沒有預算就貼合內容
			w = input.budget ? Math.max(floor, upper) : clamp(measure(input.text).w, floor, upper);
		} else {
			// 新增的節點也一樣：有預算就直接取可用的最大寬度（使用者接下來一定會打字）；沒有才用起手寬度
			w = input.budget ? Math.max(MIN_EDITOR_WIDTH, upper) : clamp(NEW_NODE_EDITOR_WIDTH, MIN_EDITOR_WIDTH, upper);
		}
	}
	return { w, h: clamp(measure(input.text, w).h, bounds.min, bounds.max) };
};

export const clampHeight = (height: number, bounds: HeightBounds): number => clamp(height, bounds.min, bounds.max);

/** 每一行在即時預覽裡的字級：標題用 --hN-size、程式碼圍欄裡用等寬字，其餘內文 */
const lineStyle = (line: string, inFence: boolean): string => {
	if (inFence) return "font-family:var(--font-monospace);font-size:var(--code-size,0.875em);";
	const heading = /^(#{1,6})\s/.exec(line);
	if (!heading) return "";
	const n = heading[1]!.length;
	return `font-size:var(--h${n}-size,1em);font-weight:var(--h${n}-weight,600);line-height:var(--h${n}-line-height,1.2);`;
};

/**
 * DOM 探針：在 host 裡放一個看不見的區塊，用編輯器的字型逐行量文字。
 * 掛編輯器之前就能算，不用等 CodeMirror 畫完；標籤膠囊、表格等裝飾的誤差由畫完後的修正補。
 */
export const domMeasurer = (host: HTMLElement): TextMeasurer => (text, width) => {
	const probe = host.createDiv();
	probe.style.cssText =
		"position:absolute;left:0;top:0;visibility:hidden;pointer-events:none;box-sizing:border-box;padding:4px 2px;" +
		"font-family:var(--font-text);font-size:var(--font-text-size);line-height:var(--line-height-normal);font-weight:normal;word-break:break-word;" +
		(width === undefined ? "white-space:pre;width:max-content;" : `white-space:pre-wrap;width:${width}px;`);
	let fence: string | null = null;
	for (const line of text.split("\n")) {
		const open = /^\s*(```+|~~~+)/.exec(line);
		const row = probe.createDiv({ text: line.length > 0 ? line : " " });
		row.style.cssText = lineStyle(line, fence !== null && !open);
		if (open) {
			const marker = open[1]!;
			if (fence === null) fence = marker[0]!.repeat(3);
			else if (marker.startsWith(fence)) fence = null;
		}
	}
	const box = { w: probe.offsetWidth, h: probe.offsetHeight };
	probe.remove();
	return box;
};

/** 元素的內容框尺寸（扣掉 padding 與 border） */
export const innerBox = (el: HTMLElement): Box => {
	const style = getComputedStyle(el);
	const px = (value: string) => parseFloat(value) || 0;
	return {
		w: el.clientWidth - px(style.paddingLeft) - px(style.paddingRight),
		h: el.clientHeight - px(style.paddingTop) - px(style.paddingBottom),
	};
};

/**
 * 節點外框扣掉內距與框線後的內容框差額（padding 4px 6px 4px 8px、border 1px）。新增的節點一掛上就在編輯中，
 * 量不到節點元素的實際樣式，用這組預設值換算。
 */
export const NODE_CHROME = { w: 16, h: 10 } as const;

/** 節點外框高度換成內容框高度（扣掉上下 padding 與 border）；沒有節點元素（新增的節點）用預設差額 */
export const innerMaxHeight = (el: HTMLElement | undefined, outerHeight: number): number => {
	if (!el) return outerHeight - NODE_CHROME.h;
	const style = getComputedStyle(el);
	const px = (value: string) => parseFloat(value) || 0;
	return outerHeight - px(style.paddingTop) - px(style.paddingBottom) - px(style.borderTopWidth) - px(style.borderBottomWidth);
};

/** 節點最大寬度換成內容框上限；沒有節點元素（新增的節點）用預設差額 */
export const innerMaxWidth = (el: HTMLElement | undefined, maxNodeWidth: number): number => {
	if (!el) return maxNodeWidth - NODE_CHROME.w;
	const style = getComputedStyle(el);
	const px = (value: string) => parseFloat(value) || 0;
	return maxNodeWidth - px(style.paddingLeft) - px(style.paddingRight) - px(style.borderLeftWidth) - px(style.borderRightWidth);
};
