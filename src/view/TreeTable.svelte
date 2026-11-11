<script lang="ts">
	import PanZoom from "../lib/components/PanZoom.svelte";
	import { treeTableLayout } from "../layout/tree-table";
	import type { LayoutProps } from "./layout-props";
	import { branchStyle } from "./branch-color";
	import TreeNodeBox from "./TreeNodeBox.svelte";

	let { tree, getText, onRenderMarkdown, maxNodeWidth, collapsed }: LayoutProps = $props();

	let placement = $derived(treeTableLayout(tree, { collapsed }));
</script>

<PanZoom minZoom={0.1} maxZoom={5} zoomStep={0.05}>
	{#snippet children()}
		<div class="tree-table" style="grid-template-columns: repeat({placement.columns}, minmax(0, 1fr));">
			<div class="cell header grid-span" style="--col-start: 1; --col-span: {placement.columns}; --row-start: 1; --row-span: 1; {branchStyle(-1)}">
				<TreeNodeBox node={tree} branch={-1} root flat {getText} {onRenderMarkdown} {maxNodeWidth} />
			</div>
			{#each placement.cells as cell (cell.node.id)}
				<div
					class="cell grid-span"
					style="--col-start: {cell.depth + 1}; --col-span: {cell.colSpan}; --row-start: {cell.row + 2}; --row-span: {cell.rowSpan}; {branchStyle(cell.branch)}"
				>
					<TreeNodeBox node={cell.node} branch={cell.branch} flat {getText} {onRenderMarkdown} {maxNodeWidth} />
				</div>
			{/each}
		</div>
	{/snippet}
</PanZoom>

<style>
	.tree-table {
		display: grid;
		width: 100%;
		gap: 0;
	}
	.grid-span {
		grid-column: var(--col-start) / span var(--col-span);
		grid-row: var(--row-start) / span var(--row-span);
	}
	.cell {
		padding: 4px 6px;
		word-break: break-word;
		box-sizing: border-box;
		border: 1px solid var(--branch);
		background-color: color-mix(in srgb, var(--branch) 22%, transparent);
	}
	.cell.header {
		border-color: var(--background-modifier-border);
		background-color: var(--background-secondary);
	}
</style>
