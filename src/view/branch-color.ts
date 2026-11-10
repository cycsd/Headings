/** 依頂層分支序號循環 Obsidian 主題的八個顏色變數，所有佈局共用 */
export const BRANCH_COLORS = ["red", "orange", "yellow", "green", "cyan", "blue", "purple", "pink"] as const;

/** branch < 0（根節點）用中性色 */
export const branchColorVar = (branch: number): string =>
	branch < 0 ? "var(--text-muted)" : `var(--color-${BRANCH_COLORS[branch % BRANCH_COLORS.length]})`;

/** 直接塞進 style 屬性的 `--branch` 變數 */
export const branchStyle = (branch: number): string => `--branch: ${branchColorVar(branch)};`;
