import type { EditorView } from "@codemirror/view";


export class CodeMirrorService {
    cm: EditorView;

    constructor(cm: EditorView) {
        this.cm = cm;
    }

    cut(from: number, to: number) {
        const source = this.cm.state.doc.sliceString(from, to);
        const cut_head = to;
        const content = {
            text: source,
            paste: (to: number) => {
                return content.pasteNew(to, source)
            },
            pasteNew: (to: number, text: string) => {
                return this.cm.state.update({
                    changes: [
                        { from: to, insert: text },
                        { from: from, to: cut_head }
                    ]
                });
            }
        }
        return content;
    }
    copy(from: number, to: number) {
        const text = this.cm.state.doc.sliceString(from, to);

        return {
            text,
            paste: (to: number) => {
                return this.cm.state.update({
                    changes: [
                        { from: to, insert: text },
                    ]
                });
            }
        }
    }
}