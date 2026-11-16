import { Notice, Platform, type App, type TFile } from "obsidian";
import { untrack } from "svelte";
import type { Attachment } from "svelte/attachments";
import { insertNewlineAndIndent } from "@codemirror/commands";
import { EditorSelection } from "@codemirror/state";
import type { TreeNode } from "../core/tree";
import { countNodes } from "../core/tree";
import { findNode, followingSiblings, makeNewNode, NEW_NODE_ID, pathTo } from "../core/tree-ops";
import { commitEdit, deleteNode, editText, insertChild, insertSibling, moveNode, toggleTask, type DropPosition, type TextPatch } from "../core/edit";
import { DocumentConflictError, DocumentEditor } from "../service/document-editor";
import { createEmbeddableMarkdownEditor } from "../extension/obsidian-markdown-editor";
import type { HostState, NewNodeState } from "./host-state.svelte";
import type { NodeCommand } from "./node-ui";
import { requestReveal, revealNode, selectNode } from "./tree-state";
import { clampHeight, domMeasurer, heightBounds, innerBox, innerMaxWidth, resolveEditorBox, type Box, type HeightBounds } from "./editor-size";
import { buildIdMap, collectStarts, diffPatch, findByStart, remapHostState, type MovedSubtree } from "./id-remap";

/** 畫完修正高度時多留的餘裕，游標在最後一行也不會剛好出捲軸 */
const HEIGHT_SLACK = 4;
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
	/**
	 * 寫回後等 cache 更新，把以 id 記的節點狀態（收合、點亮、選取…）搬到新 id 上：
	 * id 由標題與序號組成，改標題、插入或刪除兄弟都會讓它變，不搬的話編輯完節點會自己展開、狀態跑到別的節點上
	 */
	private pendingRemap: { starts: Map<string, number>; patches: TextPatch[]; moved: MovedSubtree | null } | null = null;
	/**
	 * 寫回前後的文件內容。cache 更新是非同步的，編輯中擱置的那一版（before）可能在我們的那一版（after）之前送到，
	 * 拿它來搬狀態、找新節點會對到舊樹；所以 before 略過、after 才處理、其他內容代表別人改了就放棄等待
	 */
	private pendingWrite: { before: string; after: string } | null = null;
	/** 上一次載入的樹裡每個節點的起點；外部改動（沒有補丁可對照）時用鏡像與新文件的差異搬狀態 */
	private lastStarts: Map<string, number> | null = null;
	/** 進編輯時算好的高度上下限，CodeMirror 畫完修正高度時用同一組 */
	private bounds = new Map<string, HeightBounds>();
	/** 剛掛上的編輯器游標放哪：既有節點放開頭（看到的是標題那一行）、新節點放結尾、新段落全選佔位文字 */
	private mountCursor: "start" | "end" | "all" = "start";
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
		const sameFile = this.editor !== null && this.editor.file.path === file.path;
		// 自己寫回前的那一版：略過，連鏡像都不要動（動了會清掉歷史）
		if (sameFile && this.pendingWrite && doc === this.pendingWrite.before) return;
		if (!sameFile || !this.editor) {
			this.editor = new DocumentEditor(this.app, file, doc);
			this.pendingNew = null;
			this.pendingRemap = null;
		} else {
			if (this.pendingWrite && doc !== this.pendingWrite.after) {
				this.pendingNew = null;
				this.pendingRemap = null;
			} else if (!this.pendingWrite && this.lastStarts && doc !== this.editor.doc) {
				// 外部改動（在 Markdown 編輯器裡打字）：沒有補丁可對照，用鏡像與新文件的差異化成一個補丁走同一條路
				this.pendingRemap = { starts: this.lastStarts, patches: diffPatch(this.editor.doc, doc), moved: null };
			}
			this.editor.reset(doc);
		}
		this.pendingWrite = null;
		if (this.pendingRemap && this.state.tree) {
			const { starts, patches, moved } = this.pendingRemap;
			this.pendingRemap = null;
			remapHostState(this.state, buildIdMap(starts, patches, this.state.tree, moved));
		}
		if (this.pendingNew && this.state.tree) {
			const { start, edit, selectAll } = this.pendingNew;
			this.pendingNew = null;
			const node = findByStart(this.state.tree, start);
			if (node) {
				revealNode(this.state, node.id, "ensure");
				if (edit) {
					this.mountCursor = selectAll ? "all" : "end";
					this.state.editingId = node.id;
				}
			}
		}
		this.lastStarts = this.state.tree ? collectStarts(this.state.tree) : null;
	}

	startEdit(id: string) {
		if (!this.state.tree || !findNode(this.state.tree, id)) return;
		this.mountCursor = "start";
		selectNode(this.state, id);
		this.state.editingId = id;
	}


	/**
	 * 進編輯時算一次編輯器尺寸（見 editor-size.ts）。nodeEl 是還沒換成編輯器的節點元素：
	 * 量它原本的內容框當下限、用它的字型與內距量文字；拿不到（節點一掛上就在編輯中）就沒有下限。
	 */
	measureEditor(node: TreeNode, nodeEl: HTMLElement | undefined): Box {
		const text = this.textOf(node);
		const s = this.state;
		const measure = domMeasurer(nodeEl ?? document.body);
		const input = {
			text,
			// 量不到原本的大小 = 節點一掛上就在編輯中（新增的節點），給打字用的起手尺寸
			node: nodeEl ? innerBox(nodeEl) : null,
			custom: { enabled: s.editorSizeEnabled, width: s.editorWidth, maxHeight: s.editorMaxHeight },
			maxWidth: nodeEl ? innerMaxWidth(nodeEl, s.maxNodeWidth) : s.maxNodeWidth,
			maxHeight: s.maxNodeHeight,
			viewportHeight: window.innerHeight,
		};
		this.bounds.set(node.id, heightBounds(input, measure));
		return resolveEditorBox(measure, input);
	}

	/**
	 * 掛在節點上的 Obsidian 嵌入式編輯器；Mod+Enter / 點外面會離開並寫回。
	 * onHeight：CodeMirror 畫完即時預覽後量到實際內容高度，請節點元件把編輯器鎖成這個高度（開啟時不出捲軸）。
	 */
	mountEditor(node: TreeNode, onHeight: (height: number) => void): Attachment<HTMLElement> {
		// untrack：attachment 本體在 effect 裡跑，讀到 node 的欄位會被追蹤；不追蹤才不會因為樹重算而重掛編輯器
		return (el) => untrack(() => this.mount(el, node, onHeight));
	}

	private mount(el: HTMLElement, node: TreeNode, onHeight: (height: number) => void): () => void {
		const text = this.textOf(node);
		// 編輯器若被重掛（佈局重算等），用上次的草稿而不是原文，打到一半的字不會不見
		const draft = this.drafts.get(node.id);
		const value = draft ?? text;
		const cursor = draft === undefined ? this.mountCursor : "end";
		// 不在這裡重設：編輯器可能被重掛（新增的節點在 cache 更新時會重掛兩次），重設會讓重掛後的游標跑到開頭；離開編輯才重設
		const cursorLocation =
			cursor === "all" ? { anchor: 0, head: value.length } : cursor === "end" ? { anchor: value.length, head: value.length } : { anchor: 0, head: 0 };
		let finished = false;
		const finish = (current: string) => {
			if (finished) return;
			finished = true;
			this.drafts.delete(node.id);
			void this.finishEdit(node, text, current);
		};
		const editor = createEmbeddableMarkdownEditor(this.app, el, {
			value,
			cursorLocation,
			// Enter 綁在最低優先權：Obsidian 自己的換行（含清單接續）先處理，沒人處理才補一個換行。Mod+Enter 不碰
			onEnter: (ed, mod) => (mod ? false : insertNewlineAndIndent(ed.activeCM)),
			onChange: () => this.drafts.set(node.id, editor.value),
		});
		if (this.editor) editor.owner.file = this.editor.file;
		// 要等元件掛完才 focus 得到，原因同 BlockViewEditor。
		// 聚焦後依文件實際長度放游標（掛上時文件剛設好，初始選取不一定對）；編輯器被重掛時 cursor 仍是同一個意圖
		setTimeout(() => {
			const cm = editor.activeCM;
			if (!cm) return;
			cm.focus();
			const length = cm.state.doc.length;
			const selection = cursor === "all" ? EditorSelection.range(0, length) : EditorSelection.cursor(cursor === "end" ? length : 0);
			cm.dispatch({ selection, scrollIntoView: true });
		});

		// 尺寸：掛上時是估算值，CodeMirror 畫完即時預覽（下一兩個 frame）後量實際內容高度修正一次，
		// 不低於節點原本的高、不高於上限，之後鎖住；使用者自己拉過就不再碰。修正完再 ensure 一次把節點露出來（看得到就不動），不閃光暈。
		// 只設 reveal 請求，不走 revealNode（它會動收合與選取）
		const bounds = this.bounds.get(node.id);
		let applied = el.offsetHeight;
		const fit = () => {
			if (!bounds || Math.abs(el.offsetHeight - applied) > 1) return;
			const content = (editor.activeCM?.scrollDOM.scrollHeight ?? el.scrollHeight) + HEIGHT_SLACK;
			const h = clampHeight(content, bounds);
			if (Math.abs(h - applied) > 1) {
				applied = h;
				onHeight(h);
			}
		};
		let frame = requestAnimationFrame(() => {
			frame = requestAnimationFrame(() => {
				fit();
				requestReveal(this.state, node.id, "ensure", false);
			});
		});
		// 有些裝飾（標籤膠囊、嵌入）晚一點才畫出來，再補量一次
		const settle = window.setTimeout(fit, 250);

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
			cancelAnimationFrame(frame);
			clearTimeout(settle);
			this.bounds.delete(node.id);
			document.removeEventListener("pointerdown", onPointerDown, true);
			el.removeEventListener("keydown", onKeydownCapture, true);
			editor.destroy();
		};
	}

	private async finishEdit(node: TreeNode, original: string, value: string) {
		if (this.state.editingId !== node.id) return;
		this.state.editingId = null;
		this.mountCursor = "start";
		const pending = this.state.newNode;
		if (pending && node.id === NEW_NODE_ID) {
			this.state.newNode = null;
			await this.commitNewNode(pending, value);
			this.onIdle();
			return;
		}
		// 先寫回再通知 view：鏡像要維持進入編輯時的快照，寫回才偵測得到外部改動
		if (value !== original && this.editor) {
			await this.write([commitEdit(this.editor.doc, node, value)], value);
		}
		this.onIdle();
	}

	async run(command: NodeCommand, node: TreeNode) {
		switch (command) {
			case "addSibling":
				return this.insert(node, insertSibling, "after");
			case "addChild":
				return this.insert(node, insertChild, "into");
			case "delete":
				return this.delete(node);
			case "undo":
				return this.history((e) => e.undo());
			case "redo":
				return this.history((e) => e.redo());
		}
	}

	/**
	 * 新增兄弟 / 子節點：檔案先不動，畫面放一個虛擬節點進入編輯，離開時才寫入（見 NewNodeState）。
	 * 補丁照常用 core 算好，只是記下來晚一點套：分隔、縮排與位置都在進入時的文件快照上決定。
	 */
	private insert(node: TreeNode, make: typeof insertSibling, position: "after" | "into") {
		if (!this.editor || this.state.newNode || this.isEditing) return;
		const following = position === "after" && this.state.tree ? followingSiblings(this.state.tree, node.id) : [];
		const insertion = make(this.editor.doc, node, { placeholder: t("newParagraphPlaceholder"), following });
		if (!insertion) return;
		// nodeStart 是新節點文字的起點，補丁裡在它之前的是分隔與縮排，之後是起始文字
		const lead = insertion.patch.insert.slice(0, insertion.nodeStart - insertion.patch.from);
		const text = insertion.patch.insert.slice(lead.length);
		// 子節點會長在目標底下，目標收合著就看不到
		if (position === "into") this.state.collapsed.delete(node.id);
		this.state.newNode = {
			anchorId: node.id,
			position,
			node: makeNewNode(node, position, text),
			text,
			lead,
			indent: node.kind === "listItem" ? lead.slice(1) : "",
			at: insertion.patch.from,
			extra: insertion.extra ?? [],
		};
		this.mountCursor = node.kind === "section" ? "all" : "end";
		this.state.editingId = NEW_NODE_ID;
	}

	/** 新增節點離開編輯：空的（只有標記或沒改佔位文字）就丟棄，否則寫入一次，寫完 cache 更新後用起點找回節點並選取 */
	private async commitNewNode(pending: NewNodeState, value: string) {
		const body = value.trim();
		if (body === "" || body === pending.text.trim()) {
			selectNode(this.state, pending.anchorId);
			return;
		}
		if (!this.editor) return;
		const text = pending.indent === "" ? value : value.split("\n").map((line, i) => (i === 0 || line === "" ? line : pending.indent + line)).join("\n");
		this.pendingNew = { start: pending.at + pending.lead.length, edit: false, selectAll: false };
		// 有序清單後面兄弟的重新編號一起套：補丁位置都以原文為準、互不重疊，同一個交易所以復原仍是一步
		await this.write([{ from: pending.at, to: pending.at, insert: pending.lead + text }, ...pending.extra], value);
	}

	/** 編輯器起始文字：新增中的節點是 NewNodeState.text，其他是原文的編輯範圍 */
	private textOf(node: TreeNode): string {
		if (node.id === NEW_NODE_ID && this.state.newNode) return this.state.newNode.text;
		return editText(this.editor?.doc ?? "", node).text;
	}

	/** 切換 offset 所在行的核取方塊並寫回；補丁長度不變，編輯中也可以點（不影響編輯範圍的位置） */
	async toggleTask(offset: number) {
		if (!this.editor) return;
		const patch = toggleTask(this.editor.doc, offset);
		if (patch) await this.write([patch]);
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
		await this.write(result.patches, undefined, { oldId: source.id, newStart: result.nodeStart });
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

	private async history(action: (editor: DocumentEditor) => Promise<TextPatch[] | null>) {
		if (!this.editor || this.isEditing) return;
		const starts = this.state.tree ? collectStarts(this.state.tree) : null;
		const before = this.editor.doc;
		try {
			const patches = await action(this.editor);
			if (!patches) return;
			this.pendingWrite = { before, after: this.editor.doc };
			// 搬移的復原是「剪回去」，子樹的狀態對不回去會掉，其餘節點照常搬
			if (starts) this.pendingRemap = { starts, patches, moved: null };
		} catch (error) {
			this.reportConflict(error);
		}
	}

	/** 寫回；檔案被外部改過就不硬套，通知並把使用者輸入放進剪貼簿 */
	private async write(patches: TextPatch[], clipboardText?: string, moved: MovedSubtree | null = null) {
		if (!this.editor) return;
		const starts = this.state.tree ? collectStarts(this.state.tree) : null;
		const before = this.editor.doc;
		try {
			const applied = await this.editor.apply(patches);
			if (this.editor.doc === before) return;
			this.pendingWrite = { before, after: this.editor.doc };
			if (starts) this.pendingRemap = { starts, patches: applied, moved };
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

