import { App, PluginSettingTab, Setting, type SettingDefinitionItem } from "obsidian";
import HeadingsPlugin from "./main";
import { t } from "./i18n";

export interface HeadingsSettings {
	/** tree table 中是否將 list 視為節點(含子 list)，而非 heading 底下的 section */
	listAsNode: boolean;
}

export const DEFAULT_SETTINGS: HeadingsSettings = {
	listAsNode: false
}

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

		new Setting(containerEl)
			.setName(t('settingListAsNodeName'))
			.setDesc(t('settingListAsNodeDescription'))
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.listAsNode)
				.onChange(async (value) => {
					this.plugin.settings.listAsNode = value;
					await this.plugin.saveSettings();
					await this.plugin.refreshTreeTableViews();
				}));
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: t('settingListAsNodeName'),
				desc: t('settingListAsNodeDescription'),
				control: { type: 'toggle', key: 'listAsNode', defaultValue: DEFAULT_SETTINGS.listAsNode }
			}
		]
	}

	async setControlValue(key: string, value: unknown) {
		await super.setControlValue(key, value);
		await this.plugin.refreshTreeTableViews();
	}
}
