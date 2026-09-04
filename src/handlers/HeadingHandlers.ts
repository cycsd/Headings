import type { CachedMetadata, Editor, EditorPosition } from "obsidian";
import type { Heading } from "./HeadingSuggester";
import { find_heading_block, find_next_heading } from "../extension/cached-metadata";
import { Context, Effect, Layer, Option } from "effect";
import { next } from "effect/Random";
import { EditorView } from "@codemirror/view";
import { EditorService } from "../service/editor-service";
import { AppService } from "../service/app-service";
import { CodeMirrorService } from "../service/codemirror-service";

const heading_handlers = "heading_handlers";
export class HeadingHandlers extends Context.Service<HeadingHandlers,
    {
        readonly go2Heading: (heading: Heading, evt: MouseEvent | KeyboardEvent) => Effect.Effect<void>;
        readonly copyHeading: (heading: Heading, evt: MouseEvent | KeyboardEvent) => Effect.Effect<void>;
        readonly moveHeading: (source: Heading, target: Heading, source_evt: MouseEvent | KeyboardEvent, target_evt: MouseEvent | KeyboardEvent) => Effect.Effect<void, Error>;
        readonly insertHeading: (source: Heading, target: Heading, source_evt: MouseEvent | KeyboardEvent, target_evt: MouseEvent | KeyboardEvent) => Effect.Effect<void, Error>;
        readonly moveCurrentBlock2Heading: (heading: Heading, evt: MouseEvent | KeyboardEvent) => Effect.Effect<void, Error>;
    }
>()(heading_handlers) {
}

export const HeadingHandlersLive = Layer.effect(
    HeadingHandlers,
    Effect.gen(function* () {
        const editor_service = yield* EditorService;
        const editor = yield* editor_service.getEditor();

        const app_service = yield* AppService;
        const app = yield* app_service.getApp();

        return HeadingHandlers.of({
            go2Heading: (heading, evt) => {
                return Effect.sync(() => {
                    const position = { line: heading.position.start.line, ch: heading.position.start.col };
                    editor.setCursor(position);
                    editor.scrollIntoView({ from: position, to: position }, true);
                });
            },
            copyHeading: (heading, evt) => {
                return Effect.sync(() => {
                    const cursor = editor.getCursor();
                    const headSybols = "#".repeat(heading.level);
                    const anchor = cursor.ch + headSybols.length + 1;
                    const keep_text = evt.ctrlKey || evt.metaKey;
                    const select_range = evt instanceof KeyboardEvent;
                    if (keep_text || select_range) {
                        const headText = heading.heading;
                        const cursor_head = anchor + headText.length;
                        editor.replaceRange(headSybols + " " + headText, cursor);
                        if (select_range) {
                            editor.setSelection({ line: cursor.line, ch: anchor }, { line: cursor.line, ch: cursor_head });
                        }
                        else {
                            editor.setCursor({ line: cursor.line, ch: cursor_head });
                        }
                    }
                    else {
                        editor.replaceRange(headSybols + " ", cursor);
                        editor.setCursor({ line: cursor.line, ch: anchor });
                    }
                })
            },
            moveHeading: (source, target) => {
                return Effect.gen(function* () {
                    const file = yield* editor_service.getFile();
                    const cached = yield* Effect.fromNullishOr(app.metadataCache.getFileCache(file));
                    const editor = yield* editor_service.getEditor();
                    const cm = editor.cm;

                    const source_heading_offset = find_heading_block(cached, source).offset ?? cm.state.doc.length;
                    const target_heading_offset = find_next_heading(cached, target).offset ?? cm.state.doc.length;

                    const content = new CodeMirrorService(cm)
                        .cut(source.position.start.offset, source_heading_offset)

                    const tr = content.paste(target_heading_offset);

                    const map_anchor = tr.changes.mapPos(target_heading_offset);
                    cm.dispatch({
                        changes: tr.changes,
                        selection: { anchor: map_anchor, head: map_anchor + content.text.length },
                        effects: EditorView.scrollIntoView(map_anchor, {
                            y: "center",
                        }),
                    });

                });
            },
            insertHeading(source, target) {
                return Effect.gen(function* () {
                    const file = yield* editor_service.getFile();
                    const cached = yield* Effect.fromNullishOr(app.metadataCache.getFileCache(file));
                    const editor = yield* editor_service.getEditor();
                    const cm = editor.cm;

                    const source_heading_offset = find_heading_block(cached, source).offset ?? cm.state.doc.length;
                    const target_block_offset = find_heading_block(cached, target).offset ?? cm.state.doc.length;


                    const cut = { from: source.position.start.offset, to: source_heading_offset };
                    const source_headings = yield* Effect.fromNullishOr(
                        cached
                            .headings
                            ?.filter(h => h.position.start.offset >= source.position.start.offset
                                && h.position.end.offset <= source_heading_offset
                                && h.level < 6
                            )
                    );

                    let text: string
                    const gap = source.level - target.level;
                    if (gap === 1) {
                        text = cm.state.doc.sliceString(cut.from, cut.to);
                    }
                    else if (gap > 1) {
                        // Decrease the heading level by removing '#' characters at the start of each heading
                        const indent = gap - 1;
                        const changes = source_headings
                            .map(h => {
                                const from = h.position.start.offset;
                                return {
                                    from,
                                    to: from + indent
                                }
                            });
                        const tr = cm.state.update({
                            changes: changes
                        });
                        const new_source_offset = tr.changes.mapPos(cut.to);
                        text = tr.state.doc.sliceString(cut.from, new_source_offset);
                    }
                    else {
                        // Increase the heading level by adding '#' characters at the start of each heading
                        const indent = 1 - gap;
                        const changes = source_headings
                            .map(h => {
                                return {
                                    from: h.position.start.offset,
                                    insert: '#'.repeat(Math.min(indent, 6 - h.level))

                                }
                            })

                        const tr = cm.state.update({
                            changes: changes
                        });
                        const new_source_offset = tr.changes.mapPos(cut.to);
                        text = tr.state.doc.sliceString(cut.from, new_source_offset);
                    }

                    const tr = cm.state.update({
                        changes: [
                            { from: cut.from, to: cut.to },
                            { from: target_block_offset, insert: text }
                        ]
                    });

                    const map_anchor = tr.changes.mapPos(target_block_offset);
                    cm.dispatch({
                        changes: tr.changes,
                        selection: { anchor: map_anchor, head: map_anchor + text.length },
                        effects: EditorView.scrollIntoView(map_anchor, {
                            y: "center",
                        }),
                    });

                });
            },
            moveCurrentBlock2Heading: (heading, evt) => {
                const program = Effect.gen(function* () {
                    const file = yield* editor_service.getFile();
                    const cached = yield* Effect.fromNullishOr(app.metadataCache.getFileCache(file));
                    const sections = yield* Effect.fromNullishOr(cached.sections)
                    const cm = editor.cm;
                    const cursor = editor.getCursor();
                    const curr_section = yield* Effect.fromNullishOr(
                        sections
                            .find(s => s.position.start.line <= cursor.line && s.position.end.line >= cursor.line)
                    );
                    const section_from = curr_section.position.start.offset;
                    const section_to = sections
                        .find(s => s.position.start.line > curr_section.position.end.line)?.position.start.offset
                        ?? cm.state.doc.length;

                    const next_heading_offset = find_next_heading(cached, heading).offset ?? cm.state.doc.length;

                    const last_section_in_head_block = sections.findLast(s => s.position.end.offset <= next_heading_offset);
                    const line_break = last_section_in_head_block?.type !== 'heading'
                        && next_heading_offset - last_section_in_head_block!.position.end.offset <= 1
                        ? cm.state.lineBreak.repeat(2 - (next_heading_offset - last_section_in_head_block!.position.end.offset))
                        : "";

                    const content = new CodeMirrorService(cm)
                        .cut(section_from, section_to);
                    const text = line_break + content.text;
                    // const text = line_break + cm.state.sliceDoc(section_from, section_to);

                    const tr = content.pasteNew(next_heading_offset, text);
                    // const tr = editor.cm.state.update({
                    //     changes: [
                    //         {
                    //             from: next_heading_offset,
                    //             insert: text,
                    //         },
                    //         {
                    //             from: section_from,
                    //             to: section_to,
                    //             insert: ""
                    //         }
                    //     ]
                    // })

                    const map_anchor = tr.changes.mapPos(next_heading_offset);
                    cm.dispatch({
                        changes: tr.changes,
                        selection: { anchor: map_anchor, head: map_anchor + text.length },
                        effects: EditorView.scrollIntoView(map_anchor, {
                            y: "center",
                        }),
                    });

                })
                return program;
            }
        })
    })
)



export function InsertHeading(editor: Editor, item: Heading, evt: MouseEvent | KeyboardEvent): void {

}

