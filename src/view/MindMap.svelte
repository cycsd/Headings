<script lang="ts">
	import { SvelteMap } from "svelte/reactivity";
	import type { Attachment } from "svelte/attachments";
	import PanZoom from "../lib/components/PanZoom.svelte";
	import { mindmapLayout, type Size } from "../layout/mindmap";
	import type { LayoutProps } from "./layout-props";
	import { branchStyle } from "./branch-color";
	import TreeNodeBox from "./TreeNodeBox.svelte";

	let { tree, getText, onRenderMarkdown, maxNodeWidth, collapsed }: LayoutProps = $props();

	/** 量測到的節點尺寸；第一次渲染用預設尺寸，ResizeObserver 回報後重排 */
	const sizes = new SvelteMap<string, Size>();
	let placement = $derived(mindmapLayout(tree, { sizes, collapsed }));

	function measure(id: string): Attachment<HTMLElement> {
		return (el) => {
			const report = () => {
				// offsetWidth / offsetHeight 不受 PanZoom 的 transform 影響
				const w = el.offsetWidth;
				const h = el.offsetHeight;
				if (w === 0 && h === 0) return;
				const prev = sizes.get(id);
				if (prev && Math.abs(prev.w - w) < 1 && Math.abs(prev.h - h) < 1) return;
				sizes.set(id, { w, h });
			};
			const observer = new ResizeObserver(report);
			observer.observe(el);
			report();
			return () => observer.disconnect();
		};
	}
</script>

<PanZoom minZoom={0.1} maxZoom={5} zoomStep={0.05}>
	{#snippet children()}
		<div class="mindmap" style="width: {placement.width}px; height: {placement.height}px;">
			<svg class="edges" width={placement.width} height={placement.height} viewBox="0 0 {placement.width} {placement.height}">
				{#each placement.edges as edge (edge.from + ">" + edge.to)}
					<path d={edge.path} style={branchStyle(edge.branch)} />
				{/each}
			</svg>
			{#each placement.nodes as placed (placed.node.id)}
				<div class="placed" style="left: {placed.x}px; top: {placed.y}px;" {@attach measure(placed.node.id)}>
					<TreeNodeBox node={placed.node} branch={placed.branch} root={placed.depth === 0} {getText} {onRenderMarkdown} {maxNodeWidth} />
				</div>
			{/each}
		</div>
	{/snippet}
</PanZoom>

<style>
	.mindmap {
		position: relative;
	}
	.edges {
		position: absolute;
		inset: 0;
		overflow: visible;
		pointer-events: none;
	}
	.edges path {
		fill: none;
		stroke: var(--branch);
		stroke-width: 1.5;
	}
	.placed {
		position: absolute;
		width: max-content;
	}
</style>
