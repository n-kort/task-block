import {
	Annotation,
	ChangeSet,
	EditorState,
	Text,
	Transaction,
	TransactionSpec,
} from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { today } from '../dates';
import { bodyReplacement, sortBody } from '../model/sort';
import {
	createdField,
	isFreshTask,
	isInsideBody,
	moveFieldsToEnd,
	parseTask,
	regionBody,
	regionContaining,
} from '../model/tasks';

const sorted = Annotation.define<boolean>();

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

function sortAfterToggle(tr: Transaction, change: Change): TransactionSpec | null {
	if (change.inserted.lines > 1) return null;
	const oldLine = tr.startState.doc.lineAt(change.fromA);
	if (change.toA > oldLine.to) return null;
	const newLine = tr.newDoc.lineAt(change.fromB);
	const before = parseTask(oldLine.text);
	const after = parseTask(newLine.text);
	if (!before || !after || before.status === after.status) return null;

	const lines = tr.newDoc.toJSON();
	const index = newLine.number - 1;
	const region = regionContaining(lines, index);
	if (!region || index === region.open || index === region.close) return null;

	const body = regionBody(lines, region);
	const replacement = bodyReplacement(
		region,
		body,
		sortBody(body, today(), index - region.open - 1),
	);
	if (!replacement) return null;
	return {
		annotations: sorted.of(true),
		changes: {
			from: tr.newDoc.line(replacement.fromLine + 1).from,
			to: tr.newDoc.line(replacement.toLine + 1).from,
			insert: replacement.text,
		},
	};
}

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
	if (!tr.docChanged) return tr;
	const change = singleChange(tr.changes);
	if (!change) return tr;
	const followUp =
		sortAfterToggle(tr, change) ??
		keepFieldAtEnd(tr, change) ??
		dateFreshTask(tr, change);
	return followUp ? [tr, { ...followUp, sequential: true }] : tr;
});
