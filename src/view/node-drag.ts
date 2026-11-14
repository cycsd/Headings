import type { TreeNode } from "../core/tree";
import { canMove } from "../core/edit";
import { findNode } from "../core/tree-ops";
import type { HostState } from "./host-state.svelte";

/** 單指 / 滑鼠移動超過這個距離才算拖曳，之前放開仍是點擊 */
const DRAG_THRESHOLD = 8;
/** 小影子：節點複製品的縮放倍率、最大高度與相對游標的偏移（螢幕像素） */
const GHOST_SCALE = 0.6;
const GHOST_MAX_HEIGHT = 240;
const GHOST_OFFSET = 12;

/**
 * 節點拖曳：從節點標題列按下，移動超過門檻後開始。
 * - 拖的是節點本身：把節點 DOM 複製一份固定在螢幕上跟著游標走，原本的節點變成虛線佔位；
 *   複製品不受 PanZoom 的縮放與平移影響，自動平移時也不會跑掉。
 * - 游標下的節點若是合法目標就記在 state.drag.overId，LayoutHost 據此畫落點預覽；放開時搬過去。
 * - Esc 取消。只處理滑鼠左鍵與手寫筆；觸控的單指已經給平移用了。
 */
export function startNodeDrag(state: HostState, source: TreeNode, evt: PointerEvent, onDrop: (sourceId: string, targetId: string) => void) {
	if (evt.pointerType === "touch" || (evt.pointerType === "mouse" && evt.button !== 0)) return;
	if (source.kind === "root" || state.editingId !== null) return;
	const nodeEl = (evt.currentTarget as Element | null)?.closest<HTMLElement>("[data-node-id]");
	if (!nodeEl) return;

	const startX = evt.clientX;
	const startY = evt.clientY;
	const pointerId = evt.pointerId;
	let clone: HTMLElement | null = null;

	const begin = () => {
		const rect = nodeEl.getBoundingClientRect();
		// 小影子：節點的完整複製，縮成畫面上的 GHOST_SCALE 倍，左上角固定在游標右下方；太高就裁掉（CSS 做底部淡出）
		const onScreen = nodeEl.offsetWidth > 0 ? rect.width / nodeEl.offsetWidth : 1;
		const scale = onScreen * GHOST_SCALE;
		clone = nodeEl.cloneNode(true) as HTMLElement;
		clone.classList.add("headings-drag-clone");
		clone.classList.remove("selected", "drag-source");
		clone.removeAttribute("data-node-id");
		clone.style.width = `${nodeEl.offsetWidth}px`;
		clone.style.maxHeight = `${GHOST_MAX_HEIGHT / scale}px`;
		clone.style.transform = `scale(${scale})`;
		clone.style.left = `${startX + GHOST_OFFSET}px`;
		clone.style.top = `${startY + GHOST_OFFSET}px`;
		document.body.appendChild(clone);
		// 真的被裁到才做底部淡出，矮的節點不要莫名淡掉
		if (clone.scrollHeight > clone.clientHeight + 1) clone.classList.add("is-clipped");
		document.body.classList.add("headings-dragging");

		const subtreeIds = new Set<string>();
		const collect = (node: TreeNode) => {
			subtreeIds.add(node.id);
			node.children.forEach(collect);
		};
		collect(source);
		state.drag = {
			sourceId: source.id,
			subtreeIds,
			size: { w: nodeEl.offsetWidth, h: nodeEl.offsetHeight },
			x: startX,
			y: startY,
			overId: null,
		};
	};

	const onMove = (e: PointerEvent) => {
		if (e.pointerId !== pointerId) return;
		if (!clone) {
			if (Math.hypot(e.clientX - startX, e.clientY - startY) < DRAG_THRESHOLD) return;
			begin();
		}
		clone!.style.left = `${e.clientX + GHOST_OFFSET}px`;
		clone!.style.top = `${e.clientY + GHOST_OFFSET}px`;
		if (state.drag) {
			state.drag.x = e.clientX;
			state.drag.y = e.clientY;
		}
		refreshDropTarget(state);
	};

	const cleanup = () => {
		window.removeEventListener("pointermove", onMove);
		window.removeEventListener("pointerup", onUp);
		window.removeEventListener("pointercancel", onCancel);
		window.removeEventListener("keydown", onKey, true);
		clone?.remove();
		clone = null;
		document.body.classList.remove("headings-dragging");
	};

	const finish = (drop: boolean) => {
		const target = state.drag?.overId ?? null;
		const started = clone !== null;
		cleanup();
		state.drag = null;
		if (started && drop && target) onDrop(source.id, target);
	};
	const onUp = (e: PointerEvent) => {
		if (e.pointerId === pointerId) finish(true);
	};
	const onCancel = (e: PointerEvent) => {
		if (e.pointerId === pointerId) finish(false);
	};
	const onKey = (e: KeyboardEvent) => {
		if (e.key !== "Escape" || !clone) return;
		e.preventDefault();
		e.stopPropagation();
		finish(false);
	};

	window.addEventListener("pointermove", onMove);
	window.addEventListener("pointerup", onUp);
	window.addEventListener("pointercancel", onCancel);
	window.addEventListener("keydown", onKey, true);
}

/**
 * 以目前的游標位置重新判斷落點目標。佈局自動平移時游標沒動但底下的節點換了，也要呼叫。
 * 複製品與落點佔位都設了 pointer-events: none，不會擋到 elementFromPoint。
 */
export function refreshDropTarget(state: HostState) {
	const drag = state.drag;
	if (!drag || !state.tree) return;
	const source = findNode(state.tree, drag.sourceId);
	const el = document.elementFromPoint(drag.x, drag.y)?.closest<HTMLElement>("[data-node-id]");
	const id = el?.dataset.nodeId ?? null;
	const target = id && source ? findNode(state.tree, id) : null;
	const next = target && source && canMove(source, target) ? target.id : null;
	if (drag.overId !== next) drag.overId = next;
}

/** 靠近視口邊緣時每個 frame 要平移的量：離邊越近越快，最多 speed 像素 */
export function edgePan(x: number, y: number, rect: DOMRect, margin = 24, speed = 12): [number, number] {
	const axis = (pos: number, lo: number, hi: number): number => {
		if (pos < lo + margin) return Math.min(speed, (lo + margin - pos) / 2 + 2);
		if (pos > hi - margin) return -Math.min(speed, (pos - (hi - margin)) / 2 + 2);
		return 0;
	};
	return [axis(x, rect.left, rect.right), axis(y, rect.top, rect.bottom)];
}
