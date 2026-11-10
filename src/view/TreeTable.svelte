<script lang="ts">
	import type { Attachment } from "svelte/attachments";
	import PanZoom from "../lib/components/PanZoom.svelte";
	import { contentRange, type TreeNode } from "../core/tree";
	import { treeTableLayout } from "../layout/tree-table";

	interface Props {
		onRenderMarkdown: (text: string) => Attachment<HTMLElement>;
		/** 取出文件 [from, to) 的原文 */
		getText: (from: number, to: number) => string;
	}

	let { onRenderMarkdown, getText }: Props = $props();
	let root: TreeNode | undefined = $state();

	export function refresh(node: TreeNode) {
		root = node;
	}

	let placement = $derived(root ? treeTableLayout(root) : undefined);
	let rootTitle = $derived(root?.title ?? "");

	/** heading 只顯示標題行；升級節點沒有標題，一律顯示全部內容 */
	function titleText(node: TreeNode): string {
		if (node.kind === "listItem") return node.text ?? "";
		if (node.title === null) return getText(node.range.from, node.range.to);
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

{#if placement}
{@const { columns, cells } = placement}
<PanZoom minZoom={0.1} maxZoom={5} zoomStep={0.05}>
	{#snippet children()}
		<div class="tree-table" style="grid-template-columns: repeat({columns}, minmax(0, 1fr));"
		>
			<div class="cell header grid-span" style="--col-start: 1; --col-span: {columns}; --row-start: 1; --row-span: 1;">
				{rootTitle}
			</div>
			{#each cells as cell (cell.node.id)}
			{let fold = $state(true)}
				<div
					role="gridcell"
					tabindex="-1"
					class="cell grid-span depth-{cell.depth % 6}"
					style="--col-start: {cell.depth + 1}; --col-span: {cell.colSpan}; --row-start: {cell.row + 2}; --row-span: {cell.rowSpan};"
					onpointerdown={() => { if (foldable(cell.node)) fold = !fold; }}
					{@attach onRenderMarkdown(fold && foldable(cell.node) ? titleText(cell.node) : contentText(cell.node))}
				></div>
			{/each}
		</div>
	{/snippet}
</PanZoom>
{/if}

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
		border: 1px solid var(--interactive-accent);
	}
	.cell.header {
		justify-content: center;
		background-color: var(--interactive-accent);
		color: var(--text-on-accent);
		font-weight: 600;
	}
</style>
