import { type Constructor, Workspace, type View as ObsidianView } from "obsidian";
import { Effect, Option, pipe } from "effect";

export const getActiveViewOfType = <View extends ObsidianView>(
    workspace: Workspace,
    type: Constructor<View>
) => Effect.suspend(() => {
    const activeView = workspace.getActiveViewOfType(type);

    return pipe(
        Option.fromNullable(activeView),
        Effect.mapError((message) => new Error(`No active view of type: ${type.name}. ${message}`)),
    );
});





