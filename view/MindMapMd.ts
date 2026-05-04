import { Effect } from "effect";
import { type CachedMetadata, ItemView, MarkdownRenderChild, TFile, type ViewStateResult, WorkspaceLeaf } from "obsidian";


export type MindMapMdViewState = {
    filePath: string|null;
    file: TFile|null;
    doc: string|null;
}

export type MindMapMdViewStateSave = Omit<MindMapMdViewState, "file" | "doc">;

export type ComponentState = {
    cache: CachedMetadata;
    doc: string;
    file: TFile;
};


