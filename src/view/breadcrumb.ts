import type { IconName } from "obsidian";
import type { TreeNode } from "../core/tree";
import { ROOT_ID } from "../adapter/obsidian-tree";
import { sectionIcon } from "./section-icons";

/** 麵包屑每段的圖示與純文字；不渲染 markdown，導航用的短字串就好 */

export const CRUMB_MAX_LENGTH = 40;

export const crumbIcon = (node: TreeNode): IconName => {
	if (node.id === ROOT_ID) return "file-text";
	if (node.kind === "listItem") return "list";
	if (node.kind === "section") return sectionIcon(node.sectionType ?? "");
	const level = Math.min(6, Math.max(1, node.level ?? 1));
	return `heading-${level}`;
};

const firstLine = (text: string): string => text.split("\n")[0]?.trim() ?? "";

const truncate = (text: string): string =>
	text.length > CRUMB_MAX_LENGTH ? `${text.slice(0, CRUMB_MAX_LENGTH)}…` : text;

/** heading 用 cache 的標題文字；升級節點取內容第一行 */
export const crumbLabel = (node: TreeNode, getText: (from: number, to: number) => string): string => {
	if (node.title !== null) return truncate(node.title);
	const raw = node.kind === "listItem" ? (node.text ?? "") : getText(node.range.from, node.range.to);
	return truncate(firstLine(raw));
};
