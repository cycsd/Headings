import type { TreeNode } from "../core/tree";
import type { TextPatch } from "../core/edit";
import type { HostState } from "./host-state.svelte";

/**
 * 節點 id 是由標題（heading）或序號（list item、section）組出來的，改標題、插入或刪除兄弟都會讓 id 變；
 * 收合、icon 列、點亮型別、選取、聚焦都用 id 記，不搬過去的話，編輯完節點會自己展開、狀態跑到別的節點上。
 * 做法：寫回前記下每個節點在原文的起點，cache 更新後把起點穿過補丁算到新文件的位置，再用起點在新樹找到同一個節點。
 */

/** 以文字起點找節點（root 沒有起點） */
export const findByStart = (root: TreeNode, start: number): TreeNode | null => {
	if (root.range.from === start && root.kind !== "root") return root;
	for (const child of root.children) {
		const found = findByStart(child, start);
		if (found) return found;
	}
	return null;
};

/** 每個節點（root 除外）的 id → 文字起點 */
export const collectStarts = (root: TreeNode): Map<string, number> => {
	const starts = new Map<string, number>();
	const walk = (node: TreeNode) => {
		if (node.kind !== "root") starts.set(node.id, node.range.from);
		node.children.forEach(walk);
	};
	walk(root);
	return starts;
};

/**
 * 原文的 offset 穿過一組補丁（位置都以原文為準、互不重疊）後在新文件的位置；落在被刪掉的範圍裡回傳 null。
 * - 純插入（from == to）：起點在插入點或之後都往後移（插在節點前面時節點要讓開）。
 * - 取代（to > from）：起點剛好在 from 且有插入文字 = 被編輯的節點本身，留在原位；插入空字串 = 被刪掉。
 */
export const mapOffset = (offset: number, patches: readonly TextPatch[]): number | null => {
	let result = offset;
	for (const patch of patches) {
		const delta = patch.insert.length - (patch.to - patch.from);
		if (patch.from === patch.to) {
			if (offset >= patch.from) result += delta;
		} else if (offset >= patch.to) {
			result += delta;
		} else if (offset > patch.from || (offset === patch.from && patch.insert === "")) {
			return null;
		}
	}
	return result;
};

/**
 * 兩份文件的差異化成一個取代補丁（共同前綴 / 共同後綴之間），給沒有補丁可對照的外部改動用：
 * 改到的那一段之後的節點都能對回去，那一段裡面的節點才會掉。內容相同回傳空陣列。
 */
export const diffPatch = (before: string, after: string): TextPatch[] => {
	if (before === after) return [];
	// 以「行」為單位找共同前綴 / 後綴：字元級的前綴會把「在 B 前面插入 New」算成「B 改名 New 再插入 B」，
	// 節點起點就對到錯的節點；整行比對時插入一整行 = 純插入，B 讓開，才對得準
	const a = before.split("\n");
	const b = after.split("\n");
	const max = Math.min(a.length, b.length);
	let p = 0;
	while (p < max && a[p] === b[p]) p += 1;
	let s = 0;
	while (s < max - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s += 1;
	const lineStart = (lines: string[], i: number) => lines.slice(0, i).reduce((n, line) => n + line.length + 1, 0);
	const from = lineStart(a, p);
	const aEnd = a.length - s;
	const aText = a.slice(p, aEnd).join("\n");
	const bText = b.slice(p, b.length - s).join("\n");
	if (aEnd > p && b.length - s > p) return [{ from, to: from + aText.length, insert: bText }];
	if (aEnd === p) {
		// 純插入整行：插在後綴第一行之前；沒有後綴就接在檔尾
		return s > 0 ? [{ from, to: from, insert: bText + "\n" }] : [{ from: before.length, to: before.length, insert: "\n" + bText }];
	}
	// 純刪除整行：連同一個換行一起刪
	return s > 0 ? [{ from, to: from + aText.length + 1, insert: "" }] : [{ from: Math.max(0, from - 1), to: before.length, insert: "" }];
};

export type MovedSubtree = { oldId: string; newStart: number };

const isWithin = (id: string, prefix: string): boolean => id === prefix || id.startsWith(prefix + "/") || id.startsWith(prefix + ":");

/**
 * 舊 id → 新 id 的對照；值為 null 代表節點已經不在了。只列出有變的 id。
 * moved：拖曳搬移的子樹整段被剪掉再貼上，起點對不回去，改用「新位置的節點 id」換掉舊前綴。
 */
export const buildIdMap = (
	starts: ReadonlyMap<string, number>,
	patches: readonly TextPatch[],
	newRoot: TreeNode,
	moved: MovedSubtree | null = null,
): Map<string, string | null> => {
	const map = new Map<string, string | null>();
	const movedTo = moved ? findByStart(newRoot, moved.newStart) : null;
	for (const [id, start] of starts) {
		if (moved && isWithin(id, moved.oldId)) {
			const next = movedTo ? movedTo.id + id.slice(moved.oldId.length) : null;
			if (next !== id) map.set(id, next);
			continue;
		}
		const offset = mapOffset(start, patches);
		const node = offset === null ? null : findByStart(newRoot, offset);
		const next = node?.id ?? null;
		if (next !== id) map.set(id, next);
	}
	return map;
};

/** 把 HostState 裡所有以 id 記的狀態依對照表搬過去；沒變的集合不碰，才不會讓佈局白白重算 */
export const remapHostState = (state: HostState, map: ReadonlyMap<string, string | null>) => {
	if (map.size === 0) return;
	const mapped = (id: string): string | null => (map.has(id) ? (map.get(id) ?? null) : id);

	const remapSet = (set: Set<string>) => {
		const ids = [...set];
		if (!ids.some((id) => map.has(id))) return;
		set.clear();
		for (const id of ids) {
			const next = mapped(id);
			if (next !== null) set.add(next);
		}
	};
	remapSet(state.collapsed);
	remapSet(state.iconsOpen);

	const lit = [...state.litTypes.entries()];
	if (lit.some(([id]) => map.has(id))) {
		state.litTypes.clear();
		for (const [id, types] of lit) {
			const next = mapped(id);
			if (next !== null) state.litTypes.set(next, types);
		}
	}

	if (state.selectedId !== null && map.has(state.selectedId)) state.selectedId = mapped(state.selectedId);
	if (state.focusId !== null && map.has(state.focusId)) state.focusId = mapped(state.focusId);
	if (state.editingId !== null && map.has(state.editingId)) state.editingId = mapped(state.editingId);
};
