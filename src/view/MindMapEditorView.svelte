<script lang="ts">
	import { onMount, tick } from "svelte";
	import MindMapMdPlugin from "../main";
	import {
		MarkdownRenderer,
		Menu,
		TFile,
		type CachedMetadata,
	} from "obsidian";
	import {
		heading,
		leaf_level,
		level_down,
		parse_cache_2_block_view,
		setBlockViewBreadCrumbs,
	} from "../util/parse";
	import { lineSeparator, mdc } from "../util/utils";
	import {
		type BlockView,
		type Block as StateBlock,
		type BaseBlock,
		fork,
		type State,
		type RootBlock,
	} from "../util/block-level";
	import { range } from "effect/Array";
	import type { MindMapMdView } from "./MindMapMdView";
	import type { ComponentState, Position, Selected } from "./MindMapMd";
	import type { Attachment } from "svelte/attachments";
	import VirtualColumn from "./VirtualColumn.svelte";
	import { createEmbeddableMarkdownEditor } from "../extension/obsidian-markdown-editor";
	import {
		LOCK_TO_CENTER,
		MOVE_DOWN,
		MOVE_LEFT,
		MOVE_RIGHT,
		MOVE_UP,
		type ShortcutAction,
	} from "../util/hot-key";
	import { Annotation } from "@codemirror/state";
	import { history, redo, undo } from "@codemirror/commands";
	import { Effect, Option, Schema } from "effect";
	import { createHotkeysAttachment } from "@tanstack/svelte-hotkeys";
	import { EditorView } from "@codemirror/view";
	import type { DocumentService } from "../service/document-service";
	import { hash } from "effect/Hash";
	import { linesWithSeparators } from "effect/String";
	import { find } from "effect/Stream";
	import { find_next_section } from "../util/block-utils";
	import { last } from "effect/Chunk";

	//todo view function
	//show section type 方便在編輯的時候查看父子 block 是什麼階層
	//zoom in/out
	//search/find ?
	interface Props {
		plugin: MindMapMdPlugin;
		view: MindMapMdView;
		docService: DocumentService;
		isActive: () => boolean;
	}

	let { plugin, view, docService, isActive }: Props = $props();

	let self: HTMLElement;

	let is_edit_mode = $state(false);
	docService.subscribe((file, doc, cached) => {
		// console.log("is edit mode", is_edit_mode);
		if (is_edit_mode) {
			return false;
		}
		setDocument(file, doc, cached);
		return true;
	});

	let getfile: () => TFile | null = () => null;
	let last_set_doc: {
		memory_cached: CachedMetadata;
		memory_doc: string;
	} = {
		memory_cached: {},
		memory_doc: "",
	};

	function setDocument(file: TFile, doc: string, cached: CachedMetadata) {
		const external_edit = editor_view.state.doc.toString() !== doc;
		if (doc && external_edit) {
			const tr = editor_view.state.update({
				changes: {
					from: 0,
					to: editor_view.state.doc.length,
					insert: doc,
				},
				annotations: external_edit_annotation.of(true),
			});
			editor_view.dispatch(tr);
		}
		getfile = () => file;

		last_set_doc = {
			memory_cached: cached,
			memory_doc: doc,
		};
		root.fileName = file.name;
		block_view = parse_cache_2_block_view(
			cached,
			(s, e) => editor_view.state.sliceDoc(s, e),
			root,
		);
	}

	let prev_save_action: number | null = null;

	let external_edit_annotation = Annotation.define<true>();

	let editor_view: EditorView = new EditorView({
		doc: "",
		extensions: [
			history(),
			EditorView.updateListener.of((update) => {
				if (
					!update.docChanged ||
					update.transactions.some((tr) =>
						tr.annotation(external_edit_annotation),
					)
				) {
					return;
				}
				if (prev_save_action !== null) {
					cancelAnimationFrame(prev_save_action);
				}
				prev_save_action = requestAnimationFrame(async () => {
					await docService.save(
						getfile()!,
						update.state.doc.toString(),
					);
				});
			}),
		],
	});

	//todo 思考 畫面 selected
	// 看是否只要給 selected block 更好，
	// 其他 selected position 都有 derived 就行？
	let selected_element: HTMLElement;
	export function focus() {
		selected_element?.focus();
	}

	let lock_x = $state(true);
	//todo detect conflict with obsidian default hotkeys and ask user to resolve conflict by changing hotkeys or disable default hotkeys
	const defaultKeyMaps: ShortcutAction = $state({
		MOVE_UP: {
			hotkey: MOVE_UP,
			callback: () => {
				next(-1);
			},
		},
		MOVE_DOWN: {
			hotkey: MOVE_DOWN,
			callback: () => {
				next(1);
			},
		},
		MOVE_LEFT: {
			hotkey: MOVE_LEFT,
			callback: () => {
				accross_column(-1);
			},
		},
		MOVE_RIGHT: {
			hotkey: MOVE_RIGHT,
			callback: () => {
				accross_column(1);
			},
		},
		LOCK_TO_CENTER: {
			hotkey: LOCK_TO_CENTER,
			callback: () => {
				console.log("toggle lock to center", lock_x);
				lock_x = !lock_x;
			},
		},
		Undo: {
			hotkey: "Mod+Z",
			callback: () => {
				undo(editor_view);
			},
		},
		Redo: {
			hotkey: "Mod+Y",
			callback: () => {
				redo(editor_view);
			},
		},
		RedoMac: {
			hotkey: "Mod+Shift+Z",
			callback: () => {
				redo(editor_view);
			},
		},
	});

	const main_hotkeys_attachment = createHotkeysAttachment(() =>
		Object.keys(defaultKeyMaps).map((k) => {
			const { hotkey, callback } =
				defaultKeyMaps[k as keyof typeof defaultKeyMaps]!;
			return {
				hotkey,
				callback,
			};
		}),
	);

	function block_hotkeys_attachment(
		block: StateBlock,
	): Attachment<HTMLElement> {
		return createHotkeysAttachment([
			{
				hotkey: "Enter",
				callback: () => {
					//create new block
					// edit_block();
					add_next(
						block_view,
						block_view
							.at(block.columnIndex)!
							.blocks.at(block.index)!,
					);
				},
			},
			{
				hotkey: "Tab",
				callback: () => {
					//create sub block
					console.log("tab keydown");
					add_sub_child(
						block_view,
						block_view
							.at(block.columnIndex)!
							.blocks.at(block.index)!,
					);
				},
			},
			{
				hotkey: "Backspace",
				callback: () => {
					console.log("backspace keydown");
					fold_block(block);
				},
			},
		]);
	}

	function fold_block(block: BaseBlock) {
		Option.gen(function* () {
			const prev_index = yield* Schema.decodeOption(Schema.NonNegative)(
				block.index - 1,
			);

			const pre_block = yield* Option.fromNullable(
				block_view.at(block.columnIndex)?.blocks.at(prev_index),
			);

			//todo match block type

			//for paragraph under same parent block
			onBlockSelect(block.columnIndex, pre_block.index);
			const from = pre_block.endOffset;
			const to = block.startOffset;
			const tr = editor_view.state.update({
				changes: {
					from,
					to,
					insert: lineSeparator,
				},
			});
			editor_view.dispatch(tr);

			//todo for paragraph under different parent block
			// merge current paragraph block to upper block,delete current block.

			//todo for heading
			//hide sub-blocks
		});
	}

	let root: RootBlock = $state<RootBlock>({
		id: "root",
		fileName: "",
		text: "",
		hash: hash(""),
		columnIndex: -1,
		index: -1,
		startOffset: 0,
		endOffset: 0,
		isEdit: false,
		sections: [],
	});
	let selected = $state<Selected>({
		relativePos: {
			columnIndex: 0,
			blockIndex: 0,
		},
		offset: null,
	});

	let selectedPosition = $derived.by<Position>(() => {
		//todo recover selected position by selected with blocks
		return selected.relativePos ?? { columnIndex: 0, blockIndex: 0 };
	});

	const default_block_view = $state<BlockView>([
		{
			centerBlockIndex: 0,
			blocks: [
				{
					id: crypto.randomUUID(),
					hash: hash(""),
					text: "",
					parentId: root.id,
					columnIndex: 0,
					index: 0,
					startOffset: 0,
					endOffset: 0,
					isEdit: false,
					sections: [],
					state: fork as State,
				},
			],
		},
	]);
	let block_view = $state<BlockView>([]);

	let xAxis = $derived(() => {
		const ci = selectedPosition.columnIndex;
		const columnCount = block_view.length;
		return range(0, columnCount).map((i) => i - ci);
	});

	function add_sub_child(view: BlockView, curr_block: BaseBlock) {
		//find sub,if empty downgrade this current block level
		//empty condition : no block in next column or no block in next column has parent id same as current block id
		//add next

		//if level is leaf level, add next sibling block
		//if next column has block with parent id same as current block id -> add_next
		//else check next column, if colum is empty? do...
		//if not add to endoffset and how to mock block?

		const next_column_index = curr_block.columnIndex + 1;

		const maybe_child_block =
			curr_block.sections.at(0)!.level >= leaf_level
				? Effect.succeed(curr_block)
				: Effect.gen(function* () {
						const next_blocks = yield* get_next_coloumn_blocks();
						const sub_block = yield* Option.fromNullable(
							next_blocks.findLast(
								(b) => b.parentId === curr_block.id,
							),
						);
						return sub_block;
					});

		const add_sub = Effect.match(maybe_child_block, {
			onSuccess: (b) =>
				add_before_next_section(view, b as StateBlock, (_) => {
					const child_section = b.sections.at(0)!;
					const section = curr_block.sections.at(0)!;
					const { level, type } =
						child_section.type === heading
							? child_section
							: level_down(section);
					const text =
						type === heading ? "#".repeat(level) + " " : "";
					return { text, type, level };
				}),
			onFailure: () => {
				//add_after_section
			},
		});

		Effect.runPromise(add_sub);

		function get_next_coloumn_blocks() {
			if (next_column_index < view.length) {
				return Effect.succeed(view.at(next_column_index)!.blocks);
			} else {
				//mock empty column
				return Effect.sync(() => {
					view.push({
						centerBlockIndex: 0,
						blocks: [],
					});
					return view.at(next_column_index)!.blocks;
				});
			}
		}
	}

	function add_next(view: BlockView, curr_block: StateBlock) {
		add_before_next_section(view, curr_block, (_) => {
			const section = curr_block.sections.at(0)!;
			const text =
				section.type === heading ? "#".repeat(section.level) + " " : "";
			return { text, type: section.type, level: section.level };
		});
	}

	function add_before_next_section(
		view: BlockView,
		curr_block: StateBlock,
		get_text: (
			next_block: Option.Option<StateBlock>,
		) => { text: string; type: string; level: number },
	) {
		Option.gen(function* () {
			const next_section = find_next_section(
				view,
				curr_block.columnIndex,
				curr_block.index,
			);
			const { insert_from, start_linebreaks, end_linebreaks } =
				yield* next_section.pipe(
					Option.map((next_section) => ({
						insert_from: next_section.startOffset,
						start_linebreaks: 0, //有 next_section 代表前面原本就有換行了，所以不需要再額外加換行了
						end_linebreaks: 2, // 與 next_section 隔開，換行+在隔一個段落間距，所以總共要 2 個換行符號
					})),
					Option.orElse(() => {
						return Option.fromNullable(
							last_set_doc.memory_cached.sections?.at(-1)
								?.position.end.offset,
						).pipe(
							Option.map((i) => ({
								insert_from: i,
								start_linebreaks: 2,
								end_linebreaks: 0, //避免文件越來越長
							})),
						);
					}),
				);

			is_edit_mode = true; //進入 edit mode ,避免 cache 更新把畫面重置
			const curr_section = curr_block.sections.at(0)!;
			const { text, type, level } = get_text(next_section);

			const insert =
				lineSeparator.repeat(start_linebreaks) +
				text +
				lineSeparator.repeat(end_linebreaks);
			const tr = editor_view.state.update({
				changes: {
					from: insert_from,
					insert: insert,
				},
			});

			editor_view.dispatch(tr);

			// 手動模擬更新 cache 後的 block
			const next_index = curr_block.index + 1;

			const start = insert_from + start_linebreaks;
			const end = start + text.length;
			const mock_block = {
				id: crypto.randomUUID(),
				hash: hash(text),
				text: text,
				parentId: curr_block.parentId,
				columnIndex: curr_block.columnIndex,
				index: next_index,
				startOffset: start,
				endOffset: end,
				isEdit: true,
				sections: [
					{
						type: type,
						level: level,
						startOffset: start,
						endOffset: end,
					},
				],
				state: fork as State,
			};
			const column = yield* Option.fromNullable(
				view.at(curr_block.columnIndex),
			);

			column.blocks.splice(next_index, 0, mock_block);

			onBlockSelect(curr_block.columnIndex, next_index);
		});
	}

	function accross_column(offset: number) {
		Option.gen(function* () {
			const len = yield* block_view.length === 0
				? Option.none()
				: Option.some(block_view.length);
			const { columnIndex } = selectedPosition;
			const next_column_index = columnIndex + offset;
			const x =
				next_column_index >= len
					? next_column_index - len
					: next_column_index < 0
						? len + next_column_index
						: next_column_index;

			const y = block_view.at(x)!.centerBlockIndex;

			move_to(x, y);
		});
	}

	// todo 尋找下一段落
	// 基本上先以右邊的 center block 預設為下一段落（對 header 通常而言是如此）（可能也不是，因為為了視覺效果，center block 可能是該群組使用者上次點擊的，所以還是要重找該群組的第一個
	// 如果已經是最右邊了，則先以同一 column 的下一個 block 預設為下一段落，
	// 但需要先繼續往左邊找，只要可以找到 block 的 start offset 距離目前段落越小越好 （則該 block 才是下一段落） （對 paragraph 通常而言是如此）
	// 如果是最底的段落則跳回最一開頭的段落
	function find_next() {
		const { columnIndex, blockIndex } = selectedPosition;
	}

	function move_to(x: number, y: number) {
		selected.relativePos = {
			columnIndex: x,
			blockIndex: y,
		};
	}

	export function next(offset: number) {
		const { blockIndex, columnIndex } = selectedPosition;

		const x = columnIndex;
		const len = block_view.at(x)!.blocks.length;
		const next_y = blockIndex + offset;
		const y =
			next_y >= len ? next_y - len : next_y < 0 ? len + next_y : next_y;

		move_to(x, y);
	}
	export function edit_block() {
		Option.gen(function* () {
			const block = yield* Option.fromNullable(
				block_view
					.at(selectedPosition.columnIndex)
					?.blocks.at(selectedPosition.blockIndex),
			);
			block.isEdit = true;
			is_edit_mode = true;
		});
	}

	function render_obsidian_markdown(b: StateBlock): Attachment<HTMLElement> {
		// let selectedEvent = () => onBlockSelect(b.columnIndex, b.index);
		return (element: HTMLElement) => {
			const container = element;
			container.replaceChildren();
			const filePath = getfile()?.path;
			if (!filePath) return;
			if (
				b.state === fork &&
				isActive() //避免其他 editor 更新時，這個 view 重新渲染，又因為 fork 的 focus 把，focus 搶到這個 view 上
			) {
				selected_element = container;
				// tick().then(()=>container.focus());
				// todo focus
				// 最一開始進畫面 focus 無反應，即使用 tick 也一樣
				// 需要用 setTimeout 才能成功 focus，原因不明，需要確認

				setTimeout(() => {
					container.focus({ preventScroll: true });
					// console.log("rub focus", container, document.activeElement);
				}, 0);
			}
			MarkdownRenderer.render(
				plugin.app,
				b.text,
				container,
				filePath,
				view,
			);
		};
	}

	function render_markdown_editor(b: StateBlock): Attachment<HTMLElement> {
		let start = b.startOffset;
		return (container: HTMLElement) => {
			container.replaceChildren();
			const value = b.text;
			const m = createEmbeddableMarkdownEditor(plugin.app, container, {
				value,
				cursorLocation: {
					head: value.length,
					anchor: value.length,
				},
				onEnter: (ed, mod, shift) => {
					if (mod) {
						b.isEdit = false;
						is_edit_mode = false;
						//todo 偵測如果使用者最後輸入內容為空
						//看上一個 block 是否在同個 parent 底下，如果是刪除中間留白，不論中間原本有多少 separator，變成 2 個 separator
						//todo hash block text for re-locate
					}
					return mod;
				},
				onChange: (update) => {
					update.transactions.forEach((tr) => {
						tr.changes.iterChanges(
							(fromA, toA, fromB, toB, insert) => {
								const t = editor_view?.state.update({
									changes: {
										from: start + fromA,
										to: start + toA,
										insert,
									},
								});
								editor_view?.dispatch(t!);
							},
						);
					});
				},
			});

			m.owner.file = getfile()!; //for obsidian renaming heading command to work
			//需要 focus 才能讓遊標顯示，如果不使用 setTimeout，對每欄最後一個 block 做新增 block，會無法成功 focus 新的 block，原因不明，需要確認
			setTimeout(() => m.editor.cm.focus());
			return () => {
				m.destroy();
			};

			// return m.destroy;
		};
	}

	function move_column_to_center(
		columnIndex: number,
	): Attachment<HTMLElement> {
		return (col: HTMLElement) => {
			if (columnIndex !== selectedPosition.columnIndex || !lock_x) return;
			col.scrollIntoView({
				behavior: "smooth",
				inline: "center",
			});
		};
	}

	function onBlockSelect(columnIndex: number, blockIndex: number) {
		selected.relativePos = { columnIndex, blockIndex };
	}
	function show_context_menu(block: StateBlock) {
		return (e: MouseEvent) => {
			//todo context menu
			const block_action_menu = new Menu();

			block_action_menu.addItem((item) =>
				item
					.setTitle("Edit Block")
					.setIcon("pencil")
					.onClick((e) => {
						onBlockSelect(block.columnIndex, block.index);
						edit_block();
						//防止意圖被偵測成使用者點擊 block 以外的地方而關閉編輯模式
						e.stopPropagation();
					}),
			);

			block_action_menu.addSeparator();

			block_action_menu.addItem((item) =>
				item
					.setTitle("Add Block")
					.setIcon("plus")
					.onClick(() => {
						// myCustomFunction();
						console.log("add sibling block");
						//todo add sibling block
						// onBlockSelect(columnIndex, i);
					}),
			);
			block_action_menu.addItem((item) =>
				item
					.setTitle("Add Child Block")
					.setIcon("plus-with-circle")
					.onClick(() => {
						// myCustomFunction();
						console.log("add child block");
						//todo add child block
						// onBlockSelect(columnIndex, i);
					}),
			);

			block_action_menu.addSeparator();

			block_action_menu.addItem((item) =>
				item
					.setTitle("Fold Block")
					.setIcon("list-chevrons-down-up")
					.onClick(() => {
						//todo fold block
						//不顯示其 sub-blocks
					}),
			);

			block_action_menu.addItem((item) =>
				item
					.setTitle("Expand Block")
					.setIcon("list-chevrons-up-down")
					.onClick(() => {
						//todo expand block
					}),
			);

			block_action_menu.addSeparator();

			block_action_menu.addItem((item) =>
				item
					.setTitle("Locate in File")
					.setIcon("locate")
					.onClick(async () => {
						// myCustomFunction();
						await docService.reveal(
							getfile()!,
							block.startOffset,
							block.endOffset,
						);
					}),
			);
			block_action_menu.addItem((item) =>
				item
					.setTitle("Open File")
					.setIcon("file-text")
					.onClick(async () => {
						await docService.openFile(
							getfile()!,
							block.startOffset,
							block.endOffset,
						);
					}),
			);

			block_action_menu.addSeparator();

			block_action_menu.addItem((item) =>
				item
					.setTitle("Merge Up")
					.setIcon("arrow-up")
					.onClick(() => {
						// myCustomFunction();
						//todo merge up
						console.log("merge up");
						const pre_block = block_view
							.at(block.columnIndex)!
							.blocks.at(block.index - 1)!;

						const from = pre_block.endOffset;
						const to = block.startOffset;
						const tr = editor_view.state.update({
							changes: {
								from,
								to,
								insert: "\n",
							},
						});
						editor_view.dispatch(tr);
						//主要目的是想要把 2 個 paragraph block 的內容合併成一個 block，讓我好編輯
						//但要思考如果 2 個 block 是不同層級或是處在不同 parent block 底下的話，要怎麼處理比較好?
						//或者將此功能限定給 paragraph 且 parent block 相同的時候才顯示。
						//step1 add current to upper block's parent (move position)
						//step2 downgrade current block's level
						// onBlockSelect(columnIndex, i);
					}),
			);

			block_action_menu.addItem((item) =>
				item
					.setTitle("Merge Down")
					.setIcon("arrow-down")
					.onClick(() => {
						// myCustomFunction();
						console.log("merge down");
						//todo merge down
						// onBlockSelect(columnIndex, i);
					}),
			);

			block_action_menu.addSeparator();

			block_action_menu.addItem((item) =>
				item
					.setTitle("Delete Block")
					.setIcon("trash")
					.onClick(() => {
						// myCustomFunction();
						console.log("delete block");
						//todo delete block
						// onBlockSelect(columnIndex, i);
					}),
			);
			block_action_menu.showAtPosition(e);
		};
	}

	$effect(() => {
		// console.log("execute set block view effect");
		setBlockViewBreadCrumbs(block_view, selectedPosition);
		// console.log(
		// 	$state.snapshot(block_view.at(selectedPosition.columnIndex)),
		// );
	});

	//update stale cache when user is not in edit mode
	$effect(() => {
		const file = getfile();
		if (is_edit_mode || !file) return;
		const { memory_cached, memory_doc } = last_set_doc;
		if (docService.isStale(memory_doc, memory_cached)) {
			const new_cached = docService.getCache(file);
			const update = new_cached.pipe(
				Effect.andThen((c) => {
					setDocument(file, c.doc, c.cached);
				}),
			);
			Effect.runPromise(update);
		}
	});

	let columnWidthMap = $state.raw<Record<number, number>>({});

	function updateColumnWidth(columnIndex: number, width: number) {
		const prev = columnWidthMap[columnIndex] ?? 0;
		if (width > prev) {
			columnWidthMap = {
				...columnWidthMap,
				[columnIndex]: Math.ceil(width),
			};
		}
	}

	onMount(() => {});

	function close_editor_on_click_outside(
		block: StateBlock,
	): Attachment<HTMLDivElement> {
		return (editor_container) => {
			const onClick = (e: MouseEvent) => {
				const target = e.target as HTMLElement;
				if (
					editor_container.contains(target) ||
					target.closest(".menu") //防止點擊 editor context menu 時關閉編輯模式
				) {
					return;
				}

				block.isEdit = false;
				is_edit_mode = false;
			};
			document.addEventListener("click", onClick);
			return () => document.removeEventListener("click", onClick);
		};
	}


	async function reveal_block(block: StateBlock) {
		await docService.reveal(getfile()!, block.startOffset, block.endOffset);
	}
</script>

<div
	class="mindmapmd-theme"
	tabindex="-1"
	{@attach main_hotkeys_attachment}
	bind:this={self}
>
	<div class="grid grid-flow-col gap-7 overflow-auto">
		<div>
			<div></div>
		</div>
		{#each block_view as column, columnIndex}
			<div
				class={`h-screen overflow-y-auto min-w-100 ${mdc("column")}`}
				style="overflow-anchor: none;"
				{@attach move_column_to_center(columnIndex)}
			>
				<VirtualColumn {column}>
					{#snippet children(block, i)}
						{#if !block.isEdit}
							<div
								role="treeitem"
								aria-selected={block.state === fork}
								tabindex="0"
								oncontextmenu={show_context_menu(block)}
								onkeydown={(e) => {
									if (e.key === "Delete") {
										// block.isEdit = true;
										// is_edit_mode = true;
										//todo delete block
										console.log("delete keydown");
										// onBlockSelect(columnIndex, i);
									}
								}}
								// ondblclick={() => {
								// 	block.isEdit = true;
								// 	is_edit_mode = true;
								// }}
								onclick={async (e) => {
									onBlockSelect(columnIndex, i);
									await reveal_block(block);
									(e.currentTarget as HTMLElement).focus();
								}}
								// onpointerup={() => onBlockSelect(columnIndex, i)}
								{@attach render_obsidian_markdown(block)}
								{@attach block_hotkeys_attachment(block)}
								//todo 使用者可以設定最大高度，超過的話就顯示 scroll
								class={`min-w-80 rounded-lg p-4 text-card-foreground shadow-sm ${mdc(block.state)} bg-card my-3`}
							></div>
						{:else}
							<div
								{@attach render_markdown_editor(block)}
								{@attach close_editor_on_click_outside(block)}
								class={`min-w-80 rounded-lg p-4 text-card-foreground shadow-sm ${mdc(block.state)} bg-card my-3`}
							></div>
						{/if}
					{/snippet}
				</VirtualColumn>
			</div>
		{/each}
	</div>
</div>
