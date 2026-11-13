import { App, Modal } from "obsidian";

/** 簡單的確認對話框：resolve true 代表使用者按了確認 */
export class ConfirmModal extends Modal {
	private resolved = false;

	constructor(
		app: App,
		private title: string,
		private message: string,
		private confirmLabel: string,
		private cancelLabel: string,
		private resolve: (ok: boolean) => void,
	) {
		super(app);
	}

	static ask(app: App, title: string, message: string, confirmLabel: string, cancelLabel: string): Promise<boolean> {
		return new Promise((resolve) => new ConfirmModal(app, title, message, confirmLabel, cancelLabel, resolve).open());
	}

	onOpen() {
		this.setTitle(this.title);
		this.contentEl.createEl("p", { text: this.message });
		const buttons = this.contentEl.createDiv({ cls: "modal-button-container" });
		const confirm = buttons.createEl("button", { cls: "mod-warning", text: this.confirmLabel });
		confirm.addEventListener("click", () => this.finish(true));
		const cancel = buttons.createEl("button", { text: this.cancelLabel });
		cancel.addEventListener("click", () => this.finish(false));
		confirm.focus();
	}

	onClose() {
		this.finish(false);
	}

	private finish(ok: boolean) {
		if (this.resolved) return;
		this.resolved = true;
		this.resolve(ok);
		this.close();
	}
}
