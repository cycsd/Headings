<script lang="ts">
	import { setContext } from "svelte";
	import { Menu, setIcon, type IconName } from "obsidian";
	import type { Attachment } from "svelte/attachments";
	import type { HostState } from "./host-state.svelte";
	import type { LayoutProps } from "./layout-props";
	import { getLayout } from "./layout-registry";
	import { createNodeUi, NODE_UI, type NodeActions } from "./node-ui";
	import { pathTo } from "../core/tree-ops";
	import type { TreeNode } from "../core/tree";
	import { crumbIcon, crumbLabel } from "./breadcrumb";
	import { revealNode, setFocus, visibleRoot } from "./tree-state";

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

	function icon(name: IconName): Attachment<HTMLElement> {
		return (el) => {
			setIcon(el, name);
		};
	}
</script>

{#if state.tree && visible}
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
		<Layout tree={visible} {getText} {onRenderMarkdown} maxNodeWidth={state.maxNodeWidth} collapsed={state.collapsed} />
	{/key}
{/if}

<style>
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
</style>
