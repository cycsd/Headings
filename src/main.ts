import { App, Editor, MarkdownView, Modal, Plugin, View, type Constructor, type MarkdownFileInfo } from 'obsidian';
import "./app.css";
import { DEFAULT_SETTINGS, type HeadingsSettings as HeadingsSettings } from "./settings";
import { HeadingsView, VIEW_TYPE_MINDMAPMD } from "./view/MindMapMdView";
import { getActiveViewOfType } from "./extension/workspace";
import { Context, Effect, Layer, pipe } from "effect";
import type { MindMapMdViewState } from './view/MindMapMd';
import { HeadingSuggester, HeadingSuggesterService, type Heading } from './handlers/HeadingSuggester';
import { HeadingHandlers, HeadingHandlersLive, } from './handlers/HeadingHandlers';
import { EditorService } from './service/editor-service';
import { AppService } from './service/app-service';
import { find_heading_block } from './extension/cached-metadata';
import { t } from './i18n';

// Remember to rename these classes and interfaces!

export default class HeadingsPlugin extends Plugin {
	settings: HeadingsSettings = DEFAULT_SETTINGS;

	async onload() {
		await this.loadSettings();

		// todo 暫時不提供 heading view 功能
		// this.registerView(
		// 	VIEW_TYPE_MINDMAPMD,
		// 	(leaf: WorkspaceLeaf) => new MindMapMdView(leaf, this));
		// // This creates an icon in the left ribbon.
		// this.addRibbonIcon(VIEW_ICON_MINDMAPMD, 'Toggle Mind Map MD View', (evt: MouseEvent) => {
		// 	// Called when the user clicks the icon.
		// 	// new Notice('This is a notice! just kidding');
		// 	this.toggleMindMapMdView();
		// });

		// This adds a settings tab so the user can configure various aspects of the plugin
		// this.addSettingTab(new MindMapMdSettingTab(this.app, this));

		//todo : open file with mind map md view from file explorer context menu
		// 使用者有可能從左側 file explorer 開啟檔案的 context menu 來開啟 mind map md view，
		// 所以需要新開一個 leaf 而不是從現有的 markdown view 來切換，以現在的做法會無法從 file explorer 開啟 mind map md view
		// this.registerEvent(this.app.workspace.on('file-menu', (menu, file, source) => {
		// 	menu.addItem((item) => {
		// 		item.setTitle('Mind Map MD View')
		// 			.setIcon(VIEW_ICON_MINDMAPMD)
		// 			.onClick(async () => {
		// 				Effect.runPromise(this.turnOnMindMapMdView);
		// 			});
		// 	})
		// }));

		this.addCommands();


		// editor menu 為在編輯器按右鍵顯示的 menu
		// this.app.workspace.on('editor-menu', (menu, editor, view) => {
		// 	menu.addItem((item) => {
		// 		item.setTitle('Mind Map MD View')
		// 			.setIcon(VIEW_ICON_MINDMAPMD)
		// 			.onClick(async () => {
		// 				Effect.runPromise(this.turnOnMindMapMdView);
		// 			});
		// 	})
		// });

	}


	createMindMapViewCheckCallback(action: (view: HeadingsView) => void) {
		return (checking: boolean) => {
			//checking 為 true, 代表使用者正在使用 Ctrl + P 開啟 obsidian command palette ，
			//回傳值為 true or false 決定是否顯示這個 command (true-顯示, false-不顯示)。
			if (checking) {
				const is_view_esist = getActiveViewOfType(this.app.workspace, HeadingsView)
					.pipe(Effect.map(v => {
						return true;
					}),
						Effect.orElseSucceed(() => false),
					);
				return Effect.runSyncExit(is_view_esist);
			}
			//使用者選取這個 command 或直接按下 hotkey，checking 為 false。
			else {
				const program = Effect.gen({ self: this }, function* () {
					const view = yield* getActiveViewOfType(this.app.workspace, HeadingsView);
					action(view);
					return true;
				})
				return Effect.runSync(program);
			}
		}
	}

	createViewCheckCallback<T extends View>(viewType: Constructor<T>, action: (view: T) => void) {
		return (checking: boolean) => {
			//checking 為 true, 代表使用者正在使用 Ctrl + P 開啟 obsidian command palette ，
			//回傳值為 true or false 決定是否顯示這個 command (true-顯示, false-不顯示)。
			if (checking) {
				const is_view_esist = getActiveViewOfType(this.app.workspace, viewType)
					.pipe(Effect.map(v => {
						return true;
					}),
						Effect.orElseSucceed(() => false),
					);
				return Effect.runSync(is_view_esist);
			}
			//使用者選取這個 command 或直接按下 hotkey，checking 為 false。
			else {
				const program = Effect.gen({ self: this }, function* () {
					const view = yield* getActiveViewOfType(this.app.workspace, viewType);
					action(view);
					return true;
				})
				return Effect.runSync(program);
			}
		}
	}

	onunload() {
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<HeadingsSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	//todo orElese get markdown view
	//obsidian active view 可以是左右 2 側的功能欄位，
	// 但使用者即使點選了左右 2 側的功能欄位，依然會覺得畫面正中央顯示的文件才是目前 active 的 view，
	// 所以如果 active view 沒有找到，可能需要查看一下所有 leaf 中，是否有 active 的 markdown view。
	// 如果主畫面有分割視窗，分頁 workspace-tab-header 的 class 都會顯示 is-active ，但似乎最後一個失焦的分頁會有 mod-active 的標記
	// 先抓這個來判斷就好
	//this.app.workspace.getLeavesOfType(VIEW_TYPE_MINDMAPMD)
	// const workspace_leaf = this.containerEl.parentElement;
	// if (workspace_leaf?.classList.contains("mod-active"))
	turnOnMindMapMdView = pipe(
		getActiveViewOfType(this.app.workspace, MarkdownView),
		Effect.andThen(v => Effect.tryPromise(() => {
			//state 存入 workspace.json 中的內容
			const mind_map_view_state: MindMapMdViewState = {
				filePath: v.file?.path || "",
				file: v.file,
				doc: v.editor.getValue(),
			};

			return v.leaf.setViewState(
				{
					type: VIEW_TYPE_MINDMAPMD,
					active: true,
					state: mind_map_view_state,
				});
		}))
	);


	turnOnMarkdownView = Effect.gen({ self: this }, function* () {
		const view = yield* getActiveViewOfType(this.app.workspace, HeadingsView);

		const file = yield* pipe(
			Effect.fromNullishOr(view.state?.file),
			Effect.mapError(() => new Error(`No file associated with view: ${view}`))
		);

		yield* Effect.tryPromise(() => {
			return view.leaf.openFile(file);
		});
	});

	async toggleMindMapMdView() {
		const { workspace } = this.app;

		Effect.runPromise(
			this.turnOnMindMapMdView.pipe(
				Effect.catchCause(() => this.turnOnMarkdownView),
				Effect.andThen((_) => getActiveViewOfType(workspace, MarkdownView)),
			)
		).catch((e) => { console.log(e) });
	}

	/**
 * ```markdown
 * ## hotkey 優先度：
 * obsidian command > editor command = 自行在 component 中設定的 hotkey
 * 由於 obsidian command 會覆蓋 editor command
 * 所以如果你有些 hotkey 與 editor command 一樣，例如 ArrowUp、ArrowDown，
 * 就不應該在這裡設定，而應該自行在 component 中設定，不然由於 obsidian 會先執行 obsidian command，所以 ArrowUp、ArrowDown 在 editor 內就沒有作用，你就無法在 editor 內上下移動遊標位置。
 * 一樣的，如果你有些 hotkey 與 obsidian command 一樣，例如 F2 (obsidian 預設為更改檔案名稱)，
 * 你需要在這邊設定 obsidian command，不應該在 component 中設定，
 * 不然會被預設的 obsidian command 覆蓋，造成你的 component key event 動作沒有反應。
 * ```
 */
	addCommands() {

		const app = this.app;

		function openHeadingSuggester(
			action: (
				handler: Context.Service.Shape<typeof HeadingHandlers>,
				suggesterService: Context.Service.Shape<typeof HeadingSuggesterService>,
				editorService: Context.Service.Shape<typeof EditorService>,
			) => (heading: Heading, evt: MouseEvent | KeyboardEvent) => Effect.Effect<void, Error>,
			modalSetter?: (modal: HeadingSuggester) => void) {
			return (editor: Editor, view: MarkdownView | MarkdownFileInfo) => {
				const program = Effect.gen(function* () {
					const handler = yield* HeadingHandlers;
					const suggesterService = yield* HeadingSuggesterService;
					const editorService = yield* EditorService;
					const modal = yield* suggesterService.getSuggesterModal(action(handler, suggesterService, editorService));
					modalSetter?.(modal);
					modal.start();
				});

				const mainLive = Layer.merge(
					HeadingSuggesterService.layerWithoutDependencies,
					HeadingHandlersLive,
					//	HeadingSuggesterServiceLive,
				);

				Effect.runFork(
					Effect.provide(program, mainLive).pipe(
						Effect.provideService(EditorService, {
							getEditor: () => Effect.succeed(editor),
							getFile: () => Effect.fromNullishOr(view.file),
						}),
						Effect.provideService(AppService, {
							getApp: () => Effect.succeed(app),
						}),
					)
				);
			}
		}

		this.addCommand({
			id: 'go2-heading',
			name: t('commandGoToHeading'),
			editorCallback: openHeadingSuggester(handler => handler.go2Heading)
		});

		this.addCommand({
			id: 'copy-heading',
			name: t('commandCopyHeading'),
			editorCallback: openHeadingSuggester(
				handler => handler.copyHeading,
				modal => {
					modal.setInstructions([
						{ command: t('instructionEnter'), purpose: t('instructionCopyAndSelect') },
						{ command: t('instructionClick'), purpose: t('instructionInsertMarker') },
						{ command: t('instructionModifierClick'), purpose: t('instructionCopy') },
					]);
				})

		});

		this.addCommand({
			id: 'align-heading',
			name: t('commandAlignHeadingLevel'),
			editorCallback: openHeadingSuggester((handler, suggesterService, editorService) =>
				(source, evt) =>
					Effect.gen(function* () {
						const file = yield* editorService.getFile();
						const editor = yield* editorService.getEditor();
						const cached = yield* Effect.fromNullishOr(app.metadataCache.getFileCache(file));
						const source_heading_offset = find_heading_block(cached, source).offset ?? editor.cm.state.doc.length;
						const modal = yield* suggesterService.getSuggesterModal(
							(target, targetEvt) => handler.alignHeading(source, target, evt, targetEvt),
							(items) => {
								return items.filter(item =>
									item.position.end.offset < source.position.start.offset
									|| item.position.end.offset > source_heading_offset
								);
							},);
						modal.setPlaceholder(t('placeholderChooseAlignmentTarget'));
						modal.start();
					}
					)
				, sourceModal => {
					sourceModal.setPlaceholder(t('placeholderChooseHeadingToAlign'));
				})
		});

		this.addCommand({
			id: 'insert-under-heading',
			name: t('commandInsertUnderHeading'),
			editorCallback: openHeadingSuggester((handler, suggesterService, editorService) =>
				(source, evt) =>
					Effect.gen({ self: this }, function* () {
						const file = yield* editorService.getFile();
						const editor = yield* editorService.getEditor();
						const cached = yield* Effect.fromNullishOr(app.metadataCache.getFileCache(file));
						const source_heading_offset = find_heading_block(cached, source).offset ?? editor.cm.state.doc.length;
						const modal = yield* suggesterService.getSuggesterModal(
							(target, targetEvt) => handler.insertUnder(source, target, evt, targetEvt),
							(items) => {
								const prev_heading = cached.headings?.findLast(h =>
									h.position.end.offset <= source.position.start.offset
									&& h.level < source.level
								);
								return items.filter(item =>
									(item.position.end.offset < source.position.start.offset
										|| item.position.end.offset > source_heading_offset)
									&& item.position.start.offset != prev_heading?.position.start.offset
								);
							},
						);
						modal.setPlaceholder(t('placeholderChooseInsertionTarget'));
						modal.start();
					})
				, sourceModal => {
					sourceModal.setPlaceholder(t('placeholderChooseHeadingToMove'));
				})
		});

		this.addCommand({
			id: 'move-heading',
			name: t('commandMoveHeading'),
			editorCallback: openHeadingSuggester((handler, suggesterService, editorService) =>
				(source, evt) =>
					Effect.gen(function* () {
						const file = yield* editorService.getFile();
						const editor = yield* editorService.getEditor();
						const cached = yield* Effect.fromNullishOr(app.metadataCache.getFileCache(file));
						const source_heading_offset = find_heading_block(cached, source).offset ?? editor.cm.state.doc.length;
						const modal = yield* suggesterService
							.getSuggesterModal(
								(target, targetEvt) => handler.moveHeading(source, target, evt, targetEvt),
								(items) => {
									return items.filter(item =>
										item.position.end.offset < source.position.start.offset
										|| item.position.end.offset > source_heading_offset
									);
								},);
						modal.setPlaceholder(t('placeholderChooseMoveDestination'));
						modal.start();
					})
				, sourceModal => {
					sourceModal.setPlaceholder(t('placeholderChooseHeadingToMove'));
				})
		});

		this.addCommand({
			id: 'move-current-block2-heading',
			name: t('commandMoveCurrentBlock'),
			editorCallback: openHeadingSuggester(handler => handler.moveCurrentBlock2Heading)
		});

		this.addCommand({
			id: 'move-selected-2-heading',
			name: t('commandMoveSelectedText'),
			editorCallback: openHeadingSuggester(handler => handler.moveSelected2Heading)
		});

		this.addCommand({
			id: 'select-content',
			name: t('commandSelectHeadingContent'),
			editorCallback: openHeadingSuggester(handler => handler.selectContent)
		});
		// todo export hotkey
		// 暫時不提供 heading view 的 hotkey。
		// this.addCommand({
		// 	id: 'edit-block',
		// 	name: 'Edit Block',
		// 	hotkeys: [{ modifiers: ["Shift"], key: "F2", }],
		// 	checkCallback: this.createMindMapViewCheckCallback((view) => {
		// 		view.component?.edit_block();
		// 	})
		// })


		//heading shifter 有同樣的功能了。
		// this.addCommand({
		// 	id: 'insert-current-level-heading',
		// 	name: 'Insert Current Level Heading',
		// 	checkCallback: this.createViewCheckCallback(MarkdownView, (view) => {
		// 		const command = Effect.gen(this, function* () {
		// 			const from = view.editor.getCursor('from');
		// 			const to = view.editor.getCursor('to');
		// 			const file = yield* Option.fromNullable(view.file);
		// 			const meta_cached = yield* Option.fromNullable(this.app.metadataCache.getFileCache(file));
		// 			const current_head = yield* Option.some(from)
		// 				.pipe(Option.filter(f => f.line === to.line && f.ch === 0 && f.ch === to.ch),
		// 					Option.flatMap(f => Option.fromNullable(meta_cached.headings?.findLast(h => h.position.start.line < f.line))),
		// 				);
		// 			console.log("execute when", from, to, current_head, from.line === to.line && from.ch === 0 && from.ch === to.ch);
		// 			view.editor.replaceRange("#".repeat(current_head.level) + " ", from);
		// 			view.editor.setCursor({ line: from.line, ch: current_head.level + 1 });
		// 		})

		// 		Effect.runSyncExit(command);
		// 	})
		// });
	}


}

