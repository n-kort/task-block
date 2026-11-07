import { EditorView } from '@codemirror/view';

const FRESHNESS_MS = 1000;

let lastClick: { line: number; time: number } | null = null;

export const contextMenuTracker = EditorView.domEventHandlers({
	contextmenu: (event, view) => {
		const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
		lastClick =
			pos === null
				? null
				: { line: view.state.doc.lineAt(pos).number - 1, time: Date.now() };
		return false;
	},
});

export function takeContextMenuLine(): number | null {
	const click = lastClick;
	lastClick = null;
	return click && Date.now() - click.time < FRESHNESS_MS ? click.line : null;
}
