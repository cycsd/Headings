
import { Effect } from "effect";
import { Vault, TFile } from "obsidian";


export function getFileByPath(vault:Vault,path: string) {
    return Effect.fromNullishOr(vault.getFileByPath(path));
}

export function cachedRead(vault: Vault, file: TFile) {
    return Effect.tryPromise(() => vault.cachedRead(file));
}