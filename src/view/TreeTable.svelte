<script lang="ts">
	import { MarkdownRenderer, setIcon, type App, type Component } from "obsidian";
	import type { Attachment } from "svelte/attachments";
	import type { HeadingTree, ListItemTree } from "./tree";

	interface Props {
		root: HeadingTree;
		app: App;
		sourcePath: string;
		component: Component;
	}

	let { root, app, sourcePath, component }: Props = $props();

	const MIN_ZOOM = 0.1;
	const MAX_ZOOM = 5;
	const ZOOM_STEP = 0.01;
	let zoom = $state(1);
	let viewport: HTMLElement;
	let panX = $state(0);
	let panY = $state(0);
	let isPanning = $state(false);
	let pointerStartX = 0;
	let pointerStartY = 0;
	let panStartX = 0;
	let panStartY = 0;

	function setZoom(value: number): number {
		zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 10) / 10));
		return zoom;
	}

	function zoomAtPoint(value: number, clientX: number, clientY: number) {
		if (!viewport) {
			setZoom(value);
			return;
		}

		const bounds = viewport.getBoundingClientRect();
		const localX = clientX - bounds.left;
		const localY = clientY - bounds.top;
		const contentX = (localX - panX) / zoom;
		const contentY = (localY - panY) / zoom;
		const nextZoom = setZoom(value);

		requestAnimationFrame(() => {
			panX = localX - contentX * nextZoom;
			panY = localY - contentY * nextZoom;
		});
	}

	function handleWheel(event: WheelEvent) {
		if (!event.ctrlKey) {
			const horizontalDelta = event.deltaX || (event.shiftKey ? event.deltaY : 0);
			if (horizontalDelta === 0) return;
			event.preventDefault();
			panX -= horizontalDelta;
			return;
		}
		event.preventDefault();
		zoomAtPoint(zoom + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP), event.clientX, event.clientY);
	}

	function zoomFromToolbar(value: number) {
		const bounds = viewport.getBoundingClientRect();
		zoomAtPoint(value, bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
	}

	function handlePointerDown(event: PointerEvent) {
		if (event.button !== 0 && event.button !== 1) return;
		event.preventDefault();
		isPanning = true;
		pointerStartX = event.clientX;
		pointerStartY = event.clientY;
		panStartX = panX;
		panStartY = panY;
		viewport.setPointerCapture(event.pointerId);
	}

	function handlePointerMove(event: PointerEvent) {
		if (!isPanning) return;
		panX = panStartX + event.clientX - pointerStartX;
		panY = panStartY + event.clientY - pointerStartY;
	}

	function handlePointerUp(event: PointerEvent) {
		if (!isPanning) return;
		isPanning = false;
		viewport.releasePointerCapture(event.pointerId);
	}

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

	function renderIcon(iconName: string): Attachment<HTMLElement> {
		return (element) => {
			element.replaceChildren();
			setIcon(element, iconName);
		};
	}
</script>


<div class="tree-table-container">
	<div class="tree-table-toolbar" aria-label="Tree table zoom controls">
		<button type="button" aria-label="Zoom out" title="Zoom out" disabled={zoom <= MIN_ZOOM} onclick={() => zoomFromToolbar(zoom - ZOOM_STEP)}>
			<span class="toolbar-icon" {@attach renderIcon("minus")}></span>
		</button>
		<button type="button" class="zoom-value" aria-label="Reset zoom" title="Reset zoom" onclick={() => zoomFromToolbar(1)}>
			{Math.round(zoom * 100)}%
		</button>
		<button type="button" aria-label="Zoom in" title="Zoom in" disabled={zoom >= MAX_ZOOM} onclick={() => zoomFromToolbar(zoom + ZOOM_STEP)}>
			<span class="toolbar-icon" {@attach renderIcon("plus")}></span>
		</button>
		<button type="button" class="reset-zoom" aria-label="Reset zoom" title="Reset zoom" disabled={zoom === 1} onclick={() => zoomFromToolbar(1)}>
			<span class="toolbar-icon" {@attach renderIcon("rotate-ccw")}></span>
		</button>
	</div>
	<div
		class="tree-table-viewport"
		class:panning={isPanning}
		role="application"
		aria-label="Tree table canvas"
		bind:this={viewport}
		onwheel={handleWheel}
		onpointerdown={handlePointerDown}
		onpointermove={handlePointerMove}
		onpointerup={handlePointerUp}
		onpointercancel={handlePointerUp}
	>
		<div class="tree-table" style="--zoom: {zoom}; --pan-x: {panX}px; --pan-y: {panY}px; grid-template-columns: repeat({columns}, minmax(0, 1fr));">
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
	</div>
</div>

<style>
	.tree-table-container {
		position: relative;
		width: 100%;
	}
	.tree-table-toolbar {
		position: sticky;
		top: 0;
		z-index: 1;
		display: flex;
		justify-content: flex-end;
		gap: 4px;
		padding: 6px;
		background-color: var(--background-primary);
		border-bottom: 1px solid var(--background-modifier-border);
	}
	.tree-table-toolbar button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 28px;
		height: 28px;
		padding: 0 6px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		background: var(--background-secondary);
		color: var(--text-normal);
		cursor: pointer;
	}
	.tree-table-toolbar button:hover:not(:disabled) {
		background: var(--background-modifier-hover);
	}
	.tree-table-toolbar button:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.tree-table-toolbar .zoom-value {
		min-width: 52px;
	}
	.toolbar-icon {
		display: inline-flex;
		width: 16px;
		height: 16px;
	}
	.tree-table-toolbar .reset-zoom {
		margin-left: 4px;
	}
	.tree-table-viewport {
		position: relative;
		height: 100%;
		min-height: 320px;
		overflow: hidden;
		max-width: 100%;
		cursor: grab;
		touch-action: none;
		user-select: none;
	}
	.tree-table-viewport.panning {
		cursor: grabbing;
	}
	.tree-table {
		display: grid;
		width: 100%;
		transform: translate3d(var(--pan-x), var(--pan-y), 0) scale3d(var(--zoom), var(--zoom), 1);
		transform-origin: top left;
		gap: 0;
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
		box-sizing: border-box;
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
