<script lang="ts">
	import { MarkdownRenderer, type App, type Component } from "obsidian";
	import type { Attachment } from "svelte/attachments";
	import type { HeadingTree, ListItemTree } from "./tree";

	interface Props {
		root: HeadingTree;
		app: App;
		sourcePath: string;
		component: Component;
	}

	let { root, app, sourcePath, component }: Props = $props();

	type Cell = {
		text: string;
		depth: number;
		row: number;
		rowSpan: number;
		colSpan: number;
	};

	type TreeNode = HeadingTree | ListItemTree;

	function isHeadingTree(node: TreeNode): node is HeadingTree {
		return "heading" in node;
	}

	function nodeLabel(node: TreeNode): string {
		// ListItemTree 目前 createTreeNode 尚未產出，先給予基本顯示文字
		return isHeadingTree(node) ? `${"#".repeat(node.heading.level)}  ${node.heading.heading}` : `- ${node.listItem.id ?? ""}`;
	}

	function nodeChildren(node: TreeNode): TreeNode[] {
		return node.children;
	}

	function countLeaves(node: TreeNode): number {
		const children = nodeChildren(node);
		if (children.length === 0) return 1;
		return children.reduce((sum, child) => sum + countLeaves(child), 0);
	}

	function maxDepth(node: TreeNode, depth = 1): number {
		const children = nodeChildren(node);
		if (children.length === 0) return depth;
		return Math.max(...children.map((child) => maxDepth(child, depth + 1)));
	}

	// 將樹狀結構攤平成一維 cell 清單，每個 cell 用 grid-column/grid-row 的起點與 span 定位，
	// 沒有子節點的 node 則 colSpan 補滿剩餘欄位，讓每一列右側都能對齊到最後一欄
	function buildCells(nodes: TreeNode[], columns: number): Cell[] {
		const cells: Cell[] = [];

		function place(node: TreeNode, depth: number, row: number): number {
			const leaves = countLeaves(node);
			const children = nodeChildren(node);
			const isLeaf = children.length === 0;
			const colSpan = isLeaf ? columns - depth : 1;

			cells.push({ text: nodeLabel(node), depth, row, rowSpan: leaves, colSpan });

			let childRow = row;
			for (const child of children) {
				childRow = place(child, depth + 1, childRow);
			}

			return row + leaves;
		}

		let rowCursor = 0;
		for (const node of nodes) {
			rowCursor = place(node, 0, rowCursor);
		}

		return cells;
	}

	let columns = $derived(
		root.children.length > 0 ? Math.max(...root.children.map((child) => maxDepth(child))) : 1,
	);
	let cells = $derived(buildCells(root.children, columns));

	function renderMarkdown(text: string): Attachment<HTMLElement> {
		return (element) => {
			element.replaceChildren();
			MarkdownRenderer.render(app, text, element, sourcePath, component);
		};
	}
</script>

<div class="tree-table" style="grid-template-columns: repeat({columns}, minmax(0, 1fr));">
	<div class="cell header grid-span" style="--col-start: 1; --col-span: {columns}; --row-start: 1; --row-span: 1;">
		{root.heading.heading}
	</div>
	{#each cells as cell (cell.row + "-" + cell.depth)}
		<div
			class="cell grid-span depth-{cell.depth % 6}"
			style="--col-start: {cell.depth + 1}; --col-span: {cell.colSpan}; --row-start: {cell.row + 2}; --row-span: {cell.rowSpan};"
			{@attach renderMarkdown(cell.text)}
		></div>
	{/each}
</div>

<style>
	.tree-table {
		display: grid;
		width: 100%;
		gap: 1px;
		background-color: var(--background-modifier-border);
	}
	.grid-span {
		grid-column: var(--col-start) / span var(--col-span);
		grid-row: var(--row-start) / span var(--row-span);
	}
	.cell {
		padding: 6px 10px;
		display: flex;
		align-items: center;
		word-break: break-word;
        border: 1px solid var(--interactive-accent);
		/* background-color: var(--background-primary); */
	}
	.cell.header {
		justify-content: center;
		background-color: var(--interactive-accent);
		color: var(--text-on-accent);
		font-weight: 600;
	}
	/* .depth-0 {
		background-color: #c9a86a;
	}
	.depth-1 {
		background-color: #b6a23e;
	}
	.depth-2 {
		background-color: #8fae7e;
	}
	.depth-3 {
		background-color: #eef4ee;
	}
	.depth-4 {
		background-color: #dce7f5;
	}
	.depth-5 {
		background-color: var(--background-secondary);
	} */
</style>
