import { describe, expect, it } from "vitest";
import { clampHeight, heightBounds, MIN_EDITOR_LINES, MIN_EDITOR_WIDTH, resolveEditorBox, type TextMeasurer } from "../../src/view/editor-size";

/** 假量測：每字 10px 寬、每行 20px 高，給寬度就依字數換行 */
const measure: TextMeasurer = (text, width) => {
    const lines = text.split("\n");
    if (width === undefined) return { w: Math.max(...lines.map((l) => l.length)) * 10, h: lines.length * 20 };
    const perLine = Math.max(1, Math.floor(width / 10));
    const wrapped = lines.reduce((n, l) => n + Math.max(1, Math.ceil(l.length / perLine)), 0);
    return { w: width, h: wrapped * 20 };
};

const base = { node: { w: 100, h: 40 }, custom: { enabled: false, width: 360, maxHeight: 320 }, maxWidth: 300, maxHeight: 320, viewportHeight: 800 };

describe("resolveEditorBox（關閉自訂：依內容貼合）", () => {
    it("內容比節點小：高維持節點原本的，寬至少 MIN_EDITOR_WIDTH（太小的節點也要能編輯）", () => {
        expect(resolveEditorBox(measure, { ...base, text: "ab" })).toEqual({ w: MIN_EDITOR_WIDTH, h: 40 });
        expect(resolveEditorBox(measure, { ...base, text: "ab", node: { w: 260, h: 40 } })).toEqual({ w: 260, h: 40 });
    });

    it("clampHeight 用同一組上下限：畫完再修正時不低於節點原本的高、不高於上限", () => {
        const bounds = heightBounds({ ...base }, measure);
        expect(bounds).toEqual({ min: 40, max: 320 });
        expect(clampHeight(10, bounds)).toBe(40);
        expect(clampHeight(500, bounds)).toBe(320);
        expect(clampHeight(123, bounds)).toBe(123);
    });

    it("長行撐寬到節點最大寬度，再依該寬度換行算高", () => {
        const text = "x".repeat(60); // 自然寬 600 > 300 上限 → 300；300/10 = 30 字一行 → 2 行 = 40
        expect(resolveEditorBox(measure, { ...base, text })).toEqual({ w: 300, h: 40 });
        const tall = Array.from({ length: 5 }, () => "x".repeat(20)).join("\n"); // 寬 200，5 行 = 100
        expect(resolveEditorBox(measure, { ...base, text: tall })).toEqual({ w: 200, h: 100 });
    });

    it("高度不超過內容最大高度；0 時用視窗一半", () => {
        const text = Array.from({ length: 50 }, () => "x").join("\n"); // 1000 高
        expect(resolveEditorBox(measure, { ...base, text }).h).toBe(320);
        expect(resolveEditorBox(measure, { ...base, text, maxHeight: 0 }).h).toBe(400);
    });

    it("節點本來就比上限大時以節點為準，不會縮小", () => {
        expect(resolveEditorBox(measure, { ...base, text: "a", node: { w: 500, h: 600 } })).toEqual({ w: 500, h: 600 });
    });
});

describe("resolveEditorBox（開啟自訂）", () => {
    const custom = { ...base, custom: { enabled: true, width: 360, maxHeight: 200 } };

    it("寬固定為設定值；高至少 4 行、依內容增加、不超過編輯器最大高度", () => {
        expect(resolveEditorBox(measure, { ...custom, text: "a" })).toEqual({ w: 360, h: 20 * MIN_EDITOR_LINES });
        const six = Array.from({ length: 6 }, () => "x").join("\n");
        expect(resolveEditorBox(measure, { ...custom, text: six })).toEqual({ w: 360, h: 120 });
        const many = Array.from({ length: 40 }, () => "x").join("\n");
        expect(resolveEditorBox(measure, { ...custom, text: many })).toEqual({ w: 360, h: 200 });
    });

    it("編輯器最大高度 0 時用視窗一半", () => {
        const many = Array.from({ length: 40 }, () => "x").join("\n");
        expect(resolveEditorBox(measure, { ...custom, custom: { ...custom.custom, maxHeight: 0 }, text: many }).h).toBe(400);
    });
});
