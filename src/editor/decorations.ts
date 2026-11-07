import { RangeSetBuilder } from '@codemirror/state';
import {
	Decoration,
	DecorationSet,
	EditorView,
	PluginValue,
	ViewPlugin,
	ViewUpdate,
} from '@codemirror/view';
import { editorLivePreviewField } from 'obsidian';
import { sectionStarts } from '../model/sort';
import {
	findFields,
	findRegions,
	parseTask,
	Region,
	regionBody,
} from '../model/tasks';
import { TaskBlockSettings } from '../settings';
import { AddTaskButton, CancelButton, DateWidget, SectionTitle } from './widgets';

const hiddenMarker = Decoration.replace({});
const regionLine = Decoration.line({ class: 'task-block-line' });
const cancelButton = Decoration.widget({ widget: new CancelButton(), side: 1 });

function sectionTitles(
	lines: readonly string[],
	region: Region,
	settings: TaskBlockSettings,
): Map<number, string> {
	const titles = new Map<number, string>();
	if (!settings.showSectionTitles) return titles;
	const body = regionBody(lines, region);
	for (const start of sectionStarts(body)) {
		const separator = start.line - 1;
		if (separator < 0 || body[separator]?.trim() !== '') continue;
		const title =
			start.status === 'done' ? settings.completedTitle : settings.cancelledTitle;
		titles.set(region.open + 2 + separator, title);
	}
	return titles;
}

function isLivePreview(view: EditorView): boolean {
	return view.state.field(editorLivePreviewField, false) ?? false;
}

export function createDecorations(getSettings: () => TaskBlockSettings) {
	class TaskDecorations implements PluginValue {
		decorations: DecorationSet = Decoration.none;
		atomic: DecorationSet = Decoration.none;

		constructor(view: EditorView) {
			this.build(view);
		}

		update(update: ViewUpdate): void {
			const modeChanged =
				update.startState.field(editorLivePreviewField, false) !==
				update.state.field(editorLivePreviewField, false);
			if (update.docChanged || update.selectionSet || modeChanged) {
				this.build(update.view);
			}
		}

		private build(view: EditorView): void {
			const { doc, selection } = view.state;
			const settings = getSettings();
			const lines = doc.toJSON();
			const live = isLivePreview(view);
			const all = new RangeSetBuilder<Decoration>();
			const atomic = new RangeSetBuilder<Decoration>();
			const touched = (from: number, to: number) =>
				selection.ranges.some((r) => r.from <= to && r.to >= from);

			for (const region of findRegions(lines)) {
				const open = doc.line(region.open + 1);
				if (live && !touched(open.from, open.to)) {
					all.add(
						open.from,
						open.to,
						Decoration.replace({ widget: new AddTaskButton(settings.buttonText) }),
					);
				}
				const titles = sectionTitles(lines, region, settings);
				for (let n = region.open + 2; n <= region.close; n++) {
					const line = doc.line(n);
					all.add(line.from, line.from, regionLine);
					const title = titles.get(n);
					if (title && live && !touched(line.from, line.to)) {
						all.add(
							line.from,
							line.from,
							Decoration.widget({ widget: new SectionTitle(title), side: 1 }),
						);
					}
					const task = parseTask(line.text);
					if (!task) continue;
					for (const field of findFields(line.text)) {
						const deco = Decoration.replace({
							widget: new DateWidget(field.key, field.iso, settings.dateFormat),
						});
						all.add(line.from + field.from, line.from + field.to, deco);
						atomic.add(line.from + field.from, line.from + field.to, deco);
					}
					if (task.status === 'open' && settings.showCancelButton) {
						all.add(line.to, line.to, cancelButton);
					}
				}
				const close = doc.line(region.close + 1);
				if (live && !touched(close.from, close.to)) {
					all.add(close.from, close.to, hiddenMarker);
				}
			}
			this.decorations = all.finish();
			this.atomic = atomic.finish();
		}
	}

	const plugin = ViewPlugin.fromClass(TaskDecorations, {
		decorations: (v) => v.decorations,
	});
	return [
		plugin,
		EditorView.atomicRanges.of(
			(view) => view.plugin(plugin)?.atomic ?? Decoration.none,
		),
	];
}
