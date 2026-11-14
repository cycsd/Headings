import type { Attachment } from "svelte/attachments";
import type { TreeNode } from "../core/tree";
import type { DropPosition } from "../core/edit";
import type { HostState } from "./host-state.svelte";
import { selectNode } from "./tree-state";
import { startNodeDrag } from "./node-drag";

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
	/** 點選節點：麵包屑顯示它的路徑 */
	select(id: string): void;
	/** 進入節點內編輯 */
	edit(id: string): void;
	/** 把 Obsidian 的嵌入式編輯器掛到節點上，離開時寫回；由 view 實作 */
	mountEditor(node: TreeNode): Attachment<HTMLElement>;
	/** 鍵盤與選單共用的結構操作；由 view 實作 */
	command(command: NodeCommand, node: TreeNode): void;
	/** 從節點標題列按下開始拖曳；放到合法目標上就搬過去 */
	startDrag(node: TreeNode, evt: PointerEvent): void;
	/** 把 source 子樹搬到 target 的指定位置（放進去 / 插前面 / 插後面）；由 view 實作 */
	moveNode(sourceId: string, targetId: string, position: DropPosition): void;
};

export type NodeCommand = "addSibling" | "addChild" | "delete" | "undo" | "redo";

/** view 提供、需要 Obsidian app 的動作 */
export type NodeActions = Pick<NodeUi, "showLinks" | "renderFrontmatter" | "showNodeMenu" | "edit" | "mountEditor" | "command" | "moveNode">;

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
	select(id) {
		selectNode(state, id);
	},
	edit: actions.edit,
	mountEditor: actions.mountEditor,
	command: actions.command,
	startDrag(node, evt) {
		startNodeDrag(state, node, evt, actions.moveNode);
	},
	moveNode: actions.moveNode,
});
