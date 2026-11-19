/**
 * 展開與進入編輯器時，節點最多能長多大：以現有佈局一次算出剩餘空間，不需要反覆試。
 * 純函式，座標全是內容座標（視窗邊界用 PanZoom.visibleBounds()，不能混螢幕像素）。
 *
 * - 寬：節點自己不能長出視窗（扣 gap），而且保留 GENERATIONS 代後代在視窗內。節點往遠離根的那一側變寬 Δ，整棵子樹跟著移 Δ，
 *   所以最大寬 = 現在的寬 + min(視窗邊界 − gap − 節點自己的邊緣，視窗邊界 − gap − 那幾代「完整在視窗內」的後代最靠外的邊緣)。
 *   半截或在畫面外的後代視為已離開，不計入也不限制；一個都沒有就只剩節點自己的邊緣；貼邊或超出就維持現在的寬。
 * - 高：保留 SIBLINGS 個下方的同層兄弟在視窗內（同樣只算完整在內的）。
 *   可用高度 = 免費空間（節點比它的後代疊起來還矮的那一段，變高不推任何東西）+ 視窗下緣 − 邊距 − 第 K 個兄弟的下緣。
 *   上方的兄弟也會被父節點對齊子節點中央的規則推開，先不單獨設限。
 * 根的子節點分佈左右兩側：根變寬時兩側各移一半，所以剩餘空間取較小的一側乘二。
 */

export type Bounds = { left: number; right: number; top: number; bottom: number };

/** 佈局裡一個節點需要的欄位；PlacedNode 結構上相容 */
export type BudgetNode = {
	node: { id: string; children: readonly { id: string }[] };
	x: number;
	y: number;
	w: number;
	h: number;
	/** 1 右、-1 左、0 根 */
	side: number;
};

export const GENERATIONS = 2;
export const SIBLINGS = 2;
/**
 * 與視窗邊框保留的 gap：螢幕上的像素，換算成內容座標要除以縮放。
 * 24 = 收合把手突出節點外 13px、平移帶回畫面時留的邊 20px，再加一點呼吸空間。上下左右一致。
 */
export const MARGIN_PX = 24;

export type NodeBudget = {
	/** 節點外框最大寬：節點自己的邊緣與完整在視窗內的後代取較緊的，不小於現在的寬 */
	maxWidth: number;
	/** 節點外框最大高；null = 不限制 */
	maxHeight: number | null;
};

const inside = (n: BudgetNode, b: Bounds): boolean => n.x >= b.left && n.x + n.w <= b.right && n.y >= b.top && n.y + n.h <= b.bottom;

/** 往下數 generations 代的後代（只含佈局裡有畫出來的） */
const descendants = (start: BudgetNode, byId: ReadonlyMap<string, BudgetNode>, generations: number): BudgetNode[] => {
	const found: BudgetNode[] = [];
	let level: BudgetNode[] = [start];
	for (let g = 0; g < generations && level.length > 0; g++) {
		const next: BudgetNode[] = [];
		for (const parent of level) {
			for (const child of parent.node.children) {
				const placed = byId.get(child.id);
				if (placed) next.push(placed);
			}
		}
		found.push(...next);
		level = next;
	}
	return found;
};

const allDescendants = (start: BudgetNode, byId: ReadonlyMap<string, BudgetNode>): BudgetNode[] => descendants(start, byId, Number.MAX_SAFE_INTEGER);

const widthBudget = (self: BudgetNode, byId: ReadonlyMap<string, BudgetNode>, inner: Bounds): number => {
	const kept = descendants(self, byId, GENERATIONS).filter((n) => inside(n, inner));
	// 往右側（含根的右側分支）：最靠右的右緣；往左側：最靠左的左緣
	const rightSlack = (nodes: BudgetNode[]): number | null =>
		nodes.length === 0 ? null : inner.right - Math.max(...nodes.map((n) => n.x + n.w));
	const leftSlack = (nodes: BudgetNode[]): number | null =>
		nodes.length === 0 ? null : Math.min(...nodes.map((n) => n.x)) - inner.left;
	const slackOf = (slacks: (number | null)[]): number | null => {
		const found = slacks.filter((s): s is number => s !== null);
		return found.length === 0 ? null : Math.min(...found);
	};

	// 節點自己的邊緣：往遠離根的那一側長，不能超出視窗（扣掉 gap）。根往兩側各長一半，所以取較小一側乘二
	const ownRight = inner.right - (self.x + self.w);
	const ownLeft = self.x - inner.left;
	let own: number;
	let descendantSlack: number | null;
	if (self.side === 1) {
		own = ownRight;
		descendantSlack = rightSlack(kept);
	} else if (self.side === -1) {
		own = ownLeft;
		descendantSlack = leftSlack(kept);
	} else {
		own = 2 * Math.min(ownRight, ownLeft);
		const slack = slackOf([rightSlack(kept.filter((n) => n.side === 1)), leftSlack(kept.filter((n) => n.side === -1))]);
		descendantSlack = slack === null ? null : 2 * slack;
	}
	// 完整在視窗內的後代都沒有時（都在畫面外或被切到）只受自己的邊緣限制；已經貼邊或超出就維持現在的寬，不縮小
	const slack = descendantSlack === null ? own : Math.min(own, descendantSlack);
	return self.w + Math.max(0, slack);
};

const heightBudget = (self: BudgetNode, byId: ReadonlyMap<string, BudgetNode>, parentOf: ReadonlyMap<string, BudgetNode>, inner: Bounds): number | null => {
	const parent = parentOf.get(self.node.id);
	if (!parent) return null;
	const below = parent.node.children
		.map((child) => byId.get(child.id))
		.filter((n): n is BudgetNode => n !== undefined && n.node.id !== self.node.id && n.y >= self.y + self.h && n.side === self.side)
		.filter((n) => inside(n, inner))
		.sort((a, b) => a.y - b.y)
		.slice(0, SIBLINGS);
	if (below.length === 0) return null;
	const limit = Math.max(...below.map((n) => n.y + n.h));

	const kids = allDescendants(self, byId);
	const extent = kids.length === 0 ? 0 : Math.max(...kids.map((n) => n.y + n.h)) - Math.min(...kids.map((n) => n.y));
	const free = Math.max(0, extent - self.h);
	return self.h + free + Math.max(0, inner.bottom - limit);
};

/** 節點 id 在目前佈局下的尺寸預算；佈局裡找不到節點就沒有預算（回傳 null） */
export const nodeBudget = (nodes: readonly BudgetNode[], id: string, bounds: Bounds, zoom: number): NodeBudget | null => {
	const byId = new Map(nodes.map((n) => [n.node.id, n]));
	const self = byId.get(id);
	if (!self) return null;
	const parentOf = new Map<string, BudgetNode>();
	for (const n of nodes) for (const child of n.node.children) parentOf.set(child.id, n);
	const margin = MARGIN_PX / Math.max(zoom, 0.01);
	const inner: Bounds = { left: bounds.left + margin, right: bounds.right - margin, top: bounds.top + margin, bottom: bounds.bottom - margin };
	return { maxWidth: widthBudget(self, byId, inner), maxHeight: heightBudget(self, byId, parentOf, inner) };
};
