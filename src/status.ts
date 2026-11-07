import { Editor, IconName } from 'obsidian';
import { isInsideBody, parseTask, TaskLine } from './model/tasks';

export interface StatusAction {
	id: string;
	name: string;
	icon: IconName;
	char: string;
	isCurrent: (task: TaskLine) => boolean;
}

export const STATUS_ACTIONS: StatusAction[] = [
	{
		id: 'mark-open',
		name: 'Mark as open',
		icon: 'circle',
		char: ' ',
		isCurrent: (task) => task.statusChar === ' ',
	},
	{
		id: 'mark-in-progress',
		name: 'Mark as in progress',
		icon: 'loader',
		char: '/',
		isCurrent: (task) => task.statusChar === '/',
	},
	{
		id: 'mark-complete',
		name: 'Mark as complete',
		icon: 'circle-check',
		char: 'x',
		isCurrent: (task) => task.status === 'done',
	},
	{
		id: 'mark-cancelled',
		name: 'Mark as cancelled',
		icon: 'circle-x',
		char: '-',
		isCurrent: (task) => task.status === 'cancelled',
	},
];

export function taskInListAt(editor: Editor, line: number): TaskLine | null {
	if (!isInsideBody(editor.getValue().split('\n'), line)) return null;
	return parseTask(editor.getLine(line));
}

export function setTaskStatus(
	editor: Editor,
	line: number,
	task: TaskLine,
	char: string,
): void {
	const ch = task.statusOffset;
	editor.replaceRange(char, { line, ch }, { line, ch: ch + 1 });
}
