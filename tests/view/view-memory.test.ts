import { describe, expect, it } from "vitest";
import { FileViewStore, MAX_FILE_VIEWS, pruneMemory, readFileViews, sameMemory, type FileViewMemory } from "../../src/view/view-memory";

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
