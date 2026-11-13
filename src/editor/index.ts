import { Extension } from '@codemirror/state';
import { TaskBlockSettings } from '../settings';
import { autoSort, checkboxSync, delayedSort, pendingMoves } from './autoSort';
import { contextMenuTracker } from './contextMenu';
import { createDecorations } from './decorations';
import { enterKey } from './enterKey';

export function buildEditorExtension(
	getSettings: () => TaskBlockSettings,
): Extension {
	return [
		pendingMoves,
		createDecorations(getSettings),
		autoSort,
		delayedSort,
		checkboxSync,
		contextMenuTracker,
		enterKey,
	];
}
