import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, defaultLitTypes, enabledNodeTypes, migrateSettings } from "../src/settings-model";

describe("migrateSettings", () => {
    it("null / undefined 回傳預設值並標記 migrated", () => {
        expect(migrateSettings(null)).toEqual({ settings: DEFAULT_SETTINGS, migrated: true });
        expect(migrateSettings(undefined).settings).toEqual(DEFAULT_SETTINGS);
    });

    it("預設值：9 種型別全部關閉、預設顯示內容 10 種全部關閉、桌面 mindmap、手機 outline、寬度 320", () => {
        expect(Object.keys(DEFAULT_SETTINGS.nodeTypes)).toHaveLength(9);
        expect(Object.values(DEFAULT_SETTINGS.nodeTypes).every((v) => v === false)).toBe(true);
        expect(Object.keys(DEFAULT_SETTINGS.defaultLitTypes)).toHaveLength(10);
        expect(Object.values(DEFAULT_SETTINGS.defaultLitTypes).every((v) => v === false)).toBe(true);
        expect(DEFAULT_SETTINGS.defaultLayout).toEqual({ desktop: "mindmap", mobile: "outline" });
        expect(DEFAULT_SETTINGS.maxNodeWidth).toBe(320);
    });

    it("完整且正確的設定原樣保留，migrated 為 false", () => {
        const input = {
            nodeTypes: { ...DEFAULT_SETTINGS.nodeTypes, code: true },
            defaultLitTypes: { ...DEFAULT_SETTINGS.defaultLitTypes, code: true, yaml: true },
            defaultLayout: { desktop: "tree-table", mobile: "outline" },
            maxNodeWidth: 400,
            nodeStyle: { branchBorder: true, branchBackground: false },
        };
        const result = migrateSettings(input);
        expect(result.migrated).toBe(false);
        expect(result.settings).toEqual(input);
    });

    it("nodeStyle 缺少時預設都套用分支顏色，型別錯的欄位退回預設並標記 migrated", () => {
        expect(migrateSettings({}).settings.nodeStyle).toEqual({ branchBorder: true, branchBackground: true });
        const { settings, migrated } = migrateSettings({ nodeStyle: { branchBorder: false, branchBackground: "no" } });
        expect(migrated).toBe(true);
        expect(settings.nodeStyle).toEqual({ branchBorder: false, branchBackground: true });
    });

    it("舊版 listAsNode: true 遷移成 nodeTypes.list，並標記 migrated", () => {
        const { settings, migrated } = migrateSettings({ listAsNode: true });
        expect(migrated).toBe(true);
        expect(settings.nodeTypes.list).toBe(true);
        expect(enabledNodeTypes(settings)).toEqual(["list"]);
        expect("listAsNode" in settings).toBe(false);
    });

    it("listAsNode 與 nodeTypes.list 同時存在時以 nodeTypes.list 為準", () => {
        const { settings } = migrateSettings({ listAsNode: true, nodeTypes: { list: false } });
        expect(settings.nodeTypes.list).toBe(false);
    });

    it("部分 nodeTypes 補上缺少的型別", () => {
        const { settings, migrated } = migrateSettings({
            nodeTypes: { code: true },
            defaultLayout: DEFAULT_SETTINGS.defaultLayout,
            maxNodeWidth: 320,
        });
        expect(migrated).toBe(false);
        expect(settings.nodeTypes.code).toBe(true);
        expect(settings.nodeTypes.paragraph).toBe(false);
    });

    it("舊資料沒有 defaultLitTypes 時補上全部關閉，不算 migrated", () => {
        const { settings, migrated } = migrateSettings({
            nodeTypes: DEFAULT_SETTINGS.nodeTypes,
            defaultLayout: DEFAULT_SETTINGS.defaultLayout,
            maxNodeWidth: 320,
        });
        expect(migrated).toBe(false);
        expect(defaultLitTypes(settings)).toEqual([]);
    });

    it("defaultLitTypes 只接受認識的型別與布林值", () => {
        const { settings, migrated } = migrateSettings({ defaultLitTypes: { code: true, yaml: "yes", heading: true } });
        expect(migrated).toBe(true);
        expect(defaultLitTypes(settings)).toEqual(["code"]);
    });

    it("不合法的 layout id 退回預設並標記 migrated", () => {
        const { settings, migrated } = migrateSettings({ defaultLayout: { desktop: "radial", mobile: "tree-table" } });
        expect(migrated).toBe(true);
        expect(settings.defaultLayout).toEqual({ desktop: "mindmap", mobile: "tree-table" });
    });

    it("maxNodeWidth 超出範圍會被夾住，非數字退回預設", () => {
        expect(migrateSettings({ maxNodeWidth: 10 }).settings.maxNodeWidth).toBe(160);
        expect(migrateSettings({ maxNodeWidth: 99999 }).settings.maxNodeWidth).toBe(1200);
        expect(migrateSettings({ maxNodeWidth: "wide" }).settings.maxNodeWidth).toBe(320);
    });

    it("未知欄位會被丟掉並標記 migrated", () => {
        const { settings, migrated } = migrateSettings({ ...DEFAULT_SETTINGS, legacyThing: 1 });
        expect(migrated).toBe(true);
        expect("legacyThing" in settings).toBe(false);
    });
});
