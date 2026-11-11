import { App, PluginSettingTab, Setting, type SettingDefinitionItem } from "obsidian";
import HeadingsPlugin from "./main";
import { t } from "./i18n";
import { CONTENT_SECTION_TYPES, PROMOTABLE_SECTION_TYPES } from "./core/section-types";
import { LAYOUT_IDS } from "./layout/layout";
import { DEFAULT_SETTINGS, MAX_NODE_WIDTH_RANGE, NODE_STYLE_KEYS } from "./settings-model";
import { contentTypeLabel, layoutLabel, nodeStyleLabel, sectionTypeLabel } from "./labels";

export { DEFAULT_SETTINGS, type HeadingsSettings } from "./settings-model";

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
		for (const type of PROMOTABLE_SECTION_TYPES) {
			new Setting(containerEl)
				.setName(sectionTypeLabel[type]())
				.addToggle((toggle) =>
					toggle.setValue(this.plugin.settings.nodeTypes[type]).onChange((value) => this.applySetting(`nodeTypes.${type}`, value)),
				);
		}

		new Setting(containerEl).setName(t("settingDefaultLitHeading")).setDesc(t("settingDefaultLitDescription")).setHeading();
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

		new Setting(containerEl).setName(t("settingNodeStyleHeading")).setHeading();
		for (const key of NODE_STYLE_KEYS) {
			new Setting(containerEl)
				.setName(nodeStyleLabel[key]())
				.setDesc(t("settingNodeStyleDescription"))
				.addToggle((toggle) =>
					toggle.setValue(this.plugin.settings.nodeStyle[key]).onChange((value) => this.applySetting(`nodeStyle.${key}`, value)),
				);
		}
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				type: "group",
				heading: t("settingNodeTypesHeading"),
				items: PROMOTABLE_SECTION_TYPES.map((type) => ({
					name: sectionTypeLabel[type](),
					control: { type: "toggle", key: `nodeTypes.${type}`, defaultValue: DEFAULT_SETTINGS.nodeTypes[type] },
				})),
			},
			{
				type: "group",
				heading: t("settingDefaultLitHeading"),
				items: CONTENT_SECTION_TYPES.map((type) => ({
					name: contentTypeLabel(type),
					desc: t("settingDefaultLitDescription"),
					control: { type: "toggle", key: `defaultLitTypes.${type}`, defaultValue: DEFAULT_SETTINGS.defaultLitTypes[type] },
				})),
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
				],
			},
			{
				type: "group",
				heading: t("settingNodeStyleHeading"),
				items: NODE_STYLE_KEYS.map((key) => ({
					name: nodeStyleLabel[key](),
					desc: t("settingNodeStyleDescription"),
					control: { type: "toggle", key: `nodeStyle.${key}`, defaultValue: DEFAULT_SETTINGS.nodeStyle[key] },
				})),
			},
		];
	}

	getControlValue(key: string): unknown {
		return getPath(this.plugin.settings, key);
	}

	async setControlValue(key: string, value: unknown) {
		await this.applySetting(key, value);
	}

	private async applySetting(key: string, value: unknown) {
		setPath(this.plugin.settings as unknown as Record<string, unknown>, key, value);
		await this.plugin.saveSettings();
		await this.plugin.refreshHeadingsViews();
	}
}
