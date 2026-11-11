<script lang="ts">
	import { getContext } from "svelte";
	import { setIcon, type IconName } from "obsidian";
	import type { Attachment } from "svelte/attachments";
	import { countNodes, sectionTypesOf, type TreeNode } from "../core/tree";
	import { PROMOTABLE_SECTION_TYPES } from "../core/section-types";
	import type { LayoutProps } from "./layout-props";
	import { branchStyle } from "./branch-color";
	import { NODE_UI, type NodeUi } from "./node-ui";
	import { LINK_ICON, sectionIcon } from "./section-icons";
	import { sectionTypeLabel } from "../labels";
	import { t } from "../i18n";

	/**
	 * 三種佈局共用的節點：標題列（chevron、標題、徽章或 icon 列）加內容區。
	 * - heading 節點：預設只顯示標題；icon 列每個 icon 是該型別內容的開關。
	 * - 升級節點（section / list item）：沒有標題，直接顯示全部內容，只有 link icon。
	 * - flat 模式給 Tree Table 的 cell 用，外框由 cell 提供。
	 */
	interface Props {
		node: TreeNode;
		branch: number;
		root?: boolean;
		flat?: boolean;
		getText: LayoutProps["getText"];
		onRenderMarkdown: LayoutProps["onRenderMarkdown"];
		maxNodeWidth: number;
	}

	let { node, branch, root = false, flat = false, getText, onRenderMarkdown, maxNodeWidth }: Props = $props();

	const ui = getContext<NodeUi>(NODE_UI);
	const EMPTY: ReadonlySet<string> = new Set();
	const promotable: readonly string[] = PROMOTABLE_SECTION_TYPES;

	let isHeading = $derived(node.title !== null);
	/** 內容區裡可以顯示的型別（thematicBreak、comment 等永遠不顯示） */
	let types = $derived(sectionTypesOf(node).filter((type) => promotable.includes(type)));
	let lit = $derived(ui.state.litTypes.get(node.id) ?? EMPTY);
	let litSections = $derived(node.sections.filter((s) => lit.has(s.type)));
	let allLit = $derived(types.length > 0 && types.every((type) => lit.has(type)));
	let iconsOpen = $derived(ui.state.showIcons || ui.state.iconsOpen.has(node.id));
	let collapsed = $derived(ui.state.collapsed.has(node.id));
	let hiddenCount = $derived(collapsed ? countNodes(node) - 1 : 0);
	let hasLinks = $derived(node.links.length > 0);
	let hasChildren = $derived(node.children.length > 0);

	/** heading 顯示標題文字（不含 # 符號）；升級節點顯示全部內容 */
	let headText = $derived.by(() => {
		if (node.kind === "listItem") return node.text ?? "";
		if (node.title !== null) return node.title;
		return getText(node.range.from, node.range.to);
	});

	function icon(name: IconName): Attachment<HTMLElement> {
		return (el) => {
			setIcon(el, name);
		};
	}

	/** 按鈕不能讓 PanZoom 開始拖曳，也不能觸發 cell 的其他行為 */
	function stop(evt: Event) {
		evt.stopPropagation();
	}
</script>

<div class="node" class:root class:flat style="--max-node-width: {maxNodeWidth}px; {branchStyle(branch)}">
	<div class="head">
		{#if hasChildren}
			<button
				type="button"
				class="ctl chevron"
				aria-label={t("tooltipToggleChildren")}
				title={t("tooltipToggleChildren")}
				onpointerdown={stop}
				onclick={() => ui.toggleCollapsed(node.id)}
			>
				<span class="ico" {@attach icon(collapsed ? "chevron-right" : "chevron-down")}></span>
				{#if hiddenCount > 0}<span class="count">{hiddenCount}</span>{/if}
			</button>
		{/if}

		<div class="title" class:plain={!isHeading} {@attach onRenderMarkdown(headText)}></div>

		{#if isHeading && (types.length > 0 || hasLinks)}
			{#if iconsOpen}
				<div class="icons">
					{#each types as type (type)}
						<button
							type="button"
							class="ctl"
							class:lit={lit.has(type)}
							aria-label={sectionTypeLabel[type as keyof typeof sectionTypeLabel]()}
							title={sectionTypeLabel[type as keyof typeof sectionTypeLabel]()}
							onpointerdown={stop}
							onclick={() => ui.toggleLit(node.id, type)}
						>
							<span class="ico" {@attach icon(sectionIcon(type))}></span>
						</button>
					{/each}
					{#if hasLinks}
						<button type="button" class="ctl" aria-label={t("tooltipLinks")} title={t("tooltipLinks")} onpointerdown={stop} onclick={(evt) => ui.showLinks(node, evt)}>
							<span class="ico" {@attach icon(LINK_ICON)}></span>
						</button>
					{/if}
					{#if types.length > 0}
						<button
							type="button"
							class="ctl"
							aria-label={t("tooltipToggleContent")}
							title={t("tooltipToggleContent")}
							onpointerdown={stop}
							onclick={() => ui.setLit(node.id, allLit ? [] : types)}
						>
							<span class="ico" {@attach icon(allLit ? "fold-vertical" : "unfold-vertical")}></span>
						</button>
					{/if}
					{#if !ui.state.showIcons}
						<button type="button" class="ctl" aria-label={t("tooltipToggleContent")} onpointerdown={stop} onclick={() => ui.toggleIcons(node.id)}>
							<span class="ico" {@attach icon("x")}></span>
						</button>
					{/if}
				</div>
			{:else if types.length > 0}
				<button type="button" class="ctl badge" aria-label={t("menuNodeTypes")} title={t("menuNodeTypes")} onpointerdown={stop} onclick={() => ui.toggleIcons(node.id)}>
					{types.length}
				</button>
			{:else}
				<button type="button" class="ctl" aria-label={t("tooltipLinks")} title={t("tooltipLinks")} onpointerdown={stop} onclick={(evt) => ui.showLinks(node, evt)}>
					<span class="ico" {@attach icon(LINK_ICON)}></span>
				</button>
			{/if}
		{:else if !isHeading && hasLinks}
			<button type="button" class="ctl" aria-label={t("tooltipLinks")} title={t("tooltipLinks")} onpointerdown={stop} onclick={(evt) => ui.showLinks(node, evt)}>
				<span class="ico" {@attach icon(LINK_ICON)}></span>
			</button>
		{/if}
	</div>

	{#if isHeading && litSections.length > 0}
		<div class="content">
			{#each litSections as section (section.id)}
				<div class="section" {@attach onRenderMarkdown(getText(section.range.from, section.range.to))}></div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.node {
		box-sizing: border-box;
		width: max-content;
		max-width: var(--max-node-width);
		padding: 4px 6px 4px 8px;
		border: 1px solid var(--branch);
		border-radius: 8px;
		background: color-mix(in srgb, var(--branch) 22%, transparent);
		color: var(--text-normal);
	}
	.node.root {
		border-color: var(--background-modifier-border);
		background: var(--background-secondary);
		font-weight: 600;
	}
	/* Tree Table 的 cell 自己有外框與寬度 */
	.node.flat {
		width: auto;
		max-width: none;
		padding: 0;
		border: none;
		border-radius: 0;
		background: transparent;
	}
	.head {
		display: flex;
		align-items: flex-start;
		gap: 2px;
		min-height: 28px;
	}
	.title {
		flex: 1 1 auto;
		min-width: 0;
		align-self: center;
		padding: 2px 4px;
		overflow-x: auto;
		word-break: break-word;
	}
	.title :global(p),
	.section :global(p) {
		margin: 0;
	}
	.title :global(pre),
	.title :global(table),
	.section :global(pre),
	.section :global(table) {
		margin: 4px 0;
	}
	.icons {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 2px;
		flex: 0 1 auto;
	}
	.ctl {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 2px;
		min-width: 28px;
		height: 28px;
		padding: 0 4px;
		border: 1px solid transparent;
		border-radius: 6px;
		background: transparent;
		color: var(--text-muted);
		font-size: var(--font-ui-smaller);
		font-weight: 500;
		cursor: pointer;
		box-shadow: none;
	}
	.ctl:hover {
		background: var(--background-modifier-hover);
		color: var(--text-normal);
	}
	.ctl.lit {
		color: var(--branch);
		border-color: var(--branch);
		background: color-mix(in srgb, var(--branch) 18%, transparent);
	}
	.ctl.badge {
		border-color: var(--background-modifier-border);
		background: var(--background-primary);
	}
	.ctl .count {
		font-size: var(--font-ui-smaller);
	}
	.ico {
		display: inline-flex;
		width: 16px;
		height: 16px;
	}
	.ico :global(svg) {
		width: 16px;
		height: 16px;
	}
	.content {
		margin-top: 4px;
		padding: 4px 4px 0;
		border-top: 1px solid color-mix(in srgb, var(--branch) 40%, transparent);
		overflow-x: auto;
		font-weight: normal;
	}
	.section + .section {
		margin-top: 6px;
	}
</style>
