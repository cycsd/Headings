import type { Attachment } from "svelte/attachments";
import type { TreeNode } from "../core/tree";

/** 每個佈局元件都接收同一組 props，view 層不需要知道是哪個佈局 */
export type LayoutProps = {
	tree: TreeNode;
	/** 取出文件 [from, to) 的原文 */
	getText: (from: number, to: number) => string;
	/** 把 markdown 渲染到元素上 */
	onRenderMarkdown: (text: string) => Attachment<HTMLElement>;
	/** 節點最大寬度 (px) */
	maxNodeWidth: number;
};
