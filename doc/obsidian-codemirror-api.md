# Obsidian 包裝的 CodeMirror API 整理

## 一、`Editor` 類別 — CM5/CM6 的統一抽象層

**官方文件：** [Plugins/Editor/Editor](https://docs.obsidian.md/Plugins/Editor/Editor) · [Reference/TypeScript+API/Editor](https://docs.obsidian.md/Reference/TypeScript+API/Editor)

Obsidian 底層使用 CodeMirror（CM）作為 Markdown 編輯器引擎。`Editor` 類別是 Obsidian 對 CM6（桌面+行動）與 CM5（legacy 桌面）的橋接抽象，確保插件同時在兩個平台上正常運作，**不應直接存取 CM 實例**。

### 主要方法一覽

| 方法 | 用途 | 官方文件 |
|------|------|----------|
| `getValue()` | 取得整份文件的文字內容 | [getValue](https://docs.obsidian.md/Reference/TypeScript+API/Editor/getValue) |
| `setValue(content)` | 設定整份文件的文字內容 | [setValue](https://docs.obsidian.md/Reference/TypeScript+API/Editor/setValue) |
| `getLine(line)` | 取得指定行（0-indexed）的文字 | [getLine](https://docs.obsidian.md/Reference/TypeScript+API/Editor/getLine) |
| `setLine(n, text)` | 設定指定行的文字 | [setLine](https://docs.obsidian.md/Reference/TypeScript+API/Editor/setLine) |
| `lineCount()` | 取得文件總行數 | [lineCount](https://docs.obsidian.md/Reference/TypeScript+API/Editor/lineCount) |
| `lastLine()` | 取得最後一行的行號 | [lastLine](https://docs.obsidian.md/Reference/TypeScript+API/Editor/lastLine) |
| `getRange(from, to)` | 取得兩個位置之間的文字 | [getRange](https://docs.obsidian.md/Reference/TypeScript+API/Editor/getRange) |
| `replaceRange(text, from, to?)` | 在指定位置插入或取代文字 | [replaceRange](https://docs.obsidian.md/Reference/TypeScript+API/Editor/replaceRange) |
| `getSelection()` | 取得目前選取的文字 | [getSelection](https://docs.obsidian.md/Reference/TypeScript+API/Editor/getSelection) |
| `replaceSelection(text)` | 取代目前選取的文字 | [replaceSelection](https://docs.obsidian.md/Reference/TypeScript+API/Editor/replaceSelection) |
| `listSelections()` | 列出所有目前的選取範圍 | [listSelections](https://docs.obsidian.md/Reference/TypeScript+API/Editor/listSelections) |
| `setSelection(anchor, head)` | 設定單一選取範圍 | [setSelection](https://docs.obsidian.md/Reference/TypeScript+API/Editor/setSelection) |
| `setSelections(ranges, main)` | 設定多個選取範圍 | [setSelections](https://docs.obsidian.md/Reference/TypeScript+API/Editor/setSelections) |
| `somethingSelected()` | 判斷是否有選取文字 | [somethingSelected](https://docs.obsidian.md/Reference/TypeScript+API/Editor/somethingSelected) |
| `getCursor(side?)` | 取得游標位置（`EditorPosition`） | [getCursor](https://docs.obsidian.md/Reference/TypeScript+API/Editor/getCursor) |
| `setCursor(pos, ch?)` | 移動游標到指定位置 | [setCursor](https://docs.obsidian.md/Reference/TypeScript+API/Editor/setCursor) |
| `wordAt(pos)` | 取得游標位置所在單字的範圍 | [wordAt](https://docs.obsidian.md/Reference/TypeScript+API/Editor/wordAt) |
| `offsetToPos(offset)` | 將字元偏移量轉換為 `{line, ch}` 位置 | [offsetToPos](https://docs.obsidian.md/Reference/TypeScript+API/Editor/offsetToPos) |
| `posToOffset(pos)` | 將 `{line, ch}` 位置轉換為字元偏移量 | [posToOffset](https://docs.obsidian.md/Reference/TypeScript+API/Editor/posToOffset) |
| `getScrollInfo()` | 取得目前捲動資訊 | [getScrollInfo](https://docs.obsidian.md/Reference/TypeScript+API/Editor/getScrollInfo) |
| `scrollTo(x, y)` | 捲動到指定座標 | [scrollTo](https://docs.obsidian.md/Reference/TypeScript+API/Editor/scrollTo) |
| `scrollIntoView(range, center)` | 將指定範圍捲動進可視區域 | [scrollIntoView](https://docs.obsidian.md/Reference/TypeScript+API/Editor/scrollIntoView) |
| `focus()` | 聚焦編輯器 | [focus](https://docs.obsidian.md/Reference/TypeScript+API/Editor/focus) |
| `blur()` | 移除編輯器焦點 | [blur](https://docs.obsidian.md/Reference/TypeScript+API/Editor/blur) |
| `hasFocus()` | 判斷編輯器是否有焦點 | [hasFocus](https://docs.obsidian.md/Reference/TypeScript+API/Editor/hasFocus) |
| `refresh()` | 重繪編輯器（排版變更後使用） | [refresh](https://docs.obsidian.md/Reference/TypeScript+API/Editor/refresh) |
| `exec(command)` | 執行編輯器內建指令 | [exec](https://docs.obsidian.md/Reference/TypeScript+API/Editor/exec) |
| `undo()` | 復原 | [undo](https://docs.obsidian.md/Reference/TypeScript+API/Editor/undo) |
| `redo()` | 重做 | [redo](https://docs.obsidian.md/Reference/TypeScript+API/Editor/redo) |
| `transaction(tx)` | 批次發送一個交易（transaction） | [transaction](https://docs.obsidian.md/Reference/TypeScript+API/Editor/transaction) |
| `processLines(read, write)` | 逐行讀取並批次寫入，避免多次 DOM 更新 | [processLines](https://docs.obsidian.md/Reference/TypeScript+API/Editor/processLines) |
| `getDoc()` | 取得文件物件（Document） | [getDoc](https://docs.obsidian.md/Reference/TypeScript+API/Editor/getDoc) |

---

## 二、Editor Extensions — 直接使用 CM6 擴充

**官方文件：** [Plugins/Editor/Editor+extensions](https://docs.obsidian.md/Plugins/Editor/Editor+extensions)

當需要在 **Live Preview 模式**自訂編輯器外觀與行為時，需直接使用 CM6 的 Extension 系統，透過 Obsidian API 注冊：

```ts
// Plugin.onload() 中使用
this.registerEditorExtension([myViewPlugin, myStateField]);
```

> `registerEditorExtension` 對應 CM6 的 `EditorState.create({ extensions: [...] })`，Obsidian 負責在正確時機掛載並於 unload 時清除。

---

## 三、State Management — 狀態管理基礎

**官方文件：** [Plugins/Editor/State+management](https://docs.obsidian.md/Plugins/Editor/State+management)

包裝 CM6 的 **不可變狀態 + Transaction** 模型：

- 狀態變更以 `ChangeSpec` 記錄歷史，支援 undo/redo
- 多個變更可打包為一個 **Transaction**，讓使用者只需 undo 一次

```ts
view.dispatch({
  changes: [
    { from: selectionStart, insert: `"` },
    { from: selectionEnd,   insert: `"` }
  ]
});
```

---

## 四、State Fields — 自訂狀態欄位

**官方文件：** [Plugins/Editor/State+fields](https://docs.obsidian.md/Plugins/Editor/State+fields)

對應 CM6 的 `StateField`。用於：
- 在 CM6 的 EditorState 中儲存**自訂狀態**
- 透過 `StateEffect` 定義狀態轉換邏輯
- 可同時提供 `DecorationSet` 給編輯器渲染

```ts
const addEffect = StateEffect.define<number>();

const calculatorField = StateField.define<number>({
  create: () => 0,
  update(oldState, transaction) { /* 套用 effects */ },
  provide: field => EditorView.decorations.from(field), // 可選：提供裝飾
});
```

---

## 五、View Plugins — 視窗感知插件

**官方文件：** [Plugins/Editor/View+plugins](https://docs.obsidian.md/Plugins/Editor/View+plugins)

對應 CM6 的 `ViewPlugin`。特點：
- 在 **viewport 重新計算後**執行，可讀取可視範圍
- **不能**做會影響 viewport 佈局的變更（如插入換行）
- 生命週期：`constructor` → `update(ViewUpdate)` → `destroy()`

```ts
class MyPlugin implements PluginValue {
  constructor(view: EditorView) { }
  update(update: ViewUpdate) { }
  destroy() { }
}
export const myPlugin = ViewPlugin.fromClass(MyPlugin);
```

---

## 六、Decorations — 編輯器視覺裝飾

**官方文件：** [Plugins/Editor/Decorations](https://docs.obsidian.md/Plugins/Editor/Decorations)

包裝 CM6 的 `Decoration` API，提供四種裝飾類型：

| 類型 | 用途 |
|------|------|
| `Decoration.mark` | 對現有文字套用 CSS class / 樣式 |
| `Decoration.widget` | 在文件中插入自訂 HTML 元素（`WidgetType`） |
| `Decoration.replace` | 隱藏或取代文件片段（可附加 widget） |
| `Decoration.line` | 為整行加上樣式（針對行本身而非內容） |

裝飾來源有兩種方式：
- **State Field**：適合需管理 viewport 以外的裝飾，或變更會影響佈局
- **View Plugin**：效能較佳，只處理可視範圍內的裝飾

---

## 七、Viewport — 可視範圍

**官方文件：** [Plugins/Editor/Viewport](https://docs.obsidian.md/Plugins/Editor/Viewport)

對應 CM6 的 viewport 概念。Obsidian 編輯器為支援百萬行文件，只渲染可見範圍（viewport window）。View Plugin 可透過 `view.visibleRanges` 存取，避免處理整份文件而影響效能。

---

## 八、與 Editor Extension 通訊

**官方文件：** [Plugins/Editor/Communicating+with+editor+extensions](https://docs.obsidian.md/Plugins/Editor/Communicating+with+editor+extensions)

Obsidian API 未直接暴露 `EditorView`，需透過 `@ts-expect-error` 取得底層 CM6 實例：

```ts
// @ts-expect-error, not typed
const editorView = view.editor.cm as EditorView;

// 呼叫 View Plugin 方法
const plugin = editorView.plugin(myPlugin);

// 或 dispatch 到 State Field
editorView.dispatch({ effects: [myEffect.of(value)] });
```

---

## 關係總覽

```
Obsidian Plugin
  ├── Editor (CM5/CM6 抽象) ──── 文字讀寫、游標、選取、捲動
  └── registerEditorExtension()
        ├── StateField  ────────── 自訂狀態管理 + Decoration (全文範圍)
        ├── ViewPlugin  ────────── Viewport 感知 + Decoration (可視範圍)
        └── 其他 CM6 Extensions
```
