<script lang="ts">
	import { getContext } from "svelte";
	import { setIcon, type IconName } from "obsidian";
	import type { Attachment } from "svelte/attachments";
	import { countNodes, sectionTypesOf, type SectionNode, type TreeNode } from "../core/tree";
	import { SECTION_TYPES } from "../core/section-types";
	import type { LayoutProps } from "./layout-props";
	import { branchStyle } from "./branch-color";
	import { NODE_UI, type NodeUi } from "./node-ui";
	import { CONTENT_SECTION_TYPES, LINK_ICON, sectionIcon } from "./section-icons";
	import { contentTypeLabel } from "../labels";
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

	let isHeading = $derived(node.title !== null);
	/** 內容區裡可以顯示的型別（thematicBreak、comment 等永遠不顯示；yaml 只會出現在 root） */
	let types = $derived(sectionTypesOf(node).filter((type) => (CONTENT_SECTION_TYPES as readonly string[]).includes(type)));
	/** 使用者點過就用節點自己的狀態，否則用全域設定的預設 */
	let lit = $derived(ui.state.litTypes.get(node.id) ?? ui.state.defaultLit);
	let litSections = $derived(node.sections.filter((s) => lit.has(s.type)));
	let allLit = $derived(types.length > 0 && types.every((type) => lit.has(type)));
	let iconsOpen = $derived(ui.state.showIcons || ui.state.iconsOpen.has(node.id));
	let collapsed = $derived(ui.state.collapsed.has(node.id));
	let hiddenCount = $derived(collapsed ? countNodes(node) - 1 : 0);
	let hasLinks = $derived(node.links.length > 0);
	let hasChildren = $derived(node.children.length > 0);

	/** 標題列直接顯示原文（heading 含 # 符號、list item 含 - 符號），不另外整理；只有 root 沒有範圍，顯示檔名 */
	let headText = $derived.by(() => {
		if (node.kind === "listItem") return node.text ?? "";
		const raw = getText(node.range.from, node.range.to);
		return raw !== "" ? raw : (node.title ?? "");
	});

	/** 內容區也顯示原文，不改寫 */
	function sectionText(section: SectionNode): string {
		return getText(section.range.from, section.range.to);
	}

	function icon(name: IconName): Attachment<HTMLElement> {
		return (el) => {
			setIcon(el, name);
		};
	}

	/** 按鈕不能讓 PanZoom 開始拖曳，也不能觸發 cell 的其他行為 */
	function stop(evt: Event) {
		evt.stopPropagation();
	}

	/** 右鍵與「…」按鈕開同一個節點選單 */
	function openMenu(evt: MouseEvent) {
		evt.preventDefault();
		evt.stopPropagation();
		ui.select(node.id);
		ui.showNodeMenu(node, evt);
	}

	/** 點節點本體就選取；按鈕與連結維持原本行為。拖曳平移不會送出 click，所以不用另外判斷 */
	function handleClick(evt: MouseEvent) {
		if (evt.target instanceof Element && evt.target.closest("button, a")) return;
		ui.select(node.id);
	}

	let selected = $derived(ui.state.selectedId === node.id);

	/** heading 有內容型別或連結時才有 icon 列；沒有的話「…」直接放在標題列 */
	let hasIconRow = $derived(isHeading && (types.length > 0 || hasLinks));
	/** 內容區最大高度，0 為不限制 */
	let maxNodeHeight = $derived(ui.state.maxNodeHeight > 0 ? `${ui.state.maxNodeHeight}px` : "none");
</script>

<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
<div
	class="node"
	class:root
	class:flat
	class:branch-border={ui.state.branchBorder}
	class:branch-bg={ui.state.branchBackground}
	class:selected
	data-node-id={node.id}
	style="--max-node-width: {maxNodeWidth}px; --max-node-height: {maxNodeHeight}; {branchStyle(branch)}"
	onclick={handleClick}
	oncontextmenu={openMenu}
>
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
							aria-label={contentTypeLabel(type)}
							title={contentTypeLabel(type)}
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
					<button type="button" class="ctl" aria-label={t("tooltipNodeMenu")} title={t("tooltipNodeMenu")} onpointerdown={stop} onclick={openMenu}>
						<span class="ico" {@attach icon("ellipsis")}></span>
					</button>
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
		{#if !hasIconRow}
			<button type="button" class="ctl" aria-label={t("tooltipNodeMenu")} title={t("tooltipNodeMenu")} onpointerdown={stop} onclick={openMenu}>
				<span class="ico" {@attach icon("ellipsis")}></span>
			</button>
		{/if}
	</div>

	{#if isHeading && litSections.length > 0}
		<div class="content">
			{#each litSections as section (section.id)}
				{#if section.type === SECTION_TYPES.yaml}
					<div class="section" {@attach ui.renderFrontmatter(sectionText(section))}></div>
				{:else}
					<div class="section" {@attach onRenderMarkdown(sectionText(section))}></div>
				{/if}
			{/each}
		</div>
	{/if}
</div>

<style>
	/* 預設用主題的邊框與背景；分支顏色由設定決定要不要套上，root 永遠中性 */
	.node {
		box-sizing: border-box;
		width: max-content;
		max-width: var(--max-node-width);
		padding: 4px 6px 4px 8px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 8px;
		background: var(--background-primary);
		color: var(--text-normal);
	}
	.node.branch-border {
		border-color: var(--branch);
	}
	.node.branch-bg {
		background: color-mix(in srgb, var(--branch) 22%, transparent);
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
	/* 點選的節點：外框用主題強調色，放在最後覆蓋 root 與 flat */
	.node.selected {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 1px;
	}
	.node.flat.selected {
		outline-offset: -2px;
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
	/* 標題列保留 heading 原本的字級，但不要有段落間距 */
	.title :global(:is(h1, h2, h3, h4, h5, h6)),
	.section :global(:is(h1, h2, h3, h4, h5, h6)) {
		margin: 0;
		line-height: 1.3;
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
	/* 超過最大高度的內容在節點內垂直捲動；PanZoom 不吃無修飾鍵的垂直滾輪，所以不衝突 */
	.content {
		margin-top: 4px;
		padding: 4px 4px 0;
		border-top: 1px solid color-mix(in srgb, var(--branch) 40%, transparent);
		max-height: var(--max-node-height);
		overflow: auto;
		font-weight: normal;
	}
	.section + .section {
		margin-top: 6px;
	}
</style>
