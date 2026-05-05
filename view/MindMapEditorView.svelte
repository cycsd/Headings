<script lang="ts">
	import { onMount } from "svelte";
	import MindMapMdPlugin from "../src/main";
	import {
		MarkdownRenderer,
		type CachedMetadata,
		type TFile,
	} from "obsidian";
	import { Console, Data, Effect, Logger } from "effect";
	import { json } from "stream/consumers";
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
	import Block from "./block.svelte";

	import type { MindMapMdView } from "./MindMapMdView";
	import type { ComponentState, Position, Selected } from "./MindMapMd";
	import type { Attachment } from "svelte/attachments";

	interface Props {
		startCount: number;
		plugin: MindMapMdPlugin;
		view: MindMapMdView;
	}

	let { startCount, plugin, view }: Props = $props();

	let count = $state(startCount);

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
	let blockView = $derived.by<StateBlock[][]>(() => {
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
						};
						return state_block;
					}) ?? [];
				collect.push(column);
				const selected = column.find((b) => b.id === target);
				return Data.tuple(collect, {
					target: selected?.parentId ?? "",
					state: road,
				});
			},
			Data.tuple(
				[] as StateBlock[][],
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
						};
						return state_block;
					}) ?? [];
				collect.push(column);

				return Data.tuple(collect, {
					parents: next_parents,
					state: path,
				});
			},
			Data.tuple([] as StateBlock[][], {
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

	function renderObsidianMarkdown(content: string): Attachment {
		return (element: HTMLElement) => {
			if (!filePath) return;
			element.replaceChildren();
			MarkdownRenderer.render(
				plugin.app,
				content,
				element,
				filePath,
				view,
			);
		};
	}

	function onBlockSelect(columnIndex: number, blockIndex: number) {
		selected.relativePos = { columnIndex, blockIndex };
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
<div class="mindmapmd-theme flex min-h-full flex-col gap-4 p-4 text-sm">
	<!-- <div class="number rounded-md bg-muted px-3 py-2 text-muted-foreground">
		<span>My number is {count}!</span>
	</div> -->

	<!-- <button class="inline-flex w-fit rounded-md bg-primary px-3 py-2 text-primary-foreground" onclick={logEditor}>Decrement</button> -->
	<div class="flex gap-5 overflow-x-auto">
		{#each blockView as blockGroup, columnIndex}
			<div class="flex flex-col gap-3">
				{#each blockGroup as block, blockIndex}
					<!-- <div
					style=" border: 1px solid black; margin: 10px; display: flex; align-items: center; justify-content: center;"
				> -->
					<Block {block} {plugin} {view} {filePath}>
						{#snippet preview()}
								<div
								role="treeitem"
								aria-selected={block.state !== fork}
								tabindex="0"
								onpointerdown={() => onBlockSelect(columnIndex, blockIndex)}
									{@attach renderObsidianMarkdown(
										block.content[0]!.text,
									)}
									class={`min-w-75 rounded-lg bg-card p-4 text-card-foreground shadow-sm ${mdc(block.state)}`}
								></div>
						{/snippet}
					</Block>
					<!-- </div> -->
				{/each}
			</div>
		{/each}
	</div>
	<span>{plugin.currentMarkdownDoc}</span>
	<h1 class="text-lg font-semibold">in plugin</h1>
	<span>{plugin.currentMarkdownEditor?.getValue()}</span>
	<pre class="overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(
			cache,
			null,
			2,
		)}</pre>
</div>

<style>
	.number {
		color: red;
	}
</style>
