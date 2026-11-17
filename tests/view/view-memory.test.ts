import { describe, expect, it } from "vitest";
import { FileViewStore, MAX_FILE_VIEWS, pruneMemory, readFileViews, sameMemory, withViewport, type FileViewMemory } from "../../src/view/view-memory";

const memory = (collapsed: string[] = [], focusId: string | null = null): FileViewMemory => ({
    collapsed,
    focusId,
    expandDepth: 2,
    lit: { "root/A": ["paragraph"], "root/B": [] },
});

describe("readFileViews", () => {
    it("沒有 fileViews 或格式不對回傳空表", () => {
        expect(readFileViews(undefined)).toEqual({});
        expect(readFileViews({})).toEqual({});
        expect(readFileViews({ fileViews: [] })).toEqual({});
        expect(readFileViews({ fileViews: "x" })).toEqual({});
    });

    it("合法的記錄原樣保留，壞掉的單筆丟掉", () => {
        const good = memory(["root/A"], "root/B");
        const data = {
            fileViews: {
                "a.md": good,
                "b.md": { collapsed: "nope", focusId: null, expandDepth: 0, lit: {} },
                "c.md": { collapsed: [], focusId: 3, expandDepth: 0, lit: {} },
                "d.md": { collapsed: [], focusId: null, expandDepth: -1, lit: {} },
                "e.md": { collapsed: [], focusId: null, expandDepth: 1, lit: { x: [1] } },
                "f.md": null,
            },
        };
        expect(readFileViews(data)).toEqual({ "a.md": good });
    });

    it("超過上限只留最後的", () => {
        const fileViews = Object.fromEntries(Array.from({ length: MAX_FILE_VIEWS + 5 }, (_, i) => [`${i}.md`, memory()]));
        const result = readFileViews({ fileViews });
        expect(Object.keys(result)).toHaveLength(MAX_FILE_VIEWS);
        expect("0.md" in result).toBe(false);
        expect(`${MAX_FILE_VIEWS + 4}.md` in result).toBe(true);
    });
});

describe("zoom", () => {
    it("readFileViews 只留合理的平台 / 佈局 / 數字，沒有就不帶 zoom 欄位", () => {
        const data = {
            fileViews: {
                "a.md": { ...memory(), zoom: { desktop: { mindmap: 0.8, "tree-table": 1.2, outline: 2 }, mobile: { mindmap: -1 }, tv: { mindmap: 1 } } },
                "b.md": { ...memory(), zoom: "big" },
                "c.md": memory(),
            },
        };
        const views = readFileViews(data);
        expect(views["a.md"]!.zoom).toEqual({ desktop: { mindmap: 0.8, "tree-table": 1.2 } });
        expect("zoom" in views["b.md"]!).toBe(false);
        expect("zoom" in views["c.md"]!).toBe(false);
    });

    it("pan 只留兩個座標都合理的點", () => {
        const data = { fileViews: { "a.md": { ...memory(), pan: { desktop: { mindmap: { x: 0.3, y: 0.5 }, "tree-table": { x: 99, y: 0 } }, mobile: { mindmap: { x: "a", y: 0 } } } } } };
        expect(readFileViews(data)["a.md"]!.pan).toEqual({ desktop: { mindmap: { x: 0.3, y: 0.5 } } });
    });

    it("withViewport 併入目前平台、保留其他平台；目前平台空了就拿掉；pruneMemory 不動 zoom / pan", () => {
        const previous: FileViewMemory = { ...memory(), zoom: { mobile: { mindmap: 0.5 } }, pan: { mobile: { mindmap: { x: 0.5, y: 0.5 } } } };
        const merged = withViewport(memory(), previous, "desktop", { zoom: { mindmap: 0.75 }, pan: { mindmap: { x: 0.2, y: 0.4 } } });
        expect(merged.zoom).toEqual({ mobile: { mindmap: 0.5 }, desktop: { mindmap: 0.75 } });
        expect(merged.pan).toEqual({ mobile: { mindmap: { x: 0.5, y: 0.5 } }, desktop: { mindmap: { x: 0.2, y: 0.4 } } });
        const cleared = withViewport(memory(), merged, "desktop", { zoom: {}, pan: {} });
        expect(cleared.zoom).toEqual({ mobile: { mindmap: 0.5 } });
        expect(cleared.pan).toEqual({ mobile: { mindmap: { x: 0.5, y: 0.5 } } });
        const empty = withViewport(memory(), undefined, "desktop", { zoom: {}, pan: {} });
        expect("zoom" in empty).toBe(false);
        expect("pan" in empty).toBe(false);
        expect(pruneMemory(merged, new Set()).zoom).toEqual(merged.zoom);
        expect(pruneMemory(merged, new Set()).pan).toEqual(merged.pan);
    });
});

describe("pruneMemory", () => {
    it("去掉樹上已經沒有的 id；聚焦節點不在就放掉；層數照舊", () => {
        const pruned = pruneMemory(memory(["root/A", "root/gone"], "root/gone"), new Set(["root/A", "root/B"]));
        expect(pruned).toEqual({ collapsed: ["root/A"], focusId: null, expandDepth: 2, lit: { "root/A": ["paragraph"], "root/B": [] } });
        expect(pruneMemory(memory([], "root/A"), new Set(["root/A"])).focusId).toBe("root/A");
    });
});

describe("sameMemory", () => {
    it("內容相同才算相同，沒有舊記錄算不同", () => {
        expect(sameMemory(memory(["x"]), memory(["x"]))).toBe(true);
        expect(sameMemory(memory(["x"]), memory(["y"]))).toBe(false);
        expect(sameMemory(undefined, memory())).toBe(false);
    });
});

describe("FileViewStore", () => {
    it("get 會把那筆變成最近使用，set 超過上限丟最舊的", () => {
        const store = new FileViewStore({ "a.md": memory(["a"]), "b.md": memory(["b"]) }, 2);
        expect(store.get("a.md")?.collapsed).toEqual(["a"]);
        store.set("c.md", memory(["c"]));
        expect(Object.keys(store.toJSON())).toEqual(["a.md", "c.md"]);
        expect(store.size).toBe(2);
    });

    it("rename 搬 key，remove 與 clear 刪記錄", () => {
        const store = new FileViewStore({ "a.md": memory(["a"]) });
        expect(store.rename("a.md", "sub/a.md")).toBe(true);
        expect(store.rename("nope.md", "x.md")).toBe(false);
        expect(store.get("a.md")).toBeUndefined();
        expect(store.get("sub/a.md")?.collapsed).toEqual(["a"]);
        expect(store.remove("sub/a.md")).toBe(true);
        store.set("b.md", memory());
        store.clear();
        expect(store.size).toBe(0);
    });
});
