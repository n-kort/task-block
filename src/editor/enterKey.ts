import { Prec } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { today } from '../dates';
import {
	findFields,
	moveFieldsToEnd,
	hasEmptyTaskText,
	isInsideBody,
	newTaskLine,
	parseTask,
	TASK_PREFIX,
} from '../model/tasks';

function newTaskBelow(view: EditorView): boolean {
	const cursor = view.state.selection.main;
	if (!cursor.empty) return false;
	const line = view.state.doc.lineAt(cursor.head);
	const task = parseTask(line.text);
	const field = findFields(line.text)[0];
	if (!task || !field || moveFieldsToEnd(line.text)) return false;
	const offset = cursor.head - line.from;
	if (offset > field.from || line.text.slice(offset, field.from).trim() !== '') {
		return false;
	}
	if (!isInsideBody(view.state.doc.toJSON(), line.number - 1)) return false;

	if (hasEmptyTaskText(line.text.slice(0, field.from))) {
		view.dispatch({
			changes: { from: line.from, to: line.to, insert: '' },
			userEvent: 'delete',
		});
		return true;
	}

	const indent = line.text.slice(0, task.indent);
	view.dispatch({
		changes: { from: line.to, insert: `\n${indent}${newTaskLine(today())}` },
		selection: { anchor: line.to + 1 + indent.length + TASK_PREFIX.length },
		scrollIntoView: true,
		userEvent: 'input',
	});
	return true;
}

export const enterKey = Prec.highest(
	keymap.of([{ key: 'Enter', run: newTaskBelow }]),
);
