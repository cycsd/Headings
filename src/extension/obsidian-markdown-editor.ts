/*
Copy from taskgenius-plugin

https://github.com/taskgenius/taskgenius-plugin

https://github.com/taskgenius/taskgenius-plugin/blob/ee821b0625de383a0ed0b4bfe155afd6e9ce4f33/src/editor-extensions/core/markdown-editor.ts#L31
*/

import { App, Scope } from "obsidian";
import type { MarkdownFileInfo, MarkdownScrollableEditView, TFile, WorkspaceLeaf } from "obsidian";
import { EditorSelection, Prec, type Extension } from "@codemirror/state";
import { EditorView, keymap, placeholder, ViewUpdate, type KeyBinding } from "@codemirror/view";

import { around } from "monkey-around";

/**
 * 模擬 MarkdownView 的最小 owner，ScrollableMarkdownEditor 需要它才能正確捲動
 */
interface EditorOwnerStub {
    app: App;
    onMarkdownScroll: () => void;
    getMode: () => string;
}

interface MarkdownEditorPrototype {
    buildLocalExtensions(this: MarkdownScrollableEditView): Extension[];
}

/**
 * Obsidian 內部 ScrollableMarkdownEditor 類別 (未公開 API)
 */
interface MarkdownEditorConstructor {
    new(app: App, container: HTMLElement, owner: EditorOwnerStub): MarkdownScrollableEditView;
    prototype: MarkdownEditorPrototype;
}

/**
 * owner 的 file 會被外部設定 (讓 Obsidian 的重新命名標題指令可以運作)，因此改為可寫入
 */
type EditorOwner = Omit<MarkdownFileInfo, "file"> & { file: TFile | null; editMode?: unknown };

/**
 * Creates an embeddable markdown editor
 * @param app The Obsidian app instance
 * @param container The container element
 * @param options Editor options
 * @returns A configured markdown editor
 */
export function createEmbeddableMarkdownEditor(
    app: App,
    container: HTMLElement,
    options: Partial<MarkdownEditorProps>
): EmbeddableMarkdownEditor {
    // Get the editor class
    const EditorClass = resolveEditorPrototype(app);

    // Create the editor instance
    return new EmbeddableMarkdownEditor(app, EditorClass, container, options);
}

/**
 * Resolves the markdown editor prototype from the app
 */
export function resolveEditorPrototype(app: App): MarkdownEditorConstructor {
    // Create a temporary editor to resolve the prototype of ScrollableMarkdownEditor
    const widgetEditorView = app.embedRegistry.embedByExtension.md(
        { app, containerEl: createDiv() },
        null,
        ""
    );

    // Mark as editable to instantiate the editor
    widgetEditorView.editable = true;
    widgetEditorView.showEditor();
    const markdownEditorPrototype: unknown = Object.getPrototypeOf(
        Object.getPrototypeOf(widgetEditorView.editMode)
    );

    // Unload to remove the temporary editor
    widgetEditorView.unload();

    // Return the constructor of the (internal) ScrollableMarkdownEditor class
    return (markdownEditorPrototype as { constructor: MarkdownEditorConstructor }).constructor;
}

interface MarkdownEditorProps {
    cursorLocation?: { anchor: number; head: number };
    value?: string;
    cls?: string;
    placeholder?: string;
    singleLine?: boolean; // New option for single line mode

    onEnter: (
        editor: EmbeddableMarkdownEditor,
        mod: boolean,
        shift: boolean
    ) => boolean;
    onEscape: (editor: EmbeddableMarkdownEditor) => void;
    onSubmit: (editor: EmbeddableMarkdownEditor) => void;
    onBlur: (editor: EmbeddableMarkdownEditor) => void;
    onPaste: (e: ClipboardEvent, editor: EmbeddableMarkdownEditor) => void;
    onChange: (update: ViewUpdate) => void;
}

const defaultProperties: MarkdownEditorProps = {
    cursorLocation: { anchor: 0, head: 0 },
    value: "",
    singleLine: false,
    cls: "",
    placeholder: "",

    onEnter: () => false,
    onEscape: () => { },
    onSubmit: () => { },
    // NOTE: Blur takes precedence over Escape (this can be changed)
    onBlur: () => { },
    onPaste: () => { },
    onChange: () => { },
};

/**
 * A markdown editor that can be embedded in any container
 */
export class EmbeddableMarkdownEditor {
    options: MarkdownEditorProps;
    initial_value: string;
    scope: Scope;
    editor: MarkdownScrollableEditView;

    // Expose commonly accessed properties
    get editorEl(): HTMLElement {
        return this.editor.editorEl;
    }
    get containerEl(): HTMLElement {
        return this.editor.containerEl;
    }
    get activeCM(): EditorView {
        return this.editor.activeCM;
    }
    get app(): App {
        return this.editor.app;
    }
    get owner(): EditorOwner {
        return this.editor.owner;
    }
    get _loaded(): boolean {
        return this.editor._loaded;
    }

    /**
     * Construct the editor
     * @param app - Reference to App instance
     * @param EditorClass - The editor class constructor
     * @param container - Container element to add the editor to
     * @param options - Options for controlling the initial state of the editor
     */
    constructor(
        app: App,
        EditorClass: MarkdownEditorConstructor,
        container: HTMLElement,
        options: Partial<MarkdownEditorProps>
    ) {
        // Store user options first
        this.options = { ...defaultProperties, ...options };
        this.initial_value = this.options.value!;
        this.scope = new Scope(app.scope);

        // Prevent Mod+Enter default behavior
        this.scope.register(["Mod"], "Enter", () => true);

        // Use monkey-around to safely patch the method.
        // The factory is an arrow function, so `this` is this EmbeddableMarkdownEditor,
        // while the returned function's `this` is the editor instance being built.
        const uninstaller = around(EditorClass.prototype, {
            buildLocalExtensions: (originalMethod) => {
                const extend = (view: MarkdownScrollableEditView, extensions: Extension[]) =>
                    this.extendLocalExtensions(app, view, extensions);
                return function (this: MarkdownScrollableEditView) {
                    return extend(this, originalMethod.call(this));
                };
            },
        });

        // Create the editor with the app instance
        this.editor = new EditorClass(app, container, {
            app,
            // This mocks the MarkdownView functions, required for proper scrolling
            onMarkdownScroll: () => { },
            getMode: () => "source",
        });

        // Register the uninstaller for cleanup
        this.register(uninstaller);

        // Set up the editor relationship for commands to work
        if (this.owner) {
            this.owner.editMode = this;
            this.owner.editor = this.editor.editor;
        }

        // Set initial content
        this.set(options.value || "", false);

        // Prevent active leaf changes while focused
        this.register(
            around(app.workspace, {
                setActiveLeaf:
                    (oldMethod) =>
                        (leaf: WorkspaceLeaf, ...args: unknown[]) => {
                            if (!this.activeCM?.hasFocus) {
                                Reflect.apply(oldMethod, app.workspace, [leaf, ...args]);
                            }
                        },
            })
        );

        // Blur and focus event handlers are now handled via EditorView.domEventHandlers in buildLocalExtensions

        // Apply custom class if provided
        if (options.cls && this.editorEl) {
            this.editorEl.classList.add(options.cls);
        }

        // Set cursor position if specified
        if (options.cursorLocation && this.editor.editor?.cm) {
            this.editor.editor.cm.dispatch({
                selection: EditorSelection.range(
                    options.cursorLocation.anchor,
                    options.cursorLocation.head
                ),
            });
        }

        // Override onUpdate to call our onChange handler
        const originalOnUpdate = this.editor.onUpdate.bind(this.editor);
        this.editor.onUpdate = (update: ViewUpdate, changed: boolean) => {
            originalOnUpdate(update, changed);
            if (changed) this.options.onChange(update);
        };
    }

    /**
     * Add our custom extensions to the editor's local extensions,
     * only when the editor being built is this instance's editor.
     */
    private extendLocalExtensions(
        app: App,
        view: MarkdownScrollableEditView,
        extensions: Extension[]
    ): Extension[] {
        if (view !== this.editor) {
            return extensions;
        }

        // Add placeholder if configured
        if (this.options.placeholder) {
            extensions.push(placeholder(this.options.placeholder));
        }

        // Add paste, blur, and focus event handlers
        extensions.push(
            EditorView.domEventHandlers({
                paste: (event) => {
                    this.options.onPaste(event, this);
                },
                blur: () => {
                    // Always trigger blur callback and let it handle the logic
                    app.keymap.popScope(this.scope);
                    if (this.options.onBlur) {
                        this.options.onBlur(this);
                    }
                },
                focusin: () => {
                    app.keymap.pushScope(this.scope);
                    app.workspace.activeEditor = this.owner;
                },
            })
        );

        // Add keyboard handlers
        const keyBindings: KeyBinding[] = [
            {
                key: "Enter",
                run: () => this.options.onEnter(this, false, false),
                shift: () => this.options.onEnter(this, false, true),
            },
            {
                key: "Mod-Enter",
                run: () => this.options.onEnter(this, true, false),
                shift: () => this.options.onEnter(this, true, true),
            },
            {
                key: "Escape",
                run: () => {
                    this.options.onEscape(this);
                    return true;
                },
                preventDefault: true,
            },
        ];

        // For single line mode, prevent Enter key from creating new lines
        if (this.options.singleLine) {
            keyBindings[0] = {
                key: "Enter",
                // In single line mode, Enter should trigger onEnter
                run: () => this.options.onEnter(this, false, false),
                // Even with shift, still call onEnter in single line mode
                shift: () => this.options.onEnter(this, false, true),
            };
        }

        extensions.push(Prec.highest(keymap.of(keyBindings)));

        return extensions;
    }

    // Get the current editor value
    get value(): string {
        return this.editor.editor?.cm?.state.doc.toString() || "";
    }

    // Set content in the editor
    set(content: string, focus: boolean = false): void {
        this.editor.set(content, focus);
    }

    // Register cleanup callback
    register(cb: () => unknown): void {
        this.editor.register(cb);
    }

    // Clean up method that ensures proper destruction
    destroy(): void {
        if (this._loaded && typeof this.editor.unload === "function") {
            this.editor.unload();
        }

        this.app.keymap.popScope(this.scope);
        this.app.workspace.activeEditor = null;
        this.containerEl.empty();

        this.editor.destroy();
    }

    // Unload handler
    onunload(): void {
        if (typeof this.editor.onunload === "function") {
            this.editor.onunload();
        }
        this.destroy();
    }

    // Required method for MarkdownScrollableEditView compatibility
    unload(): void {
        if (typeof this.editor.unload === "function") {
            this.editor.unload();
        }
    }
}
