import type { TreeNode } from "../core/tree";
import { canDrop, type DropPosition } from "../core/edit";
import { findNode } from "../core/tree-ops";
import type { HostState } from "./host-state.svelte";
import { visibleRoot } from "./tree-state";

/** 單指 / 滑鼠移動超過這個距離才算拖曳，之前放開仍是點擊 */
const DRAG_THRESHOLD = 8;
/** 插前 / 插後的邊區：目標節點高的這個比例，至少 EDGE_MIN 像素、最多節點高的 1/3 */
const EDGE_RATIO = 0.25;
const EDGE_MIN = 8;
/** 小影子：節點複製品的縮放倍率、最大高度與相對游標的偏移（螢幕像素） */
const GHOST_SCALE = 0.6;
const GHOST_MAX_HEIGHT = 240;
const GHOST_OFFSET = 12;

/**
 * 節點拖曳：從節點標題列按下，移動超過門檻後開始。
 * - 拖的是節點本身：把節點 DOM 複製一份固定在螢幕上跟著游標走，原本的節點變成虛線佔位；
 *   複製品不受 PanZoom 的縮放與平移影響，自動平移時也不會跑掉。
 * - 游標下的節點若是合法目標就記在 state.drag.overId / overPosition，LayoutHost 據此畫落點預覽；放開時搬過去。
 * - Esc 取消。只處理滑鼠左鍵與手寫筆；觸控的單指已經給平移用了。
 */
export function startNodeDrag(
	state: HostState,
	source: TreeNode,
	evt: PointerEvent,
	onDrop: (sourceId: string, targetId: string, position: DropPosition) => void,
) {
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
		// 影子只要節點本體：收合把手、icon 列、「…」等按鈕都拿掉
		clone.querySelectorAll("button").forEach((button) => button.remove());
		anchor = null;
		// 定位相關的樣式寫 inline：節點自己的 scoped CSS（.node.svelte-xxx）比 .headings-drag-clone 更 specific，寫在 CSS 會被蓋掉
		clone.style.position = "fixed";
		clone.style.margin = "0";
		clone.style.pointerEvents = "none";
		clone.style.zIndex = "var(--layer-popover, 30)";
		clone.style.width = `${nodeEl.offsetWidth}px`;
		clone.style.maxHeight = `${GHOST_MAX_HEIGHT / scale}px`;
		clone.style.transform = `scale(${scale})`;
		clone.style.left = `${startX + GHOST_OFFSET}px`;
		clone.style.top = `${startY + GHOST_OFFSET}px`;
		document.body.appendChild(clone);
		// 真的被裁到才做底部淡出，矮的節點不要莫名淡掉
		if (clone.scrollHeight > clone.clientHeight + 1) clone.classList.add("is-clipped");
		document.body.classList.add("headings-dragging");
		// 門檻前瀏覽器可能已經選到字，開始拖曳就清掉
		window.getSelection()?.removeAllRanges();

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
			overPosition: null,
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
		document.removeEventListener("selectstart", blockSelect, true);
		clone?.remove();
		clone = null;
		anchor = null;
		document.body.classList.remove("headings-dragging");
	};

	const finish = (drop: boolean) => {
		const target = state.drag?.overId ?? null;
		const position = state.drag?.overPosition ?? null;
		const started = clone !== null;
		cleanup();
		state.drag = null;
		if (started && drop && target && position) onDrop(source.id, target, position);
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

	// 從標題列按下就是在拖節點，不是在選字：按下到放開之間擋掉原生選取（門檻前就會開始選，所以不能等拖曳開始才擋）
	const blockSelect = (e: Event) => e.preventDefault();
	document.addEventListener("selectstart", blockSelect, true);
	window.addEventListener("pointermove", onMove);
	window.addEventListener("pointerup", onUp);
	window.addEventListener("pointercancel", onCancel);
	window.addEventListener("keydown", onKey, true);
}

/**
 * 落點決策的錨點：決定當下目標節點在螢幕上的矩形。
 * 分區只看游標相對這個矩形的位置，不看目標的即時位置：佔位一插進去目標就會被推開，若用即時位置重算，
 * 游標在交界附近會陷入「插入 → 目標移走 → 取消 → 目標移回 → 插入」的抖動。
 * 游標還在錨點矩形裡就只在矩形內換區；在佔位框上就維持原決策；離開兩者才重新找目標。
 * 一次只有一個拖曳，放模組層級即可；開始與結束時歸零。
 */
let anchor: { id: string; rect: DOMRect } | null = null;

const inside = (rect: DOMRect, x: number, y: number): boolean => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;

/**
 * 以目前的游標位置重新判斷落點目標與操作。佈局自動平移時游標沒動但底下的節點換了，也要呼叫，
 * 並把內容在螢幕上移動的量傳進來，錨點矩形才跟得上。
 * 複製品與落點佔位都設了 pointer-events: none，不會擋到 elementFromPoint。
 */
export function refreshDropTarget(state: HostState, shift?: readonly [number, number]) {
	const drag = state.drag;
	if (!drag || !state.tree) return;
	const source = findNode(state.tree, drag.sourceId);
	if (!source) return;
	if (shift && anchor) {
		const r = anchor.rect;
		anchor = { id: anchor.id, rect: new DOMRect(r.x + shift[0], r.y + shift[1], r.width, r.height) };
	}

	const set = (id: string | null, position: DropPosition | null) => {
		if (drag.overId !== id) drag.overId = id;
		if (drag.overPosition !== position) drag.overPosition = position;
	};

	if (anchor && drag.overId === anchor.id) {
		if (inside(anchor.rect, drag.x, drag.y)) {
			const target = findNode(state.tree, anchor.id);
			const position = target ? dropPosition(state, source, target, anchor.rect, drag.y) : null;
			set(position ? anchor.id : null, position);
			return;
		}
		const placeholder = document.querySelector<HTMLElement>("[data-drop-placeholder]");
		if (placeholder && inside(placeholder.getBoundingClientRect(), drag.x, drag.y)) return;
	}

	const el = document.elementFromPoint(drag.x, drag.y)?.closest<HTMLElement>("[data-node-id]");
	const id = el?.dataset.nodeId ?? null;
	const target = id ? findNode(state.tree, id) : null;
	if (!el || !target) {
		anchor = null;
		set(null, null);
		return;
	}
	const rect = el.getBoundingClientRect();
	anchor = { id: target.id, rect };
	const position = dropPosition(state, source, target, rect, drag.y);
	set(position ? target.id : null, position);
}

/**
 * 游標在目標上的垂直位置決定操作：
 * - 放進去與插前後都合法：上緣區插前面、下緣區插後面、中間放進去；邊區不合法（原地）就退回放進去。
 * - 只有放進去合法：整個節點都是放進去。
 * - 只有插前後合法：上半插前面、下半插後面。
 * - 都不合法：不是目標。
 * 聚焦時的可見根（與整棵樹的根）不能插前後。
 */
export function dropPosition(state: HostState, source: TreeNode, target: TreeNode, rect: DOMRect, y: number): DropPosition | null {
	const root = state.tree!;
	const into = canDrop(root, source, target, "into");
	const isVisibleRoot = visibleRoot(state)?.id === target.id;
	const before = !isVisibleRoot && canDrop(root, source, target, "before");
	const after = !isVisibleRoot && canDrop(root, source, target, "after");
	if (into && (before || after)) {
		const edge = Math.min(Math.max(EDGE_MIN, rect.height * EDGE_RATIO), rect.height / 3);
		if (y < rect.top + edge) return before ? "before" : "into";
		if (y > rect.bottom - edge) return after ? "after" : "into";
		return "into";
	}
	if (into) return "into";
	if (before || after) {
		const upper = y < rect.top + rect.height / 2;
		const pick: DropPosition = upper ? "before" : "after";
		return (pick === "before" ? before : after) ? pick : null;
	}
	return null;
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
