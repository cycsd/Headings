<script lang="ts">
	import { onMount } from "svelte";
	import MindMapMdPlugin from "../main";
	import {
		MarkdownRenderer,
		type CachedMetadata,
		type TFile,
	} from "obsidian";
	import { Console, Data, Effect, Logger } from "effect";
	import {
		parseCacheMetadata2Content,
		parseContent2Blocks,
	} from "../util/parse";
	import { mdc } from "../util/utils";
	import {
		type BlockView,
		type Block as StateBlock,
		type Root,
		fork,
		unselected,
		type State,
		road,
		path,
		type ColumnLayout,
	} from "../util/block_level";
	import { range } from "effect/Array";
	import CodeMirror from "svelte-codemirror-editor";
	// import { markdown } from "@codemirror/lang-markdown";
	// import {
	// 	livePreviewPlugin,
	// 	markdownStylePlugin,
	// 	editorTheme,
	// 	mouseSelectingField,
	// 	collapseOnSelectionFacet,
	// 	setMouseSelecting,
	// } from "codemirror-live-markdown";
	import { markdown } from "@codemirror/lang-markdown";
	import { GFM } from "@lezer/markdown";

	import {
		prosemarkBasicSetup,
		prosemarkBaseThemeSetup,
		prosemarkMarkdownSyntaxExtensions,
	} from "@prosemark/core";
	import {
		htmlBlockExtension,
		renderHtmlMarkdownSyntaxExtensions,
	} from "@prosemark/render-html";
	import BlockEditor from "./BlockEditor.svelte";

	import type { MindMapMdView } from "./MindMapMdView";
	import type { ComponentState, Position, Selected } from "./MindMapMd";
	import type { Attachment } from "svelte/attachments";
	import {
		VList,
		Virtualizer,
		WindowVirtualizer,
		type VirtualizerHandle,
	} from "virtua/svelte";
	import VirtualColumn from "./VirtualColumn.svelte";
	import {
		createEmbeddableMarkdownEditor,
		resolveEditorPrototype,
	} from "../extension/obsidian-markdown-editor";

	interface Props {
		startCount: number;
		plugin: MindMapMdPlugin;
		view: MindMapMdView;
	}

	let { startCount, plugin, view }: Props = $props();

	let count = $state(startCount);

	//todo remove cache
	//應該是不用 cache state, 直接從 updateState 傳入 cache 後更新 blocks sate 就好
	let cache = $state<CachedMetadata | null>(null);
	let doc = $state<string | null>(null);
	let filePath = $state<string | null>(null);
	let root: Root = {
		id: "root",
		fileName: "",
	};
	let selected = $state<Selected>({
		relativePos: {
			columnIndex: 0,
			blockIndex: 0,
		},
		offset: null,
	});
	let blocks = $derived.by(() => {
		if (!cache || !doc) return [];
		const contents = parseCacheMetadata2Content(cache, doc);
		const blockGroup = parseContent2Blocks(contents, root);
		return blockGroup;
	});
	let rootEdit = $derived(root);
	let selectedPosition = $derived.by<Position>(() => {
		//todo recover selected position by selected with blocks
		return selected.relativePos ?? { columnIndex: 0, blockIndex: 0 };
	});
	// let blockView = $derived.by<BlockView>(() => {
	// https://svelte.dev/docs/svelte/$derived#Deriveds-and-reactivity
	let blockView = $derived.by<ColumnLayout[]>(() => {
		if (blocks.length === 0) return [];
		const { columnIndex, blockIndex } = selectedPosition;
		const selectedBlock = blocks[columnIndex]?.[blockIndex];

		const [r_before_columns] = range(0, columnIndex).reduceRight(
			(acc, column_index) => {
				const [collect, { target, state }] = acc;

				const column =
					blocks[column_index]?.map((b) => {
						const state_block: StateBlock = {
							...b,
							state: b.id === target ? state : unselected,
							isEdit: false,
						};
						return state_block;
					}) ?? [];
				const selected = column.find((b) => b.id === target);

				const column_layout: ColumnLayout = {
					centerBlockIndex: selected?.index ?? 0,
					blocks: column,
				};

				collect.push(column_layout);
				return Data.tuple(collect, {
					target: selected?.parentId ?? "",
					state: road,
				} as {
					target: string;
					state: State;
				});
			},
			Data.tuple(
				[] as BlockView,
				{ target: selectedBlock?.id, state: fork } as {
					target: string;
					state: State;
				},
			),
		);

		const before_columns = r_before_columns.reverse();

		const [after_columns] = range(columnIndex + 1, blocks.length).reduce(
			(acc, column_index) => {
				const [collect, { parents }] = acc;

				const next_parents: string[] = [];
				const column =
					blocks[column_index]?.map((b) => {
						let s: State = unselected;
						if (parents.includes(b.parentId)) {
							next_parents.push(b.id);
							s = path;
						}
						const state_block: StateBlock = {
							...b,
							state: s,
							isEdit: false,
						};
						return state_block;
					}) ?? [];

				// 應該讓中間的區塊在正中央，所以應該取中間的 block 當作 centerBlockIndex
				// 這樣如果 block 一多，反而第一個元素有可能超出上邊界...
				const selected_subblocks = column.filter(
					(b) => b.state === path,
				);
				// const center_index = selected_subblocks.length > 0 ?selected_subblocks[Math.floor(selected_subblocks.length / 2)]!.index : -1;
				const center_index = selected_subblocks.first()?.index ?? -1;
				const column_layout: ColumnLayout = {
					centerBlockIndex: center_index,
					blocks: column,
				};
				collect.push(column_layout);

				return Data.tuple(collect, {
					parents: next_parents,
					state: path,
				});
			},
			Data.tuple([] as BlockView, {
				parents: [selectedBlock?.id ?? ""],
			}),
		);

		const columns = [...before_columns, ...after_columns];
		return columns;
	});
	let xAxis = $derived(() => {
		const ci = selectedPosition.columnIndex;
		const columnCount = blockView.length;
		return range(0, columnCount).map((i) => i - ci);
	});
	export function increment() {
		count += 1;
	}
	export function setState(state: ComponentState) {
		cache = state.cache;
		doc = state.doc;
		filePath = state.file.path;
		rootEdit.fileName = state.file.name;
	}
	function logEditor() {
		console.log("Current Markdown Editor:");
		console.log(plugin.currentMarkdownEditor);
		console.log("editor text:", plugin.currentMarkdownEditor?.getValue());
	}

	function renderObsidianMarkdown(b: StateBlock): Attachment {
		let selectedEvent = () => onBlockSelect(b.columnIndex, b.index);
		return (element: Element) => {
			const container = element as HTMLElement;
			container.replaceChildren();
			const text = b.content[0]!.text;
			if (b.isEdit) {
				container.removeEventListener("pointerup", selectedEvent);
				const m = createEmbeddableMarkdownEditor(
					plugin.app,
					container,
					{
						value: text,
						onEnter: (ed, mod, shift) => {
							if (mod) {
								console.log("in editor?");
								b.isEdit = false;
							}
							return false;
						},
					},
				);
			} else {
				if (!filePath) return;
				// element.replaceChildren();
				container.addEventListener("pointerup", selectedEvent);
				MarkdownRenderer.render(
					plugin.app,
					text,
					container,
					filePath,
					view,
				);
			}
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

	function renderMarkdownEditor(b: StateBlock): Attachment {
		return (container: Element) => {
			container.replaceChildren();
			const m = createEmbeddableMarkdownEditor(
				plugin.app,
				container as HTMLElement,
				{
					value: b.content[0]!.text,
					onEnter: (ed, mod, shift) => {
						if (mod) {
							console.log("in editor?");
							b.isEdit = false;
						}
						return false;
					},
				},
			);
			// return m.destroy;
		};
	}
	function onBlockSelect(columnIndex: number, blockIndex: number) {
		selected.relativePos = { columnIndex, blockIndex };
	}

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
		// const metaDataCache = plugin.app.metadataCache.getFileCache(
		// 	plugin.currentFile!,
		// );
		// cache = metaDataCache;
		// const c = Effect.log(
		// 	"Metadata Cache for current file:",
		// 	JSON.stringify(metaDataCache, null, 2),
		// );
		// Effect.runPromise(c.pipe(Effect.provide(Logger.structured)));
		// console.dir(metaDataCache);
	});
</script>

<!-- <CodeMirror
	bind:value={plugin.currentMarkdownDoc}
	extensions={[
		// Adds support for the Markdown language
		markdown({
			extensions: [
				// GitHub Flavored Markdown (support for autolinks, strikethroughs)
				GFM,
				// additional parsing tags for existing markdown features, backslash escapes, emojis
				prosemarkMarkdownSyntaxExtensions,
				// html block continuation parsing for rendered HTML widgets
				renderHtmlMarkdownSyntaxExtensions,
			],
		}),
		// Basic prosemark extensions
		prosemarkBasicSetup(),
		// Theme extensions
		prosemarkBaseThemeSetup(),
		// Render HTML blocks
		htmlBlockExtension,
	]}
/> -->
<div class="mindmapmd-theme">
	<div class="grid grid-flow-col gap-10 overflow-auto">
		{#each blockView as blockGroup, columnIndex}
			<div
				class={`h-screen overflow-y-auto p-10 min-w-100 ${mdc("column")}`}
				style="overflow-anchor: none;"
			>
				<VirtualColumn column={blockGroup}>
					{#snippet children(block, i)}
						<!-- <BlockEditor {block}> -->
						<!-- {#snippet preview()} -->
						<!-- <div> -->
						<!-- {#if !block.isEdit} -->
						<div
							role="treeitem"
							aria-selected={block.state !== fork}
							tabindex="0"
							onkeypress={(e) => {
								if (e.key === "Enter") {
									console.log("on preview key press", e.key);
									block.isEdit = true;
								}
							}}
							// onpointerup={() => onBlockSelect(columnIndex, i)}
							{@attach renderObsidianMarkdown(block)}
							class={`min-w-80 rounded-lg p-4 text-card-foreground shadow-sm ${mdc(block.state)} bg-card my-3`}
						></div>
						<!-- {/snippet} -->
						<!-- {:else} -->
						<!-- {#snippet edit()} -->
						<!-- <div
									{@attach renderMarkdownEditor(block)}
								></div> -->
						<!-- {/snippet} -->
						<!-- {/if} -->
						<!-- </div> -->
						<!-- </BlockEditor> -->
					{/snippet}
				</VirtualColumn>
			</div>
		{/each}
	</div>
</div>

<!-- <div class="flex flex-col gap-3">
				<h1>select index: {blockGroup.centerBlockIndex}</h1>
				{#each blockGroup.blocks as block, blockIndex}
					<BlockEditor {block} {plugin} {view} {filePath}>
						{#snippet preview()}
							<div
								role="treeitem"
								aria-selected={block.state !== fork}
								tabindex="0"
								onpointerdown={() =>
									onBlockSelect(columnIndex, blockIndex)}
								{@attach renderObsidianMarkdown(
									block.content[0]!.text,
								)}
								class={`min-w-75 rounded-lg p-4 text-card-foreground shadow-sm ${mdc(block.state)} bg-card`}
							></div>
						{/snippet}
					</BlockEditor>
				{/each}
			</div> -->
