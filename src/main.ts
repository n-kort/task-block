import { Extension } from '@codemirror/state';
import { MarkdownView, Plugin } from 'obsidian';
import { registerCommands } from './commands';
import { buildEditorExtension } from './editor';
import { registerReadingView } from './reading/readingView';
import {
	DEFAULT_SETTINGS,
	TaskBlockSettings,
	TaskBlockSettingTab,
} from './settings';

export default class TaskBlockPlugin extends Plugin {
	settings!: TaskBlockSettings;
	private readonly editorExtensions: Extension[] = [];

	async onload() {
		await this.loadSettings();
		this.editorExtensions.push(buildEditorExtension(this.getSettings));
		this.registerEditorExtension(this.editorExtensions);
		registerReadingView(this, this.getSettings);
		registerCommands(this);
		this.addSettingTab(new TaskBlockSettingTab(this.app, this));
	}

	private readonly getSettings = () => this.settings;

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<TaskBlockSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	refreshViews() {
		this.editorExtensions.splice(
			0,
			this.editorExtensions.length,
			buildEditorExtension(this.getSettings),
		);
		this.app.workspace.updateOptions();
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (leaf.view instanceof MarkdownView) leaf.view.previewMode.rerender(true);
		});
	}
}
