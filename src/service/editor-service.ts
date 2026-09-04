import { Context, Effect } from "effect";
import type { CachedMetadata, Editor, TFile } from "obsidian";

const editor_service = "editor_service";
export class EditorService extends Context.Service<
    EditorService,
    {
        readonly getEditor: () => Effect.Effect<Editor>;
        readonly getFile: () => Effect.Effect<TFile, Error>;
    }>()(editor_service) {

}