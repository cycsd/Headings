<script lang="ts">
	import { untrack } from "svelte";
	import { setIcon, type IconName } from "obsidian";
	import type { Attachment } from "svelte/attachments";
	import type { HostState } from "./host-state.svelte";
	import type { SearchMode } from "../settings-model";
	import { stepSearch } from "./tree-state";
	import { t } from "../i18n";

	/**
	 * 搜尋列：放在麵包屑上方，host.search 不是 null 時才出現。
	 * 兩種模式：搜尋（整棵樹照畫、命中描色）與過濾（只留命中與祖先），由漏斗鈕切換；
	 * Enter / Shift+Enter 在命中之間跳，Esc 關閉。命中順序 order 由 LayoutHost 依目前畫的樹算好傳進來。
	 * prop 不叫 state，避免跟 $state rune 撞名。
	 */
	interface Props {
		host: HostState;
		/** 命中的節點 id，依文件順序 */
		order: readonly string[];
		/** 聚焦中時是聚焦節點的標題，搜尋範圍只在它底下；沒聚焦為 null */
		scope: string | null;
		onQuery: (query: string) => void;
		onMode: (mode: SearchMode) => void;
		onClearScope: () => void;
		onClose: () => void;
	}

	let { host, order, scope, onQuery, onMode, onClearScope, onClose }: Props = $props();

	let input: HTMLInputElement | undefined = $state();

	/**
	 * 開啟或再次要求（Mod+F、標題列按鈕）時把焦點放到輸入框並全選；seq 每次要求都會加一。
	 * host.search 每打一個字就換新物件，effect 會跟著重跑，所以要記住處理過的 seq，沒變就不碰焦點，
	 * 否則 select() 會把剛打的字全選起來、下一個字就蓋掉它。關閉時歸零，重開的 seq 從 1 起算才會再聚焦。
	 */
	let handledSeq = -1;
	$effect(() => {
		const seq = host.search?.seq;
		if (seq === undefined) {
			handledSeq = -1;
			return;
		}
		if (seq === handledSeq) return;
		handledSeq = seq;
		untrack(() => {
			input?.focus();
			input?.select();
		});
	});

	let hasQuery = $derived((host.search?.query.trim() ?? "") !== "");
	let total = $derived(order.length);
	let noMatch = $derived(hasQuery && total === 0);
	let filtering = $derived(host.search?.mode === "filter");
	let label = $derived.by(() => {
		const search = host.search;
		if (!search || !hasQuery) return "";
		if (total === 0) return t("searchNoMatch");
		return t("searchCount")
			.replace("{i}", search.current < 0 ? "–" : String(search.current + 1))
			.replace("{n}", String(total));
	});

	/** 輸入框的按鍵不給外層的樹用：方向鍵、Space、Enter 在那邊都有別的意思 */
	function handleKeydown(evt: KeyboardEvent) {
		evt.stopPropagation();
		if (evt.key === "Enter") {
			evt.preventDefault();
			stepSearch(host, order, evt.shiftKey ? -1 : 1);
		} else if (evt.key === "Escape") {
			evt.preventDefault();
			onClose();
		}
	}

	function icon(name: IconName): Attachment<HTMLElement> {
		return (el) => {
			setIcon(el, name);
		};
	}
</script>

{#if host.search}
	<div class="search">
		<span class="ico lead" {@attach icon("search")}></span>
		<input
			type="text"
			placeholder={t("searchPlaceholder")}
			value={host.search.query}
			bind:this={input}
			oninput={(evt) => onQuery(evt.currentTarget.value)}
			onkeydown={handleKeydown}
		/>
		{#if scope !== null}
			<!-- 聚焦中：提醒只搜這個子樹，點了回整份檔案 -->
			<button type="button" class="scope" aria-label={t("searchScopeAll")} onclick={onClearScope}>
				{t("searchScope").replace("{title}", scope)}
			</button>
		{/if}
		<span class="count" class:none={noMatch}>{label}</span>
		<button type="button" class="ctl" class:active={filtering} aria-label={t("searchModeFilter")} onclick={() => onMode(filtering ? "search" : "filter")}>
			<span class="ico" {@attach icon("filter")}></span>
		</button>
		<button type="button" class="ctl" aria-label={t("searchPrev")} disabled={total === 0} onclick={() => stepSearch(host, order, -1)}>
			<span class="ico" {@attach icon("chevron-up")}></span>
		</button>
		<button type="button" class="ctl" aria-label={t("searchNext")} disabled={total === 0} onclick={() => stepSearch(host, order, 1)}>
			<span class="ico" {@attach icon("chevron-down")}></span>
		</button>
		<button type="button" class="ctl" aria-label={t("searchClose")} onclick={onClose}>
			<span class="ico" {@attach icon("x")}></span>
		</button>
	</div>
{/if}

<style>
	.search {
		flex: none;
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 4px 12px;
		border-bottom: 1px solid var(--background-modifier-border);
		background: var(--background-primary);
	}
	.search input {
		flex: 1 1 auto;
		min-width: 0;
		height: 28px;
	}
	.scope {
		flex: none;
		max-width: 180px;
		height: 22px;
		padding: 0 8px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 999px;
		background: var(--background-secondary);
		color: var(--text-muted);
		font-size: var(--font-ui-smaller);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		cursor: pointer;
		box-shadow: none;
	}
	.scope:hover {
		color: var(--text-normal);
		background: var(--background-modifier-hover);
	}
	.count {
		flex: none;
		padding: 0 4px;
		font-size: var(--font-ui-smaller);
		color: var(--text-muted);
		white-space: nowrap;
	}
	.count.none {
		color: var(--text-error);
	}
	.ctl {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		padding: 0;
		border: 1px solid transparent;
		border-radius: 6px;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		box-shadow: none;
	}
	.ctl:hover:not(:disabled) {
		background: var(--background-modifier-hover);
		color: var(--text-normal);
	}
	.ctl:disabled {
		opacity: 0.45;
		cursor: default;
	}
	/* 過濾模式開著：漏斗鈕用強調色標示 */
	.ctl.active {
		color: var(--interactive-accent);
		border-color: var(--interactive-accent);
		background: color-mix(in srgb, var(--interactive-accent) 15%, transparent);
	}
	.ico {
		display: inline-flex;
		width: 16px;
		height: 16px;
	}
	.ico.lead {
		color: var(--text-faint);
	}
	.ico :global(svg) {
		width: 16px;
		height: 16px;
	}
</style>
