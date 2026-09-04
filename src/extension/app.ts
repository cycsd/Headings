
import { App, TFile, Vault } from "obsidian";
import { Effect } from "effect";
import { cachedRead } from "../extension/vault";




export function getFileCached(app: App, file: TFile) {
    return Effect.gen(function* () {
        const cached = yield* Effect.fromNullishOr(app.metadataCache.getFileCache(file));
        const doc = yield* cachedRead(app.vault, file);
        return { cached, doc };
    });
}