import { addIcon, App, Editor, FuzzySuggestModal, setIcon, TFile, type FuzzyMatch } from "obsidian";
import { getFileCached } from "../extension/app";
import { Effect } from "effect";
import { mount } from "svelte";
import fuzzySuggesterItem from "./FuzzySuggesterItem.svelte";
import { range } from "effect/Array";



export type Heading = {
    level: number;
    text: string;
    locate: 'upper' | 'lower';
    isParent: boolean;
}

export type BaseHeading = Omit<Heading, 'isParent'>;

export class FuzzySuggester extends FuzzySuggestModal<Heading> {
    private editor: Editor;
    private file: TFile;
    private current_select: number = 0;
    constructor(app: App, editor: Editor, file: TFile) {
        super(app);
        this.editor = editor;
        this.file = file;
        this.setInstructions([
            { command: "Enter:", purpose: "Copy heading and select text;" },
            { command: "Mouse Click:", purpose: "Insert heading symbol;" },
            { command: "Ctrl/Cmd + Mouse Click:", purpose: "Copy heading;" },
        ]);
    }
    getItems(): Heading[] {
        const cached = this.app.metadataCache.getFileCache(this.file);
        const headings = cached?.headings ?? [];
        if (headings.length === 0) return [];

        const selection = this.editor.getCursor()
        const base_heads: BaseHeading[] = headings.map(h => ({
            level: h.level,
            text: h.heading,
            locate: h.position.start.line <= selection.line ? 'upper' : 'lower',
        }));

        this.current_select = base_heads.findLastIndex(h => h.locate === 'upper');

        const first = base_heads.splice(0, 1).map(h => ({ ...h, isParent: false }));

        const heads = base_heads.reduce((acc, current, i) => {
            const prev = acc[i]!;
            const isParent = prev.level < current.level;
            acc[i] = { ...prev, isParent };
            acc.push({ ...current, isParent: false });
            return acc;
        }, first);

        return heads;
    }
    getItemText(item: Heading): string {
        return `H${item.level} ` + item.text;
    }
    onChooseItem(item: Heading, evt: MouseEvent | KeyboardEvent): void {
        const cursor = this.editor.getCursor();
        const headSybols = "#".repeat(item.level);
        const anchor = cursor.ch + headSybols.length + 1;
        const keep_text = evt.ctrlKey || evt.metaKey;
        const select_range = evt instanceof KeyboardEvent;
        if (keep_text || select_range) {
            const headText = item.text;
            const cursor_head = anchor + headText.length;
            this.editor.replaceRange(headSybols + " " + headText, cursor);
            if (select_range) {
                this.editor.setSelection({ line: cursor.line, ch: anchor }, { line: cursor.line, ch: cursor_head });
            }
            else {
                this.editor.setCursor({ line: cursor.line, ch: cursor_head });
            }
        }
        else {
            this.editor.replaceRange(headSybols + " ", cursor);
            this.editor.setCursor({ line: cursor.line, ch: anchor });
        }
    }
    renderSuggestion(item: FuzzyMatch<Heading>, el: HTMLElement): void {
        const head = item.item;
        // el.textContent = "  ".repeat(head.level - 1) + head.text;
        // console.log('renderSuggestion', item);
        // el.addClass('cm-header', 'cm-header-1');
        // // el.style.borderLeft = '1px solid green';
        // el.style.borderLeftWidth = "5px";
        // el.style.borderLeftStyle = "solid";
        // el.style.borderLeftColor = head.locate === Locate.Upper ? "green" : "red";
        // this.count++;
        // if (this.count === 3) {
        //     el.addClass('is-selected');
        // }

        // el.style.display = "flex";
        // el.style.alignItems = "center";
        // const color = head.locate === 'upper' ? "green" : "red";
        // if (head.isParent) {      
        //     const iconEl = el.createSpan();
        //     setIcon(iconEl, "chevron-down");
        //     iconEl.style.color = color;
        // }
        // el.style.paddingTop = "0px";
        // el.style.paddingBottom = "0px";

        mount(fuzzySuggesterItem, {
            target: el,
            props: {
                heading: head,
            }
        });

    }
    start() {
        this.open();
        if (this.current_select === 0) return;

        //下移多一個，讓超出範圍的內容也顯示在當前畫面
        range(0, this.current_select-1).forEach(() => {
            const down = new KeyboardEvent('keydown', { key: 'ArrowDown' });
            this.modalEl.dispatchEvent(down);
        });
        const target = this.modalEl.getElementsByClassName('is-selected')[0] as HTMLElement;
        console.log('target', target);
        requestAnimationFrame(() => {
            target.scrollIntoView({ block: 'center', behavior: 'instant' });
        });
        // target.scrollIntoView({ block: 'center', behavior: 'instant' });
        
        //this.modalEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
        // this.modalEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));

        //         let offset = 0;
//         const observer = new ResizeObserver(() => {
//             // 3. 計算目標元素相對於容器頂部的絕對距離
//             const containerTop = this.modalEl.getBoundingClientRect().top;
//             const targetTop = target.getBoundingClientRect().top;
//             const currentScrollTop = this.modalEl.scrollTop;

//             // 實際需要捲動到的位置 = 當前捲動量 + 元素相對視窗位置 - 容器相對視窗位置 - 預留邊距
//             const finalScrollTop = currentScrollTop + targetTop - containerTop - offset;
// console.log('finalScrollTop', finalScrollTop, 'currentScrollTop', currentScrollTop, 'targetTop', targetTop, 'containerTop', containerTop, 'offset', offset);
//             // 4. 強制捲動
//             this.modalEl.scrollTo({
//                 top: finalScrollTop,
//                 behavior: 'auto' // 若怕被瀏覽器優化中斷，可改為 'auto'
//             });

//             // 捲動完成後關閉監聽，避免無限循環
//             observer.disconnect();
//         });

//         observer.observe(this.modalEl);


    }
}