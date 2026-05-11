<script lang="ts">
	import { toggle } from "effect/HashSet";
	import type { Block } from "../util/block-level";
	import type { Snippet } from "svelte";

	interface Props {
		block: Block;
		preview: Snippet<[]>;
		edit: Snippet<[]>;
	}
	let { block, preview, edit }: Props = $props();

	// let is_edit_mode = $state(false);
	// function escapePreviewMode(event: KeyboardEvent) {
	// 	console.log("key pressed",event.key,event.metaKey,event.ctrlKey);
	// 	if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
	// 		is_edit_mode = false;
	// 	}
	// }
	let isEdit = $derived.by(()=>block.isEdit);
	$effect(()=>console.log("block editor",isEdit,block,block.isEdit));
</script>

{#if isEdit}
		{#if edit}
			{@render edit()}
		{/if}
{:else}
	<div>
		{#if preview}
			{@render preview()}
		{/if}
		<span>{block.content[0]!.type}</span>
	</div>
{/if}
