import {
	Annotation,
	ChangeSet,
	ChangeSpec,
	EditorState,
	MapMode,
	StateEffect,
	StateField,
	Text,
	Transaction,
	TransactionSpec,
} from '@codemirror/state';
import { EditorView, PluginValue, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { today } from '../dates';
import { bodyReplacement, sortBody } from '../model/sort';
import {
	createdField,
	isFreshTask,
	isInsideBody,
	moveFieldsToEnd,
	parseTask,
	regionBody,
	Region,
	regionContaining,
	TaskStatus,
} from '../model/tasks';

export const MOVE_DELAY_MS = 600;

const sorted = Annotation.define<boolean>();

interface PendingMove {
	pos: number;
	from: TaskStatus;
}

const addPending = StateEffect.define<PendingMove>();
const clearPending = StateEffect.define<null>();

export const pendingMoves = StateField.define<readonly PendingMove[]>({
	create: () => [],
	update(value, tr) {
		let next: PendingMove[] = [];
		for (const move of value) {
			const pos = tr.changes.mapPos(move.pos, 1, MapMode.TrackDel);
			if (pos !== null) next.push({ ...move, pos });
		}
		for (const effect of tr.effects) {
			if (effect.is(clearPending)) next = [];
			if (effect.is(addPending) && !next.some((m) => m.pos === effect.value.pos)) {
				next.push(effect.value);
			}
		}
		return next.length || value.length ? next : value;
	},
});

interface Change {
	fromA: number;
	toA: number;
	fromB: number;
	toB: number;
	inserted: Text;
}

function singleChange(changes: ChangeSet): Change | null {
	const all: Change[] = [];
	changes.iterChanges((fromA, toA, fromB, toB, inserted) =>
		all.push({ fromA, toA, fromB, toB, inserted }),
	);
	return all.length === 1 ? (all[0] ?? null) : null;
}

function deferSortAfterToggle(tr: Transaction, change: Change): TransactionSpec | null {
	if (change.inserted.lines > 1) return null;
	if (tr.isUserEvent('undo') || tr.isUserEvent('redo')) return null;
	const oldLine = tr.startState.doc.lineAt(change.fromA);
	if (change.toA > oldLine.to) return null;
	const newLine = tr.newDoc.lineAt(change.fromB);
	const before = parseTask(oldLine.text);
	const after = parseTask(newLine.text);
	if (!before || !after || before.status === after.status) return null;

	if (!isInsideBody(tr.newDoc.toJSON(), newLine.number - 1)) return null;
	return { effects: addPending.of({ pos: newLine.from, from: before.status }) };
}

function pendingSortChanges(state: EditorState): ChangeSpec[] {
	const { doc } = state;
	const lines = doc.toJSON();
	const moved = new Map<number, { region: Region; lines: number[] }>();
	for (const move of state.field(pendingMoves)) {
		const line = doc.lineAt(move.pos);
		const task = parseTask(line.text);
		if (!task || task.status === move.from) continue;
		const index = line.number - 1;
		const region = regionContaining(lines, index);
		if (!region || index <= region.open || index >= region.close) continue;
		const entry = moved.get(region.open) ?? { region, lines: [] };
		entry.lines.push(index - region.open - 1);
		moved.set(region.open, entry);
	}

	const date = today();
	const changes: ChangeSpec[] = [];
	for (const { region, lines: movedLines } of moved.values()) {
		const body = regionBody(lines, region);
		const replacement = bodyReplacement(
			region,
			body,
			sortBody(body, date, movedLines),
		);
		if (!replacement) continue;
		changes.push({
			from: doc.line(replacement.fromLine + 1).from,
			to: doc.line(replacement.toLine + 1).from,
			insert: replacement.text,
		});
	}
	return changes;
}

class DelayedSort implements PluginValue {
	private timer: number | null = null;

	constructor(private readonly view: EditorView) {}

	update(update: ViewUpdate): void {
		const added = update.transactions.some((tr) =>
			tr.effects.some((e) => e.is(addPending)),
		);
		if (added) this.schedule();
		else if (!update.state.field(pendingMoves).length) this.cancel();
	}

	destroy(): void {
		this.cancel();
	}

	private schedule(): void {
		this.cancel();
		this.timer = window.setTimeout(() => this.flush(), MOVE_DELAY_MS);
	}

	private cancel(): void {
		if (this.timer !== null) window.clearTimeout(this.timer);
		this.timer = null;
	}

	private flush(): void {
		this.timer = null;
		const { state } = this.view;
		if (!state.field(pendingMoves).length) return;
		this.view.dispatch({
			changes: pendingSortChanges(state),
			effects: clearPending.of(null),
			annotations: sorted.of(true),
		});
	}
}

export const delayedSort = ViewPlugin.fromClass(DelayedSort);

function keepFieldAtEnd(tr: Transaction, change: Change): TransactionSpec | null {
	if (change.inserted.lines > 1) return null;
	const line = tr.newDoc.lineAt(change.toB);
	if (!parseTask(line.text)) return null;
	const moved = moveFieldsToEnd(line.text);
	if (!moved || !isInsideBody(tr.newDoc.toJSON(), line.number - 1)) return null;

	const head = tr.newSelection.main.head - line.from;
	const headOnLine = head >= 0 && head <= line.length;
	return {
		changes: { from: line.from, to: line.to, insert: moved.text },
		selection: headOnLine
			? { anchor: line.from + moved.mapOffset(head) }
			: undefined,
	};
}

function dateFreshTask(tr: Transaction, change: Change): TransactionSpec | null {
	if (change.inserted.lines < 2) return null;
	const cursor = tr.newSelection.main;
	if (!cursor.empty) return null;
	const line = tr.newDoc.lineAt(cursor.head);
	if (cursor.head !== line.to || !isFreshTask(line.text)) return null;
	if (!isInsideBody(tr.newDoc.toJSON(), line.number - 1)) return null;
	return {
		changes: { from: line.to, insert: createdField(today()) },
		selection: { anchor: line.to },
	};
}

function syncCheckboxes(view: EditorView): void {
	view.contentDOM
		.querySelectorAll<HTMLInputElement>('input.task-list-item-checkbox')
		.forEach((box) => {
			const line = view.state.doc.lineAt(view.posAtDOM(box));
			const task = parseTask(line.text);
			if (task) box.checked = task.statusChar !== ' ';
		});
}

export const checkboxSync = EditorView.updateListener.of((update) => {
	if (update.transactions.some((tr) => tr.annotation(sorted))) {
		syncCheckboxes(update.view);
	}
});

export const autoSort = EditorState.transactionFilter.of((tr) => {
	if (!tr.docChanged || tr.annotation(sorted)) return tr;
	const change = singleChange(tr.changes);
	if (!change) return tr;
	const followUp =
		deferSortAfterToggle(tr, change) ??
		keepFieldAtEnd(tr, change) ??
		dateFreshTask(tr, change);
	return followUp ? [tr, { ...followUp, sequential: true }] : tr;
});
