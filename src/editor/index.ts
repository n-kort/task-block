import { Extension } from '@codemirror/state';
import { TaskBlockSettings } from '../settings';
import { autoSort, checkboxSync } from './autoSort';
import { contextMenuTracker } from './contextMenu';
import { createDecorations } from './decorations';
import { enterKey } from './enterKey';

export function buildEditorExtension(
	getSettings: () => TaskBlockSettings,
): Extension {
	return [createDecorations(getSettings), autoSort, checkboxSync, contextMenuTracker, enterKey];
}
