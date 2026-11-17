/**
 * 節點內編輯器的尺寸：進入編輯時算一次，之後不變（內容多了在編輯器內捲動）。
 * - 關閉自訂尺寸：依內容貼合。寬取原文最長一行的自然寬度，夾在「節點原本的寬（至少 MIN_EDITOR_WIDTH）」與「節點最大寬度」之間；
 *   高用該寬度量原文換行後的高度，夾在「節點原本的高」與「內容最大高度」之間。
 * - 開啟自訂尺寸：寬 = 設定值；高量原文換行後的高度，至少 MIN_EDITOR_LINES 行、不超過「編輯器最大高度」。
 * - 高度上限為 0（不限）時用視窗高度的一半兜底。
 * 這裡算的是掛編輯器前的估算值；CodeMirror 畫完即時預覽後 NodeEditing 會量實際內容高度再修正一次（fitHeight）。
 * 量測交給呼叫端注入（DOM 探針），這裡只做夾值，方便測試。
 */

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
	/** 關閉自訂時的高度上限：節點內容最大高度，0 為不限 */
	maxHeight: number;
	viewportHeight: number;
};

export const MIN_EDITOR_LINES = 4;
/** 關閉自訂時的寬度下限；太小的節點打開也要有可用的寬度。跟自訂寬度滑桿的最小值一致 */
export const MIN_EDITOR_WIDTH = 200;
/** 新增的節點：使用者接下來一定會打字，關閉自訂時給這個寬度（仍不超過節點最大寬度）、至少 MIN_EDITOR_LINES 行 */
export const NEW_NODE_EDITOR_WIDTH = 320;

const clamp = (value: number, lo: number, hi: number): number => Math.max(lo, Math.min(Math.max(lo, hi), value));

/** 高度的上下限：畫完再修正時也用同一組 */
export type HeightBounds = { min: number; max: number };

export const heightBounds = (input: Pick<EditorSizeInput, "node" | "custom" | "maxHeight" | "viewportHeight">, measure: TextMeasurer): HeightBounds => {
	const cap = (max: number) => (max > 0 ? max : Math.round(input.viewportHeight / 2));
	const lines = () => measure("x").h * MIN_EDITOR_LINES;
	if (input.custom.enabled) return { min: lines(), max: cap(input.custom.maxHeight) };
	return { min: input.node ? input.node.h : lines(), max: cap(input.maxHeight) };
};

export const resolveEditorBox = (measure: TextMeasurer, input: EditorSizeInput): Box => {
	const bounds = heightBounds(input, measure);
	let w: number;
	if (input.custom.enabled) w = input.custom.width;
	else if (input.node) w = clamp(measure(input.text).w, Math.max(input.node.w, MIN_EDITOR_WIDTH), input.maxWidth);
	else w = clamp(NEW_NODE_EDITOR_WIDTH, MIN_EDITOR_WIDTH, input.maxWidth);
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

/** 節點最大寬度換成內容框上限 */
export const innerMaxWidth = (el: HTMLElement, maxNodeWidth: number): number => {
	const style = getComputedStyle(el);
	const px = (value: string) => parseFloat(value) || 0;
	return maxNodeWidth - px(style.paddingLeft) - px(style.paddingRight) - px(style.borderLeftWidth) - px(style.borderRightWidth);
};
