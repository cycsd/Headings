import { describe, expect, it } from "vitest";
import { nodeBudget, MARGIN_PX, type BudgetNode } from "../../src/view/node-budget";

type Spec = { id: string; x: number; y: number; w: number; h: number; side?: number; children?: string[] };

/** 組一份 BudgetNode 清單；children 只放 id，欄位結構同 PlacedNode */
const layout = (specs: Spec[]): BudgetNode[] =>
    specs.map((s) => ({
        node: { id: s.id, children: (s.children ?? []).map((id) => ({ id })) },
        x: s.x,
        y: s.y,
        w: s.w,
        h: s.h,
        side: s.side ?? 1,
    }));

const view = { left: 0, right: 1000, top: 0, bottom: 800 };
const G = MARGIN_PX;

describe("nodeBudget 寬度", () => {
  it("保留 2 代後代在視窗內：剩餘空間 = 視窗右緣 − gap − 最靠右的右緣", () => {
        const nodes = layout([
            { id: "n", x: 100, y: 100, w: 200, h: 40, children: ["a", "b"] },
            { id: "a", x: 340, y: 60, w: 200, h: 40, children: ["g"] },
            { id: "b", x: 340, y: 140, w: 300, h: 40 },
            { id: "g", x: 580, y: 60, w: 200, h: 40 }, // 第 2 代：右緣 780，最靠右
        ]);
        // 剩餘 = 1000 − G − 780；節點自己的邊緣空間（1000 − G − 300）更大，取後代這個
        expect(nodeBudget(nodes, "n", view, 1)!.maxWidth).toBe(200 + (1000 - G - 780));
    });

    it("半截或在視窗外的後代視為已離開：不計入、不限制", () => {
        const nodes = layout([
            { id: "n", x: 100, y: 100, w: 200, h: 40, children: ["a", "c"] },
            { id: "a", x: 340, y: 60, w: 200, h: 40 }, // 右緣 540，完整在內
            { id: "c", x: 340, y: 140, w: 800, h: 40 }, // 右緣 1140，超出視窗：不算
        ]);
        expect(nodeBudget(nodes, "n", view, 1)!.maxWidth).toBe(200 + (1000 - G - 540));
    });

    it("完整在視窗內的後代一個都沒有：只受節點自己的邊緣限制（沒有子節點的葉節點也一樣）", () => {
        const none = layout([
            { id: "n", x: 100, y: 100, w: 200, h: 40, children: ["c"] },
            { id: "c", x: 900, y: 100, w: 300, h: 40 }, // 被切到，不算
        ]);
        expect(nodeBudget(none, "n", view, 1)!.maxWidth).toBe(200 + (1000 - G - 300));
        const leaf = layout([{ id: "n", x: 100, y: 100, w: 200, h: 40 }]);
        expect(nodeBudget(leaf, "n", view, 1)!.maxWidth).toBe(200 + (1000 - G - 300));
    });

    it("貼著視窗邊緣（落在 gap 裡）的後代不算完整在內", () => {
        const nodes = layout([
            { id: "n", x: 100, y: 100, w: 200, h: 40, children: ["a"] },
            { id: "a", x: 340, y: 100, w: 650, h: 40 }, // 右緣 990 > 1000 − G
        ]);
        expect(nodeBudget(nodes, "n", view, 1)!.maxWidth).toBe(200 + (1000 - G - 300));
    });

    it("節點自己已經貼邊或超出視窗：維持現在的寬，不縮小", () => {
        const nodes = layout([{ id: "n", x: 700, y: 100, w: 400, h: 40 }]); // 右緣 1100 超出
        expect(nodeBudget(nodes, "n", view, 1)!.maxWidth).toBe(400);
    });

    it("左側分支用左緣算", () => {
        const nodes = layout([
            { id: "n", x: 600, y: 100, w: 200, h: 40, side: -1, children: ["a"] },
            { id: "a", x: 300, y: 100, w: 200, h: 40, side: -1 },
        ]);
        // 後代：300 − G − 0；自己：600 − G − 0 更大 → 取後代
        expect(nodeBudget(nodes, "n", view, 1)!.maxWidth).toBe(200 + (300 - G));
    });

    it("根：兩側剩餘空間取小的乘二", () => {
        const nodes = layout([
            { id: "r", x: 400, y: 100, w: 200, h: 40, side: 0, children: ["a", "b"] },
            { id: "a", x: 650, y: 100, w: 200, h: 40, side: 1 }, // 右緣 850
            { id: "b", x: 250, y: 100, w: 200, h: 40, side: -1 }, // 左緣 250
        ]);
        const budget = nodeBudget(nodes, "r", view, 1)!.maxWidth;
        expect(budget).toBe(200 + 2 * Math.min(1000 - G - 850, 250 - G));
    });

    it("gap 是螢幕上的像素：放大時換成內容座標會變小", () => {
        const nodes = layout([
            { id: "n", x: 100, y: 100, w: 200, h: 40, children: ["a"] },
            { id: "a", x: 340, y: 100, w: 200, h: 40 },
        ]);
        const bounds = { left: 0, right: 600, top: 0, bottom: 800 };
        // 縮放 1：gap 24 → 剩餘 600 − 24 − 540 = 36；縮放 2：gap 換成內容座標 12 → 剩餘 48
        expect(nodeBudget(nodes, "n", bounds, 1)!.maxWidth).toBe(200 + (600 - G - 540));
        expect(nodeBudget(nodes, "n", bounds, 2)!.maxWidth).toBe(200 + (600 - G / 2 - 540));
    });
});

describe("nodeBudget 高度", () => {
    it("保留 2 個下方兄弟在視窗內：最大高 = 現在的高 + 視窗下緣 − gap − 第 2 個兄弟的下緣", () => {
        const nodes = layout([
            { id: "p", x: 0, y: 0, w: 100, h: 40, children: ["n", "s1", "s2", "s3"], side: 0 },
            { id: "n", x: 150, y: 100, w: 200, h: 40 },
            { id: "s1", x: 150, y: 160, w: 200, h: 40 },
            { id: "s2", x: 150, y: 220, w: 200, h: 40 }, // 下緣 260
            { id: "s3", x: 150, y: 280, w: 200, h: 40 },
        ]);
        // 沒有後代 → 免費空間 0
        expect(nodeBudget(nodes, "n", view, 1)!.maxHeight).toBe(40 + (800 - G - 260));
    });

    it("節點比後代疊起來還矮時，差額是免費空間", () => {
        const nodes = layout([
            { id: "p", x: 0, y: 0, w: 100, h: 40, children: ["n", "s1"], side: 0 },
            { id: "n", x: 150, y: 100, w: 200, h: 40, children: ["a", "b"] },
            { id: "a", x: 390, y: 60, w: 100, h: 40 },
            { id: "b", x: 390, y: 200, w: 100, h: 40 }, // 後代範圍 60..240 = 180
            { id: "s1", x: 150, y: 300, w: 200, h: 40 }, // 下緣 340
        ]);
        // 免費 = 180 − 40 = 140
        expect(nodeBudget(nodes, "n", view, 1)!.maxHeight).toBe(40 + 140 + (800 - G - 340));
    });

    it("下方兄弟不在視窗內（或沒有）就不限制；根沒有兄弟", () => {
        const nodes = layout([
            { id: "p", x: 0, y: 0, w: 100, h: 40, children: ["n", "s1"], side: 0 },
            { id: "n", x: 150, y: 100, w: 200, h: 40 },
            { id: "s1", x: 150, y: 790, w: 200, h: 40 }, // 下緣 830 超出
        ]);
        expect(nodeBudget(nodes, "n", view, 1)!.maxHeight).toBeNull();
        expect(nodeBudget(nodes, "p", view, 1)!.maxHeight).toBeNull();
    });

    it("只算同一側、同一個父節點、在它下方的兄弟", () => {
        const nodes = layout([
            { id: "p", x: 0, y: 0, w: 100, h: 40, children: ["above", "n", "other"], side: 0 },
            { id: "above", x: 150, y: 20, w: 200, h: 40 },
            { id: "n", x: 150, y: 100, w: 200, h: 40 },
            { id: "other", x: -250, y: 200, w: 200, h: 40, side: -1 },
        ]);
        expect(nodeBudget(nodes, "n", { left: -300, right: 1000, top: 0, bottom: 800 }, 1)!.maxHeight).toBeNull();
    });

    it("佈局裡找不到節點回傳 null", () => {
        expect(nodeBudget(layout([]), "x", view, 1)).toBeNull();
    });
});
