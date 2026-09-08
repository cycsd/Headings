import { App, Editor, FuzzySuggestModal, TFile, type FuzzyMatch, type HeadingCache } from "obsidian";
import { Context, Effect, Layer } from "effect";
import { mount } from "svelte";
import fuzzySuggesterItem from "./HeadingFuzzySuggesterItem.svelte";
import { range } from "effect/Array";
import { EditorService } from "../service/editor-service";
import { AppService } from "../service/app-service";



export interface Heading extends HeadingCache {
    locate: 'upper' | 'lower';
    isParent: boolean;
}

export type BaseHeading = Omit<Heading, 'isParent'>;

const heading_suggester_service = "heading_suggester_service";
export class HeadingSuggesterService extends Context.Service<HeadingSuggesterService, {
    readonly getSuggesterModal: (
        onSelect: (item: Heading, evt: MouseEvent | KeyboardEvent) => Effect.Effect<void, Error>,
        getItem?: (items: Heading[]) => Heading[],
    ) => Effect.Effect<HeadingSuggester>,
}>()(heading_suggester_service, {
    make: Effect.gen(function* () {
        const editor_service = yield* EditorService
        const editor = yield* editor_service.getEditor();
        const file = yield* editor_service.getFile();
        const app_service = yield* AppService;
        const app = yield* app_service.getApp();
        return {
            getSuggesterModal: (onSelect, getItem) => Effect.succeed(new HeadingSuggester(app, editor, file, onSelect, getItem)),
        };
    })
}) {
    static readonly layerWithoutDependencies = Layer.effect(this, this.make)
}

// export const HeadingSuggesterServiceLive = Layer.effect(
//     HeadingSuggesterService,
//     Effect.gen(function* () {
//         const editor_service = yield* EditorService
//         const editor = yield* editor_service.getEditor();
//         const file = yield* editor_service.getFile();
//         const app_service = yield* AppService;
//         const app = yield* app_service.getApp();
//         return HeadingSuggesterService.of({
//             getSuggesterModal: (onSelect) => Effect.succeed(new HeadingSuggester(app, editor, file, onSelect))
//         });
//     })
// );
export class HeadingSuggester extends FuzzySuggestModal<Heading> {
    private editor: Editor;
    private file: TFile;
    private current_select: number = 0;
    private on_select: (item: Heading, evt: MouseEvent | KeyboardEvent) => Effect.Effect<void, Error>;
    private get_items: (items: Heading[]) => Heading[];
    constructor(
        app: App,
        editor: Editor,
        file: TFile,
        onSelect: (item: Heading, evt: MouseEvent | KeyboardEvent) => Effect.Effect<void, Error>,
        getItems: (items: Heading[]) => Heading[] = (items) => items
    ) {
        super(app);
        this.editor = editor;
        this.file = file;
        this.on_select = onSelect;
        this.get_items = getItems;
    }
    getItems(): Heading[] {
        const cached = this.app.metadataCache.getFileCache(this.file);
        const headings = cached?.headings ?? [];
        if (headings.length === 0) return [];

        const selection = this.editor.getCursor()
        const base_heads: BaseHeading[] = headings.map(h => ({
            ...h,
            locate: h.position.start.line <= selection.line ? 'upper' : 'lower',

        }));

        const first = base_heads.splice(0, 1).map(h => ({ ...h, isParent: false }));

        const heads = base_heads.reduce((acc, current, i) => {
            const prev = acc[i]!;
            const isParent = prev.level < current.level;
            acc[i] = { ...prev, isParent };
            acc.push({ ...current, isParent: false });
            return acc;
        }, first);

        const show_heads = this.get_items(heads);
        this.current_select = show_heads.findLastIndex(h => h.locate === 'upper');
        return show_heads;
    }
    getItemText(item: Heading): string {
        return `H${item.level} ` + item.heading;
    }
    onChooseItem(item: Heading, evt: MouseEvent | KeyboardEvent): void {
        Effect.runSyncExit(this.on_select(item, evt));
    }
    renderSuggestion(item: FuzzyMatch<Heading>, el: HTMLElement): void {
        const heading = item.item;

        mount(fuzzySuggesterItem, {
            target: el,
            props: {
                heading,
            }
        });

    }
    start() {
        this.open();
        if (this.current_select === 0) return;

        range(0, this.current_select - 1).forEach(() => {
            const down = new KeyboardEvent('keydown', { key: 'ArrowDown' });
            this.modalEl.dispatchEvent(down);
        });
        const target = this.modalEl.getElementsByClassName('is-selected')[0] as HTMLElement;
        requestAnimationFrame(() => {
            target.scrollIntoView({ block: 'center' });
        });

    }
}