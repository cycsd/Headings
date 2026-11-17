import { untrack } from "svelte";
import { SvelteMap, SvelteSet } from "svelte/reactivity";
import type { LayoutId } from "../layout/layout";
import type { MindmapDirection } from "../layout/mindmap";
import type { PanPoint, ZoomLayout } from "./view-memory";
import type { TreeNode } from "../core/tree";
import type { DropPosition, TextPatch } from "../core/edit";
import type { SearchMode } from "../settings-model";

export type RevealMode = "center" | "ensure";

/**
 * 新增節點的草稿：新增兄弟 / 子節點時檔案先不動，畫面上放一個虛擬節點（node）讓使用者打字，離開編輯才寫入。
 * 這樣編輯期間沒有 cache 更新、不會重建樹或重掛編輯器；離開時內容是空的就直接丟棄，檔案不留痕跡。
 */
export type NewNodeState = {
	/** 新增動作所在的節點，虛擬節點放在它之後（after）或底下最後（into） */
	anchorId: string;
	position: "after" | "into";
	node: TreeNode;
	/** 編輯器起始文字：「## 」「- 」或新段落的佔位文字 */
	text: string;
	/** 寫入時接在文字前面的分隔與縮排（「\n\n」或「\n」加清單縮排） */
	lead: string;
	/** 清單縮排；多行內容的後續行要補回 */
	indent: string;
	/** 寫入檔案的位置 */
	at: number;
	/** 跟著一起寫入的補丁（有序清單後面兄弟的重新編號），位置以進入時的文件為準 */
	extra: TextPatch[];
};

/**
 * 搜尋列開著時的狀態。命中與修剪後的樹不放這裡：LayoutHost 依目前畫的樹（聚焦子樹）用 $derived 即時算，
 * 聚焦改變、樹重建都會自動跟著重算。
 */
export type SearchState = {
	query: string;
	/** search：整棵樹照畫、命中描色；filter：只留命中與祖先 */
	mode: SearchMode;
	/** 目前跳到第幾個命中（依文件順序的 index），-1 為還沒跳 */
	current: number;
	/** 每次「開啟搜尋」加一，搜尋列靠它把焦點放回輸入框 */
	seq: number;
};

export type DragState = {
	sourceId: string;
	/** 來源與它所有後代的 id，畫面上一起淡化 */
	subtreeIds: ReadonlySet<string>;
	/** 來源節點未縮放的尺寸，落點佔位框用同樣大小 */
	size: { w: number; h: number };
	/** 游標位置（螢幕座標） */
	x: number;
	y: number;
	/** 游標下合法的目標節點，沒有就 null */
	overId: string | null;
	/** 對目標做什麼：放進去 / 插前面 / 插後面；overId 為 null 時也是 null */
	overPosition: DropPosition | null;
};

/**
 * ItemView 與 Svelte 之間共享的反應式狀態；view 改這個物件，LayoutHost 就重新渲染。
 * 節點層級的狀態都以穩定 id 為 key，三種佈局共用，切換佈局或重新解析時不會丟。
 */
export type HostState = {
	layoutId: LayoutId;
	tree: TreeNode | null;
	maxNodeWidth: number;
	/** view 層級：永遠顯示 icon 列，跳過徽章 */
	showIcons: boolean;
	/** 全域設定：節點還沒被手動切換前預設點亮的型別 */
	defaultLit: ReadonlySet<string>;
	/** 全域設定：節點邊框 / 背景是否套用分支顏色 */
	branchBorder: boolean;
	branchBackground: boolean;
	/** 全域設定：內容區最大高度 (px)，0 為不限制 */
	maxNodeHeight: number;
	/** 心智圖方向（YAML 或設定解析後的值）：both 左右分佈、right 全部往右 */
	mindmapDirection: MindmapDirection;
	/** 全域設定：編輯器是否用自訂尺寸；關閉時依內容貼合節點 */
	editorSizeEnabled: boolean;
	/** 全域設定（已解析）：自訂的編輯器寬度與最大高度 (px)，最大高度 0 為不限制（以視窗高度一半兜底） */
	editorWidth: number;
	editorMaxHeight: number;
	/** 聚焦中的節點 id；null 為完整樹 */
	focusId: string | null;
	/** 最後一次套用的展開層數（0 = 全部），「展開一層 / 收合一層」的基準 */
	expandDepth: number;
	/** 點選的節點 id，麵包屑顯示它的路徑；null 為還沒選 */
	selectedId: string | null;
	/** 要求佈局把節點帶到畫面上；seq 遞增讓同一個 id 也能再觸發。center 置中、ensure 只在看不到時最小平移；flash 為 false 就不閃光暈 */
	reveal: { id: string; seq: number; mode: RevealMode; flash: boolean } | null;
	/** 正在節點內編輯的節點 id；新增中的節點是 NEW_NODE_ID */
	editingId: string | null;
	/** 新增中的節點草稿；null 為沒有 */
	newNode: NewNodeState | null;
	/** 拖曳中的狀態；物件在整段拖曳裡不換，只改欄位，讀 sourceId 的節點才不會跟著游標重算 */
	drag: DragState | null;
	/** 子樹被收合的節點 */
	collapsed: SvelteSet<string>;
	/** 點開 icon 列的節點 */
	iconsOpen: SvelteSet<string>;
	/** 每個節點被點亮（顯示內容）的 section 型別 */
	litTypes: SvelteMap<string, ReadonlySet<string>>;
	/** 搜尋列；null 為關著 */
	search: SearchState | null;
	/** 目前檔案在這個平台上手動縮放過的倍率，依佈局分；沒縮放過的佈局沒有 key（用 1） */
	zoom: Partial<Record<ZoomLayout, number>>;
	/** 參考點在視口的相對位置（心智圖是根節點中心、樹狀表格是左上角），依佈局分；沒有就用預設擺法 */
	pan: Partial<Record<ZoomLayout, PanPoint>>;
	/** 換檔時加一，佈局據此把視口重新擺到記住的位置（或預設位置） */
	viewportSeq: number;
};

export function createHostState(
	init: Pick<
		HostState,
		| "layoutId"
		| "tree"
		| "maxNodeWidth"
		| "maxNodeHeight"
		| "mindmapDirection"
		| "editorSizeEnabled"
		| "editorWidth"
		| "editorMaxHeight"
		| "defaultLit"
		| "branchBorder"
		| "branchBackground"
	>,
): HostState {
	const state = $state<HostState>({
		...init,
		showIcons: false,
		focusId: null,
		expandDepth: 0,
		selectedId: null,
		reveal: null,
		editingId: null,
		newNode: null,
		drag: null,
		search: null,
		zoom: {},
		pan: {},
		viewportSeq: 0,
		collapsed: new SvelteSet<string>(),
		iconsOpen: new SvelteSet<string>(),
		litTypes: new SvelteMap<string, ReadonlySet<string>>(),
	});
	return state;
}

/** 換檔案時清掉所有節點層級的狀態 */
export function resetNodeState(state: HostState) {
	state.collapsed.clear();
	state.iconsOpen.clear();
	state.litTypes.clear();
	state.focusId = null;
	state.expandDepth = 0;
	state.selectedId = null;
	state.reveal = null;
	state.editingId = null;
	state.newNode = null;
	state.drag = null;
	state.search = null;
	state.zoom = {};
	state.pan = {};
}

/**
 * 監看每檔要記住的節點狀態（收合、聚焦、展開層數、點亮型別），任何一個變了就叫 onChange。
 * 在 Svelte 元件之外用 $effect.root 建立，回傳停止監看的函式；建立時也會先叫一次。
 */
export function watchFileMemory(state: HostState, onChange: () => void): () => void {
	return $effect.root(() => {
		$effect(() => {
			// 走訪集合與 map 的內容才會追蹤到新增與刪除；點亮型別是整個 Set 換掉，追蹤 map 的值就夠
			void Array.from(state.collapsed);
			void Array.from(state.litTypes.values());
			void state.focusId;
			void state.expandDepth;
			// 倍率與視口位置改了是整個物件換掉，讀屬性就追蹤得到
			void state.zoom;
			void state.pan;
			untrack(onChange);
		});
	});
}
