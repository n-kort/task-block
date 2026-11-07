import { moment } from 'obsidian';
import { FieldKey } from './model/tasks';

const ISO_DATE = 'YYYY-MM-DD';

const DATE_PREFIX: Record<FieldKey, string> = {
	created: '',
	completion: '✓ ',
	cancelled: '✕ ',
};

export const DATE_LABEL: Record<FieldKey, string> = {
	created: 'Created',
	completion: 'Completed',
	cancelled: 'Cancelled',
};

export function today(): string {
	return moment().format(ISO_DATE);
}

export function formatDate(iso: string, format: string): string {
	const date = moment(iso, ISO_DATE, true);
	return date.isValid() ? date.format(format) : iso;
}

export function createDateEl(
	key: FieldKey,
	iso: string,
	format: string,
): HTMLElement {
	const date = formatDate(iso, format);
	return createSpan({
		cls: 'task-block-date',
		text: `(${DATE_PREFIX[key]}${date})`,
		attr: { title: `${DATE_LABEL[key]} ${iso}` },
	});
}
