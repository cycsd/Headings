<script lang="ts">
	import PanZoom from "../lib/components/PanZoom.svelte";
	import { contentRange, type TreeNode } from "../core/tree";
	import { treeTableLayout } from "../layout/tree-table";
	import type { LayoutProps } from "./layout-props";
	import { branchStyle } from "./branch-color";

	let { tree, getText, onRenderMarkdown }: LayoutProps = $props();

	let placement = $derived(treeTableLayout(tree));

	/** heading 只顯示標題行；升級節點沒有標題，一律顯示全部內容 */
	function titleText(node: TreeNode): string {
		if (node.kind === "listItem") return node.text ?? "";
		return getText(node.range.from, node.range.to);
	}

	function contentText(node: TreeNode): string {
		if (node.kind === "listItem") return node.text ?? "";
		const { from, to } = contentRange(node);
		return getText(from, to);
	}

	/** 只有 heading 類節點有「標題 / 內容」兩種狀態可以切換 */
	function foldable(node: TreeNode): boolean {
		return node.title !== null;
	}
</script>

<PanZoom minZoom={0.1} maxZoom={5} zoomStep={0.05}>
	{#snippet children()}
		<div class="tree-table" style="grid-template-columns: repeat({placement.columns}, minmax(0, 1fr));"
		>
			<div class="cell header grid-span" style="--col-start: 1; --col-span: {placement.columns}; --row-start: 1; --row-span: 1;">
				{tree.title}
			</div>
			{#each placement.cells as cell (cell.node.id)}
			{let fold = $state(true)}
				<div
					role="gridcell"
					tabindex="-1"
					class="cell grid-span"
					style="--col-start: {cell.depth + 1}; --col-span: {cell.colSpan}; --row-start: {cell.row + 2}; --row-span: {cell.rowSpan}; {branchStyle(cell.branch)}"
					onpointerdown={() => { if (foldable(cell.node)) fold = !fold; }}
					{@attach onRenderMarkdown(fold && foldable(cell.node) ? titleText(cell.node) : contentText(cell.node))}
				></div>
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
		padding: 6px 10px;
		align-items: center;
		word-break: break-word;
		box-sizing: border-box;
		border: 1px solid var(--branch);
		background-color: color-mix(in srgb, var(--branch) 22%, transparent);
	}
	.cell.header {
		justify-content: center;
		border-color: var(--background-modifier-border);
		background-color: var(--background-secondary);
		color: var(--text-normal);
		font-weight: 600;
	}
</style>
