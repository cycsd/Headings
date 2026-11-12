<script lang="ts">
	import { getContext } from "svelte";
	import { OUTLINE_BEND, OUTLINE_INDENT, OUTLINE_STEM, outlineLayout } from "../layout/outline";
	import type { LayoutProps } from "./layout-props";
	import { branchStyle } from "./branch-color";
	import { NODE_UI, type NodeUi } from "./node-ui";
	import TreeNodeBox from "./TreeNodeBox.svelte";

	let { tree, getText, onRenderMarkdown, maxNodeWidth, collapsed }: LayoutProps = $props();

	let placement = $derived(outlineLayout(tree, { collapsed }));

	/** 麵包屑選到節點後捲到它；等下一個 frame 讓剛展開的列先渲染出來 */
	const ui = getContext<NodeUi>(NODE_UI);
	let container: HTMLElement | undefined = $state();
	$effect(() => {
		const request = ui.state.reveal;
		if (!request) return;
		const frame = requestAnimationFrame(() => {
			container?.querySelector(`[data-node-id="${CSS.escape(request.id)}"]`)?.scrollIntoView({ block: "center" });
		});
		return () => cancelAnimationFrame(frame);
	});
</script>

<div class="outline" bind:this={container} style="--indent: {OUTLINE_INDENT}px; --stem: {OUTLINE_STEM}px; --bend: {OUTLINE_BEND}px;">
	{#each placement.rows as row (row.node.id)}
		<div class="row" style={branchStyle(row.branch)}>
			{#each row.trunks as trunk, i (i)}
				<div class="col" class:trunk></div>
			{/each}
			{#if row.depth > 0}
				<div class="col elbow" class:continue={!row.isLast}></div>
			{/if}
			<div class="box">
				<TreeNodeBox node={row.node} branch={row.branch} root={row.depth === 0} {getText} {onRenderMarkdown} {maxNodeWidth} />
			</div>
		</div>
	{/each}
</div>

<style>
	/* 父層是 flex column，大綱自己捲動 */
	.outline {
		flex: 1 1 auto;
		min-height: 0;
		padding: 8px 12px;
		overflow: auto;
	}
	.row {
		display: flex;
		align-items: stretch;
	}
	.col {
		position: relative;
		flex: none;
		width: var(--indent);
	}
	/* 祖先那一欄還有後續兄弟：畫一條通過整列的垂直主幹 */
	.col.trunk::before {
		content: "";
		position: absolute;
		left: var(--stem);
		top: 0;
		bottom: 0;
		border-left: 1.5px solid var(--branch);
	}
	/* 自己這一欄：從上方垂直下來，在節點中線轉彎接到節點左緣 */
	.col.elbow::before {
		content: "";
		position: absolute;
		left: var(--stem);
		top: 0;
		height: 50%;
		right: 0;
		border-left: 1.5px solid var(--branch);
		border-bottom: 1.5px solid var(--branch);
		border-bottom-left-radius: var(--bend);
	}
	/* 不是最後一個兄弟：主幹繼續往下 */
	.col.elbow.continue::after {
		content: "";
		position: absolute;
		left: var(--stem);
		top: 50%;
		bottom: 0;
		border-left: 1.5px solid var(--branch);
	}
	.box {
		padding: 3px 0;
		min-width: 0;
	}
</style>
