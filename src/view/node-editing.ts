import { Notice, Platform, type App, type TFile } from "obsidian";
import { untrack } from "svelte";
import type { Attachment } from "svelte/attachments";
import { insertNewlineAndIndent } from "@codemirror/commands";
import type { TreeNode } from "../core/tree";
import { countNodes } from "../core/tree";
import { findNode, pathTo } from "../core/tree-ops";
import { commitEdit, deleteNode, editText, insertChild, insertSibling, moveNode, type DropPosition, type TextPatch } from "../core/edit";
import { DocumentConflictError, DocumentEditor } from "../service/document-editor";
import { createEmbeddableMarkdownEditor } from "../extension/obsidian-markdown-editor";
import type { HostState } from "./host-state.svelte";
import type { NodeCommand } from "./node-ui";
import { revealNode, selectNode } from "./tree-state";
import { ConfirmModal } from "./confirm-modal";
import { crumbLabel } from "./breadcrumb";
import { t } from "../i18n";

/**
 * 節點編輯的 view 層：進出編輯模式、新增 / 刪除、復原。
 * 文字補丁由 core/edit 算，寫回走 DocumentEditor；這裡只管狀態與 Obsidian 的編輯器元件。
 */
export class NodeEditing {
	private editor: DocumentEditor | null = null;
	/** 新增節點後等 cache 更新，用文字起點找到新節點並進入編輯 */
	private pendingNew: { start: number; edit: boolean; selectAll: boolean } | null = null;
	/** 剛掛上的編輯器要不要全選（佔位文字） */
	private selectAllOnMount = false;
	/** 編輯中的草稿，編輯器被重掛時用來還原 */
	private drafts = new Map<string, string>();

	constructor(
		private app: App,
		private state: HostState,
		private getText: (from: number, to: number) => string,
		/** 離開編輯並寫回之後呼叫，view 用來補套編輯中收到的檔案內容 */
		private onIdle: () => void,
	) { }

	get isEditing(): boolean {
		return this.state.editingId !== null;
	}

	/** 每次 view 收到新的檔案內容就呼叫：換檔重建鏡像、同檔同步鏡像、處理等待中的新節點 */
	onLoaded(file: TFile, doc: string) {
		if (!this.editor || this.editor.file.path !== file.path) {
			this.editor = new DocumentEditor(this.app, file, doc);
			this.pendingNew = null;
		} else {
			this.editor.reset(doc);
		}
		if (this.pendingNew && this.state.tree) {
			const { start, edit, selectAll } = this.pendingNew;
			this.pendingNew = null;
			const node = findByStart(this.state.tree, start);
			if (node) {
				revealNode(this.state, node.id, "ensure");
				if (edit) {
					this.selectAllOnMount = selectAll;
					this.state.editingId = node.id;
				}
			}
		}
	}

	startEdit(id: string) {
		if (!this.state.tree || !findNode(this.state.tree, id)) return;
		selectNode(this.state, id);
		this.state.editingId = id;
	}


	/** 掛在節點上的 Obsidian 嵌入式編輯器；Mod+Enter / Esc / 失焦都會離開並寫回 */
	mountEditor(node: TreeNode): Attachment<HTMLElement> {
		// untrack：attachment 本體在 effect 裡跑，讀到 node 的欄位會被追蹤；不追蹤才不會因為樹重算而重掛編輯器
		return (el) => untrack(() => this.mount(el, node));
	}

	private mount(el: HTMLElement, node: TreeNode): () => void {
		const doc = this.editor?.doc ?? "";
		const { text } = editText(doc, node);
		// 編輯器若被重掛（佈局重算等），用上次的草稿而不是原文，打到一半的字不會不見
		const draft = this.drafts.get(node.id);
		const value = draft ?? text;
		const selectAll = this.selectAllOnMount && draft === undefined;
		this.selectAllOnMount = false;
		let finished = false;
		const finish = (current: string) => {
			if (finished) return;
			finished = true;
			this.drafts.delete(node.id);
			void this.finishEdit(node, text, current);
		};
		const editor = createEmbeddableMarkdownEditor(this.app, el, {
			value,
			cursorLocation: selectAll ? { anchor: 0, head: value.length } : { anchor: value.length, head: value.length },
			// Enter 綁在最低優先權：Obsidian 自己的換行（含清單接續）先處理，沒人處理才補一個換行。Mod+Enter 不碰
			onEnter: (ed, mod) => (mod ? false : insertNewlineAndIndent(ed.activeCM)),
			onChange: () => this.drafts.set(node.id, editor.value),
		});
		if (this.editor) editor.owner.file = this.editor.file;
		// 要等元件掛完才 focus 得到，原因同 BlockViewEditor
		setTimeout(() => editor.editor.cm?.focus());

		/**
		 * 編輯器的預設按鍵一律不攔（Enter 的清單接續、Esc 取消選取、Mod+B 粗體等都照 Obsidian 的來），
		 * 只有 Mod+Enter 是「完成並寫回」：這是「送出」的慣例，代價是節點編輯器裡不能用它切換核取方塊。
		 * 在 capture 階段攔，CodeMirror 與 Obsidian 的 scope 都看不到；LayoutHost 的快捷鍵在編輯中會自己略過。
		 */
		const onKeydownCapture = (evt: KeyboardEvent) => {
			const mod = Platform.isMacOS ? evt.metaKey : evt.ctrlKey;
			if (evt.key === "Enter" && mod && !evt.shiftKey && !evt.altKey) {
				evt.preventDefault();
				evt.stopPropagation();
				finish(editor.value);
			}
		};
		el.addEventListener("keydown", onKeydownCapture, true);
		// Obsidian 的快捷鍵（Mod+Enter 預設是切換核取方塊）走 app.keymap，在 document 層先於 DOM 監聽處理；
		// 嵌入式編輯器有自己的 Scope，在它裡面註冊才搶得到。回傳 false 代表已處理、不再往上找
		editor.scope.register(["Mod"], "Enter", () => {
			finish(editor.value);
			return false;
		});

		// 「點外面」用文件層級的 pointerdown 判斷，不用編輯器的 blur：
		// 連結補全、右鍵選單、對話框都會讓編輯器失焦，但那不是使用者想離開。剛掛上的瞬間也不算。
		const mountedAt = Date.now();
		const onPointerDown = (evt: PointerEvent) => {
			if (Date.now() - mountedAt < 300) return;
			const target = evt.target;
			if (!(target instanceof Element)) return;
			if (el.contains(target) || target.closest(".suggestion-container, .menu, .modal-container, .cm-tooltip")) return;
			finish(editor.value);
		};
		document.addEventListener("pointerdown", onPointerDown, true);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown, true);
			el.removeEventListener("keydown", onKeydownCapture, true);
			editor.destroy();
		};
	}

	private async finishEdit(node: TreeNode, original: string, value: string) {
		if (this.state.editingId !== node.id) return;
		this.state.editingId = null;
		// 先寫回再通知 view：鏡像要維持進入編輯時的快照，寫回才偵測得到外部改動
		if (value !== original && this.editor) {
			await this.write([commitEdit(this.editor.doc, node, value)], value);
		}
		this.onIdle();
	}

	async run(command: NodeCommand, node: TreeNode) {
		switch (command) {
			case "addSibling":
				return this.insert(node, insertSibling);
			case "addChild":
				return this.insert(node, insertChild);
			case "delete":
				return this.delete(node);
			case "undo":
				return this.history((e) => e.undo());
			case "redo":
				return this.history((e) => e.redo());
		}
	}

	private async insert(node: TreeNode, make: typeof insertSibling) {
		if (!this.editor) return;
		const insertion = make(this.editor.doc, node, { placeholder: t("newParagraphPlaceholder") });
		if (!insertion) return;
		this.pendingNew = { start: insertion.nodeStart, edit: true, selectAll: node.kind === "section" };
		await this.write([insertion.patch]);
	}

	/** 拖曳搬移：source 子樹搬到 target 的指定位置（放進去 / 插前面 / 插後面），搬完選取它並帶到畫面上 */
	async move(sourceId: string, targetId: string, position: DropPosition) {
		if (!this.editor || !this.state.tree) return;
		const source = findNode(this.state.tree, sourceId);
		const target = findNode(this.state.tree, targetId);
		if (!source || !target) return;
		const result = moveNode(this.editor.doc, source, target, position);
		if (!result) return;
		this.pendingNew = { start: result.nodeStart, edit: false, selectAll: false };
		await this.write(result.patches);
	}

	private async delete(node: TreeNode) {
		if (!this.editor || !this.state.tree) return;
		const patch = deleteNode(this.editor.doc, node);
		if (!patch) return;
		const message = t("confirmDeleteMessage").replace("{title}", crumbLabel(node, this.getText)).replace("{n}", String(countNodes(node) - 1));
		const ok = await ConfirmModal.ask(this.app, t("confirmDeleteTitle"), message, t("buttonDelete"), t("buttonCancel"));
		if (!ok) return;
		const path = pathTo(this.state.tree, node.id);
		const parent = path[path.length - 2];
		await this.write([patch]);
		if (parent) selectNode(this.state, parent.id);
	}

	private async history(action: (editor: DocumentEditor) => Promise<boolean>) {
		if (!this.editor || this.isEditing) return;
		try {
			await action(this.editor);
		} catch (error) {
			this.reportConflict(error);
		}
	}

	/** 寫回；檔案被外部改過就不硬套，通知並把使用者輸入放進剪貼簿 */
	private async write(patches: TextPatch[], clipboardText?: string) {
		if (!this.editor) return;
		try {
			await this.editor.apply(patches);
		} catch (error) {
			this.pendingNew = null;
			this.reportConflict(error, clipboardText);
		}
	}

	private reportConflict(error: unknown, clipboardText?: string) {
		if (!(error instanceof DocumentConflictError)) {
			console.error("headings: edit failed", error);
			return;
		}
		if (clipboardText !== undefined) void navigator.clipboard?.writeText(clipboardText);
		new Notice(t("noticeEditConflict"));
	}
}

/** 以文字起點找節點（新增後的節點位置是已知的） */
const findByStart = (root: TreeNode, start: number): TreeNode | null => {
	if (root.range.from === start && root.kind !== "root") return root;
	for (const child of root.children) {
		const found = findByStart(child, start);
		if (found) return found;
	}
	return null;
};
