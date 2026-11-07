import {
	MarkdownPostProcessorContext,
	MarkdownView,
	Plugin,
	TFile,
} from 'obsidian';
import { createDateEl, today } from '../dates';
import { sortRegions } from '../model/sort';
import { findFields, isInsideBody } from '../model/tasks';
import { TaskBlockSettings } from '../settings';

function replaceFields(node: Text, format: string): void {
	const text = node.data;
	const fields = findFields(text);
	if (!fields.length) return;
	const fragment = createFragment();
	let last = 0;
	for (const field of fields) {
		fragment.append(
			text.slice(last, field.from),
			createDateEl(field.key, field.iso, format),
		);
		last = field.to;
	}
	fragment.append(text.slice(last));
	node.replaceWith(fragment);
}

function renderDates(el: HTMLElement, format: string): void {
	el.querySelectorAll('li.task-list-item').forEach((item) => {
		const walker = activeDocument.createTreeWalker(item, NodeFilter.SHOW_TEXT);
		const nodes: Text[] = [];
		while (walker.nextNode()) nodes.push(walker.currentNode as Text);
		nodes.forEach((node) => replaceFields(node, format));
	});
}

function isTaskList(el: HTMLElement, ctx: MarkdownPostProcessorContext): boolean {
	const info = ctx.getSectionInfo(el);
	return !!info && isInsideBody(info.text.split('\n'), info.lineStart);
}

function addSectionTitle(el: HTMLElement, selector: string, title: string): void {
	const first = el.querySelector(`:scope > ul > ${selector}`);
	if (!first || first.previousElementSibling?.matches('.task-block-section-title')) {
		return;
	}
	first.before(createEl('li', { cls: 'task-block-section-title', text: title }));
}

function renderTaskList(el: HTMLElement, settings: TaskBlockSettings): void {
	el.querySelectorAll(':scope > ul').forEach((list) => list.addClass('task-block-list'));
	if (!settings.showSectionTitles) return;
	addSectionTitle(
		el,
		'li.task-list-item.is-checked:not([data-task="-"])',
		settings.completedTitle,
	);
	addSectionTitle(el, 'li.task-list-item[data-task="-"]', settings.cancelledTitle);
}

function isOpenInEditor(plugin: Plugin, file: TFile): boolean {
	let open = false;
	plugin.app.workspace.iterateAllLeaves((leaf) => {
		const view = leaf.view;
		if (
			view instanceof MarkdownView &&
			view.file === file &&
			view.getMode() === 'source'
		) {
			open = true;
		}
	});
	return open;
}

async function sortFile(plugin: Plugin, file: TFile): Promise<void> {
	const content = await plugin.app.vault.cachedRead(file);
	const date = today();
	if (sortRegions(content, date) === content) return;
	await plugin.app.vault.process(file, (data) => sortRegions(data, date));
}

export function registerReadingView(
	plugin: Plugin,
	getSettings: () => TaskBlockSettings,
): void {
	plugin.registerMarkdownPostProcessor((el, ctx) => {
		const settings = getSettings();
		renderDates(el, settings.dateFormat);
		if (isTaskList(el, ctx)) renderTaskList(el, settings);
	});
	plugin.registerEvent(
		plugin.app.vault.on('modify', (file) => {
			if (!(file instanceof TFile) || file.extension !== 'md') return;
			if (isOpenInEditor(plugin, file)) return;
			void sortFile(plugin, file);
		}),
	);
}
