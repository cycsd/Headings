import { MarkdownEditView, MarkdownView, type CachedMetadata, type TFile } from "obsidian";
import type MindMapMdPlugin from "../main";
import { Effect, Option } from "effect";
import { getFileCached } from "../extension/app";
import type { NoSuchElementException, UnknownException } from "effect/Cause";
import { getActiveViewOfType } from "../extension/workspace";
import { EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";



export type Promiseable<T> = T | Promise<T>;

export interface DocumentService {
    getCache(file: TFile): Effect.Effect<{ doc: string, cached: CachedMetadata }, NoSuchElementException | UnknownException, never>;
    subscribe: (callback: (file: TFile, doc: string, cached: CachedMetadata) => Promiseable<boolean>) => void;
    /**
     * return boolean 代表是否有成功送出訊息給訂閱者，成功的定義是訂閱者有收到訊息並且成功處理。
     */
    send: (file: TFile, doc: string, cached: CachedMetadata) => Promiseable<boolean>;
    save: (file: TFile, doc: string) => Promise<string>;
    isStale: (doc: string, cached: CachedMetadata) => boolean;
    openFile: (file: TFile, anchor: number, head: number) => Promise<void>;
    reveal: (file: TFile, anchor: number, head: number) => Promise<void>;
    locate: (file: TFile, anchor: number, head: number) => Promise<MarkdownView>;
}


export class PluginDocumentService implements DocumentService {
    private constructor(private plugin: MindMapMdPlugin) {

    }
    private markdown_view: MarkdownView | null = null;
    async reveal(file: TFile, anchor: number, head: number) {
        const program = Effect.gen(this, function* () {
            const view = yield* Effect.promise(() => this.locate(file, anchor, head));
            view.editor.focus();
        });

        return Effect.runPromise(program);
    }

    async locate(file: TFile, anchor: number, head: number) {
        const program = Effect.gen(this, function* () {
            const view = yield* Option.fromNullable(this.markdown_view)
                .pipe(Option.filter(v => v.file?.path === file.path), Effect.orElse(() => this.open_file(file)));

            this.locate_view(view, anchor, head);
            return view;
        });
        return Effect.runPromise(program);
    }
    open_file(file: TFile) {
        const program = Effect.gen(this, function* () {
            yield* Effect.tryPromise(() => {
                return this.plugin.app.workspace.getLeaf('split').openFile(file);
            });
            this.markdown_view = yield* getActiveViewOfType(this.plugin.app.workspace, MarkdownView);
            return this.markdown_view;
        });

        return program;
    }
    locate_view(view: MarkdownView, anchor: number, head: number) {
        const range = EditorSelection.range(anchor, head);
        view.editor.cm.dispatch({
            selection: range,
            effects: EditorView.scrollIntoView(range, { y: "center" }),
        });
    }

    async openFile(file: TFile, anchor: number, head?: number) {
        const program = Effect.gen(this, function* () {
            const view = yield* this.open_file(file);

            this.locate_view(view, anchor, head ?? anchor);
        });

        return Effect.runPromise(program);

    };
    getCache(file: TFile) {
        return Effect.fromNullable(this.cachedData)
            .pipe(Effect.orElse(() => getFileCached(this.plugin.app, file)))
    }

    static create(plugin: MindMapMdPlugin): PluginDocumentService {
        return new PluginDocumentService(plugin);
    }
    private subscribers: Set<(file: TFile, doc: string, cached: CachedMetadata) => Promiseable<boolean>> = new Set();

    private cachedData: {
        doc: string,
        cached: CachedMetadata,
    } = {
            doc: "",
            cached: {},
        }

    async subscribe(callback: (file: TFile, doc: string, cached: CachedMetadata) => Promiseable<boolean>) {
        this.subscribers.add(callback);
    };

    async send(file: TFile, doc: string, cached: CachedMetadata): Promise<boolean> {
        const results = await Promise.all(Array.from(this.subscribers).map(subscriber => Promise.resolve(subscriber(file, doc, cached))));
        const is_process = results.some(r => r);
        this.cachedData = {
            doc,
            cached,
        };
        return is_process;
    }

    async save(file: TFile, doc: string): Promise<string> {
        //todo vaul.process 效能
        // 再確認 vault.process 是否也只是先寫進 cache,如果是的話這邊應該不用 debouce
        return this.plugin.app.vault.process(file, (data) => doc);
    }

    isStale(doc: string, cached: CachedMetadata): boolean {
        const is_equal = this.cachedData.doc === doc;
        return !is_equal;
    }
}

