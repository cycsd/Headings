<script lang="ts">
	import type { Block } from "../util/block_level";
	import type { Snippet } from "svelte";

	interface Props {
		block: Block;
		preview: Snippet<[]>;
	}
	let { block, preview }: Props = $props();
</script>

<div>
	{#if preview}
		{@render preview()}
	{/if}
	<span>{block.content[0]!.type}</span>
</div>
