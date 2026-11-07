import { Editor } from 'obsidian';
import { today } from '../dates';
import { bodyReplacement, prependTask } from '../model/sort';
import {
	findRegions,
	newTaskLine,
	regionBody,
	TASK_PREFIX,
} from '../model/tasks';

export function addTask(editor: Editor, nearLine: number): boolean {
	const lines = editor.getValue().split('\n');
	const regions = findRegions(lines);
	const region =
		regions.find((r) => r.open <= nearLine && nearLine <= r.close) ??
		regions[0];
	if (!region) return false;

	const body = regionBody(lines, region);
	const next = prependTask(body, newTaskLine(today()));
	const replacement = bodyReplacement(region, body, next.body);
	if (replacement) {
		editor.transaction({
			changes: [
				{
					from: { line: replacement.fromLine, ch: 0 },
					to: { line: replacement.toLine, ch: 0 },
					text: replacement.text,
				},
			],
		});
	}
	editor.setCursor({ line: region.open + 1 + next.line, ch: TASK_PREFIX.length });
	editor.focus();
	return true;
}
