import { Option, Schema } from "effect";
import type { Block, BlockView } from "./block-level";



export function find_next_section(view: BlockView, column: number, row: number): Option.Option<Block> {
    return Option.gen(function* () {
        const blocks = yield* Option.fromNullishOr(view.at(column)?.blocks);
        const current_block = yield* Option.fromNullishOr(blocks.at(row));
        const next_block = yield* Option.some(row + 1).pipe(
            Option.filter(r => r < blocks.length ),
            Option.andThen(next_index => Option.fromNullishOr(blocks.at(next_index))),
            Option.filter(nb=>nb.parentId === current_block.parentId),
            Option.orElse(() => Option.gen(function* () {
                const prev_column_index = yield* Schema.decodeOption(Schema.Natural)(column - 1);
                const parent_block = yield* Option.fromNullishOr(view.at(prev_column_index)?.blocks.find(b => b.id === current_block.parentId));
                return yield* find_next_section(view, prev_column_index, parent_block.index);
            })
            )
        );

        return next_block;

    })
}