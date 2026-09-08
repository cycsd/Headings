import {App, PluginSettingTab, Setting} from "obsidian";
import HeadingsPlugin from "./main";
import { t } from "./i18n";

export interface HeadingsSettings {
	mySetting: string;
}

export const DEFAULT_SETTINGS: HeadingsSettings = {
	mySetting: 'default'
}

export class HeadingsSettingTab extends PluginSettingTab {
	plugin: HeadingsPlugin;

	constructor(app: App, plugin: HeadingsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName(t('settingName'))
			.setDesc(t('settingDescription'))
			.addText(text => text
				.setPlaceholder(t('settingPlaceholder'))
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}
