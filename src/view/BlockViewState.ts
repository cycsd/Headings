import { type CachedMetadata, TFile } from "obsidian";


export type BlockViewState = {
    filePath: string|null;
    file: TFile|null;
    doc: string | null;
}

export type BlockViewStateSave = Pick<BlockViewState, "filePath">;

export type ComponentState = {
    cached: CachedMetadata;
    doc: string;
    file: TFile;
};


export type Position = {
    columnIndex: number;
    blockIndex: number;
}
export type Selected = {
    relativePos: Position | null,
    offset: number | null;

}


