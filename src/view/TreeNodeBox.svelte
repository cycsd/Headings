<script lang="ts">
	import { contentRange, type TreeNode } from "../core/tree";
	import type { LayoutProps } from "./layout-props";
	import { branchStyle } from "./branch-color";

	/**
	 * mindmap 與 outline 共用的節點外觀：圓角矩形、分支色邊框、分支色淡底，根節點中性色。
	 * heading 節點預設只顯示標題，點擊切換成內容；升級節點沒有標題，一律顯示全部內容。
	 */
	interface Props {
		node: TreeNode;
		branch: number;
		root?: boolean;
		getText: LayoutProps["getText"];
		onRenderMarkdown: LayoutProps["onRenderMarkdown"];
		maxNodeWidth: number;
	}

	let { node, branch, root = false, getText, onRenderMarkdown, maxNodeWidth }: Props = $props();

	let fold = $state(true);

	/** heading 顯示標題文字（不含 # 符號） */
	function titleText(n: TreeNode): string {
		if (n.kind === "listItem") return n.text ?? "";
		return n.title ?? getText(n.range.from, n.range.to);
	}

	function contentText(n: TreeNode): string {
		if (n.kind === "listItem") return n.text ?? "";
		const { from, to } = contentRange(n);
		return getText(from, to);
	}

	/** 只有留著內容的 heading 有「標題 / 內容」兩種狀態可以切換 */
	let foldable = $derived(node.title !== null && node.sections.length > 0);
	let text = $derived(fold || !foldable ? titleText(node) : contentText(node));
</script>

<div
	role="gridcell"
	tabindex="-1"
	class="node"
	class:root
	class:foldable
	style="--max-node-width: {maxNodeWidth}px; {branchStyle(branch)}"
	onpointerdown={() => { if (foldable) fold = !fold; }}
>
	<div class="node-content" {@attach onRenderMarkdown(text)}></div>
</div>

<style>
	.node {
		box-sizing: border-box;
		width: max-content;
		max-width: var(--max-node-width);
		padding: 4px 10px;
		border: 1px solid var(--branch);
		border-radius: 8px;
		background: color-mix(in srgb, var(--branch) 22%, transparent);
		color: var(--text-normal);
	}
	.node.foldable {
		cursor: pointer;
	}
	.node.root {
		border-color: var(--background-modifier-border);
		background: var(--background-secondary);
		font-weight: 600;
	}
	.node-content {
		overflow-x: auto;
		word-break: break-word;
	}
	.node-content :global(p) {
		margin: 0;
	}
	.node-content :global(pre),
	.node-content :global(table) {
		margin: 4px 0;
	}
</style>
