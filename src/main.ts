import { App, Editor, MarkdownView, Modal, Notice, Plugin, TFile, WorkspaceLeaf } from 'obsidian';
import { DEFAULT_SETTINGS, MindMapMdSettingTab, type MyPluginSettings } from "./settings";
import { MindMapMdView, VIEW_TYPE_MINDMAPMD } from "../view/MindMapMdView";
import { getActiveViewOfType } from "../extension/workspace";
import { Effect, Option, pipe } from "effect";
import type { MindMapMdViewState } from '../view/MindMapMd';

// Remember to rename these classes and interfaces!

export default class MindMapMdPlugin extends Plugin {
	settings: MyPluginSettings = DEFAULT_SETTINGS;
	currentMarkdownEditor: Editor | null = null;
	currentMarkdownDoc: string | null = null;
	currentFile: TFile | null = null;
	async onload() {
		await this.loadSettings();

		this.registerView(
			VIEW_TYPE_MINDMAPMD,
			(leaf: WorkspaceLeaf) => new MindMapMdView(leaf, this));
		// This creates an icon in the left ribbon.
		this.addRibbonIcon('dice', 'Sample', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			// new Notice('This is a notice! just kidding');
			this.toggleMindMapMdView();
		});

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status bar text');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-modal-simple',
			name: 'Open modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'replace-selected',
			name: 'Replace selected content',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				editor.replaceSelection('Sample editor command');
			}
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-modal-complex',
			name: 'Open modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
				return false;
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new MindMapMdSettingTab(this.app, this));

		//todo : open file with mind map md view from file explorer context menu
		// 使用者有可能從左側 file explorer 開啟檔案的 context menu 來開啟 mind map md view，
		// 所以需要新開一個 leaf 而不是從現有的 markdown view 來切換，以現在的做法會無法從 file explorer 開啟 mind map md view
		this.registerEvent(this.app.workspace.on('file-menu', (menu, file, source) => {
			console.log("open editor menu fail", { menu, file, source });
			menu.addItem((item) => {
				item.setTitle('Mind Map MD View')
					.setIcon('layout-template')
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

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			new Notice("Click");
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));

	}

	onunload() {
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<MyPluginSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	turnOnMindMapMdView = pipe(
		getActiveViewOfType(this.app.workspace, MarkdownView),
		Effect.andThen(v => Effect.tryPromise(() => {
			// console.log("this", this)
			// console.log("view", v)
			
			// this.currentMarkdownEditor = v.editor;
			// this.currentMarkdownDoc = v.editor.getValue();
			// this.currentFile = v.file;

	// console.log("View found, activating it in map", this.currentFile);
			// console.log("View found, activating it in map", v, this);
			// console.log("this", this)

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

		let leaf: WorkspaceLeaf | undefined | null = undefined;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_MINDMAPMD);

		// const view = getActiveViewOfType(workspace, MarkdownView);

		// const openMindMapMdView = getActiveViewOfType(workspace, MarkdownView)
		// 	.pipe(
		// 		Effect.andThen(v => Effect.tryPromise(() => {
		// 			this.currentMarkdownEditor = v.editor;
		// 			this.currentMarkdownDoc = v.editor.getValue();
		// 			console.log("View found, activating it in map");
		// 			return v.leaf.setViewState({ type: VIEW_TYPE_MINDMAPMD, active: true });
		// 		}))
		// 	);

		Effect.runPromise(
			this.turnOnMindMapMdView.pipe(
				Effect.orElse(() => this.turnOnMarkdownView),
				Effect.andThen(() => getActiveViewOfType(workspace, MarkdownView)),
				Effect.andThen(v => console.log("editor", v.editor))
			)
		);

		// const m =Option.map(view, v => {
		// 	this.currentMarkdownEditor = v.editor;
		// 	this.currentMarkdownDoc = v.editor.getValue();
		// 	console.log("View found, activating it in map");
		// 	return v.leaf.setViewState({ type: VIEW_TYPE_MINDMAPMD, active: true });
		// });

		// Effect.runPromise(view).then(v => {
		// 	this.currentMarkdownEditor = v.editor;
		// 	this.currentMarkdownDoc = v.editor.getValue();
		// 	v.leaf.setViewState({ type: VIEW_TYPE_MINDMAPMD, active: true });
		// });

		// if (view) {
		// 	this.currentMarkdownEditor = view.editor;
		// 	this.currentMarkdownDoc = view.editor.getValue();
		// 	await view.leaf.setViewState({ type: VIEW_TYPE_MINDMAPMD, active: true });

		// }

		// if (leaves.length > 0) {
		// 	// A leaf with our view already exists, use that
		// 	leaf = leaves[0];
		// } else {
		// 	// Our view could not be found in the workspace, create a new leaf
		// 	// in the right sidebar for it
		// 	leaf = workspace.getRightLeaf(false);
		// 	await leaf?.setViewState({ type: VIEW_TYPE_MINDMAPMD, active: true });
		// }

		// // "Reveal" the leaf in case it is in a collapsed sidebar
		// workspace.revealLeaf(leaf!);
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
