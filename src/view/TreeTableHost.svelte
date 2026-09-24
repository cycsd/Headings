<script lang="ts">
	import type { CachedMetadata, Component, TFile } from "obsidian";
	import { Effect, pipe } from "effect";
	import type { DocumentService } from "../service/document-service";
	import type HeadingsPlugin from "../main";
	import TreeTable from "./TreeTable.svelte";
	import { createTreeNode, type HeadingTree } from "./tree";

	interface Props {
		plugin: HeadingsPlugin;
		view: Component;
		docService: DocumentService;
	}

	let { plugin, view, docService }: Props = $props();

	let root: HeadingTree | null = $state(null);
	let sourcePath = $state("");

	docService.subscribe((file, doc, cached) => {
		setTree(file, cached);
		return true;
	});

	function setTree(file: TFile, cached: CachedMetadata) {
		sourcePath = file.path;
		root = pipe(
			createTreeNode(cached, file),
			Effect.orElseSucceed(() => null),
			Effect.runSync,
		) ?? null;
	}
</script>

{#if root}
	<TreeTable {root} app={plugin.app} {sourcePath} component={view} />
{:else}
	<div class="empty">Open a markdown file with headings to see its tree table.</div>
{/if}

<style>
	.empty {
		padding: 12px;
		color: var(--text-muted);
	}
</style>
