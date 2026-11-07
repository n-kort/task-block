import { App, PluginSettingTab, Setting } from 'obsidian';
import type TaskBlockPlugin from './main';

export interface TaskBlockSettings {
	dateFormat: string;
	buttonText: string;
	showCancelButton: boolean;
	showSectionTitles: boolean;
	completedTitle: string;
	cancelledTitle: string;
}

export const DEFAULT_SETTINGS: TaskBlockSettings = {
	dateFormat: 'D.M.YY',
	buttonText: 'Add task',
	showCancelButton: true,
	showSectionTitles: true,
	completedTitle: 'Completed',
	cancelledTitle: 'Cancelled',
};

export class TaskBlockSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private readonly plugin: TaskBlockPlugin,
	) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		const description = createFragment((frag) => {
			frag.appendText('How dates are shown after each task. Uses ');
			frag.createEl('a', {
				text: 'Moment.js syntax',
				href: 'https://momentjs.com/docs/#/displaying/format/',
			});
			frag.appendText('. Preview: ');
		});
		const sample = description.createEl('strong');

		new Setting(containerEl)
			.setName('Date format')
			.setDesc(description)
			.addMomentFormat((format) =>
				format
					.setDefaultFormat(DEFAULT_SETTINGS.dateFormat)
					.setValue(this.plugin.settings.dateFormat)
					.setSampleEl(sample)
					.onChange(async (value) => {
						this.plugin.settings.dateFormat =
							value.trim() || DEFAULT_SETTINGS.dateFormat;
						await this.plugin.saveSettings();
						this.plugin.refreshViews();
					}),
			);

		new Setting(containerEl)
			.setName('Button text')
			.setDesc('Text on the button that adds a new task.')
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.buttonText)
					.setValue(this.plugin.settings.buttonText)
					.onChange(async (value) => {
						this.plugin.settings.buttonText =
							value.trim() || DEFAULT_SETTINGS.buttonText;
						await this.plugin.saveSettings();
						this.plugin.refreshViews();
					}),
			);

		new Setting(containerEl)
			.setName('Show cancel button')
			.setDesc('Show a button after open tasks that moves them to the cancelled section.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showCancelButton)
					.onChange(async (value) => {
						this.plugin.settings.showCancelButton = value;
						await this.plugin.saveSettings();
						this.plugin.refreshViews();
					}),
			);

		const titleSettings: Setting[] = [];
		new Setting(containerEl)
			.setName('Show section titles')
			.setDesc('Show a faded title above the completed and cancelled tasks.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showSectionTitles)
					.onChange(async (value) => {
						this.plugin.settings.showSectionTitles = value;
						for (const setting of titleSettings) setting.setDisabled(!value);
						await this.plugin.saveSettings();
						this.plugin.refreshViews();
					}),
			);
		titleSettings.push(
			this.addTitleSetting('Completed title', 'completedTitle'),
			this.addTitleSetting('Cancelled title', 'cancelledTitle'),
		);
	}

	private addTitleSetting(
		name: string,
		key: 'completedTitle' | 'cancelledTitle',
	): Setting {
		return new Setting(this.containerEl)
			.setName(name)
			.setDisabled(!this.plugin.settings.showSectionTitles)
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS[key])
					.setValue(this.plugin.settings[key])
					.onChange(async (value) => {
						this.plugin.settings[key] = value.trim() || DEFAULT_SETTINGS[key];
						await this.plugin.saveSettings();
						this.plugin.refreshViews();
					}),
			);
	}
}
