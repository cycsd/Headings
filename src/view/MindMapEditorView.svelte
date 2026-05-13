<script lang="ts">
	import { onMount, tick } from "svelte";
	import MindMapMdPlugin from "../main";
	import { MarkdownRenderer, MarkdownView } from "obsidian";
	import {
		parseCache2BlockView,
		setBlockViewBreadCrumbs,
		text,
	} from "../util/parse";
	import { mdc } from "../util/utils";
	import {
		type BlockView,
		type Block as StateBlock,
		type Root,
		fork,
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
	import { Effect, Option } from "effect";
	import {
		createHotkey,
		createHotkeys,
		createHotkeysAttachment,
		NAVIGATION_KEYS,
	} from "@tanstack/svelte-hotkeys";
	import { clamp } from "effect/Number";

	interface Props {
		plugin: MindMapMdPlugin;
		view: MindMapMdView;
	}

	let { plugin, view }: Props = $props();

	let self: HTMLElement;
	let selected_element: HTMLElement;
	let lock_to_center = $state(true);
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
		LOCK_TO_CENTER:{
			hotkey:LOCK_TO_CENTER,
			callback:()=>{
				console.log("toggle lock to center", lock_to_center);
				lock_to_center = !lock_to_center;
			}
		}
	});

	const hotkeysAttachment = createHotkeysAttachment(() =>
		Object.keys(defaultKeyMaps).map((k) => {
			const { hotkey, callback } =
				defaultKeyMaps[k as keyof typeof defaultKeyMaps]!;
			return {
				hotkey,
				callback,
			};
		}),
	);

	let filePath = $state<string | null>(null);
	let root: Root = $state<Root>({
		id: "root",
		fileName: "",
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

	let blockView = $state<BlockView>([]);
	let xAxis = $derived(() => {
		const ci = selectedPosition.columnIndex;
		const columnCount = blockView.length;
		return range(0, columnCount).map((i) => i - ci);
	});
	export function increment() {
		// count += 1;
	}
	export function setState(state: ComponentState) {
		const { cache, doc, file } = state;
		//todo send state to channel
		filePath = file.path;
		root.fileName = file.name;
		// const contents = parseCacheMetadata2Content(cache, doc);
		// const blockGroup = parseContent2Blocks(contents, root);

		blockView = parseCache2BlockView(cache, doc, root);
		// console.log("set state");

		// setBlockViewBreadCrumbs(blockView, selectedPosition);
	}

	export function focus() {
		selected_element?.focus();
	}

	function accross_column(offset: number) {
		Option.gen(function* () {
			const len = yield* blockView.length === 0
				? Option.none()
				: Option.some(blockView.length);
			const { columnIndex } = selectedPosition;
			const next_column_index = columnIndex + offset;
			const x =
				next_column_index >= len
					? next_column_index - len
					: next_column_index < 0
						? len + next_column_index
						: next_column_index;

			const y = blockView.at(x)!.centerBlockIndex;

			move_to(x, y);
		});
	}

	// todo
	// 尋找下一段落，基本上先以右邊的 center block 預設為下一段落（對 header 通常而言是如此）（可能也不是，因為為了視覺效果，center block 可能是該群組使用者上次點擊的，所以還是要重找該群組的第一個
	// 如果已經是最右邊了，則先以同一 column 的下一個 block 預設為下一段落，
	// 但需要先繼續往左邊找，只要可以找到 block 的 start offset 距離目前段落越小越好 （則該 block 才是下一段落） （對 paragraph 通常而言是如此）
	// 如果是最底的段落則跳回最一開頭的段落
	function find_next() {
		const { columnIndex, blockIndex } = selectedPosition;

		const next_column_index = columnIndex + 1;
	}

	function move_to(x: number, y: number) {
		selected.relativePos = {
			columnIndex: x,
			blockIndex: y,
		};
	}

	function next(offset: number) {
		const { blockIndex, columnIndex } = selectedPosition;

		const x = columnIndex;
		const len = blockView.at(x)!.blocks.length;
		const next_y = blockIndex + offset;
		const y =
			next_y >= len ? next_y - len : next_y < 0 ? len + next_y : next_y;

		move_to(x, y);
	}

	function renderObsidianMarkdown(b: StateBlock): Attachment<HTMLElement> {
		// let selectedEvent = () => onBlockSelect(b.columnIndex, b.index);
		return (element: HTMLElement) => {
			const container = element;
			container.replaceChildren();
			const text = b.content[0]!.text;
			if (!filePath) return;
			if (b.state === fork) {
				selected_element = container;
				// tick().then(()=>container.focus());
				// todo focus
				// 最一開始進畫面 focus 無反應，即使用 tick 也一樣
				// 需要用 setTimeout 才能成功 focus，原因不明，需要確認
				setTimeout(() => {
					container.focus({preventScroll: true});
				}, 0);
				// console.log("focus element after", document.activeElement);
			}
			// element.replaceChildren();
			// container.addEventListener("pointerup", selectedEvent);
			MarkdownRenderer.render(
				plugin.app,
				text,
				container,
				filePath,
				view,
			);
			// }
			// .then(() => {
			// 	// After rendering is complete, measure the width and update the column width
			// 	console.log(
			// 		"content:",
			// 		content,
			// 		"width:",
			// 		element.getBoundingClientRect().width,
			// 	);
			// 	const width = element.getBoundingClientRect().width;
			// 	updateColumnWidth(column, width);
			// });
		};
	}

	function renderMarkdownEditor(b: StateBlock): Attachment<HTMLElement> {
		return (container: HTMLElement) => {
			container.replaceChildren();
			const value = b.content[0]!.text;
			const m = createEmbeddableMarkdownEditor(plugin.app, container, {
				value,
				cursorLocation: {
					head: value.length,
					anchor: value.length,
				},
				onEnter: (ed, mod, shift) => {
					if (mod) {
						b.isEdit = false;
					}
					return mod;
				},
			});

			// return m.destroy;
		};
	}

	function move_column_to_center(
		columnIndex: number,
	): Attachment<HTMLElement> {
		return (col: HTMLElement) => {
			if (columnIndex !== selectedPosition.columnIndex || !lock_to_center) return;
			//console.log("move column to center", columnIndex);

			col.scrollIntoView({
				behavior: "smooth",
				inline: "center",
			});
		};
	}

	function onBlockSelect(columnIndex: number, blockIndex: number) {
		selected.relativePos = { columnIndex, blockIndex };
		// setBlockViewBreadCrumbs(blockView, selectedPosition);
		// console.log("select block", columnIndex, blockIndex);
	}

	$effect(() => {
		// console.log("execute effect");
		setBlockViewBreadCrumbs(blockView, selectedPosition);
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

	onMount(() => {
		// workspace-leaf-content
		// hotkeysAttachment(self.parentElement!.parentElement!.parentElement!);
		// console.log(
		// 	"mount parent element",
		// 	self.parentElement!.parentElement!.parentElement!,
		// );
		// self.focus();
	});
</script>

<div
	class="mindmapmd-theme"
	tabindex="-1"
	{@attach hotkeysAttachment}
	bind:this={self}
>
	<div class="grid grid-flow-col gap-10 overflow-auto">
		{#each blockView as blockGroup, columnIndex}
			<div
				class={`h-screen overflow-y-auto p-10 min-w-100 ${mdc("column")}`}
				style="overflow-anchor: none;"
				{@attach move_column_to_center(columnIndex)}
			>
				<VirtualColumn column={blockGroup}>
					{#snippet children(block, i)}
						<!-- <BlockEditor {block}> -->
						<!-- {#snippet preview()} -->
						<!-- <div> -->
						{#if !block.isEdit}
							<div
								role="treeitem"
								aria-selected={block.state === fork}
								tabindex="0"
								onkeydown={(e) => {
									if (e.key === "Enter") {
										block.isEdit = true;
									}
								}}
								ondblclick={() => (block.isEdit = true)}
								onclick={() => onBlockSelect(columnIndex, i)}
								// onpointerup={() => onBlockSelect(columnIndex, i)}
								{@attach renderObsidianMarkdown(block)}
								//todo 使用者可以設定最大高度，超過的話就顯示 scroll
								class={`min-w-80 rounded-lg p-4 text-card-foreground shadow-sm ${mdc(block.state)} bg-card my-3`}
							></div>
							<!-- {/snippet} -->
						{:else}
							<!-- {#snippet edit()} -->
							<div
								{@attach renderMarkdownEditor(block)}
								class={`min-w-80 rounded-lg p-4 text-card-foreground shadow-sm ${mdc(block.state)} bg-card my-3`}
							></div>
							<!-- {/snippet} -->
						{/if}
						<!-- </div> -->
						<!-- </BlockEditor> -->
					{/snippet}
				</VirtualColumn>
			</div>
		{/each}
	</div>
</div>
