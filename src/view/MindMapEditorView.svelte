<script lang="ts">
	import { onMount } from "svelte";
	import MindMapMdPlugin from "../main";
	import { MarkdownRenderer } from "obsidian";
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
	} from "../util/block_level";
	import { range } from "effect/Array";
	import type { MindMapMdView } from "./MindMapMdView";
	import type { ComponentState, Position, Selected } from "./MindMapMd";
	import type { Attachment } from "svelte/attachments";
	import VirtualColumn from "./VirtualColumn.svelte";
	import { createEmbeddableMarkdownEditor } from "../extension/obsidian-markdown-editor";

	interface Props {
		plugin: MindMapMdPlugin;
		view: MindMapMdView;
	}

	let { plugin, view }: Props = $props();

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

		setBlockViewBreadCrumbs(blockView, selectedPosition);
	}

	function renderObsidianMarkdown(b: StateBlock): Attachment {
		// let selectedEvent = () => onBlockSelect(b.columnIndex, b.index);
		return (element: Element) => {
			const container = element as HTMLElement;
			container.replaceChildren();
			const text = b.content[0]!.text;
			if (!filePath) return;
			if(b.state === fork){
				container.focus();
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

	function renderMarkdownEditor(b: StateBlock): Attachment {
		return (container: Element) => {
			container.replaceChildren();
			const value = b.content[0]!.text;
			const m = createEmbeddableMarkdownEditor(
				plugin.app,
				container as HTMLElement,
				{
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
				},
			);

			// return m.destroy;
		};
	}
	function onBlockSelect(columnIndex: number, blockIndex: number) {
		selected.relativePos = { columnIndex, blockIndex };
		setBlockViewBreadCrumbs(blockView, selectedPosition);
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

	onMount(() => {});
</script>

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
