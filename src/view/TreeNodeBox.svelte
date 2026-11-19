<script lang="ts">
	import { getContext, tick, untrack } from "svelte";
	import { setIcon, type IconName } from "obsidian";
	import type { Attachment } from "svelte/attachments";
	import type { Box } from "./editor-size";
	import type { ExpandedBox } from "./host-state.svelte";
	import { countNodes, sectionTypesOf, type SectionNode, type TreeNode } from "../core/tree";
	import { DROP_PLACEHOLDER_ID } from "../core/tree-ops";
	import { SECTION_TYPES } from "../core/section-types";
	import type { LayoutProps } from "./layout-props";
	import { branchStyle } from "./branch-color";
	import { NODE_UI, type NodeUi } from "./node-ui";
	import { CONTENT_SECTION_TYPES, LINK_ICON, sectionIcon } from "./section-icons";
	import { contentTypeLabel } from "../labels";
	import { t } from "../i18n";
	import { requestReveal } from "./tree-state";
	import { effectiveMaxHeight, expandContentMaxHeight, hiddenLineCount, usableViewport, wideMaxWidth } from "./node-limits";

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
		/** 收合把手貼在哪一邊：子節點長出來的那一側。root 傳 none */
		handleSide?: "left" | "right" | "none";
	}

	let { node, branch, root = false, flat = false, getText, onRenderMarkdown, maxNodeWidth, handleSide = "none" }: Props = $props();

	const ui = getContext<NodeUi>(NODE_UI);

	let isHeading = $derived(node.title !== null);
	/** 內容區裡可以顯示的型別（thematicBreak、comment 等永遠不顯示；yaml 只會出現在 root） */
	let types = $derived(sectionTypesOf(node).filter((type) => (CONTENT_SECTION_TYPES as readonly string[]).includes(type)));
	/** 使用者點過就用節點自己的狀態，否則用全域設定的預設 */
	let lit = $derived(ui.state.litTypes.get(node.id) ?? ui.state.defaultLit);
	let litSections = $derived(node.sections.filter((s) => lit.has(s.type)));
	let allLit = $derived(types.length > 0 && types.every((type) => lit.has(type)));
	let iconsOpen = $derived(ui.state.showIcons || ui.state.iconsOpen.has(node.id));
	/** 過濾中通往命中節點的路徑一律展開，收合狀態先不看；搜尋模式照舊 */
	let collapsed = $derived(!ui.search.filtering && ui.state.collapsed.has(node.id));
	/** 命中的描強調色（兩種模式都是）；過濾模式裡只是路過的祖先淡化，搜尋模式不淡化 */
	let searchHit = $derived(ui.search.active && ui.search.hits.has(node.id));
	/** Enter 跳到的那個：顏色更深；跳過去時它同時是選取節點，選取外框照畫在內圈 */
	let searchCurrent = $derived(searchHit && ui.search.currentId === node.id);
	let searchMiss = $derived(ui.search.filtering && ui.search.active && !searchHit);
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

	/** 按鈕、連結、核取方塊有自己的行為，點到它們不算點節點 */
	const CONTROLS = "button, a, input";

	/** 點節點本體就選取；按鈕與連結維持原本行為。拖曳平移不會送出 click，所以不用另外判斷 */
	function handleClick(evt: MouseEvent) {
		if (evt.target instanceof Element && evt.target.closest(CONTROLS)) return;
		ui.select(node.id);
	}

	let selected = $derived(ui.state.selectedId === node.id);
	let editing = $derived(ui.state.editingId === node.id);
	let dragSource = $derived(ui.state.drag?.sourceId === node.id);
	/** 來源的後代：留在原地淡化 */
	let dragSubtree = $derived(!dragSource && (ui.state.drag?.subtreeIds.has(node.id) ?? false));
	/** 「放進去」且目標收合著看不到落點預覽時，才在目標上畫外框；插前後的佔位在兄弟列，看得到 */
	let dropTarget = $derived(ui.state.drag?.overId === node.id && ui.state.drag.overPosition === "into" && collapsed);
	/** 落點預覽的佔位框：跟來源同尺寸的虛線框，不接事件 */
	let placeholder = $derived(node.id === DROP_PLACEHOLDER_ID);
	let placeholderSize = $derived(ui.state.drag?.size ?? { w: 160, h: 36 });

	/** 標題列按下開始拖曳；按鈕、連結、編輯中除外。實際是否算拖曳由移動距離決定 */
	function handleHeadPointerDown(evt: PointerEvent) {
		// 過濾中兄弟被藏起來，落點說不清楚，不拖
		if (editing || ui.search.filtering) return;
		if (evt.target instanceof Element && evt.target.closest(CONTROLS)) return;
		ui.startDrag(node, evt);
	}

	/** 雙擊節點本體進入編輯；按鈕、連結與編輯器本身除外 */
	function handleDoubleClick(evt: MouseEvent) {
		if (editing) return;
		if (evt.target instanceof Element && evt.target.closest(CONTROLS)) return;
		evt.preventDefault();
		ui.edit(node.id);
	}

	/**
	 * 從麵包屑定位到這個節點時閃一下光暈。reveal.seq 變了就重播；
	 * 等兩個 frame 讓佈局先置中完再開始，先關再開是為了讓 CSS 動畫重新播放。
	 */
	let flashing = $state(false);
	$effect(() => {
		const request = ui.state.reveal;
		if (!request || request.id !== node.id || !request.flash) return;
		flashing = false;
		let timer: number | undefined;
		const frame = requestAnimationFrame(() =>
			requestAnimationFrame(() => {
				flashing = true;
				timer = window.setTimeout(() => (flashing = false), 1100);
			}),
		);
		return () => {
			cancelAnimationFrame(frame);
			if (timer !== undefined) clearTimeout(timer);
		};
	});

	/** heading 有內容型別或連結時才有 icon 列；沒有的話「…」直接放在標題列 */
	let hasIconRow = $derived(isHeading && (types.length > 0 || hasLinks));
	/** 內容區最大高度（內容座標）：設定值，0（自動）時依視圖高度換算；不隨縮放變 */
	let maxNodeHeight = $derived(`${effectiveMaxHeight(ui.state.maxNodeHeight, usableViewport(ui.state.viewport))}px`);

	/**
	 * 內容的尺寸狀態（HostState.expanded，不存檔）：
	 * - 平常（沒有記錄）：內容比上限高就裁切（底部淡出），下面一列「還有約 N 行」。預設顯示或從記憶還原的內容走這條，開檔時所有節點大小穩定。
	 * - 使用者點出內容（icon 列）：那一刻算一次最大寬度與內容區最大高度（見 node-limits.ts、node-budget.ts），之後固定；
	 *   內容貼合，超過高度上限在內容區裡捲動，捲動時仍有「還有約 N 行」。再點亮其他型別不重算，內容全收回才清掉。
	 * - 點「還有約 N 行」：展開到顯示全部內容，沒有高度上限與捲軸；「收合」回到上一個狀態。
	 */
	let box = $derived(ui.state.expanded.get(node.id));
	let contentEl: HTMLElement | undefined = $state();
	let hiddenLines = $state(0);

	function watchClip(): Attachment<HTMLElement> {
		return (el) => {
			// 讀 litSections 讓內容區增減節點時重掛；裁切與否由尺寸變化驅動（內容區本身、各 section 渲染完都會觸發）
			void litSections.length;
			const measure = () => {
				const hidden = el.scrollHeight - el.clientHeight;
				const fontSize = parseFloat(getComputedStyle(el).fontSize) || 16;
				hiddenLines = untrack(() => box?.full) || hidden <= 1 ? 0 : hiddenLineCount(hidden, fontSize * 1.5);
			};
			const observer = new ResizeObserver(measure);
			observer.observe(el);
			for (const child of Array.from(el.children)) observer.observe(child);
			measure();
			return () => observer.disconnect();
		};
	}

	/** 算一次尺寸：寬度由佈局預算決定（只有心智圖才加寬，沒有固定上限；樹狀表格的 cell 寬度由表格決定），高度上限見 expandContentMaxHeight */
	function measureBox(user: boolean): ExpandedBox | null {
		if (!nodeEl || !contentEl) return null;
		const id = node.id;
		const budget = untrack(() => ui.state.budgetFor?.(id)) ?? null;
		const visible = untrack(() => ui.state.visibleHeight?.()) ?? ui.state.viewport.h;
		const width =
			budget && !flat ? wideMaxWidth({ nodeWidth: nodeEl.offsetWidth, displayMax: maxNodeWidth, budgetWidth: budget.maxWidth }) : maxNodeWidth;
		const height = expandContentMaxHeight({
			nodeHeight: nodeEl.offsetHeight,
			contentHeight: contentEl.clientHeight,
			visibleHeight: visible,
			budgetHeight: budget?.maxHeight ?? null,
		});
		return { width, height, user, full: false };
	}

	/** 心智圖：尺寸變動的節點當錨點，靠根那一側的上角不動；變大後被推到畫面外的話帶回來 */
	function anchorAndReveal() {
		if (ui.state.layoutId === "mindmap") ui.state.expandAnchor = node.id;
		requestReveal(ui.state, node.id, "ensure", false);
	}

	/**
	 * 使用者在 icon 列點亮 / 收回內容之後：內容出現的那一刻（還沒有記錄）算一次尺寸；已經有就沿用，內容全收回就清掉。
	 * 等 DOM 更新完才量（要有內容區才量得到標題列與內距佔的高度）；tick 之後、畫面繪製之前，不會閃一下。
	 */
	async function afterContentChange() {
		await tick();
		const id = node.id;
		if (litSections.length === 0) {
			ui.state.expanded.delete(id);
			return;
		}
		if (ui.state.expanded.has(id)) return;
		const next = measureBox(true);
		if (!next) return;
		ui.state.expanded.set(id, next);
		anchorAndReveal();
	}

	/** 「還有約 N 行」展開到全部內容；「收合」回到上一個狀態（使用者點出來的回到有上限的捲動，其他的回到平常的裁切） */
	function toggleFull(evt: MouseEvent) {
		evt.stopPropagation();
		ui.select(node.id);
		const id = node.id;
		const current = ui.state.expanded.get(id);
		if (current?.full) {
			if (current.user) ui.state.expanded.set(id, { ...current, full: false });
			else ui.state.expanded.delete(id);
		} else if (current) {
			ui.state.expanded.set(id, { ...current, full: true });
		} else {
			const next = measureBox(false);
			if (next) ui.state.expanded.set(id, { ...next, full: true });
		}
		anchorAndReveal();
	}

	/**
	 * 編輯器尺寸：進入編輯時量一次，之後不變（內容多了在編輯器內捲動），節點外形在編輯期間就不會一直跳。
	 * 用 $effect.pre 在 DOM 還沒換成編輯器之前量節點原本的大小當下限；離開編輯就清掉。
	 */
	let nodeEl: HTMLElement | undefined = $state();
	let editorBox: Box | null = $state(null);
	$effect.pre(() => {
		if (!editing) {
			editorBox = null;
			return;
		}
		if (untrack(() => editorBox) === null) editorBox = untrack(() => ui.measureEditor(node, nodeEl));
	});
	/** CodeMirror 畫完後量到實際內容高度，鎖成這個高度（開啟時剛好裝下、不出捲軸） */
	function lockHeight(h: number) {
		if (editorBox) editorBox = { w: editorBox.w, h };
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
<div
	class="node"
	class:root
	class:flat
	class:branch-border={ui.state.branchBorder}
	class:branch-bg={ui.state.branchBackground}
	class:selected
	class:drag-source={dragSource}
	class:drop-target={dropTarget}
	class:drag-subtree={dragSubtree}
	class:placeholder
	class:editing
	class:flash={flashing}
	class:search-hit={searchHit}
	class:search-current={searchCurrent}
	class:search-miss={searchMiss}
	data-node-id={placeholder ? undefined : node.id}
	data-drop-placeholder={placeholder ? "" : undefined}
	bind:this={nodeEl}
	style="--max-node-width: {box?.width ?? maxNodeWidth}px; --max-node-height: {maxNodeHeight}; {branchStyle(branch)}{placeholder ? ` width: ${placeholderSize.w}px; height: ${placeholderSize.h}px;` : ""}"
	onclick={handleClick}
	ondblclick={handleDoubleClick}
	oncontextmenu={openMenu}
>
	{#if !placeholder}
	{#if editing}
		<!-- 編輯模式：Obsidian 的嵌入式編輯器取代標題列與內容區；Mod+Enter / 點外面離開並寫回。尺寸進入時定好，右下角可自己拉 -->
		<div class="editor" style={editorBox ? `width: ${editorBox.w}px; height: ${editorBox.h}px;` : ""} {@attach ui.mountEditor(node, lockHeight)}></div>
	{:else}
	<!-- 從標題列按下可以拖曳（按鈕與連結除外）；移動超過門檻才算拖，點擊與雙擊照舊 -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="head" onpointerdown={handleHeadPointerDown}>

		<div class="title" class:plain={!isHeading} {@attach onRenderMarkdown(headText, node.range.from)}></div>

		{#if isHeading && (types.length > 0 || hasLinks)}
			{#if iconsOpen}
				<div class="icons">
					{#each types as type (type)}
						<button
							type="button"
							class="ctl"
							class:lit={lit.has(type)}
							aria-label={contentTypeLabel(type)}
							onpointerdown={stop}
							onclick={() => {
								ui.toggleLit(node.id, type);
								void afterContentChange();
							}}
						>
							<span class="ico" {@attach icon(sectionIcon(type))}></span>
						</button>
					{/each}
					{#if hasLinks}
						<button type="button" class="ctl" aria-label={t("tooltipLinks")} onpointerdown={stop} onclick={(evt) => ui.showLinks(node, evt)}>
							<span class="ico" {@attach icon(LINK_ICON)}></span>
						</button>
					{/if}
					{#if types.length > 0}
						<button
							type="button"
							class="ctl"
							aria-label={t("tooltipToggleContent")}
							onpointerdown={stop}
							onclick={() => {
								ui.setLit(node.id, allLit ? [] : types);
								void afterContentChange();
							}}
						>
							<span class="ico" {@attach icon(allLit ? "fold-vertical" : "unfold-vertical")}></span>
						</button>
					{/if}
					<button type="button" class="ctl" aria-label={t("tooltipNodeMenu")} onpointerdown={stop} onclick={openMenu}>
						<span class="ico" {@attach icon("ellipsis")}></span>
					</button>
					{#if !ui.state.showIcons}
						<button type="button" class="ctl" aria-label={t("tooltipToggleContent")} onpointerdown={stop} onclick={() => ui.toggleIcons(node.id)}>
							<span class="ico" {@attach icon("x")}></span>
						</button>
					{/if}
				</div>
			{:else if types.length > 0}
				<button type="button" class="ctl badge" aria-label={t("menuNodeTypes")} onpointerdown={stop} onclick={() => ui.toggleIcons(node.id)}>
					{types.length}
				</button>
			{:else}
				<button type="button" class="ctl" aria-label={t("tooltipLinks")} onpointerdown={stop} onclick={(evt) => ui.showLinks(node, evt)}>
					<span class="ico" {@attach icon(LINK_ICON)}></span>
				</button>
			{/if}
		{:else if !isHeading && hasLinks}
			<button type="button" class="ctl" aria-label={t("tooltipLinks")} onpointerdown={stop} onclick={(evt) => ui.showLinks(node, evt)}>
				<span class="ico" {@attach icon(LINK_ICON)}></span>
			</button>
		{/if}
		{#if !hasIconRow}
			<button type="button" class="ctl" aria-label={t("tooltipNodeMenu")} onpointerdown={stop} onclick={openMenu}>
				<span class="ico" {@attach icon("ellipsis")}></span>
			</button>
		{/if}
	</div>

	{#if isHeading && litSections.length > 0}
		<!-- 展開時內容區的高度是進入那一刻定好的值；平常用節點最大高度裁切，裁到才淡出 -->
		<div
			class="content"
			class:clipped={hiddenLines > 0 && !box}
			class:capped={box !== undefined && !box.full}
			class:full={box?.full}
			style={box ? (box.full ? "max-height: none;" : `max-height: ${box.height}px;`) : ""}
			bind:this={contentEl}
			{@attach watchClip()}
		>
			{#each litSections as section (section.id)}
				{#if section.type === SECTION_TYPES.yaml}
					<div class="section" {@attach ui.renderFrontmatter(sectionText(section))}></div>
				{:else}
					<div class="section" {@attach onRenderMarkdown(sectionText(section), section.range.from)}></div>
				{/if}
			{/each}
		</div>
		{#if box?.full}
			<div class="more">
				<button type="button" class="more-btn" onpointerdown={stop} onclick={toggleFull}>{t("nodeCollapse")}</button>
			</div>
		{:else if hiddenLines > 0}
			<div class="more">
				<button type="button" class="more-btn" aria-label={t("tooltipExpandContent")} onpointerdown={stop} onclick={toggleFull}>
					{t("nodeMoreLines").replace("{n}", String(hiddenLines))}
				</button>
			</div>
		{/if}
	{/if}
	{/if}

	{#if hasChildren && handleSide !== "none" && !ui.search.filtering}
		<!-- 收合把手：壓在子節點那一側的邊緣中央，也就是連線接到節點的地方；收合時顯示隱藏的後代數 -->
		<button
			type="button"
			class="fork {handleSide}"
			class:collapsed
			aria-label={t("tooltipToggleChildren")}
			onpointerdown={stop}
			onclick={(evt) => {
				evt.stopPropagation();
				ui.toggleCollapsed(node.id);
			}}
		>
			<span class="dot">{#if collapsed}{hiddenCount}{/if}</span>
		</button>
	{/if}
	{/if}
</div>

<style>
	/* 預設用主題的邊框與背景；分支顏色由設定決定要不要套上，root 永遠中性 */
	.node {
		position: relative;
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
	/* 拖曳中：來源與它的後代留在原地淡化，內容照常顯示 */
	.node.drag-source,
	.node.drag-subtree {
		opacity: 0.4;
	}
	/*
	 * 搜尋命中：用 Obsidian 的搜尋高亮色（跟編輯器 Ctrl+F、==標記== 同一個）畫環並淡染背景，跟選取的強調色分得開；
	 * 目前跳到的那個用 active 色加粗。flat 節點往內畫。過濾模式裡只是路過的祖先淡化。要放在分支背景之後才蓋得過去
	 */
	.node.search-hit {
		box-shadow: 0 0 0 2px var(--text-highlight-bg);
		background: color-mix(in srgb, var(--text-highlight-bg) 30%, var(--background-primary));
	}
	.node.flat.search-hit {
		box-shadow: inset 0 0 0 2px var(--text-highlight-bg);
	}
	.node.search-current {
		box-shadow: 0 0 0 3px var(--text-highlight-bg-active);
		background: color-mix(in srgb, var(--text-highlight-bg-active) 40%, var(--background-primary));
	}
	.node.flat.search-current {
		box-shadow: inset 0 0 0 3px var(--text-highlight-bg-active);
	}
	.node.search-miss {
		opacity: 0.45;
	}
	/* 落點預覽：跟來源同尺寸的虛線框，強調色；不接事件才不會擋到 elementFromPoint */
	.node.placeholder {
		box-sizing: border-box;
		border: 2px dashed var(--interactive-accent);
		background: color-mix(in srgb, var(--interactive-accent) 10%, transparent);
		pointer-events: none;
	}
	/* 目標收合著、看不到落點預覽時才在目標上畫外框 */
	.node.drop-target {
		outline: 2px dashed var(--interactive-accent);
		outline-offset: 2px;
	}
	.node.flat.drop-target {
		outline-offset: -2px;
	}
	/* 從麵包屑定位到的節點：強調色光暈由濃轉淡閃兩下，flat 節點向內發光避免被鄰近 cell 蓋住 */
	.node.flash {
		animation: node-flash 0.5s ease-out 2;
	}
	.node.flat.flash {
		animation-name: node-flash-inset;
	}
	@keyframes node-flash {
		from {
			box-shadow: 0 0 0 0 color-mix(in srgb, var(--interactive-accent) 80%, transparent);
		}
		to {
			box-shadow: 0 0 0 10px transparent;
		}
	}
	@keyframes node-flash-inset {
		from {
			box-shadow: inset 0 0 0 0 color-mix(in srgb, var(--interactive-accent) 80%, transparent);
		}
		to {
			box-shadow: inset 0 0 0 10px transparent;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.node.flash {
			animation: none;
		}
	}
	/* 編輯中：寬高由 inline style 一次定好，內容超過就在編輯器內捲動；右下角的拖拉把手讓使用者自己調，離開編輯就回復 */
	.editor {
		box-sizing: border-box;
		min-width: 80px;
		min-height: 40px;
		overflow: auto;
		resize: both;
		font-weight: normal;
		cursor: text;
	}
	/* 自訂寬度可以比節點最大寬度大，編輯中放開節點的上限；Tree Table 的 cell 寬度由表格決定，編輯器不撐破它 */
	.node.editing {
		max-width: none;
	}
	.node.flat .editor {
		max-width: 100%;
	}
	.editor :global(.cm-editor) {
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
	/*
	 * 渲染內容包在 .markdown-preview-view.markdown-rendered 裡（同 Canvas 文字節點），主題的閱讀模式樣式整套套上；
	 * 但那個容器預設是整頁用的（height 100%、overflow auto、檔案邊距），在節點裡要拿掉
	 */
	.title :global(.markdown-preview-view),
	.section :global(.markdown-preview-view) {
		height: auto;
		width: auto;
		min-height: 0;
		overflow: visible;
		padding: 0;
	}
	.title :global(.markdown-preview-view > :first-child),
	.section :global(.markdown-preview-view > :first-child) {
		margin-top: 0;
	}
	.title :global(.markdown-preview-view > :last-child),
	.section :global(.markdown-preview-view > :last-child) {
		margin-bottom: 0;
	}
	/* 標題列只有一行標題，不要段落間距 */
	.title :global(:is(h1, h2, h3, h4, h5, h6)) {
		margin: 0;
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
	/* 收合把手：24px 點擊範圍，中間 14px 空心圓；圓心壓在邊框上（邊框 1px，所以位移 8px 而不是 7px） */
	.fork {
		position: absolute;
		top: 50%;
		z-index: 2;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		padding: 0;
		border: none;
		background: transparent;
		box-shadow: none;
		cursor: pointer;
		transform: translateY(-50%);
	}
	.fork.right {
		right: -13px;
	}
	.fork.left {
		left: -13px;
	}
	/* flat 節點沒有邊框與 padding，cell 的 6px 水平 padding 要補回去，把手才會壓在 cell 邊緣 */
	.node.flat .fork.right {
		right: -19px;
	}
	.node.flat .fork.left {
		left: -19px;
	}
	.dot {
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 14px;
		height: 14px;
		border: 1.5px solid var(--branch);
		border-radius: 999px;
		background: var(--background-primary);
		color: var(--branch);
		font-size: 10px;
		line-height: 1;
		font-weight: 600;
	}
	/* 收合時圓裡放數字，多位數拉成膠囊 */
	.fork.collapsed .dot {
		min-width: 16px;
		height: 16px;
		padding: 0 4px;
	}
	.fork:hover .dot {
		background: var(--branch);
		color: var(--background-primary);
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
	/*
	 * 超過最大高度的內容平常裁掉（不放捲軸，滾輪留給畫布），被裁到才在底部做淡出，下面一列顯示「還有約 N 行」讓使用者展開；
	 * 展開後高度由 inline style 的 max-height 定，放不下的在內容區裡捲動（PanZoom 的 innerScrollConsumes 會把滾輪讓給還能捲的內容區）
	 */
	.content {
		margin-top: 4px;
		padding: 4px 4px 0;
		border-top: 1px solid color-mix(in srgb, var(--branch) 40%, transparent);
		max-height: var(--max-node-height);
		overflow: hidden;
		font-weight: normal;
	}
	.content.clipped {
		mask-image: linear-gradient(to bottom, black calc(100% - 2.5em), transparent);
	}
	.content.capped {
		overflow: auto;
	}
	.content.full {
		overflow: visible;
	}
	.more {
		display: flex;
		justify-content: flex-end;
		padding: 0 4px;
	}
	.more-btn {
		height: auto;
		padding: 0 6px;
		border: none;
		border-radius: 4px;
		background: transparent;
		color: var(--text-muted);
		font-size: var(--font-ui-smaller);
		box-shadow: none;
		cursor: pointer;
	}
	.more-btn:hover {
		background: var(--background-modifier-hover);
		color: var(--text-normal);
	}
	.section + .section {
		margin-top: 6px;
	}
</style>
