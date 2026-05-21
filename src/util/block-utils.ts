import { Effect, Option, Schema } from "effect";
import type { Block, BlockView } from "./block-level";
import { find } from "effect/Stream";



export function find_next_section(view: BlockView, column: number, row: number): Option.Option<Block> {
    return Option.gen(function* () {
        const blocks = yield* Option.fromNullable(view.at(column)?.blocks);
        const current_block = yield* Option.fromNullable(blocks.at(row));
        const next_block = yield* Option.some(row + 1).pipe(
            Option.filter(r => r < blocks.length ),
            Option.andThen(next_index => Option.fromNullable(blocks.at(next_index))),
            Option.filter(nb=>nb.parentId === current_block.parentId),
            Option.orElse(() => Option.gen(function* () {
                const prev_column_index = yield* Schema.decodeOption(Schema.NonNegative)(column - 1);
                const parent_block = yield* Option.fromNullable(view.at(prev_column_index)?.blocks.find(b => b.id === current_block.parentId));
                return yield* find_next_section(view, prev_column_index, parent_block.index);
            })
            )
        );

        return next_block;

    })
}