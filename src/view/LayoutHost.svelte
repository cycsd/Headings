<script lang="ts">
	import { setContext } from "svelte";
	import { Menu, Platform, setIcon, type IconName } from "obsidian";
	import type { Attachment } from "svelte/attachments";
	import type { HostState } from "./host-state.svelte";
	import type { LayoutProps } from "./layout-props";
	import { getLayout } from "./layout-registry";
	import { createNodeUi, NODE_UI, type NodeActions, type NodeCommand } from "./node-ui";
	import { findNode, pathTo, withDropPlaceholder } from "../core/tree-ops";
	import type { TreeNode } from "../core/tree";
	import { crumbIcon, crumbLabel } from "./breadcrumb";
	import { revealNode, setFocus, visibleRoot } from "./tree-state";
	import { navigate, type NavKey } from "./keyboard-nav";

	interface Props {
		state: HostState;
		actions: NodeActions;
		getText: LayoutProps["getText"];
		onRenderMarkdown: LayoutProps["onRenderMarkdown"];
	}

	let { state, actions, getText, onRenderMarkdown }: Props = $props();

	// 節點元件透過 context 取得共享狀態與操作，不用一層層傳 props。
	// state 物件本身在 view 的生命週期內不會換，只有欄位會變，所以取初始值即可。
	// svelte-ignore state_referenced_locally
	setContext(NODE_UI, createNodeUi(state, actions));

	let entry = $derived(getLayout(state.layoutId));
	/** 聚焦中只畫子樹；聚焦節點不存在時 visibleRoot 已退回完整樹 */
	let visible = $derived(visibleRoot(state));

	/** 聚焦節點在文件更新後消失就自動退回完整樹 */
	$effect(() => {
		if (state.tree && state.focusId !== null && pathTo(state.tree, state.focusId).length === 0) setFocus(state, null);
	});

	/**
	 * 麵包屑：檔名 → … → 選取節點的完整路徑，不因聚焦截短。
	 * 還沒選或選取節點已不存在時只有檔名那段。
	 */
	let crumbs = $derived.by((): TreeNode[] => {
		if (!state.tree) return [];
		const path = state.selectedId !== null ? pathTo(state.tree, state.selectedId) : [];
		return path.length > 0 ? path : [state.tree];
	});

	/** 點某一段：列出它父層的全部 children（檔名那段列第一層），自己打勾；選了就帶到畫面上 */
	function showSiblings(index: number, evt: MouseEvent) {
		const parent = index === 0 ? crumbs[0] : crumbs[index - 1];
		const current = index === 0 ? crumbs[1] : crumbs[index];
		if (!parent || parent.children.length === 0) return;
		const menu = new Menu();
		for (const sibling of parent.children) {
			menu.addItem((item) =>
				item
					.setTitle(crumbLabel(sibling, getText))
					.setIcon(crumbIcon(sibling))
					.setChecked(sibling.id === current?.id)
					.onClick(() => revealNode(state, sibling.id)),
			);
		}
		menu.showAtMouseEvent(evt);
	}

	/**
	 * 鍵盤：方向鍵在看得到的節點間移動；Enter / Tab / F2 / Delete 是結構操作；Mod+Z / Mod+Shift+Z / Mod+Y 復原。
	 * 編輯中交給編輯器自己處理，這裡不碰。
	 */
	// bind:this 在掛載時就設好，effect 跑的時候已經有值；不用 $state 是因為這裡的 prop 叫 state，會跟 rune 撞名
	// svelte-ignore non_reactive_update
	let container: HTMLElement | undefined;
	const ARROWS: Record<string, NavKey> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };

	function selectedNode(): TreeNode | null {
		return state.tree && state.selectedId !== null ? findNode(state.tree, state.selectedId) : null;
	}

	function handleKeydown(evt: KeyboardEvent) {
		if (state.editingId !== null || !visible) return;
		const mod = Platform.isMacOS ? evt.metaKey : evt.ctrlKey;

		const arrow = ARROWS[evt.key];
		if (arrow && !mod) {
			evt.preventDefault();
			if (state.selectedId === null) {
				revealNode(state, visible.id, "ensure");
				return;
			}
			const next = navigate(visible, state.collapsed, state.layoutId, state.selectedId, arrow);
			if (next) revealNode(state, next.id, "ensure");
			return;
		}

		let command: NodeCommand | null = null;
		if (mod && !evt.altKey && evt.key.toLowerCase() === "z") command = evt.shiftKey ? "redo" : "undo";
		else if (mod && !evt.altKey && evt.key.toLowerCase() === "y") command = "redo";
		else if (!mod && evt.key === "Enter") command = "addSibling";
		else if (!mod && evt.key === "Tab") command = "addChild";
		else if (!mod && evt.key === "Delete") command = "delete";
		else if (!mod && evt.key === "F2") {
			const node = selectedNode();
			if (!node) return;
			evt.preventDefault();
			actions.edit(node.id);
			return;
		}
		if (!command) return;

		const node = selectedNode() ?? (command === "undo" || command === "redo" ? visible : null);
		if (!node) return;
		evt.preventDefault();
		evt.stopPropagation();
		actions.command(command, node);
	}

	/**
	 * 拖曳落點預覽：游標停在合法目標上時，多放一個佔位節點再排佈局（放進去 → 目標 children 最後；插前後 → 兄弟列的那個位置），
	 * 其他節點會真的讓出空間，佔位畫成虛線框。來源留在原位淡化，不先拿掉。
	 */
	let displayTree = $derived(
		visible && state.drag?.overId && state.drag.overPosition ? withDropPlaceholder(visible, state.drag.overId, state.drag.overPosition) : visible,
	);

	/** 選取節點後把焦點放到容器上，鍵盤才會進來；編輯中焦點歸編輯器 */
	$effect(() => {
		if (state.selectedId !== null && state.editingId === null) container?.focus({ preventScroll: true });
	});

	function icon(name: IconName): Attachment<HTMLElement> {
		return (el) => {
			setIcon(el, name);
		};
	}
</script>

{#if state.tree && visible}
	<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_static_element_interactions -->
	<div class="host" role="tree" tabindex="-1" bind:this={container} onkeydown={handleKeydown}>
		<nav class="crumbs" aria-label="Breadcrumb">
			{#each crumbs as node, i (node.id)}
				{#if i > 0}<span class="sep" {@attach icon("chevron-right")}></span>{/if}
				<button
					type="button"
					class="crumb"
					class:current={i === crumbs.length - 1}
					disabled={i === 0 ? node.children.length === 0 : false}
					onclick={(evt) => showSiblings(i, evt)}
				>
					<span class="ico" {@attach icon(crumbIcon(node))}></span>
					<span class="label">{crumbLabel(node, getText)}</span>
				</button>
			{/each}
		</nav>
		<!-- 換佈局或換聚焦根都重新掛載，mindmap 才會把新的根置中 -->
		{#key `${entry.id}:${state.focusId ?? ""}`}
			{@const Layout = entry.component}
			<Layout tree={displayTree ?? visible} {getText} {onRenderMarkdown} maxNodeWidth={state.maxNodeWidth} collapsed={state.collapsed} />
		{/key}
	</div>
{/if}

<style>
	/* 容器吃滿 view 的內容區，裡面再是 flex column：麵包屑 + 佈局 */
	.host {
		display: flex;
		flex-direction: column;
		flex: 1 1 auto;
		min-height: 0;
		outline: none;
	}
	.crumbs {
		flex: none;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 2px;
		padding: 4px 12px;
		border-bottom: 1px solid var(--background-modifier-border);
		background: var(--background-primary);
		font-size: var(--font-ui-small);
	}
	.crumb {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		height: 24px;
		padding: 0 6px;
		border: none;
		border-radius: 4px;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		box-shadow: none;
	}
	.crumb:hover:not(:disabled) {
		background: var(--background-modifier-hover);
		color: var(--text-normal);
	}
	.crumb.current {
		color: var(--text-normal);
		font-weight: 600;
	}
	.sep,
	.ico {
		display: inline-flex;
		width: 14px;
		height: 14px;
		color: var(--text-faint);
	}
	.sep :global(svg),
	.ico :global(svg) {
		width: 14px;
		height: 14px;
	}
	.crumb .ico {
		color: inherit;
	}
	.label {
		max-width: 240px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	/* 拖曳中整個 app 不要選到文字、游標用抓取 */
	:global(body.headings-dragging) {
		user-select: none;
		cursor: grabbing;
	}
	/* 跟著游標走的小影子：節點的完整複製縮小後跟著游標；定位、z-index、pointer-events 由 node-drag.ts 寫 inline（scoped 的 .node 樣式比這裡 specific）。太高就裁掉並在底部淡出 */
	:global(.headings-drag-clone) {
		overflow: hidden;
		transform-origin: top left;
		pointer-events: none;
		box-shadow: var(--shadow-l);
		opacity: 0.95;
	}
	:global(.headings-drag-clone.is-clipped) {
		mask-image: linear-gradient(to bottom, black calc(100% - 40px), transparent);
	}
</style>
