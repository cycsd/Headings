import { Context, Effect } from "effect";
import type { CachedMetadata, Editor, TFile, App } from "obsidian";

const app_service = "app_service";
export class AppService extends Context.Service<
    AppService,
    {
        readonly getApp: () => Effect.Effect<App>;
    }>()(app_service) {
}