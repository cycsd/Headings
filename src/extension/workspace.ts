import { type Constructor, Workspace, type WorkspaceLeaf, type View as ObsidianView } from "obsidian";
import { Effect, pipe } from "effect";

export const getActiveViewOfType = <View extends ObsidianView>(
    workspace: Workspace,
    type: Constructor<View>
) => Effect.suspend(() => {
    const activeView = workspace.getActiveViewOfType(type);

    return pipe(
        Effect.fromNullishOr(activeView),
        Effect.mapError(() => new Error(`No active view of type: ${type.name}`)),
    );
});






/**
 * 把分頁帶到前面。`revealLeaf` 是 1.7.2 才有的（還會展開側邊欄），manifest 的 minAppVersion 更低，
 * 所以有就用、沒有就退回 `setActiveLeaf`（主視窗的分頁用它就夠了）。
 */
export const revealLeaf = async (workspace: Workspace, leaf: WorkspaceLeaf): Promise<void> => {
    const reveal = (workspace as { revealLeaf?: (leaf: WorkspaceLeaf) => Promise<void> }).revealLeaf;
    if (reveal) await reveal.call(workspace, leaf);
    else workspace.setActiveLeaf(leaf, { focus: true });
};
