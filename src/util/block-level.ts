
//代表當前被選擇的 Block (fork) 的 ancestor
export const road = 'road';
//代表當前被選擇的 Block
export const fork = 'fork';
//代表當前被選擇的 Block (road) 的所有 descendant
export const path = 'path';
//代表跟當前被選擇的 Block 沒有關係的 Block （不在同一群組的 Block)
export const unselected = 'unselected';
const states = [road, fork, path, unselected] as const;
export type State = typeof states[number];

//todo
//metadata 對應轉換，編寫 example,plan 以及單元測試

/**
 * example
 * ```js
 * const layout: ColumnLayout = {
 *   index: 1,
 *   blocks: [
 *    { index: 0, parentIndex: 0, state: 'unselected', type: 'heading2', level: 2, text: 'Example text 1', startOffset: 10, endOffset: 24 },
 *   { index: 1, parentIndex: 1, state: 'fork', type: 'heading2', level: 2, text: 'Example text 2', startOffset: 50, endOffset: 64 },
 *  ],
 * state: 'road',
 * centerBlockIndex: 0,
 * }
 * ```
 */
export type ColumnLayout = {
    /*
    記錄 column 的 index，從 0 開始
    方便在 drag and drop 的時候，知道使用者是從哪個 column 拖出 block，
    又是將 block 拖到哪個 column
    */
    // index: number;

    /*
    column 中需要呈現的 Block,
    */
    blocks: Block[];
    // state: State;

    /*
    判斷目前使用者所選到的 Block 對應的整個路徑，
    可能是 road (ancestor), fork (current), path (descendant)，
    讓 virtual list 可以根據此值來決定要 scroll 到哪個位置
    */
    centerBlockIndex: number;
}

export type Content = {
    text: string,
    type: string;
    level: number;
    startOffset: number;
    endOffset: number;
}

/*
此份 markdown 文件的 metadata (yaml)
*/
export type Root = {
    id: string;
    fileName: string;
    yaml?: Content;
    //不需要了？因為只可能是 yaml?
    //  content: Content;
}


export type MindMapNode = Root | Block;


export type Block = {

    id: string;

    /*
    obsidian 的 block id
    ex: ^this_is_a_block
    */
    obsidianBlockId?: string;
    content: Content[];
    /*
    記錄 block 在 column 中的位置，讓我可以知道使用者選取的 block 在哪一個位置    
    但或許可以直接用 current select 取代？
    需要記錄，可以在使用者垂直移動後知道那個 block 被移動過
    */
    index: number;
    /*
    記錄歸屬於哪個 column group，方便在使用者操作後，確認哪個 Block 是被使用者操作過的 Block。
    */
    columnIndex: number;
    /*
    記錄 block 歸類在哪個 parent block 底下，方便在使用者操作後，
    將同個 parent 下的 block 做群組更新。
    */
    // parent: MindMapNode;
    parentId: string;

    /*
    記錄當前的 block 跟被選取的 block 的關係，方便在使用者操作後，將同個路徑下的 block 做群組更新。
    */
    state: State;
    /*
    重新轉發需要知道原本從哪裡開始，此值應要隨時 update ？
    */
    startOffset: number;
    endOffset: number;
    isEdit: boolean;
}

export type NonStateBlock = Omit<Block, 'state'>;
export type CurrentSelect = {
    columnIndex: number;
    blockIndex: number;
    block: MindMapNode;
}
export type BlockView = ColumnLayout[];


