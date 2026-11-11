<script lang="ts">
	import { setIcon } from "obsidian";
	import type { Snippet } from "svelte";
	import type { Attachment } from "svelte/attachments";

	interface Props {
		children: Snippet;
		minZoom?: number;
		maxZoom?: number;
		zoomStep?: number;
	}

	let {
		children,
		minZoom = 0.1,
		maxZoom = 5,
		zoomStep = 0.01,
	}: Props = $props();

	let zoom = $state(1);
	let viewport: HTMLElement;
	let panX = $state(0);
	let panY = $state(0);
	let isPanning = $state(false);
	let pointerStartX = 0;
	let pointerStartY = 0;
	let panStartX = 0;
	let panStartY = 0;

	/** 目前按下的指標（滑鼠 / 手指），用來分辨單指平移與雙指縮放 */
	const pointers = new Map<number, { x: number; y: number }>();
	/** 雙指手勢開始時的基準 */
	let pinch: { distance: number; zoom: number; contentX: number; contentY: number } | null = null;

	function setZoom(value: number): number {
		zoom = Math.min(maxZoom, Math.max(minZoom, Math.round(value * 1000) / 1000));
		return zoom;
	}

	function localPoint(clientX: number, clientY: number) {
		const bounds = viewport.getBoundingClientRect();
		return { x: clientX - bounds.left, y: clientY - bounds.top };
	}

	function pinchGeometry() {
		const [a, b] = [...pointers.values()];
		if (!a || !b) return null;
		const mid = localPoint((a.x + b.x) / 2, (a.y + b.y) / 2);
		return { distance: Math.hypot(a.x - b.x, a.y - b.y), midX: mid.x, midY: mid.y };
	}

	function beginPinch() {
		const geometry = pinchGeometry();
		if (!geometry) return;
		pinch = {
			distance: Math.max(geometry.distance, 1),
			zoom,
			// 兩指中點底下的內容座標，縮放時要讓它一直留在中點底下
			contentX: (geometry.midX - panX) / zoom,
			contentY: (geometry.midY - panY) / zoom,
		};
	}

	function updatePinch() {
		const geometry = pinchGeometry();
		if (!pinch || !geometry) return;
		const nextZoom = setZoom(pinch.zoom * (geometry.distance / pinch.distance));
		panX = geometry.midX - pinch.contentX * nextZoom;
		panY = geometry.midY - pinch.contentY * nextZoom;
	}

	/** 單指平移的基準點：開始平移或從雙指退回單指時重設，避免跳動 */
	function beginPan(x: number, y: number) {
		pointerStartX = x;
		pointerStartY = y;
		panStartX = panX;
		panStartY = panY;
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
		zoomAtPoint(zoom + (event.deltaY < 0 ? zoomStep : -zoomStep), event.clientX, event.clientY);
	}

	function zoomFromToolbar(value: number) {
		const bounds = viewport.getBoundingClientRect();
		zoomAtPoint(value, bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
	}

	function handlePointerDown(event: PointerEvent) {
		if (event.pointerType === "mouse" && event.button !== 0 && event.button !== 1) return;
		event.preventDefault();
		pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		viewport.setPointerCapture(event.pointerId);
		isPanning = true;
		if (pointers.size >= 2) {
			beginPinch();
		} else {
			beginPan(event.clientX, event.clientY);
		}
	}

	function handlePointerMove(event: PointerEvent) {
		if (!pointers.has(event.pointerId)) return;
		pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		if (pointers.size >= 2) {
			if (!pinch) beginPinch();
			updatePinch();
			return;
		}
		panX = panStartX + event.clientX - pointerStartX;
		panY = panStartY + event.clientY - pointerStartY;
	}

	function handlePointerUp(event: PointerEvent) {
		if (!pointers.has(event.pointerId)) return;
		pointers.delete(event.pointerId);
		if (viewport.hasPointerCapture(event.pointerId)) {
			viewport.releasePointerCapture(event.pointerId);
		}
		if (pointers.size >= 2) {
			beginPinch();
			return;
		}
		pinch = null;
		const remaining = [...pointers.values()][0];
		if (remaining) {
			beginPan(remaining.x, remaining.y);
		} else {
			isPanning = false;
		}
	}

	function renderIcon(iconName: string): Attachment<HTMLElement> {
		return (element) => {
			element.replaceChildren();
			setIcon(element, iconName);
		};
	}
</script>

<div class="pan-zoom-container">
	<div class="pan-zoom-toolbar" aria-label="Canvas zoom controls">
		<button type="button" aria-label="Zoom out" title="Zoom out" disabled={zoom <= minZoom} onclick={() => zoomFromToolbar(zoom - zoomStep)}>
			<span class="toolbar-icon" {@attach renderIcon("minus")}></span>
		</button>
		<button type="button" class="zoom-value" aria-label="Reset zoom" title="Reset zoom" onclick={() => zoomFromToolbar(1)}>
			{Math.round(zoom * 100)}%
		</button>
		<button type="button" aria-label="Zoom in" title="Zoom in" disabled={zoom >= maxZoom} onclick={() => zoomFromToolbar(zoom + zoomStep)}>
			<span class="toolbar-icon" {@attach renderIcon("plus")}></span>
		</button>
		<button type="button" class="reset-zoom" aria-label="Reset zoom" title="Reset zoom" disabled={zoom === 1} onclick={() => zoomFromToolbar(1)}>
			<span class="toolbar-icon" {@attach renderIcon("rotate-ccw")}></span>
		</button>
	</div>
	<div
		class="pan-zoom-viewport"
		class:panning={isPanning}
		role="application"
		aria-label="Canvas"
		bind:this={viewport}
		onwheel={handleWheel}
		onpointerdown={handlePointerDown}
		onpointermove={handlePointerMove}
		onpointerup={handlePointerUp}
		onpointercancel={handlePointerUp}
	>
		<div class="pan-zoom-content" style="--zoom: {zoom}; --pan-x: {panX}px; --pan-y: {panY}px;">
			{@render children()}
		</div>
	</div>
</div>

<style>
	.pan-zoom-container {
		position: relative;
		width: 100%;
	}
	.pan-zoom-toolbar {
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
	.pan-zoom-toolbar button {
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
	.pan-zoom-toolbar button:hover:not(:disabled) {
		background: var(--background-modifier-hover);
	}
	.pan-zoom-toolbar button:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.pan-zoom-toolbar .zoom-value {
		min-width: 52px;
	}
	.toolbar-icon {
		display: inline-flex;
		width: 16px;
		height: 16px;
	}
	.pan-zoom-toolbar .reset-zoom {
		margin-left: 4px;
	}
	.pan-zoom-viewport {
		position: relative;
		height: 100%;
		min-height: 320px;
		overflow: hidden;
		max-width: 100%;
		cursor: grab;
		touch-action: none;
		user-select: none;
	}
	.pan-zoom-viewport.panning {
		cursor: grabbing;
	}
	.pan-zoom-content {
		transform: translate3d(var(--pan-x), var(--pan-y), 0) scale3d(var(--zoom), var(--zoom), 1);
		transform-origin: top left;
	}
</style>
