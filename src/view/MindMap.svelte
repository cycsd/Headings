<script lang="ts">
	import { getContext, untrack } from "svelte";
	import { NODE_UI, type NodeUi } from "./node-ui";
	import { edgePan, refreshDropTarget } from "./node-drag";
	import { SvelteMap } from "svelte/reactivity";
	import type { Attachment } from "svelte/attachments";
	import PanZoom from "../lib/components/PanZoom.svelte";
	import { mindmapLayout, type PlacedNode, type Side, type Size } from "../layout/mindmap";
	import type { LayoutProps } from "./layout-props";
	import { branchStyle } from "./branch-color";
	import TreeNodeBox from "./TreeNodeBox.svelte";

	let { tree, getText, onRenderMarkdown, maxNodeWidth, collapsed }: LayoutProps = $props();
	const ui = getContext<NodeUi>(NODE_UI);

	/** 量測到的節點尺寸；第一次渲染用預設尺寸，ResizeObserver 回報後重排 */
	const sizes = new SvelteMap<string, Size>();
	/** 拖曳中固定根的直接子節點左右分配：拖曳開始時記下來，結束就放掉；不然佔位塞進去會讓分支跳邊 */
	let frozenSides: ReadonlyMap<string, Side> | undefined = $state();
	let placement = $derived(mindmapLayout(tree, { sizes, collapsed, sides: frozenSides, direction: ui.state.mindmapDirection }));

	/**
	 * 所有節點共用一個 ResizeObserver，回報先收進 pending，
	 * 下一個 animation frame 一次寫進 sizes，所以不管幾個節點變大小，每個 frame 最多重排一次。
	 */
	const idOf = new WeakMap<Element, string>();
	const pending = new Map<string, Size>();
	let frame: number | null = null;

	function flush() {
		frame = null;
		for (const [id, size] of pending) {
			const prev = sizes.get(id);
			if (prev && Math.abs(prev.w - size.w) < 1 && Math.abs(prev.h - size.h) < 1) continue;
			sizes.set(id, size);
		}
		pending.clear();
	}

	const observer = new ResizeObserver((entries) => {
		for (const entry of entries) {
			const id = idOf.get(entry.target);
			if (id === undefined) continue;
			// border-box 尺寸就是 layout 尺寸，不受 PanZoom 的 transform 影響
			const box = entry.borderBoxSize?.[0];
			const el = entry.target as HTMLElement;
			const w = box ? box.inlineSize : el.offsetWidth;
			const h = box ? box.blockSize : el.offsetHeight;
			if (w === 0 && h === 0) continue;
			pending.set(id, { w, h });
		}
		if (pending.size > 0 && frame === null) {
			frame = requestAnimationFrame(flush);
		}
	});

	$effect(() => () => {
		observer.disconnect();
		if (frame !== null) cancelAnimationFrame(frame);
	});

	/**
	 * 佈局每次都把整張圖平移到留白處，節點的畫布座標會隨子樹大小變動。螢幕上保持不動的參考點（錨點）：
	 * 平常是根節點中心；編輯中是編輯節點靠根那一側的上角，它變大、兄弟讓位時使用者盯著的角落不跑；
	 * 離開編輯後的第一次重排也沿用它。第一次佈局把根節點置中；錨點換人時只記新位置、不平移。
	 */
	let panZoom: ReturnType<typeof PanZoom> | undefined = $state();
	let anchorPrev: { id: string; x: number; y: number } | null = null;
	let lastEditing: string | null = null;
	let lastPlacement: typeof placement | null = null;

	/** 方向換了（雙向 ↔ 只往右）整張圖重排，當成第一次佈局重新擺放根節點；要宣告在錨點 effect 之前才會先跑 */
	$effect(() => {
		void ui.state.mindmapDirection;
		anchorPrev = null;
	});

	/** 第一次佈局：雙向把根置中；只往右時根靠左（左緣在視口 10% 處）、垂直置中，右邊才有空間長 */
	const placeRoot = (pz: NonNullable<typeof panZoom>, root: PlacedNode) => {
		if (ui.state.mindmapDirection === "right") pz.positionAt(root.x, root.y + root.h / 2, 0.1, 0.5);
		else pz.centerOn(root.x + root.w / 2, root.y + root.h / 2);
	};

	const anchorPoint = (placed: PlacedNode): { x: number; y: number } =>
		placed.depth === 0
			? { x: placed.x + placed.w / 2, y: placed.y + placed.h / 2 }
			: { x: placed.side === -1 ? placed.x + placed.w : placed.x, y: placed.y };

	$effect(() => {
		const nodes = placement.nodes;
		const pz = panZoom;
		const editingId = ui.state.editingId;
		if (nodes.length === 0 || !pz) return;
		untrack(() => {
			const changed = placement !== lastPlacement;
			lastPlacement = placement;
			if (editingId !== null) lastEditing = editingId;
			const wanted = editingId ?? lastEditing ?? nodes[0]!.node.id;
			const placed = nodes.find((n) => n.node.id === wanted) ?? nodes[0]!;
			const point = anchorPoint(placed);
			const prev = anchorPrev;
			anchorPrev = { id: placed.node.id, ...point };
			if (prev === null) placeRoot(pz, nodes[0]!);
			else if (prev.id === placed.node.id && (prev.x !== point.x || prev.y !== point.y)) pz.shiftContent(point.x - prev.x, point.y - prev.y);
			// 離開編輯後處理完一次重排就把錨點還給根（編輯前後尺寸一樣時沒有重排，會留到下一次佈局變動才還）
			if (editingId === null && changed) lastEditing = null;
		});
	});

	/**
	 * 麵包屑選到節點後把它置中。等下一個 frame 再做：收合狀態剛改完，新展開的節點要先量過尺寸、
	 * 錨點補償也要先跑完，置中才不會被蓋掉。
	 */
	let canvas: HTMLElement | undefined = $state();
	$effect(() => {
		const request = ui.state.reveal;
		if (!request) return;
		const frame = requestAnimationFrame(() => {
			const el = canvas?.querySelector(`[data-node-id="${CSS.escape(request.id)}"]`);
			if (!el) return;
			if (request.mode === "ensure") panZoom?.ensureVisible(el);
			else panZoom?.centerOnElement(el);
		});
		return () => cancelAnimationFrame(frame);
	});

	$effect(() => {
		if (!ui.state.drag) {
			frozenSides = undefined;
			return;
		}
		if (frozenSides) return;
		frozenSides = untrack(() => new Map(placement.nodes.filter((n) => n.depth === 1).map((n) => [n.node.id, n.side])));
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

	/**
	 * observe 時 ResizeObserver 會先回報一次初始尺寸，不用另外量。
	 * attachment 依 id 快取：每次 placement 重算都給新的函式的話，Svelte 會把每個節點 unobserve 再 observe 一輪，
	 * 全部節點重新回報初始尺寸，編輯中節點每長高一次就是一場風暴。
	 */
	const attachments = new Map<string, Attachment<HTMLElement>>();
	function measure(id: string): Attachment<HTMLElement> {
		let attachment = attachments.get(id);
		if (!attachment) {
			attachment = (el) => {
				idOf.set(el, id);
				observer.observe(el);
				return () => {
					observer.unobserve(el);
					idOf.delete(el);
					pending.delete(id);
					attachments.delete(id);
				};
			};
			attachments.set(id, attachment);
		}
		return attachment;
	}
</script>

<PanZoom bind:this={panZoom} minZoom={0.1} maxZoom={5} zoomStep={0.05}>
	{#snippet children()}
		<div class="mindmap" class:dragging={ui.state.drag !== null} bind:this={canvas} style="width: {placement.width}px; height: {placement.height}px;">
			<svg class="edges" width={placement.width} height={placement.height} viewBox="0 0 {placement.width} {placement.height}">
				{#each placement.edges as edge (edge.from + ">" + edge.to)}
					<path d={edge.path} style={branchStyle(edge.branch)} />
				{/each}
			</svg>
			{#each placement.nodes as placed (placed.node.id)}
				<div class="placed" style="left: {placed.x}px; top: {placed.y}px;" {@attach measure(placed.node.id)}>
					<TreeNodeBox
						node={placed.node}
						branch={placed.branch}
						root={placed.depth === 0}
						handleSide={placed.depth === 0 ? "none" : placed.side === 1 ? "right" : "left"}
						{getText}
						{onRenderMarkdown}
						{maxNodeWidth}
					/>
				</div>
			{/each}
		</div>
	{/snippet}
</PanZoom>

<style>
	.mindmap {
		position: relative;
	}
	/* 拖曳落點預覽時其他節點讓出空間，加一點過渡才不會跳；平常不加，量測重排才跟手 */
	.mindmap.dragging .placed {
		transition: left 120ms ease, top 120ms ease;
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
