<script lang="ts">
	import { onMount } from "svelte";
	import MindMapMdPlugin from "../src/main";
	import type { CachedMetadata, TFile } from "obsidian";
	import { Console, Effect, Logger } from "effect";
	import { json } from "stream/consumers";
	import {
		parseCacheMetadata2Content,
		parseContent2Blocks,
	} from "../util/parse";
	import {
		type BlockView,
		type Position,
		type Root,
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
	import type { ComponentState } from "./MindMapMd";

	interface Props {
		startCount: number;
		plugin: MindMapMdPlugin;
		view: MindMapMdView;
	}



	let { startCount, plugin, view }: Props = $props();

	let count = $state(startCount);

	let cache = $state<CachedMetadata | null>(null);
	let doc = $state<string|null>(null);
	let filePath = $state<string|null>(null);
	let root: Root = {
		id: "root",
		fileName: "",
	};
	let blocks = $derived.by(() => {
		if (!cache || !doc) return [];
		const contents = parseCacheMetadata2Content(
			cache,
			doc,
		);
		const blockGroup = parseContent2Blocks(contents, root);
		return blockGroup;
	});
	let rootEdit = $derived(root);
	let selectedPosition = $state<Position>({
		columnIndex: 0,
		blockIndex: 0,
	});
	let blockView = $state<BlockView>([]);
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
<div class="number">
	<span>My number is {count}!</span>
</div>

<button onclick={logEditor}>Decrement</button>
<div style="display: flex; gap: 20px;">
	{#each blocks as blockGroup, columnIndex}
		<div
			style="display: flex; flex-direction: column;"
		>
			{#each blockGroup as block, blockIndex}
				<div
					style=" border: 1px solid black; margin: 10px; display: flex; align-items: center; justify-content: center;"
				>
					<Block {block} {plugin} {view} {filePath}></Block>
				</div>
			{/each}
		</div>
	{/each}
</div>
<span>{plugin.currentMarkdownDoc}</span>
<h1>in plugin</h1>
<span>{plugin.currentMarkdownEditor?.getValue()}</span>
<pre>{JSON.stringify(cache, null, 2)}</pre>

<style>
	.number {
		color: red;
	}
</style>
