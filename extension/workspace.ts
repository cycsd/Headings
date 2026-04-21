import { type Constructor, Workspace, type View as ObsidianView } from "obsidian";
import { Effect, Option } from "effect";

export const getActiveViewOfType = <View extends ObsidianView>(
    workspace: Workspace,
    type: Constructor<View>
) => {
    const activeView = workspace.getActiveViewOfType(type);
    return Option.fromNullable(activeView);
}
    

  