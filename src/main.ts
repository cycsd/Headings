import { App, Editor, MarkdownView, Modal, Notice, Plugin, TFile, WorkspaceLeaf } from 'obsidian';
import "./app.css";
import { DEFAULT_SETTINGS, MindMapMdSettingTab, type MyPluginSettings } from "./settings";
import { MindMapMdView, VIEW_ICON_MINDMAPMD, VIEW_TYPE_MINDMAPMD } from "./view/MindMapMdView";
import { getActiveViewOfType } from "./extension/workspace";
import { Effect, Option, pipe } from "effect";
import type { MindMapMdViewState } from './view/MindMapMd';

// Remember to rename these classes and interfaces!

export default class MindMapMdPlugin extends Plugin {
	settings: MyPluginSettings = DEFAULT_SETTINGS;

	async onload() {
		await this.loadSettings();

		this.registerView(
			VIEW_TYPE_MINDMAPMD,
			(leaf: WorkspaceLeaf) => new MindMapMdView(leaf, this));
		// This creates an icon in the left ribbon.
		this.addRibbonIcon(VIEW_ICON_MINDMAPMD, 'Toggle Mind Map MD View', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			// new Notice('This is a notice! just kidding');
			this.toggleMindMapMdView();
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new MindMapMdSettingTab(this.app, this));

		//todo : open file with mind map md view from file explorer context menu
		// 使用者有可能從左側 file explorer 開啟檔案的 context menu 來開啟 mind map md view，
		// 所以需要新開一個 leaf 而不是從現有的 markdown view 來切換，以現在的做法會無法從 file explorer 開啟 mind map md view
		this.registerEvent(this.app.workspace.on('file-menu', (menu, file, source) => {

			menu.addItem((item) => {
				item.setTitle('Mind Map MD View')
					.setIcon(VIEW_ICON_MINDMAPMD)
					.onClick(async () => {
						Effect.runPromise(this.turnOnMindMapMdView);
					});
			})
		}));

		// this.registerEvent(this.app.workspace.on('editor-menu', (menu, editor, view) => {
		// 	console.log("open editor menu", { menu, editor, view });
		// 	menu.addItem((item) => {
		// 		item.setTitle('Mind Map MD View')
		// 			.setIcon('dice')
		// 			.onClick(async () => {
		// 				Effect.runPromise(this.turnOnMindMapMdView);
		// 			});
		// 	})
		// }));

		// // This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		// const statusBarItemEl = this.addStatusBarItem();
		// statusBarItemEl.setText('Status bar text');

		// // This adds a simple command that can be triggered anywhere
		// this.addCommand({
		// 	id: 'open-modal-simple',
		// 	name: 'Open modal (simple)',
		// 	callback: () => {
		// 		new SampleModal(this.app).open();
		// 	}
		// });
		// // This adds an editor command that can perform some operation on the current editor instance
		// this.addCommand({
		// 	id: 'replace-selected',
		// 	name: 'Replace selected content',
		// 	editorCallback: (editor: Editor, view: MarkdownView) => {
		// 		editor.replaceSelection('Sample editor command');
		// 	}
		// });
		// // This adds a complex command that can check whether the current state of the app allows execution of the command
		// this.addCommand({
		// 	id: 'open-modal-complex',
		// 	name: 'Open modal (complex)',
		// 	checkCallback: (checking: boolean) => {
		// 		// Conditions to check
		// 		const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
		// 		if (markdownView) {
		// 			// If checking is true, we're simply "checking" if the command can be run.
		// 			// If checking is false, then we want to actually perform the operation.
		// 			if (!checking) {
		// 				new SampleModal(this.app).open();
		// 			}

		// 			// This command will only show up in Command Palette when the check function returns true
		// 			return true;
		// 		}
		// 		return false;
		// 	}
		// });



		// // If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// // Using this function will automatically remove the event listener when this plugin is disabled.
		// this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
		// 	new Notice("Click");
		// });

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		// this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));

	}

	onunload() {
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<MyPluginSettings>);
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


	turnOnMarkdownView = Effect.gen(this, function* () {
		const view = yield* getActiveViewOfType(this.app.workspace, MindMapMdView);

		const file = yield* pipe(
			Effect.fromNullable(view.state?.file),
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
				Effect.orElse(() => this.turnOnMarkdownView),
				Effect.andThen(() => getActiveViewOfType(workspace, MarkdownView)),
			)
		);
	}


}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		let { contentEl } = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
