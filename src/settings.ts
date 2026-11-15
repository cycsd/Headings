import { App, Notice, PluginSettingTab, Setting, type SettingDefinitionItem, type SettingGroupItem } from "obsidian";
import HeadingsPlugin from "./main";
import { t } from "./i18n";
import { CONTENT_SECTION_TYPES, PROMOTABLE_SECTION_TYPES } from "./core/section-types";
import { LAYOUT_IDS } from "./layout/layout";
import {
	DEFAULT_SETTINGS,
	EDITOR_HEIGHT_RANGE,
	EDITOR_WIDTH_RANGE,
	EXPAND_DEPTH_RANGE,
	MAX_NODE_HEIGHT_RANGE,
	MAX_NODE_WIDTH_RANGE,
	NODE_STYLE_KEYS,
	normalizeHeight,
} from "./settings-model";
import { contentTypeLabel, layoutLabel, nodeStyleLabel, sectionTypeLabel } from "./labels";

export { DEFAULT_SETTINGS, type HeadingsSettings } from "./settings-model";

/** 有「全部開啟 / 關閉」開關的兩組型別；虛擬 key `<group>.*` 代表整組 */
const TOGGLE_GROUPS = [
	{ key: "nodeTypes", types: PROMOTABLE_SECTION_TYPES as readonly string[] },
	{ key: "defaultLitTypes", types: CONTENT_SECTION_TYPES as readonly string[] },
] as const;

const allOn = (settings: Record<string, unknown>, group: (typeof TOGGLE_GROUPS)[number]): boolean =>
	group.types.every((type) => getPath(settings, `${group.key}.${type}`) === true);

/** 高度類的滑桿：0 為不限制，0 到下限之間的值拉到下限 */
const HEIGHT_KEYS: Record<string, number> = { maxNodeHeight: MAX_NODE_HEIGHT_RANGE.minLimit, editorMaxHeight: EDITOR_HEIGHT_RANGE.minLimit };
const normalizeValue = (key: string, value: unknown): unknown =>
	typeof value === "number" && key in HEIGHT_KEYS ? normalizeHeight(value, HEIGHT_KEYS[key]) : value;

const layoutOptions = (): Record<string, string> =>
	Object.fromEntries(LAYOUT_IDS.map((id) => [id, layoutLabel[id]()]));

/** 設定物件的巢狀 key，例如 "nodeTypes.list"、"defaultLayout.desktop" */
const getPath = (obj: unknown, path: string): unknown =>
	path.split(".").reduce<unknown>((acc, key) => (typeof acc === "object" && acc !== null ? (acc as Record<string, unknown>)[key] : undefined), obj);

const setPath = (obj: Record<string, unknown>, path: string, value: unknown) => {
	const keys = path.split(".");
	const last = keys.pop()!;
	let target = obj;
	for (const key of keys) {
		const next = target[key];
		if (typeof next !== "object" || next === null) {
			target[key] = {};
		}
		target = target[key] as Record<string, unknown>;
	}
	target[last] = value;
};

export class HeadingsSettingTab extends PluginSettingTab {
	plugin: HeadingsPlugin;

	constructor(app: App, plugin: HeadingsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	// Obsidian 1.13 以前的版本不支援 getSettingDefinitions，會改用 display 渲染
	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName(t("settingNodeTypesHeading")).setDesc(t("settingNodeTypesDescription")).setHeading();
		this.displayToggleAll(containerEl, TOGGLE_GROUPS[0]);
		for (const type of PROMOTABLE_SECTION_TYPES) {
			new Setting(containerEl)
				.setName(sectionTypeLabel[type]())
				.addToggle((toggle) =>
					toggle.setValue(this.plugin.settings.nodeTypes[type]).onChange((value) => this.applySetting(`nodeTypes.${type}`, value)),
				);
		}

		new Setting(containerEl).setName(t("settingDefaultLitHeading")).setDesc(t("settingDefaultLitDescription")).setHeading();
		this.displayToggleAll(containerEl, TOGGLE_GROUPS[1]);
		for (const type of CONTENT_SECTION_TYPES) {
			new Setting(containerEl)
				.setName(contentTypeLabel(type))
				.addToggle((toggle) =>
					toggle.setValue(this.plugin.settings.defaultLitTypes[type]).onChange((value) => this.applySetting(`defaultLitTypes.${type}`, value)),
				);
		}

		new Setting(containerEl).setName(t("settingLayoutHeading")).setHeading();
		for (const platform of ["desktop", "mobile"] as const) {
			new Setting(containerEl)
				.setName(platform === "desktop" ? t("settingDefaultLayoutDesktopName") : t("settingDefaultLayoutMobileName"))
				.setDesc(t("settingDefaultLayoutDescription"))
				.addDropdown((dropdown) =>
					dropdown
						.addOptions(layoutOptions())
						.setValue(this.plugin.settings.defaultLayout[platform])
						.onChange((value) => this.applySetting(`defaultLayout.${platform}`, value)),
				);
		}

		new Setting(containerEl)
			.setName(t("settingMaxNodeWidthName"))
			.setDesc(t("settingMaxNodeWidthDescription"))
			.addSlider((slider) =>
				slider
					.setLimits(MAX_NODE_WIDTH_RANGE.min, MAX_NODE_WIDTH_RANGE.max, MAX_NODE_WIDTH_RANGE.step)
					.setValue(this.plugin.settings.maxNodeWidth)
					.setDynamicTooltip()
					.onChange((value) => this.applySetting("maxNodeWidth", value)),
			);

		new Setting(containerEl)
			.setName(t("settingMaxNodeHeightName"))
			.setDesc(t("settingMaxNodeHeightDescription"))
			.addSlider((slider) =>
				slider
					.setLimits(MAX_NODE_HEIGHT_RANGE.min, MAX_NODE_HEIGHT_RANGE.max, MAX_NODE_HEIGHT_RANGE.step)
					.setValue(this.plugin.settings.maxNodeHeight)
					.setDynamicTooltip()
					.onChange((value) => this.applySetting("maxNodeHeight", normalizeValue("maxNodeHeight", value))),
			);

		new Setting(containerEl)
			.setName(t("settingDefaultExpandEnabledName"))
			.setDesc(t("settingDefaultExpandEnabledDescription"))
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.defaultExpandEnabled).onChange((value) => this.applySetting("defaultExpandEnabled", value)),
			);

		new Setting(containerEl)
			.setName(t("settingDefaultExpandDepthName"))
			.setDesc(t("settingDefaultExpandDepthDescription"))
			.addSlider((slider) =>
				slider
					.setLimits(EXPAND_DEPTH_RANGE.min, EXPAND_DEPTH_RANGE.max, EXPAND_DEPTH_RANGE.step)
					.setValue(this.plugin.settings.defaultExpandDepth)
					.setDynamicTooltip()
					.onChange((value) => this.applySetting("defaultExpandDepth", value)),
			);

		new Setting(containerEl)
			.setName(t("settingRememberFileViewsName"))
			.setDesc(t("settingRememberFileViewsDescription"))
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.rememberFileViews).onChange((value) => this.applySetting("rememberFileViews", value)),
			);
		new Setting(containerEl)
			.setName(t("settingClearFileViewsName"))
			.setDesc(t("settingClearFileViewsDescription"))
			.addButton((button) => button.setButtonText(t("settingClearFileViewsButton")).onClick(() => void this.clearFileViews()));

		new Setting(containerEl).setName(t("settingNodeStyleHeading")).setHeading();
		for (const key of NODE_STYLE_KEYS) {
			new Setting(containerEl)
				.setName(nodeStyleLabel[key]())
				.setDesc(t("settingNodeStyleDescription"))
				.addToggle((toggle) =>
					toggle.setValue(this.plugin.settings.nodeStyle[key]).onChange((value) => this.applySetting(`nodeStyle.${key}`, value)),
				);
		}

		new Setting(containerEl)
			.setName(t("settingEditorSizeEnabledName"))
			.setDesc(t("settingEditorSizeEnabledDescription"))
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.editorSizeEnabled).onChange((value) => this.applySetting("editorSizeEnabled", value)),
			);
		if (this.plugin.settings.editorSizeEnabled) {
			new Setting(containerEl)
				.setName(t("settingEditorWidthName"))
				.setDesc(t("settingEditorWidthDescription"))
				.addSlider((slider) =>
					slider
						.setLimits(EDITOR_WIDTH_RANGE.min, EDITOR_WIDTH_RANGE.max, EDITOR_WIDTH_RANGE.step)
						.setValue(this.plugin.settings.editorWidth)
						.setDynamicTooltip()
						.onChange((value) => this.applySetting("editorWidth", value)),
				);
			new Setting(containerEl)
				.setName(t("settingEditorMaxHeightName"))
				.setDesc(t("settingEditorMaxHeightDescription"))
				.addSlider((slider) =>
					slider
						.setLimits(EDITOR_HEIGHT_RANGE.min, EDITOR_HEIGHT_RANGE.max, EDITOR_HEIGHT_RANGE.step)
						.setValue(this.plugin.settings.editorMaxHeight)
						.setDynamicTooltip()
						.onChange((value) => this.applySetting("editorMaxHeight", normalizeValue("editorMaxHeight", value))),
				);
		}
	}

	/** 清掉所有檔案記住的視圖狀態；開著的視圖維持現況 */
	private async clearFileViews() {
		await this.plugin.clearFileViews();
		new Notice(t("noticeFileViewsCleared"));
	}

	/** 舊版設定頁的「全部開啟 / 關閉」列 */
	private displayToggleAll(containerEl: HTMLElement, group: (typeof TOGGLE_GROUPS)[number]) {
		new Setting(containerEl)
			.setName(t("settingToggleAllName"))
			.setDesc(t("settingToggleAllDescription"))
			.addToggle((toggle) =>
				toggle
					.setValue(allOn(this.plugin.settings as unknown as Record<string, unknown>, group))
					.onChange((value) => this.applySetting(`${group.key}.*`, value)),
			);
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		const toggleAll = (group: (typeof TOGGLE_GROUPS)[number]): SettingGroupItem => ({
			name: t("settingToggleAllName"),
			desc: t("settingToggleAllDescription"),
			control: { type: "toggle", key: `${group.key}.*`, defaultValue: false },
		});
		return [
			{
				type: "group",
				heading: t("settingNodeTypesHeading"),
				items: [
					toggleAll(TOGGLE_GROUPS[0]),
					...PROMOTABLE_SECTION_TYPES.map((type): SettingGroupItem => ({
						name: sectionTypeLabel[type](),
						control: { type: "toggle", key: `nodeTypes.${type}`, defaultValue: DEFAULT_SETTINGS.nodeTypes[type] },
					})),
				],
			},
			{
				type: "group",
				heading: t("settingDefaultLitHeading"),
				items: [
					toggleAll(TOGGLE_GROUPS[1]),
					...CONTENT_SECTION_TYPES.map((type): SettingGroupItem => ({
						name: contentTypeLabel(type),
						desc: t("settingDefaultLitDescription"),
						control: { type: "toggle", key: `defaultLitTypes.${type}`, defaultValue: DEFAULT_SETTINGS.defaultLitTypes[type] },
					})),
				],
			},
			{
				type: "group",
				heading: t("settingLayoutHeading"),
				items: [
					{
						name: t("settingDefaultLayoutDesktopName"),
						desc: t("settingDefaultLayoutDescription"),
						control: { type: "dropdown", key: "defaultLayout.desktop", options: layoutOptions(), defaultValue: DEFAULT_SETTINGS.defaultLayout.desktop },
					},
					{
						name: t("settingDefaultLayoutMobileName"),
						desc: t("settingDefaultLayoutDescription"),
						control: { type: "dropdown", key: "defaultLayout.mobile", options: layoutOptions(), defaultValue: DEFAULT_SETTINGS.defaultLayout.mobile },
					},
					{
						name: t("settingMaxNodeWidthName"),
						desc: t("settingMaxNodeWidthDescription"),
						control: {
							type: "slider",
							key: "maxNodeWidth",
							...MAX_NODE_WIDTH_RANGE,
							defaultValue: DEFAULT_SETTINGS.maxNodeWidth,
							displayFormat: (value: number) => `${value}px`,
						},
					},
					{
						name: t("settingMaxNodeHeightName"),
						desc: t("settingMaxNodeHeightDescription"),
						control: {
							type: "slider",
							key: "maxNodeHeight",
							min: MAX_NODE_HEIGHT_RANGE.min,
							max: MAX_NODE_HEIGHT_RANGE.max,
							step: MAX_NODE_HEIGHT_RANGE.step,
							defaultValue: DEFAULT_SETTINGS.maxNodeHeight,
							displayFormat: (value: number) => (value === 0 ? t("settingUnlimited") : `${value}px`),
						},
					},
					{
						name: t("settingDefaultExpandEnabledName"),
						desc: t("settingDefaultExpandEnabledDescription"),
						control: { type: "toggle", key: "defaultExpandEnabled", defaultValue: DEFAULT_SETTINGS.defaultExpandEnabled },
					},
					{
						name: t("settingDefaultExpandDepthName"),
						desc: t("settingDefaultExpandDepthDescription"),
						control: {
							type: "slider",
							key: "defaultExpandDepth",
							...EXPAND_DEPTH_RANGE,
							defaultValue: DEFAULT_SETTINGS.defaultExpandDepth,
							displayFormat: (value: number) => (value === 0 ? t("expandDepthRootOnly") : String(value)),
						},
					},
					{
						name: t("settingRememberFileViewsName"),
						desc: t("settingRememberFileViewsDescription"),
						control: { type: "toggle", key: "rememberFileViews", defaultValue: DEFAULT_SETTINGS.rememberFileViews },
					},
					// 整列可點的動作項：清掉所有檔案記住的視圖狀態
					{
						name: t("settingClearFileViewsName"),
						desc: t("settingClearFileViewsDescription"),
						action: () => void this.clearFileViews(),
					},
				],
			},
			{
				type: "group",
				heading: t("settingNodeStyleHeading"),
				items: [
					...NODE_STYLE_KEYS.map(
						(key): SettingGroupItem => ({
							name: nodeStyleLabel[key](),
							desc: t("settingNodeStyleDescription"),
							control: { type: "toggle", key: `nodeStyle.${key}`, defaultValue: DEFAULT_SETTINGS.nodeStyle[key] },
						}),
					),
					{
						name: t("settingEditorSizeEnabledName"),
						desc: t("settingEditorSizeEnabledDescription"),
						control: { type: "toggle", key: "editorSizeEnabled", defaultValue: DEFAULT_SETTINGS.editorSizeEnabled },
					},
					// 兩個尺寸只在開關開著時顯示；開關改了 applySetting 會重畫
					...(this.plugin.settings.editorSizeEnabled
						? ([
								{
									name: t("settingEditorWidthName"),
									desc: t("settingEditorWidthDescription"),
									control: {
										type: "slider",
										key: "editorWidth",
										...EDITOR_WIDTH_RANGE,
										defaultValue: DEFAULT_SETTINGS.editorWidth,
										displayFormat: (value: number) => `${value}px`,
									},
								},
								{
									name: t("settingEditorMaxHeightName"),
									desc: t("settingEditorMaxHeightDescription"),
									control: {
										type: "slider",
										key: "editorMaxHeight",
										min: EDITOR_HEIGHT_RANGE.min,
										max: EDITOR_HEIGHT_RANGE.max,
										step: EDITOR_HEIGHT_RANGE.step,
										defaultValue: DEFAULT_SETTINGS.editorMaxHeight,
										displayFormat: (value: number) => (value === 0 ? t("settingUnlimited") : `${value}px`),
									},
								},
							] satisfies SettingGroupItem[])
						: []),
				],
			},
		];
	}

	getControlValue(key: string): unknown {
		const group = TOGGLE_GROUPS.find((g) => key === `${g.key}.*`);
		if (group) return allOn(this.plugin.settings as unknown as Record<string, unknown>, group);
		return getPath(this.plugin.settings, key);
	}

	async setControlValue(key: string, value: unknown) {
		await this.applySetting(key, normalizeValue(key, value));
	}

	private async applySetting(key: string, value: unknown) {
		const group = TOGGLE_GROUPS.find((g) => key === `${g.key}.*`);
		if (group) {
			// 一鍵全開 / 全關：寫入該組所有型別
			for (const type of group.types) {
				setPath(this.plugin.settings as unknown as Record<string, unknown>, `${group.key}.${type}`, value === true);
			}
		} else {
			setPath(this.plugin.settings as unknown as Record<string, unknown>, key, value);
		}
		await this.plugin.saveSettings();
		await this.plugin.refreshHeadingsViews();
		// 這兩組的個別開關與「全部」開關互相影響，改了就重畫整個設定頁讓它們同步；編輯器尺寸開關決定底下兩個滑桿顯不顯示
		if (TOGGLE_GROUPS.some((g) => key.startsWith(`${g.key}.`)) || key === "editorSizeEnabled") this.rerender();
	}

	/** 1.13 以後用 update() 重畫宣告式設定；舊版重跑 display() */
	private rerender() {
		if (typeof this.update === "function") this.update();
		else this.display();
	}
}
