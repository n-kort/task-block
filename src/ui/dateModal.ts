import { App, Modal, Setting } from 'obsidian';
import { DATE_LABEL } from '../dates';
import { FieldKey } from '../model/tasks';

const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class DateModal extends Modal {
	constructor(
		app: App,
		private readonly key: FieldKey,
		private readonly iso: string,
		private readonly onSave: (iso: string) => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle(`${DATE_LABEL[this.key]} date`);
		let value = this.iso;
		const save = () => {
			if (!ISO_PATTERN.test(value)) return;
			this.onSave(value);
			this.close();
		};

		new Setting(this.contentEl).setName('Date').addText((text) => {
			text.inputEl.type = 'date';
			text.setValue(this.iso).onChange((next) => (value = next));
			text.inputEl.addEventListener('keydown', (e) => {
				if (e.key === 'Enter') {
					e.preventDefault();
					save();
				}
			});
			window.setTimeout(() => text.inputEl.focus());
		});

		new Setting(this.contentEl)
			.addButton((button) =>
				button.setButtonText('Cancel').onClick(() => this.close()),
			)
			.addButton((button) =>
				button.setButtonText('Save').setCta().onClick(save),
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
