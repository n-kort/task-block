import { Labels, parseOpenMarker } from './marker';

const CLOSE_MARKER = /^\s*%%\s*\/tasks\s*%%\s*$/;
const TASK_LINE = /^(\s*)[-*+] \[(.)\]/;
const FRESH_TASK = /^\s*[-*+] \[ \] $/;
const EMPTY_TASK_TEXT = /^\s*[-*+] \[.\]\s*$/;
const FIELD = String.raw`\[(created|completion|cancelled)::\s*(\d{4}-\d{2}-\d{2})\]`;
const CHECKBOX_PREFIX = /^\s*[-*+] \[.\] /;

export const TASK_PREFIX = '- [ ] ';
export const EMPTY_TASK_LIST = '%% tasks %%\n\n%% /tasks %%\n';

export interface Region {
	open: number;
	close: number;
	labels: Labels;
}

export type TaskStatus = 'open' | 'done' | 'cancelled';

export interface TaskLine {
	indent: number;
	status: TaskStatus;
	statusChar: string;
	statusOffset: number;
}

export type FieldKey = 'created' | 'completion' | 'cancelled';

const STATUS_FIELD: Record<TaskStatus, FieldKey | null> = {
	open: null,
	done: 'completion',
	cancelled: 'cancelled',
};

export interface Field {
	key: FieldKey;
	from: number;
	to: number;
	iso: string;
}

export function findRegions(lines: readonly string[]): Region[] {
	const regions: Region[] = [];
	let open: { line: number; labels: Labels } | null = null;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i] ?? '';
		const labels = parseOpenMarker(line);
		if (labels) {
			open = { line: i, labels };
		} else if (open !== null && CLOSE_MARKER.test(line)) {
			regions.push({ open: open.line, close: i, labels: open.labels });
			open = null;
		}
	}
	return regions;
}

export function regionContaining(
	lines: readonly string[],
	line: number,
): Region | undefined {
	return findRegions(lines).find((r) => r.open <= line && line <= r.close);
}

export function isInsideBody(lines: readonly string[], line: number): boolean {
	const region = regionContaining(lines, line);
	return !!region && region.open < line && line < region.close;
}

export function regionBody(lines: readonly string[], region: Region): string[] {
	return lines.slice(region.open + 1, region.close);
}

function statusOf(char: string): TaskStatus {
	if (char === 'x' || char === 'X') return 'done';
	if (char === '-') return 'cancelled';
	return 'open';
}

export function parseTask(line: string): TaskLine | null {
	const match = TASK_LINE.exec(line);
	if (!match) return null;
	const indent = (match[1] ?? '').length;
	const statusChar = match[2] ?? ' ';
	return {
		indent,
		status: statusOf(statusChar),
		statusChar,
		statusOffset: indent + 3,
	};
}

export function isFreshTask(line: string): boolean {
	return FRESH_TASK.test(line);
}

export function hasEmptyTaskText(lineBeforeField: string): boolean {
	return EMPTY_TASK_TEXT.test(lineBeforeField);
}

export function findFields(line: string): Field[] {
	return [...line.matchAll(new RegExp(FIELD, 'g'))].map((m) => {
		const from = m.index ?? 0;
		return {
			key: m[1] as FieldKey,
			from,
			to: from + m[0].length,
			iso: m[2] ?? '',
		};
	});
}

export function fieldText(key: FieldKey, iso: string): string {
	return `[${key}:: ${iso}]`;
}

export function createdField(iso: string): string {
	return ` ${fieldText('created', iso)}`;
}

export function newTaskLine(iso: string): string {
	return TASK_PREFIX + createdField(iso);
}

export function hasStatusDate(line: string, status: TaskStatus): boolean {
	const expected = STATUS_FIELD[status];
	return findFields(line).some((f) => f.key !== 'created' && f.key === expected);
}

export function hasAnyStatusDate(line: string): boolean {
	return findFields(line).some((f) => f.key !== 'created');
}

export function setStatusDate(
	line: string,
	status: TaskStatus,
	iso: string,
): string {
	let text = line;
	for (const field of findFields(line).reverse()) {
		if (field.key === 'created') continue;
		text = text.slice(0, field.from).replace(/ $/, '') + text.slice(field.to);
	}
	const key = STATUS_FIELD[status];
	if (!key) return text;
	const statusField = fieldText(key, iso);
	const created = findFields(text).find((f) => f.key === 'created');
	return created
		? `${text.slice(0, created.from)}${statusField} ${text.slice(created.from)}`
		: `${text.trimEnd()} ${statusField}`;
}

export function moveFieldsToEnd(
	line: string,
): { text: string; mapOffset: (offset: number) => number } | null {
	const fields = findFields(line);
	const first = fields[0];
	if (!first) return null;

	const kept: [number, number][] = [];
	fields.forEach((field, i) => {
		const next = fields[i + 1]?.from ?? line.length;
		const gap = line.slice(field.to, next);
		if (!fields[i + 1] || gap.trim() !== '') kept.push([field.to, next]);
	});
	const stray = kept.map(([from, to]) => line.slice(from, to)).join('');
	if (stray.trim() === '') return null;

	const beforeField = line.slice(0, first.from);
	const prefix = CHECKBOX_PREFIX.exec(beforeField)?.[0] ?? '';
	const head = prefix + beforeField.slice(prefix.length).trimEnd();
	const metadata = [...fields]
		.sort((a, b) => Number(a.key === 'created') - Number(b.key === 'created'))
		.map((f) => line.slice(f.from, f.to));
	return {
		text: `${head}${stray} ${metadata.join(' ')}`,
		mapOffset: (offset) =>
			offset <= first.from
				? Math.min(offset, head.length)
				: head.length +
					kept.reduce(
						(sum, [from, to]) =>
							sum + Math.max(0, Math.min(to, offset) - from),
						0,
					),
	};
}

