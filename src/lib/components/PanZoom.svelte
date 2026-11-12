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

	/**
	 * 滾輪落在節點內可捲動的區塊（內容區、過寬的程式碼）時，讓它自己捲，不平移畫布。
	 * 捲到頂或底之後不馬上接手平移：同一段連續滾動（間隔小於 INNER_SCROLL_GRACE）仍然歸該區塊，
	 * 停下來一下再滾才平移畫布。這樣讀內容時不會因為慣性多滾一格就把畫布帶走，又不用把滑鼠移開。
	 */
	const INNER_SCROLL_GRACE = 300;
	/** 在邊界連續滾這麼多次（同一方向）也視為使用者想移動畫布，不用等停頓 */
	const INNER_EDGE_PUSHES = 3;
	let innerWheelAt = -Infinity;
	let edgePushes = 0;

	function innerScrollConsumes(target: EventTarget | null, dx: number, dy: number): boolean {
		let el = target instanceof Element ? target : null;
		while (el && el !== viewport) {
			const style = getComputedStyle(el);
			const scrollsY = /(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight;
			const scrollsX = /(auto|scroll)/.test(style.overflowX) && el.scrollWidth > el.clientWidth;
			if ((scrollsY && dy !== 0) || (scrollsX && dx !== 0)) {
				const now = performance.now();
				const continuous = now - innerWheelAt < INNER_SCROLL_GRACE;
				innerWheelAt = now;

				const atTop = el.scrollTop <= 0;
				const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
				const atLeft = el.scrollLeft <= 0;
				const atRight = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
				const canScrollY = scrollsY && ((dy < 0 && !atTop) || (dy > 0 && !atBottom));
				const canScrollX = scrollsX && ((dx < 0 && !atLeft) || (dx > 0 && !atRight));
				if (canScrollY || canScrollX) {
					edgePushes = 0;
					return true;
				}
				// 已在邊界：同一段連續滾動先吃掉前幾格，多推幾下或停頓後再滾就交給畫布
				edgePushes += 1;
				if (continuous && edgePushes < INNER_EDGE_PUSHES) return true;
				innerWheelAt = -Infinity;
				edgePushes = 0;
				return false;
			}
			el = el.parentElement;
		}
		edgePushes = 0;
		return false;
	}

	/** Svelte 5 的 onwheel 預設是 passive，preventDefault 無效，所以自己掛非 passive 的監聽 */
	function wheelListener(): Attachment<HTMLElement> {
		return (el) => {
			el.addEventListener("wheel", handleWheel, { passive: false });
			return () => el.removeEventListener("wheel", handleWheel);
		};
	}

	/** 滾輪：直接平移；Shift 換成水平；Ctrl 縮放 */
	function handleWheel(event: WheelEvent) {
		if (event.ctrlKey) {
			event.preventDefault();
			zoomAtPoint(zoom + (event.deltaY < 0 ? zoomStep : -zoomStep), event.clientX, event.clientY);
			return;
		}

		let dx = event.deltaX;
		let dy = event.deltaY;
		if (event.shiftKey && dx === 0) {
			dx = dy;
			dy = 0;
		}
		if (dx === 0 && dy === 0) return;
		if (innerScrollConsumes(event.target, dx, dy)) return;

		event.preventDefault();
		panX -= dx;
		panY -= dy;
	}

	function zoomFromToolbar(value: number) {
		const bounds = viewport.getBoundingClientRect();
		zoomAtPoint(value, bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
	}

	/** 單指移動超過這個距離才算拖曳；之前都當作點擊，讓連結與按鈕收得到 click */
	const DRAG_THRESHOLD = 8;
	/** 觸控按下後還沒超過門檻的那根手指：還沒接管，也還沒 capture */
	let pendingTouch: { id: number; x: number; y: number } | null = null;

	function capture(pointerId: number) {
		if (!viewport.hasPointerCapture(pointerId)) viewport.setPointerCapture(pointerId);
	}

	function handlePointerDown(event: PointerEvent) {
		// 滑鼠不拖移畫布（靠滾輪平移），左鍵留給節點裡的文字選取與連結；中鍵保留當備援。
		if (event.pointerType === "mouse") {
			if (event.button !== 1) return;
			event.preventDefault();
			pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
			capture(event.pointerId);
			isPanning = true;
			beginPan(event.clientX, event.clientY);
			return;
		}

		// 觸控 / 手寫筆：第一根手指先不接管，等移動超過門檻才開始平移；第二根手指一出現就直接縮放
		pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		if (pointers.size >= 2) {
			event.preventDefault();
			for (const id of pointers.keys()) capture(id);
			pendingTouch = null;
			isPanning = true;
			beginPinch();
			return;
		}
		pendingTouch = { id: event.pointerId, x: event.clientX, y: event.clientY };
	}

	function handlePointerMove(event: PointerEvent) {
		if (!pointers.has(event.pointerId)) return;
		pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		if (pointers.size >= 2) {
			if (!pinch) beginPinch();
			updatePinch();
			return;
		}
		if (pendingTouch?.id === event.pointerId) {
			if (Math.hypot(event.clientX - pendingTouch.x, event.clientY - pendingTouch.y) < DRAG_THRESHOLD) return;
			// 超過門檻：從按下的位置開始算平移量，畫面不會跳
			const start = pendingTouch;
			pendingTouch = null;
			capture(event.pointerId);
			isPanning = true;
			beginPan(start.x, start.y);
		}
		if (!isPanning) return;
		panX = panStartX + event.clientX - pointerStartX;
		panY = panStartY + event.clientY - pointerStartY;
	}

	function handlePointerUp(event: PointerEvent) {
		if (!pointers.has(event.pointerId)) return;
		pointers.delete(event.pointerId);
		if (pendingTouch?.id === event.pointerId) pendingTouch = null;
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

	/** 還沒 capture 的手指滑出視口時不會收到 pointerup，這裡把它清掉 */
	function handlePointerLeave(event: PointerEvent) {
		if (pendingTouch?.id !== event.pointerId) return;
		pointers.delete(event.pointerId);
		pendingTouch = null;
	}

	/** 讓內容座標 (x, y) 落在視口正中央 */
	export function centerOn(x: number, y: number) {
		if (!viewport) return;
		const bounds = viewport.getBoundingClientRect();
		panX = bounds.width / 2 - x * zoom;
		panY = bounds.height / 2 - y * zoom;
	}

	/** 內容座標整體移動了 (dx, dy) 時呼叫，反向調整平移量，讓畫面上的東西不動 */
	export function shiftContent(dx: number, dy: number) {
		panX -= dx * zoom;
		panY -= dy * zoom;
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
		{@attach wheelListener()}
		onpointerdown={handlePointerDown}
		onpointermove={handlePointerMove}
		onpointerup={handlePointerUp}
		onpointercancel={handlePointerUp}
		onpointerleave={handlePointerLeave}
	>
		<div class="pan-zoom-content" style="--zoom: {zoom}; --pan-x: {panX}px; --pan-y: {panY}px;">
			{@render children()}
		</div>
	</div>
</div>

<style>
	/*
	 * 填滿 view 的內容區，視口吃掉工具列以外的高度；否則視口高度只會等於未縮放的內容高度，平移後就被裁掉。
	 * 父層（view 的 contentEl）是 flex column，所以用 flex: 1 撐滿，不靠 height: 100%。
	 */
	.pan-zoom-container {
		position: relative;
		display: flex;
		flex-direction: column;
		flex: 1 1 auto;
		min-height: 0;
		width: 100%;
		height: 100%;
	}
	.pan-zoom-toolbar {
		flex: none;
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
		flex: 1 1 auto;
		min-height: 0;
		overflow: hidden;
		max-width: 100%;
		/* 滑鼠不拖移，用預設游標，文字可以用滑鼠選取；touch-action: none 是給觸控手勢用的 */
		cursor: default;
		touch-action: none;
	}
	.pan-zoom-viewport.panning {
		cursor: grabbing;
		user-select: none;
	}
	.pan-zoom-content {
		transform: translate3d(var(--pan-x), var(--pan-y), 0) scale3d(var(--zoom), var(--zoom), 1);
		transform-origin: top left;
	}
</style>
