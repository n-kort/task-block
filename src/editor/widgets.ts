import { EditorView, WidgetType } from '@codemirror/view';
import { editorInfoField, setIcon } from 'obsidian';
import { createDateEl } from '../dates';
import { FieldKey, fieldText, findFields, parseTask } from '../model/tasks';
import { DateModal } from '../ui/dateModal';
import { addTask } from './addTask';

export class DateWidget extends WidgetType {
	constructor(
		private readonly key: FieldKey,
		private readonly iso: string,
		private readonly format: string,
	) {
		super();
	}

	eq(other: DateWidget): boolean {
		return (
			other.key === this.key &&
			other.iso === this.iso &&
			other.format === this.format
		);
	}

	toDOM(view: EditorView): HTMLElement {
		const el = createDateEl(this.key, this.iso, this.format);
		el.addClass('task-block-date-editable');
		el.addEventListener('mousedown', (e) => e.preventDefault());
		el.addEventListener('click', (e) => {
			e.preventDefault();
			const app = view.state.field(editorInfoField, false)?.app;
			if (!app) return;
			const pos = view.posAtDOM(el);
			new DateModal(app, this.key, this.iso, (iso) =>
				replaceDate(view, pos, this.key, iso),
			).open();
		});
		return el;
	}

	ignoreEvent(): boolean {
		return true;
	}
}

function replaceDate(
	view: EditorView,
	pos: number,
	key: FieldKey,
	iso: string,
): void {
	const line = view.state.doc.lineAt(pos);
	const fields = findFields(line.text).filter((f) => f.key === key);
	const field =
		fields.find((f) => line.from + f.from === pos) ?? fields[0];
	if (!field) return;
	view.dispatch({
		changes: {
			from: line.from + field.from,
			to: line.from + field.to,
			insert: fieldText(key, iso),
		},
		userEvent: 'input',
	});
}

export class CancelButton extends WidgetType {
	eq(): boolean {
		return true;
	}

	toDOM(view: EditorView): HTMLElement {
		const button = createSpan({
			cls: 'task-block-cancel',
			attr: { 'aria-label': 'Cancel task', role: 'button' },
		});
		setIcon(button, 'circle-x');
		button.addEventListener('mousedown', (e) => e.preventDefault());
		button.addEventListener('click', (e) => {
			e.preventDefault();
			const line = view.state.doc.lineAt(view.posAtDOM(button));
			const task = parseTask(line.text);
			if (task?.status !== 'open') return;
			const at = line.from + task.statusOffset;
			view.dispatch({
				changes: { from: at, to: at + 1, insert: '-' },
				userEvent: 'input',
			});
		});
		return button;
	}

	ignoreEvent(): boolean {
		return true;
	}
}

export class SectionTitle extends WidgetType {
	constructor(private readonly title: string) {
		super();
	}

	eq(other: SectionTitle): boolean {
		return other.title === this.title;
	}

	toDOM(): HTMLElement {
		return createSpan({ cls: 'task-block-section-title', text: this.title });
	}
}

export class AddTaskButton extends WidgetType {
	constructor(private readonly label: string) {
		super();
	}

	eq(other: AddTaskButton): boolean {
		return other.label === this.label;
	}

	toDOM(view: EditorView): HTMLElement {
		const button = createEl('button', { cls: 'task-block-add' });
		setIcon(button.createSpan({ cls: 'task-block-add-icon' }), 'plus');
		button.createSpan({ text: this.label });
		button.addEventListener('mousedown', (e) => e.preventDefault());
		button.addEventListener('click', (e) => {
			e.preventDefault();
			const editor = view.state.field(editorInfoField, false)?.editor;
			if (!editor) return;
			const line = view.state.doc.lineAt(view.posAtDOM(button)).number - 1;
			addTask(editor, line);
		});
		return button;
	}

	ignoreEvent(): boolean {
		return true;
	}
}
