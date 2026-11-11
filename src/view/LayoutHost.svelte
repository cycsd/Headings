<script lang="ts">
	import { setContext } from "svelte";
	import type { HostState } from "./host-state.svelte";
	import type { LayoutProps } from "./layout-props";
	import { getLayout } from "./layout-registry";
	import { createNodeUi, NODE_UI, type NodeActions } from "./node-ui";

	interface Props {
		state: HostState;
		actions: NodeActions;
		getText: LayoutProps["getText"];
		onRenderMarkdown: LayoutProps["onRenderMarkdown"];
	}

	let { state, actions, getText, onRenderMarkdown }: Props = $props();

	// 節點元件透過 context 取得共享狀態與操作，不用一層層傳 props。
	// state 物件本身在 view 的生命週期內不會換，只有欄位會變，所以取初始值即可。
	// svelte-ignore state_referenced_locally
	setContext(NODE_UI, createNodeUi(state, actions));

	let entry = $derived(getLayout(state.layoutId));
</script>

{#if state.tree}
	{#key entry.id}
		{@const Layout = entry.component}
		<Layout tree={state.tree} {getText} {onRenderMarkdown} maxNodeWidth={state.maxNodeWidth} collapsed={state.collapsed} />
	{/key}
{/if}
