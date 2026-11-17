import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, type HeadingsSettings } from "../../src/settings-model";
import {
	FM_LAYOUT_KEY,
	FM_MINDMAP_DIRECTION_KEY,
	FM_NODES_KEY,
	frontmatterLayout,
	frontmatterNodeTypes,
	resolveLayoutId,
	resolveMindmapDirection,
	resolveNodeTypes,
} from "../../src/view/view-config";

const settings: HeadingsSettings = {
	...DEFAULT_SETTINGS,
	nodeTypes: { ...DEFAULT_SETTINGS.nodeTypes, list: true },
	defaultLayout: { desktop: "mindmap", mobile: "outline" },
};

describe("frontmatterLayout", () => {
	it("合法的值原樣回傳", () => {
		expect(frontmatterLayout({ [FM_LAYOUT_KEY]: "tree-table" })).toBe("tree-table");
	});
	it("沒有屬性、不合法的值、非字串都回傳 undefined", () => {
		expect(frontmatterLayout(undefined)).toBeUndefined();
		expect(frontmatterLayout({})).toBeUndefined();
		expect(frontmatterLayout({ [FM_LAYOUT_KEY]: "radial" })).toBeUndefined();
		expect(frontmatterLayout({ [FM_LAYOUT_KEY]: 3 })).toBeUndefined();
	});
});

describe("frontmatterNodeTypes", () => {
	it("沒有屬性回傳 undefined，代表要用全域設定", () => {
		expect(frontmatterNodeTypes(undefined)).toBeUndefined();
		expect(frontmatterNodeTypes({})).toBeUndefined();
	});
	it("空陣列代表明確指定「不升級任何型別」", () => {
		expect(frontmatterNodeTypes({ [FM_NODES_KEY]: [] })).toEqual([]);
	});
	it("不認識的型別略過，順序依 PROMOTABLE_SECTION_TYPES 固定", () => {
		expect(frontmatterNodeTypes({ [FM_NODES_KEY]: ["code", "heading", "list", 42] })).toEqual(["list", "code"]);
	});
	it("不是陣列視為沒有屬性", () => {
		expect(frontmatterNodeTypes({ [FM_NODES_KEY]: "list" })).toBeUndefined();
	});
});

describe("resolveLayoutId", () => {
	const all = ["mindmap", "tree-table", "outline"] as const;

	it("YAML 指定且已註冊時優先", () => {
		expect(resolveLayoutId({ [FM_LAYOUT_KEY]: "tree-table" }, settings, false, all)).toBe("tree-table");
	});
	it("沒有 YAML 時依平台用全域預設", () => {
		expect(resolveLayoutId(undefined, settings, false, all)).toBe("mindmap");
		expect(resolveLayoutId(undefined, settings, true, all)).toBe("outline");
	});
	it("YAML 指定的佈局尚未註冊時退回全域預設", () => {
		expect(resolveLayoutId({ [FM_LAYOUT_KEY]: "mindmap" }, settings, false, ["tree-table"])).toBe("tree-table");
	});
	it("全域預設也沒註冊時用第一個已註冊的", () => {
		expect(resolveLayoutId(undefined, settings, false, ["tree-table"])).toBe("tree-table");
	});
});

describe("resolveMindmapDirection", () => {
	it("沒有 YAML 時用全域設定；YAML 合法就覆寫；不合法視為沒有", () => {
		expect(resolveMindmapDirection(undefined, settings)).toBe("both");
		expect(resolveMindmapDirection(undefined, { ...settings, mindmapDirection: "right" })).toBe("right");
		expect(resolveMindmapDirection({ [FM_MINDMAP_DIRECTION_KEY]: "right" }, settings)).toBe("right");
		expect(resolveMindmapDirection({ [FM_MINDMAP_DIRECTION_KEY]: "both" }, { ...settings, mindmapDirection: "right" })).toBe("both");
		expect(resolveMindmapDirection({ [FM_MINDMAP_DIRECTION_KEY]: "left" }, { ...settings, mindmapDirection: "right" })).toBe("right");
	});
});

describe("resolveNodeTypes", () => {
	it("沒有 YAML 時用全域設定勾選的型別", () => {
		expect(resolveNodeTypes(undefined, settings)).toEqual(["list"]);
	});
	it("YAML 有指定就完全以 YAML 為準，包含空陣列", () => {
		expect(resolveNodeTypes({ [FM_NODES_KEY]: ["code"] }, settings)).toEqual(["code"]);
		expect(resolveNodeTypes({ [FM_NODES_KEY]: [] }, settings)).toEqual([]);
	});
});
