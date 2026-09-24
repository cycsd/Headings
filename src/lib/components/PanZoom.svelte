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

	function setZoom(value: number): number {
		zoom = Math.min(maxZoom, Math.max(minZoom, Math.round(value * 100) / 100));
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
		zoomAtPoint(zoom + (event.deltaY < 0 ? zoomStep : -zoomStep), event.clientX, event.clientY);
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
