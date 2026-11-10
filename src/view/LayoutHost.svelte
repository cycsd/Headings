<script lang="ts">
	import type { HostState } from "./host-state.svelte";
	import type { LayoutProps } from "./layout-props";
	import { getLayout } from "./layout-registry";

	interface Props {
		state: HostState;
		getText: LayoutProps["getText"];
		onRenderMarkdown: LayoutProps["onRenderMarkdown"];
	}

	let { state, getText, onRenderMarkdown }: Props = $props();

	let entry = $derived(getLayout(state.layoutId));
</script>

{#if state.tree}
	{#key entry.id}
		{@const Layout = entry.component}
		<Layout tree={state.tree} {getText} {onRenderMarkdown} maxNodeWidth={state.maxNodeWidth} />
	{/key}
{/if}
