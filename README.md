# MindMapMd

MindMapMd 是一個將 Markdown 文件結構視覺化的 Obsidian 插件構想。它不是把筆記轉成獨立格式，而是維持 Markdown 作為唯一資料來源，並用心智圖式介面協助使用者理解整份文件的階層、快速調整 heading 結構，以及在圖形模式下直接編輯內容。

目前這個專案仍處於早期開發階段，程式碼骨架仍是 Obsidian sample plugin。這份 README 反映的是目前的產品設計、問題定義與預計實作方向。

## 專案目標

整理長篇筆記時，純 Markdown 編輯器很難快速看出整體層級，尤其在以下情境特別明顯：

- 不容易掌握目前文件的整體架構。
- 調整某個 heading 的層級時，底下所有子階層也需要一起調整。
- 使用現有文字型工具做階層變更，效率與可視性都不夠直覺。

MindMapMd 想解決的核心問題是：

- 用圖像化方式呈現 Markdown 結構。
- 讓使用者能直接從視覺結構編輯文件，而不是只把它當成只讀預覽。
- 在不脫離 Markdown 的前提下，提供更直觀的階層操作體驗。

## 產品定位

MindMapMd 的本質仍然是 Markdown 編輯器的延伸視圖。

- Markdown 是唯一真實資料來源。
- 心智圖只是文件結構的另一種編輯與瀏覽方式。
- 使用者在圖上拖拉、調整層級、切換區塊時，最終都應回寫成合法的 Markdown。

## 預期功能

### 核心視圖

- 將 Markdown 內容依 heading 與區塊階層轉成心智圖結構。
- 以目前操作中的區塊為視覺中心，提升聚焦效率。
- 支援不只一種佈局，後續可擴展為心智圖、魚骨圖等不同呈現方式。

### 視圖內編輯

- 在心智圖模式下直接編輯節點內容。
- 允許拖拉節點改變階層。
- 當一個 heading 被移動或升降級時，子節點需一起同步調整。

### 快捷操作

- 提供 shortcut command 提升結構編輯效率。
- 快速跳到目前 heading 區段的最前或最後區塊。
- 快速跳到同階層的最前或最後區塊。
- 合併相鄰區塊。

### 與 Markdown 編輯器同步

- 保持心智圖視圖與原始 Markdown editor 的雙向同步。
- 視圖切換後仍能追蹤原本 editor 狀態。
- 能接收外部 editor 的變更並更新目前視圖。
- 在心智圖中發出的操作，應能轉為 editor transaction 或等效文件更新。

## 目前規劃中的難點

### 1. 結構同步

- 如何在保留 editor 狀態的前提下切換成自訂 view。
- 如何把其他 editor 對同一份文件的修改同步回目前視圖。
- 如何判斷何時需要整體重排，何時只需局部重渲染。

### 2. Markdown 解析與回寫

- heading 下方的段落、quote、list item 應如何分組呈現。
- 使用者在同一個 block 輸入多段內容時，是否自動拆分成多個 block。
- 使用者輸入錯誤層級的 heading 時，應自動修正、保留原樣，或交由使用者決定。

### 3. 拖拉意圖判定

- 拖拉行為是改順序、改父節點，還是改 heading level。
- 拖拉後的 Markdown 重寫邏輯要如何保持穩定可預期。
- 一次移動父節點時，子樹的整體層級變更要如何計算。

### 4. 佈局演算法

- 如何安排同層節點的寬度與間距，讓大型筆記仍可閱讀。
- 是否根據內容長度動態調整節點寬度。
- 如何在水平展開與垂直展開之間切換。
- 如何處理縮放、平移與聚焦區塊置中。

## 建議開發順序

### Phase 1: 驗證基礎同步能力

- 先取得目前 Markdown editor 與文件狀態。
- 建立最小可行自訂 view，把文件結構渲染成唯讀樹狀畫面。
- 驗證 editor 變更是否能即時反映到自訂 view。
- 驗證自訂 view 是否能安全送出文件更新。

### Phase 2: 建立 Markdown 結構模型

- 定義 heading、paragraph、list、quote 等節點模型。
- 把文件解析成可供 UI 與拖拉邏輯使用的中介資料結構。
- 明確定義每種節點對應的回寫規則。

### Phase 3: 完成基礎心智圖介面

- 先完成單一佈局的視覺呈現。
- 支援目前節點聚焦與基本導覽。
- 加入節點內編輯與基本快捷指令。

### Phase 4: 加入拖拉與階層調整

- 處理 drag and drop。
- 實作父子節點重掛載與層級批次調整。
- 釐清拖拉行為的意圖判定規則與使用者回饋方式。

### Phase 5: 擴充進階能力

- 多種佈局模式。
- 每份文件的自訂佈局設定。
- 更完整的 keyboard-first 編輯流程。

## 技術方向

根據目前規劃，技術上會優先驗證以下方向：

- Obsidian custom view 與 Markdown editor 的整合。
- CodeMirror transaction 或等效文件修改流程。
- 事件監聽與外部變更同步。
- 適合節點式操作的 drag and drop UI 套件。

canvas 中目前記錄的參考方向包含：

- MarkMind
- Flexiboards
- Fluid DnD for Svelte
- Heading Shifter

這些工具主要是用來參考互動模式、佈局方式與階層調整體驗，不代表專案一定會直接採用其實作。

## 開發現況

目前 repo 狀態：

- 專案已建立 Obsidian plugin 的 TypeScript 開發環境。
- 已包含 esbuild、TypeScript、ESLint 等基本工具。
- `src/` 內容仍接近 sample plugin，尚未進入 MindMapMd 的正式功能開發。

## 本機開發

### 環境需求

- Node.js 18+
- npm
- Obsidian 桌面版

### 安裝

```bash
npm install
```

### 開發模式

```bash
npm run dev
```

### 正式建置

```bash
npm run build
```

### Lint

```bash
npm run lint
```

## 安裝到 Obsidian 測試

將下列檔案放到你的 vault：

```text
<Vault>/.obsidian/plugins/<plugin-id>/
```

需要的檔案：

- `main.js`
- `manifest.json`
- `styles.css`

之後重新載入 Obsidian，並在 **Settings → Community plugins** 啟用插件。

## 近期里程碑

- 將 sample plugin 骨架改成實際的 MindMapMd plugin 結構。
- 建立可解析 Markdown heading tree 的資料模型。
- 做出第一版唯讀結構視圖。
- 驗證與原始 editor 的同步機制。

## 參考資料

- Obsidian Plugin Docs: https://docs.obsidian.md
- Obsidian sample plugin: https://github.com/obsidianmd/obsidian-sample-plugin
- MarkMind: https://github.com/MarkMindCkm/obsidian-markmind
- Flexiboards: https://www.flexiboards.dev/
- Fluid DnD for Svelte: https://fluid-dnd.netlify.app/svelte/
- Heading Shifter: https://github.com/k4a-l/obsidian-heading-shifter
