import {
	App,
	PluginSettingTab,
	Setting,
	SettingDefinitionItem,
} from 'obsidian';
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

type TextKey = 'buttonText' | 'completedTitle' | 'cancelledTitle';

function isSettingKey(key: string): key is keyof TaskBlockSettings {
	return key in DEFAULT_SETTINGS;
}

export class TaskBlockSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private readonly plugin: TaskBlockPlugin,
	) {
		super(app, plugin);
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		const titlesHidden = () => !this.plugin.settings.showSectionTitles;
		return [
			{
				name: 'Date format',
				desc: 'How dates are shown after each task. Uses Moment.js syntax.',
				aliases: ['moment'],
				render: (setting) => this.renderDateFormat(setting),
			},
			this.textDefinition(
				'Button text',
				'Text on the button that adds a new task.',
				'buttonText',
			),
			{
				name: 'Show cancel button',
				desc: 'Show a button after open tasks that moves them to the cancelled section.',
				control: { type: 'toggle', key: 'showCancelButton' },
			},
			{
				name: 'Show section titles',
				desc: 'Show a faded title above the completed and cancelled tasks.',
				control: { type: 'toggle', key: 'showSectionTitles' },
			},
			this.textDefinition('Completed title', undefined, 'completedTitle', titlesHidden),
			this.textDefinition('Cancelled title', undefined, 'cancelledTitle', titlesHidden),
		];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		if (!isSettingKey(key)) return;
		const settings = this.plugin.settings as unknown as Record<string, unknown>;
		const fallback = DEFAULT_SETTINGS[key];
		settings[key] =
			typeof value === 'string' && typeof fallback === 'string'
				? value.trim() || fallback
				: value;
		await this.plugin.saveSettings();
		this.plugin.refreshViews();
		if (key === 'showSectionTitles') this.refreshDomState();
	}

	private textDefinition(
		name: string,
		desc: string | undefined,
		key: TextKey,
		disabled?: () => boolean,
	): SettingDefinitionItem {
		return {
			name,
			desc,
			control: {
				type: 'text',
				key,
				placeholder: DEFAULT_SETTINGS[key],
				disabled,
			},
		};
	}

	private renderDateFormat(setting: Setting): void {
		const description = createFragment((frag) => {
			frag.appendText('How dates are shown after each task. Uses ');
			frag.createEl('a', {
				text: 'Moment.js syntax',
				href: 'https://momentjs.com/docs/#/displaying/format/',
			});
			frag.appendText('. Preview: ');
		});
		const sample = description.createEl('strong');
		setting.setDesc(description).addMomentFormat((format) =>
			format
				.setDefaultFormat(DEFAULT_SETTINGS.dateFormat)
				.setValue(this.plugin.settings.dateFormat)
				.setSampleEl(sample)
				.onChange((value) => this.setControlValue('dateFormat', value)),
		);
	}
}
