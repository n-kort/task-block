import {
	findRegions,
	hasAnyStatusDate,
	hasStatusDate,
	parseTask,
	Region,
	regionBody,
	setStatusDate,
	TaskStatus,
} from './tasks';

interface Block {
	lines: string[];
	status: TaskStatus;
	origin: number;
}

interface Body {
	lead: string[];
	blocks: Block[];
}

type Groups = Record<TaskStatus, Block[]>;

export interface BodyReplacement {
	fromLine: number;
	toLine: number;
	text: string;
}

export interface SectionStart {
	status: TaskStatus;
	line: number;
}

function parseBody(body: readonly string[]): Body {
	const lead: string[] = [];
	const blocks: Block[] = [];
	let baseIndent: number | null = null;
	body.forEach((line, index) => {
		if (line.trim() === '') return;
		const task = parseTask(line);
		const current = blocks[blocks.length - 1];
		if (task && (baseIndent === null || task.indent <= baseIndent)) {
			baseIndent ??= task.indent;
			blocks.push({ lines: [line], status: task.status, origin: index });
		} else if (current) {
			current.lines.push(line);
		} else {
			lead.push(line);
		}
	});
	return { lead, blocks };
}

function group(blocks: Block[]): Groups {
	return {
		open: blocks.filter((b) => b.status === 'open'),
		done: blocks.filter((b) => b.status === 'done'),
		cancelled: blocks.filter((b) => b.status === 'cancelled'),
	};
}

function render(lead: string[], groups: Groups): string[] {
	const out = [...lead, ...groups.open.flatMap((b) => b.lines)];
	for (const status of ['done', 'cancelled'] as const) {
		if (groups[status].length) {
			out.push('', ...groups[status].flatMap((b) => b.lines));
		}
	}
	return out;
}

function stamp(block: Block, today: string): Block {
	const [first = '', ...children] = block.lines;
	return {
		...block,
		lines: [setStatusDate(first, block.status, today), ...children],
	};
}

function isJustToggled(blocks: Block[], index: number): boolean {
	const block = blocks[index];
	if (!block) return false;
	const first = block.lines[0] ?? '';
	if (block.status === 'open') return hasAnyStatusDate(first);
	if (hasStatusDate(first, block.status)) return false;
	if (block.status === 'cancelled') return true;
	return blocks.some((b, i) => i > index && b.status === 'open');
}

export function sectionStarts(body: readonly string[]): SectionStart[] {
	const { blocks } = parseBody(body);
	return (['done', 'cancelled'] as const).flatMap((status) => {
		const first = blocks.find((b) => b.status === status);
		return first ? [{ status, line: first.origin }] : [];
	});
}

export function sortBody(
	body: readonly string[],
	today: string,
	movedLine?: number,
): string[] {
	const { lead, blocks } = parseBody(body);
	const moved = blocks.find((b) => b.origin === movedLine);
	if (moved) {
		const groups = group(blocks.filter((b) => b !== moved));
		groups[moved.status].unshift(stamp(moved, today));
		return render(lead, groups);
	}

	const toggled = blocks.map((_, i) => isJustToggled(blocks, i));
	const reordered = [
		...blocks.filter((_, i) => toggled[i]).map((b) => stamp(b, today)),
		...blocks.filter((_, i) => !toggled[i]),
	];
	return render(lead, group(reordered));
}

export function prependTask(
	body: readonly string[],
	taskLine: string,
): { body: string[]; line: number } {
	const { lead, blocks } = parseBody(body);
	const groups = group(blocks);
	groups.open.unshift({ lines: [taskLine], status: 'open', origin: -1 });
	return { body: render(lead, groups), line: lead.length };
}

export function bodyReplacement(
	region: Region,
	oldBody: readonly string[],
	newBody: readonly string[],
): BodyReplacement | null {
	let start = 0;
	while (
		start < oldBody.length &&
		start < newBody.length &&
		oldBody[start] === newBody[start]
	) {
		start++;
	}
	let oldEnd = oldBody.length;
	let newEnd = newBody.length;
	while (
		oldEnd > start &&
		newEnd > start &&
		oldBody[oldEnd - 1] === newBody[newEnd - 1]
	) {
		oldEnd--;
		newEnd--;
	}
	if (start === oldEnd && start === newEnd) return null;
	const base = region.open + 1;
	return {
		fromLine: base + start,
		toLine: base + oldEnd,
		text: newBody
			.slice(start, newEnd)
			.map((line) => `${line}\n`)
			.join(''),
	};
}

export function sortRegions(content: string, today: string): string {
	const lines = content.split('\n');
	for (const region of findRegions(lines).reverse()) {
		const body = regionBody(lines, region);
		lines.splice(region.open + 1, body.length, ...sortBody(body, today));
	}
	return lines.join('\n');
}
