
import type { Pos, CachedMetadata, HeadingCache, SectionCache } from "obsidian";
import { unselected, type Block, type BlockView, type Content, type NonStateBlock, type Root, type State } from "./block_level";
import { Effect, Match, Random } from "effect";

export const blockquote = 'blockquote';
export const callout = 'callout';
export const code = 'code';
export const element = 'element';
export const footnoteDefinition = 'footnoteDefinition';
export const heading = 'heading';
export const html = 'html';
export const list = 'list';
export const paragraph = 'paragraph';
export const table = 'table';
export const text = 'text';
export const thematicBreak = 'thematicBreak';
export const yaml = 'yaml';

export const embed = 'embed';
export const link = 'link';


export const yaml_level = 0;
export const paragraph_level = 7;
export const other_level = 8;


export const sectionMatchLevel = Match.type<SectionCache>().pipe(
    Match.withReturnType<Pick<Content, 'level'>>(),
    Match.when({ type: yaml }, () => ({ level: yaml_level, })),
    Match.when({ type: paragraph }, () => ({ level: paragraph_level, })),
    Match.orElse(() => ({ level: other_level, }))
)

export function parseSection2Content(section: SectionCache, doc: string): Content {
    const level = sectionMatchLevel(section);
    return {
        ...level,
        text: sliceDocument(section.position, doc),
        type: section.type,
        startOffset: section.position.start.offset,
        endOffset: section.position.end.offset,
    }
}
export function parseCacheMetadata2Content(metadataCache: CachedMetadata, doc: string): Content[] {
    const headingCache = headingsCacheToMap(metadataCache.headings);
    const match = Match.type<SectionCache>().pipe(
        Match.withReturnType<Content>(),
        Match.when({ type: heading, position: (p) => headingCache.has(getOffsetKey(p)) }, (section) => {
            const head = headingCache.get(getOffsetKey(section.position))!;
            return {
                text: sliceDocument(section.position, doc),
                type: heading,
                level: head.level,
                startOffset: section.position.start.offset,
                endOffset: section.position.end.offset,
            }
        }),
        Match.orElse((section) => parseSection2Content(section, doc)),
    )
    if (metadataCache.sections) {
        return metadataCache.sections.map(section => match(section));
    }
    return [];
}

function sliceDocument(position: Pos, doc: string) {
    return doc.slice(position.start.offset, position.end.offset);
}
function getOffsetKey(position: Pos) {
    const start = position.start.offset;
    const end = position.end.offset;
    return `${start}-${end}`;
}

export function headingsCacheToMap(
    headings: HeadingCache[] | undefined,
) {
    if (!headings) return new Map<string, HeadingCache>();
    return new Map(headings.map(item => [getOffsetKey(item.position), item]));
}


type BlockWithParent = Omit<NonStateBlock, 'parent'> & { parent: BlockWithParent | Root };
export function parseContent2Blocks(content: Content[], root: Root): BlockWithParent[][] {
    if (content.length === 0) return [];
    let [first, ...rest] = content;
    if (first!.type === yaml) {
        // root.content = [first];
        root.yaml = first!;
        [first, ...rest] = rest;
    }

    const firstBlock: BlockWithParent = {
        id: crypto.randomUUID(),
        content: [first!],
        index: 0,
        columnIndex: 0,
        parentId: root.id,
        parent: root,
        startOffset: first!.startOffset,
        endOffset: first!.endOffset,
    }
    const columns: BlockWithParent[][] = [[firstBlock]];
    const seed = { blocks: columns, node: firstBlock };

    const result = rest.reduce((sd, current_content) => {
        const { blocks, node } = sd;
        const new_block = traceBackToOrigin(blocks, node, current_content);
        return { blocks, node: new_block };

    }, seed)

    return result.blocks;

}

export function traceBackToOrigin(
    blocks: BlockWithParent[][],
    node: BlockWithParent,
    currentContent: Content): BlockWithParent {

    const result = Match.value({
        nodeColumnIndex: node.columnIndex,
        nodeLevel: node.content.at(-1)!.level,
        currentLevel: currentContent.level,
    }).pipe(
        Match.withReturnType<BlockWithParent>(),
        Match.whenOr(({ nodeLevel, currentLevel }) => nodeLevel === currentLevel,
            // In first column, but current level priority still  higher then previous content, do split,not trace back
            ({ nodeColumnIndex, nodeLevel, currentLevel }) => nodeColumnIndex === 0 && nodeLevel > currentLevel,
            //todo merge current level < 8
            ({ nodeLevel, currentLevel }) => nodeLevel < currentLevel && currentLevel === other_level && nodeLevel >= paragraph_level,
            create_split_block),
        Match.when(({ nodeLevel, currentLevel }) => nodeLevel < currentLevel,
            append_new_block),
        Match.when(({ nodeLevel, currentLevel }) => nodeLevel > currentLevel,
            () => traceBackToOrigin(blocks, node.parent as BlockWithParent, currentContent)
        ),
        Match.orElseAbsurd
        // Match.orElse(create_split_block)
    );

    return result;


    function append_new_block() {
        const next_column_index = node.columnIndex + 1;
        if (blocks.length <= next_column_index) {
            blocks.push([]);
        }
        const block: BlockWithParent = {
            id: crypto.randomUUID(),
            content: [currentContent],
            index: blocks[next_column_index]!.length,
            columnIndex: next_column_index,
            parent: node,
            parentId: node.id,
            startOffset: currentContent.startOffset,
            endOffset: currentContent.endOffset,
        };
        blocks[next_column_index]!.push(block);
        return block;
    }

    function create_split_block() {
        const block: BlockWithParent = {
            id: crypto.randomUUID(),
            content: [currentContent],
            index: node.index + 1,
            columnIndex: node.columnIndex,
            parent: node.parent,
            parentId: node.parent.id,
            startOffset: currentContent.startOffset,
            endOffset: currentContent.endOffset,
        };
        blocks[block.columnIndex]!.push(block);
        return block;
    }
}
