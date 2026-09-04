
import type { Pos, CachedMetadata, HeadingCache, SectionCache } from "obsidian";
import { unselected, type Block, type BlockView, type LevelSection, type NonStateBlock, type BaseBlock, type State, type ColumnLayout, road, fork, path, upper_path, lower_path, sibling } from "./block-level";
import { Data, Effect, Match, Option, pipe, Random } from "effect";
import type { Position } from "../view/MindMapMd";
import { range } from "effect/Array";
import { hash } from "effect/Hash";
import { get } from "svelte/store";

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
export const leaf_level = paragraph_level;

export const level_down = Match.type<LevelSection>().pipe(
    Match.withReturnType<Pick<LevelSection, 'level' | 'type'>>(),
    Match.when({ type: yaml }, () => ({ level: 1, type: heading })),
    Match.whenOr(
        { type: paragraph },
        { type: heading, level: 6 }, () => ({ level: paragraph_level, type: paragraph })),
    Match.when({ type: heading }, (h) => ({ level: h.level + 1, type: heading })),
    Match.orElse(({ type: other }) => ({ level: other_level, type: other })),
)

export const sectionMatchLevel = Match.type<SectionCache>().pipe(
    Match.withReturnType<Pick<LevelSection, 'level'>>(),
    Match.when({ type: yaml }, () => ({ level: yaml_level, })),
    Match.when({ type: paragraph }, () => ({ level: paragraph_level, })),
    Match.orElse(() => ({ level: other_level, }))
)

export function parseSection2Content(section: SectionCache): LevelSection {
    const level = sectionMatchLevel(section);
    return {
        ...level,
        type: section.type,
        startOffset: section.position.start.offset,
        endOffset: section.position.end.offset,
    }
}
export function parse_cache_metadat_2_sections(metadataCache: CachedMetadata): LevelSection[] {
    const headingCache = headingsCacheToMap(metadataCache.headings);
    const match = Match.type<SectionCache>().pipe(
        Match.withReturnType<LevelSection>(),
        Match.when({ type: heading, position: (p) => headingCache.has(getOffsetKey(p)) }, (section) => {
            const head = headingCache.get(getOffsetKey(section.position))!;
            return {
                type: heading,
                level: head.level,
                startOffset: section.position.start.offset,
                endOffset: section.position.end.offset,
            }
        }),
        Match.orElse((section) => parseSection2Content(section)),
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


type BlockWithParent = Omit<Block, 'hash' | 'text'> & { parent: BlockWithParent | BaseBlock };
export function parse_cache_2_block_view(cache: CachedMetadata, get_doc: (start: number, end: number) => string, root: BaseBlock): BlockView {
    const sections = parse_cache_metadat_2_sections(cache);
    const blocks = parse_sections_2_blocks(sections, root);

    const view = blocks.map(column => {
        const column_layout: ColumnLayout = {
            centerBlockIndex: 0,
            blocks: column.map(b => {
                const text = get_doc(b.startOffset, b.endOffset);
                const t_hash = hash(text);
                return {
                    ...b,
                    hash: t_hash,
                    text,
                }
            }),
        }
        return column_layout;
    })
    return view;
}
export function parse_sections_2_blocks(sections: LevelSection[], root: BaseBlock): BlockWithParent[][] {
    if (sections.length === 0) return [];
    let [first, ...rest] = sections;
    if (first!.type === yaml) {
        // root.content = [first];
        root.sections = [first!];
        [first, ...rest] = rest;
    }

    const firstBlock: BlockWithParent = {
        id: crypto.randomUUID(),
        sections: [first!],
        index: 0,
        columnIndex: 0,
        parentId: root.id,
        parent: root,
        startOffset: first!.startOffset,
        endOffset: first!.endOffset,
        state: unselected,
        isEdit: false,
    }
    const columns: BlockWithParent[][] = [[firstBlock]];
    const seed = { blocks: columns, node: firstBlock };

    const result = rest.reduce((sd, current_section) => {
        const { blocks, node } = sd;
        const new_block = traceBackToOrigin(blocks, node, current_section);
        return { blocks, node: new_block };

    }, seed)

    return result.blocks;

}

export function traceBackToOrigin(
    blocks: BlockWithParent[][],
    node: BlockWithParent,
    currentSection: LevelSection): BlockWithParent {

    const result = Match.value({
        nodeColumnIndex: node.columnIndex,
        nodeLevel: node.sections.at(-1)!.level,
        currentLevel: currentSection.level,
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
            () => traceBackToOrigin(blocks, node.parent as BlockWithParent, currentSection)
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
            sections: [currentSection],
            index: blocks[next_column_index]!.length,
            columnIndex: next_column_index,
            parent: node,
            parentId: node.id,
            startOffset: currentSection.startOffset,
            endOffset: currentSection.endOffset,
            state: unselected,
            isEdit: false,
        };
        blocks[next_column_index]!.push(block);
        return block;
    }

    function create_split_block() {
        const block: BlockWithParent = {
            id: crypto.randomUUID(),
            sections: [currentSection],
            index: node.index + 1,
            columnIndex: node.columnIndex,
            parent: node.parent,
            parentId: node.parent.id,
            startOffset: currentSection.startOffset,
            endOffset: currentSection.endOffset,
            state: unselected,
            isEdit: false,
        };
        blocks[block.columnIndex]!.push(block);
        return block;
    }
}


export async function setBlockViewBreadCrumbs(view: BlockView, seletedPosition: Position) {
    const { columnIndex, blockIndex } = seletedPosition;
    const curr_column = view.at(columnIndex);
    const selectedBlock = curr_column?.blocks.at(blockIndex);

    if (!selectedBlock) return;


    //與 fork 同層級需要顯示同一群組的group，這樣視覺上才好辨認
    for (const b of curr_column!.blocks) {
        b.state = b.id === selectedBlock.id
            ? fork
            : b.parentId === selectedBlock.parentId
                ? sibling
                : unselected;
    }
    curr_column!.centerBlockIndex = selectedBlock.index;


    const set_road = Effect.whileLoop(
        Option.fromNullishOr(selectedBlock).pipe(
            Option.map(b => {
                return {
                    target: b.parentId,
                    columnIndex: columnIndex - 1,
                };
            })
        ),
        {
            while: (s) => s.pipe(
                Option.map(({ columnIndex }) => columnIndex),
                Option.flatMap(Option.liftPredicate(n => n >= 0)),
                Option.isSome,
            ),
            step: (s) => {
                const selected = Option.gen(function* () {
                    const { target, columnIndex } = yield* s;
                    const column_layout = yield* Option.fromNullishOr(view[columnIndex]);

                    const selected_block = yield* Option.fromNullishOr(column_layout.blocks.find((b) => b.id === target));

                    column_layout.centerBlockIndex = selected_block.index;

                    return {
                        target: selected_block.parentId,
                        columnIndex: columnIndex - 1,
                    };
                })
                return selected
            },
            body: (s) => {
                const { target, columnIndex } = Option.getOrThrow(s);
                const column_layout = view.at(columnIndex)!;
                for (const b of column_layout.blocks) {
                    b.state = b.id === target ? road : unselected;
                }
                return s;
            }
        }
    );

    //todo return breadcrumbs
    const r = await Effect.runSync(set_road);

    const set_path = Effect.loop({
        parents: [selectedBlock.id],
        start: selectedBlock.endOffset,
        end: pipe(Option.fromNullable(curr_column?.blocks.at(selectedBlock.index + 1)?.startOffset),
            Option.getOrElse(() => Infinity),
        ),
        columnIndex: columnIndex + 1,
    }, {
        while: ({ parents, columnIndex }) => columnIndex < view.length,
        step: ({ columnIndex, start, end }) => {
            const s = Option.gen(function* () {
                const column_layout = yield* Option.fromNullable(view[columnIndex]);
                const blocks = column_layout.blocks;

                const next_parents = blocks.filter(b => b.state === path);


                //應找距離上一層範圍內的區塊，如果沒有則找被選取的區塊最近的區塊。
                const center_block = yield* Option.fromNullable(next_parents.first())
                    .pipe(Option.orElse(() => {
                        const closest_block = blocks.find(b => b.startOffset >= start);
                        return Option.some(closest_block ?? blocks.at(-1)!);
                    }))

                // 如果新的 centerBlockIndex 與舊的 centerBlockIndex 屬於同一個群組，則保持不變，這樣視覺效果比較好
                const old_center_block = yield* Option.fromNullable(column_layout.blocks.at(column_layout.centerBlockIndex));
                if (old_center_block.parentId !== center_block.parentId)
                    column_layout.centerBlockIndex = center_block.index;
                return {
                    parents: next_parents.map(b => b.id),
                    columnIndex: columnIndex + 1,
                    start,
                    end,
                };
            })
            return s.pipe(Option.getOrElse(() => ({ parents: [], columnIndex: columnIndex + 1, start, end })));
        },
        body: (s) => {
            const b = Option.gen(function* () {
                const { parents, columnIndex, start, end } = s;
                const column_layout = yield* Option.fromNullable(view.at(columnIndex));
                const blocks = column_layout.blocks;
                for (const b of blocks) {
                    b.state = b.startOffset < start
                        ? upper_path
                        : b.endOffset > end
                            ? lower_path
                            : path;

                    // start <= b.startOffset && b.startOffset < end ? path : unselected;
                }
                return blocks;
            });
            return b;
        }
    }
    );

    const p = await Effect.runPromise(set_path);

    return;
}
