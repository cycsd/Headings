import { describe, expect, it } from "vitest";
import {
    DEFAULT_VIEWPORT,
    effectiveMaxHeight,
    effectiveMaxWidth,
    expandContentMaxHeight,
    hiddenLineCount,
    MAX_AUTO_WIDTH,
    MIN_AUTO_HEIGHT,
    MIN_AUTO_WIDTH,
    usableViewport,
    viewportChanged,
    wideMaxWidth,
} from "../../src/view/node-limits";

describe("effectiveMaxWidth / effectiveMaxHeight", () => {
    it("設定有填數字就直接用", () => {
        expect(effectiveMaxWidth(320, { w: 2000, h: 1000 })).toBe(320);
        expect(effectiveMaxHeight(240, { w: 2000, h: 1000 })).toBe(240);
    });

    it("0（自動）：寬 = 視圖寬一半、夾在上下限；高 = 視圖高 60%、至少下限", () => {
        expect(effectiveMaxWidth(0, { w: 1000, h: 800 })).toBe(500);
        expect(effectiveMaxWidth(0, { w: 300, h: 800 })).toBe(MIN_AUTO_WIDTH);
        expect(effectiveMaxWidth(0, { w: 4000, h: 800 })).toBe(MAX_AUTO_WIDTH);
        expect(effectiveMaxHeight(0, { w: 1000, h: 800 })).toBe(480);
        expect(effectiveMaxHeight(0, { w: 1000, h: 100 })).toBe(MIN_AUTO_HEIGHT);
    });
});

describe("usableViewport", () => {
    it("尺寸為 0（分頁在背景）時退回預設估計值", () => {
        expect(usableViewport({ w: 0, h: 0 })).toBe(DEFAULT_VIEWPORT);
        expect(usableViewport({ w: 900, h: 0 })).toBe(DEFAULT_VIEWPORT);
        expect(usableViewport({ w: 900, h: 500 })).toEqual({ w: 900, h: 500 });
    });
});

describe("viewportChanged", () => {
    it("任一邊變化超過 20% 才算", () => {
        const base = { w: 1000, h: 800 };
        expect(viewportChanged(base, { w: 1100, h: 800 })).toBe(false);
        expect(viewportChanged(base, { w: 1000, h: 800 })).toBe(false);
        expect(viewportChanged(base, { w: 1300, h: 800 })).toBe(true);
        expect(viewportChanged(base, { w: 1000, h: 500 })).toBe(true);
    });
});

describe("hiddenLineCount", () => {
    it("被裁掉的高度除以行高、進位；有被裁就至少 1 行；沒被裁是 0", () => {
        expect(hiddenLineCount(0, 24)).toBe(0);
        expect(hiddenLineCount(-5, 24)).toBe(0);
        expect(hiddenLineCount(1, 24)).toBe(1);
        expect(hiddenLineCount(48, 24)).toBe(2);
        expect(hiddenLineCount(49, 24)).toBe(3);
    });
});

describe("wideMaxWidth", () => {
    const base = { nodeWidth: 400, displayMax: 600, budgetWidth: null };

    it("有預算：只看預算，沒有固定上限（可以比一般顯示上限寬）", () => {
        expect(wideMaxWidth({ ...base, budgetWidth: 520 })).toBe(520);
        expect(wideMaxWidth({ ...base, budgetWidth: 1500 })).toBe(1500);
    });

    it("沒有預算（樹狀表格、大綱）：用一般顯示上限", () => {
        expect(wideMaxWidth(base)).toBe(600);
    });

    it("不會比節點現在的寬窄（預算或上限更小時維持現在的寬）", () => {
        expect(wideMaxWidth({ ...base, nodeWidth: 650, budgetWidth: 500 })).toBe(650);
        expect(wideMaxWidth({ ...base, nodeWidth: 800 })).toBe(800);
    });
});

describe("expandContentMaxHeight（存上限，不是剛好裝下的高度）", () => {
    const base = { nodeHeight: 360, contentHeight: 320, visibleHeight: 1000, budgetHeight: null };

    it("上限 = 可見高度的 80% 換成內容區的高：extra = 40，上限 800 → 內容區 760", () => {
        expect(expandContentMaxHeight(base)).toBe(760);
    });

    it("預算比可見上限更緊就用預算", () => {
        expect(expandContentMaxHeight({ ...base, budgetHeight: 500 })).toBe(460);
    });

    it("預算或畫面小到比現在還矮時不縮小（寧可推出畫面）", () => {
        expect(expandContentMaxHeight({ ...base, budgetHeight: 100 })).toBe(320);
        expect(expandContentMaxHeight({ ...base, visibleHeight: 200 })).toBe(320);
    });
});
