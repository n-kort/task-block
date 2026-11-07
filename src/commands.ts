import { Editor, Menu, Notice, Plugin } from 'obsidian';
import { addTask } from './editor/addTask';
import { takeContextMenuLine } from './editor/contextMenu';
import { EMPTY_TASK_LIST, regionContaining } from './model/tasks';
import { setTaskStatus, STATUS_ACTIONS, taskInListAt } from './status';

function isInTaskList(editor: Editor, line: number): boolean {
	return !!regionContaining(editor.getValue().split('\n'), line);
}

function insertTaskList(editor: Editor): void {
	const cursor = editor.getCursor();
	const prefix = cursor.ch === 0 ? '' : '\n';
	editor.replaceRange(prefix + EMPTY_TASK_LIST, cursor);
	editor.setCursor({ line: cursor.line + (prefix ? 2 : 1), ch: 0 });
}

function addStatusItems(menu: Menu, editor: Editor, line: number): void {
	const task = taskInListAt(editor, line);
	if (!task) return;
	for (const action of STATUS_ACTIONS) {
		if (action.isCurrent(task)) continue;
		menu.addItem((item) =>
			item
				.setTitle(action.name)
				.setIcon(action.icon)
				.setSection('task-status')
				.onClick(() => setTaskStatus(editor, line, task, action.char)),
		);
	}
}

export function registerCommands(plugin: Plugin): void {
	plugin.addCommand({
		id: 'add-task',
		name: 'Add task',
		editorCallback: (editor) => {
			if (!addTask(editor, editor.getCursor().line)) {
				new Notice('No task list in this note yet. Insert one first.');
			}
		},
	});
	plugin.addCommand({
		id: 'insert-task-list',
		name: 'Insert task list',
		editorCheckCallback: (checking, editor) => {
			if (isInTaskList(editor, editor.getCursor().line)) return false;
			if (!checking) insertTaskList(editor);
			return true;
		},
	});
	for (const action of STATUS_ACTIONS) {
		plugin.addCommand({
			id: action.id,
			name: action.name,
			icon: action.icon,
			editorCheckCallback: (checking, editor) => {
				const line = editor.getCursor().line;
				const task = taskInListAt(editor, line);
				if (!task || action.isCurrent(task)) return false;
				if (!checking) setTaskStatus(editor, line, task, action.char);
				return true;
			},
		});
	}
	plugin.registerEvent(
		plugin.app.workspace.on('editor-menu', (menu, editor) => {
			const line = takeContextMenuLine() ?? editor.getCursor().line;
			if (isInTaskList(editor, line)) {
				addStatusItems(menu, editor, line);
				return;
			}
			menu.addItem((item) =>
				item
					.setTitle('Insert task list')
					.setIcon('list-checks')
					.setSection('insert')
					.onClick(() => insertTaskList(editor)),
			);
		}),
	);
}
