import type { Attachment } from "svelte/attachments";
import type { TreeNode } from "../core/tree";
import type { HostState } from "./host-state.svelte";

/** 節點元件透過 Svelte context 拿到的操作介面，由 LayoutHost 建立 */
export type NodeUi = {
	state: HostState;
	toggleCollapsed(id: string): void;
	toggleIcons(id: string): void;
	toggleLit(id: string, type: string): void;
	/** 一次點亮（或全部收回）一組型別 */
	setLit(id: string, types: readonly string[]): void;
	/** 顯示節點內連結的選單，由 view 實作（需要 app） */
	showLinks(node: TreeNode, evt: MouseEvent): void;
	/** 把 YAML 區塊畫成屬性面板；解析不了時退回一般 markdown */
	renderFrontmatter(text: string): Attachment<HTMLElement>;
	/** 節點選單（右鍵或「…」按鈕）：收合其他、以此為根、展開 / 收合子樹，由 view 實作 */
	showNodeMenu(node: TreeNode, evt: MouseEvent): void;
};

/** view 提供、需要 Obsidian app 的動作 */
export type NodeActions = Pick<NodeUi, "showLinks" | "renderFrontmatter" | "showNodeMenu">;

export const NODE_UI = Symbol("headings-node-ui");

export const createNodeUi = (state: HostState, actions: NodeActions): NodeUi => ({
	state,
	toggleCollapsed(id) {
		if (state.collapsed.has(id)) state.collapsed.delete(id);
		else state.collapsed.add(id);
	},
	toggleIcons(id) {
		if (state.iconsOpen.has(id)) state.iconsOpen.delete(id);
		else state.iconsOpen.add(id);
	},
	toggleLit(id, type) {
		const next = new Set(state.litTypes.get(id) ?? []);
		if (next.has(type)) next.delete(type);
		else next.add(type);
		state.litTypes.set(id, next);
	},
	setLit(id, types) {
		state.litTypes.set(id, new Set(types));
	},
	showLinks: actions.showLinks,
	renderFrontmatter: actions.renderFrontmatter,
	showNodeMenu: actions.showNodeMenu,
});
