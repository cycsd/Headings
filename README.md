# MindMapMd

MindMapMd 是一個為 Obsidian 設計的 Markdown 結構視覺化插件。它的目標不是發明另一套筆記格式，而是直接建立在原本的 Markdown 之上，提供一個更直觀的心智圖式編輯視圖，讓使用者能看懂整份筆記的階層、快速調整 heading 結構，並在圖形介面中完成編輯。

> 這個專案目前仍在早期設計與原型階段，現有程式碼基底仍接近 Obsidian sample plugin。

## 為什麼做這個插件

當一份筆記越寫越長，純文字的 Markdown 編輯體驗會開始出現幾個問題：

- 很難一眼看出整份文件的層級與結構。
- 調整一個 heading 時，底下整個子樹也常常要跟著一起重整。
- 文字型的階層編輯方式不夠直覺，尤其在大綱重組時成本很高。

MindMapMd 想做的事情很直接：把 Markdown 的結構變成可以看、可以拖、可以編輯的圖。

## 核心概念

- Markdown 是唯一資料來源。
- 心智圖是文件的另一種編輯視圖，不是匯出格式。
- 所有視圖中的操作，最終都必須能穩定回寫成合法的 Markdown。

這代表 MindMapMd 不只是預覽器，而是一個面向「結構編輯」的工作介面。

## 預計體驗

MindMapMd 預期提供以下能力：

- 將 heading 與內容區塊轉成可瀏覽的結構圖。
- 以目前操作中的區塊為視覺中心，降低長文切換成本。
- 直接在圖中編輯節點內容。
- 用 drag and drop 調整節點順序與階層。
- 當父節點升降級或移動時，自動同步處理整個子樹。
- 提供 keyboard-first 的快捷操作來快速整理結構。
- 長期支援不只一種佈局，例如 mind map、fishbone 等視圖模式。

## 這個專案要解的難題

這不是單純把 Markdown 畫成樹狀圖而已。真正困難的部分在於：

- 如何與 Obsidian / CodeMirror editor 保持雙向同步。
- 如何把 heading、paragraph、quote、list 等區塊轉成穩定的中介模型。
- 如何判定拖拉操作的意圖，是改順序、改父節點，還是改層級。
- 如何在大型筆記中維持可讀的佈局、縮放與聚焦體驗。

也因為這些問題，MindMapMd 目前的開發方向會先聚焦在同步模型與最小可行視圖，而不是一開始就做完整 UI。

## 開發現況

目前 repository 狀態如下：

- 已建立 Obsidian plugin 的 TypeScript 開發環境。
- 已配置 Vite、TypeScript 與 ESLint。
- 功能實作仍未開始，`src/` 目前大致仍是 sample plugin 骨架。

換句話說，這是一個正在成形中的產品原型，而不是已可安裝使用的正式插件。

## Roadmap

### Phase 1

- 取得目前 Markdown editor 狀態。
- 建立最小可行的唯讀結構視圖。
- 驗證 editor 變更能否同步到自訂 view。
- 驗證自訂 view 能否安全回寫文件內容。

### Phase 2

- 建立 Markdown 結構模型。
- 定義 heading / paragraph / list / quote 的節點表示。
- 建立穩定的解析與回寫規則。

### Phase 3

- 完成第一版心智圖式介面。
- 加入聚焦、導覽與基本快捷操作。
- 支援節點內編輯。

### Phase 4

- 加入 drag and drop。
- 實作父子節點搬移與層級批次調整。
- 優化互動回饋與操作可預期性。

### Phase 5

- 擴充多種佈局模式。
- 研究每份文件的自訂佈局設定。
- 強化 keyboard-first 的結構編輯流程。

## 本機開發

### 需求

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

### 建置

```bash
npm run build
```

### Lint

```bash
npm run lint
```

## 在 Obsidian 中測試

建置後，將以下檔案放進你的 vault 插件資料夾：

```text
<Vault>/.obsidian/plugins/<plugin-id>/
```

需要的檔案：

- `main.js`
- `manifest.json`
- `styles.css`

重新載入 Obsidian 後，可在 **Settings → Community plugins** 啟用插件。

## 參考方向

目前設計過程中有參考以下專案或工具的互動思路：

- MarkMind
- Flexiboards
- Fluid DnD for Svelte
- Heading Shifter

這些內容主要用來研究互動模式、佈局方式與階層調整體驗，不代表專案一定會直接採用對應實作。

## References

- Obsidian Plugin Docs: https://docs.obsidian.md
- Obsidian sample plugin: https://github.com/obsidianmd/obsidian-sample-plugin
- MarkMind: https://github.com/MarkMindCkm/obsidian-markmind
- Flexiboards: https://www.flexiboards.dev/
- Fluid DnD for Svelte: https://fluid-dnd.netlify.app/svelte/
- Heading Shifter: https://github.com/k4a-l/obsidian-heading-shifter
