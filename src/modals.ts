import { App, Modal, Setting } from 'obsidian';

export class NewTopicModal extends Modal {
	private topicName = '';
	private onSubmit: (name: string) => void;

	constructor(app: App, onSubmit: (name: string) => void) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.addClass('learning-modal');

		contentEl.createEl('h2', { text: 'New Learning Topic' });
		contentEl.createEl('p', {
			text: 'What do you want to learn? This creates the topic folder — use /learn in Claude Code or CONTEXT.md with any AI to build the curriculum.',
			cls: 'learning-modal-description',
		});

		new Setting(contentEl)
			.setName('Topic name')
			.setDesc('e.g., "Rust & Solana Development", "Transformer Architecture"')
			.addText(text => {
				text.setPlaceholder('Enter topic name...');
				text.onChange(value => { this.topicName = value; });
				text.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
					if (e.key === 'Enter' && this.topicName.trim()) {
						this.submit();
					}
				});
				// Auto-focus
				setTimeout(() => text.inputEl.focus(), 50);
			});

		new Setting(contentEl)
			.addButton(btn =>
				btn
					.setButtonText('Create Topic')
					.setCta()
					.onClick(() => this.submit())
			);
	}

	private submit() {
		if (this.topicName.trim()) {
			this.onSubmit(this.topicName.trim());
			this.close();
		}
	}

	onClose() {
		this.contentEl.empty();
	}
}

export class ConfirmModal extends Modal {
	private message: string;
	private onConfirm: () => void;

	constructor(app: App, message: string, onConfirm: () => void) {
		super(app);
		this.message = message;
		this.onConfirm = onConfirm;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl('p', { text: this.message });

		new Setting(contentEl)
			.addButton(btn =>
				btn.setButtonText('Cancel').onClick(() => this.close())
			)
			.addButton(btn =>
				btn
					.setButtonText('Confirm')
					.setWarning()
					.onClick(() => {
						this.onConfirm();
						this.close();
					})
			);
	}

	onClose() {
		this.contentEl.empty();
	}
}
