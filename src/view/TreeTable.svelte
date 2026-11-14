<script lang="ts">
	import PanZoom from "../lib/components/PanZoom.svelte";
	import { treeTableLayout } from "../layout/tree-table";
	import type { LayoutProps } from "./layout-props";
	import { branchStyle } from "./branch-color";
	import TreeNodeBox from "./TreeNodeBox.svelte";
	import { getContext } from "svelte";
	import { NODE_UI, type NodeUi } from "./node-ui";
	import { edgePan, refreshDropTarget } from "./node-drag";

	let { tree, getText, onRenderMarkdown, maxNodeWidth, collapsed }: LayoutProps = $props();

	/* cell 的邊框與背景跟 TreeNodeBox 一樣依設定決定要不要套分支顏色 */
	const ui = getContext<NodeUi>(NODE_UI);

	let placement = $derived(treeTableLayout(tree, { collapsed }));

	/** 麵包屑選到節點後把 cell 置中；等下一個 frame 讓剛展開的 cell 先渲染出來 */
	let panZoom: ReturnType<typeof PanZoom> | undefined = $state();
	let grid: HTMLElement | undefined = $state();
	$effect(() => {
		const request = ui.state.reveal;
		if (!request) return;
		const frame = requestAnimationFrame(() => {
			const el = grid?.querySelector(`[data-node-id="${CSS.escape(request.id)}"]`);
			if (!el) return;
			if (request.mode === "ensure") panZoom?.ensureVisible(el);
			else panZoom?.centerOnElement(el);
		});
		return () => cancelAnimationFrame(frame);
	});
	/** 拖曳靠近視口邊緣時自動平移；平移後游標底下的節點換了，要重算落點 */
	$effect(() => {
		if (!ui.state.drag) return;
		let frame = 0;
		const tick = () => {
			const drag = ui.state.drag;
			const rect = panZoom?.viewportRect();
			if (drag && rect) {
				const [dx, dy] = edgePan(drag.x, drag.y, rect);
				if (dx !== 0 || dy !== 0) {
					panZoom?.panBy(dx, dy);
					refreshDropTarget(ui.state, [dx, dy]);
				}
			}
			frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	});

</script>

<PanZoom bind:this={panZoom} minZoom={0.1} maxZoom={5} zoomStep={0.05}>
	{#snippet children()}
		<div class="tree-table" bind:this={grid} style="grid-template-columns: repeat({placement.columns}, minmax(0, 1fr));">
			<div class="cell header grid-span" style="--col-start: 1; --col-span: {placement.columns}; --row-start: 1; --row-span: 1; {branchStyle(-1)}">
				<TreeNodeBox node={tree} branch={-1} root flat {getText} {onRenderMarkdown} {maxNodeWidth} />
			</div>
			{#each placement.cells as cell (cell.node.id)}
				<div
					class="cell grid-span"
					class:branch-border={ui.state.branchBorder}
					class:branch-bg={ui.state.branchBackground}
					style="--col-start: {cell.depth + 1}; --col-span: {cell.colSpan}; --row-start: {cell.row + 2}; --row-span: {cell.rowSpan}; {branchStyle(cell.branch)}"
				>
					<TreeNodeBox node={cell.node} branch={cell.branch} flat handleSide="right" {getText} {onRenderMarkdown} {maxNodeWidth} />
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
		border: 1px solid var(--background-modifier-border);
		background-color: var(--background-primary);
	}
	.cell.branch-border {
		border-color: var(--branch);
	}
	.cell.branch-bg {
		background-color: color-mix(in srgb, var(--branch) 22%, transparent);
	}
	.cell.header {
		border-color: var(--background-modifier-border);
		background-color: var(--background-secondary);
	}
</style>
