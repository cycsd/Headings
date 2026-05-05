<script lang="ts">
	import type { Attachment } from "svelte/attachments";
	import type { Block, NonStateBlock, Root } from "../util/block_level";
	import { MarkdownRenderer } from "obsidian";
	import type MindMapMdPlugin from "../src/main";
	import type { MindMapMdView } from "./MindMapMdView";
	import type { Snippet } from "svelte";

	type BlockWithParent = Omit<NonStateBlock, "parent"> & {
		parent: BlockWithParent | Root;
	};
	interface Props {
		block: Block//BlockWithParent; //todo Block 暫時;
		plugin: MindMapMdPlugin;
		view: MindMapMdView;
		filePath: string | null;
		preview: Snippet<[]>;
	}
	let { block, plugin, view, filePath, preview }: Props = $props();

</script>

<div>
	{#if preview}
		{@render preview()}
	{/if}
	<span>{block.content[0]!.type}</span>
</div>
