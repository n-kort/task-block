const OPEN_MARKER = /^\s*%%\s*tasks(?:\s+(.*?))?\s*%%\s*$/;
const LABEL_KEY = /(button|completed|cancelled):/g;
const SEPARATOR = /[\s,;|]/;
const EDGE_SEPARATORS = /^[\s,;|]+|[\s,;|]+$/g;

export type LabelKey = 'button' | 'completed' | 'cancelled';
export type Labels = Partial<Record<LabelKey, string>>;

function findKeys(options: string): RegExpMatchArray[] {
	return [...options.matchAll(LABEL_KEY)].filter((m) => {
		const before = options[(m.index ?? 0) - 1];
		return before === undefined || SEPARATOR.test(before);
	});
}

export function parseOpenMarker(line: string): Labels | null {
	const match = OPEN_MARKER.exec(line);
	if (!match) return null;
	const options = match[1] ?? '';
	const keys = findKeys(options);
	if (options && keys[0]?.index !== 0) return null;

	const labels: Labels = {};
	keys.forEach((key, i) => {
		const from = (key.index ?? 0) + key[0].length;
		const to = keys[i + 1]?.index ?? options.length;
		const value = options.slice(from, to).replace(EDGE_SEPARATORS, '');
		if (value) labels[key[1] as LabelKey] = value;
	});
	return labels;
}
