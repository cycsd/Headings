# 區塊縮放
有些區段含有 code 或 table，
固定的 cell 長寬會讓這些內容擠在一起，
如果能讓使用者自行拖放改變 cell 或直接改變表格的長寬，
會方便閱讀。

# 心智圖

## 設計共識 (2026-11-10)

### 架構分層
1. `core/`：純資料的 `Node { id, kind, label, range, content, children }`，不 import obsidian。
2. `adapter/`：`CachedMetadata + doc` 轉成「完整樹」，每個 section 都先是候選節點。
3. `layout/`：純函式 `Layout = (tree, options) => Placement`。Tree Table 的 buildCells 搬到這裡，mindmap、outline 並列。
4. `view/`：Svelte 只拿 layout 輸出畫圖；設定與使用者操作在這一層轉成 policy 傳入。

建樹只有一條路徑（目前 TreeTableView.ts 與 TreeTableHost.svelte 各建一次要收成一條）。
`promote(tree, policy)` 是純函式，決定哪些候選節點升為子節點，其餘留在父節點 content；
切換設定只重跑 promote，不重讀 cache。policy 型別為 `(node) => boolean`，core 不認識 settings。

每層補 vitest，fixture 用 `doc/obsidian-markdown-metaData-cache.json`。
重構前先以現有 buildCells 輸出寫基準測試，確保重構後輸出相同。

### 設定
- `listAsNode` 遷移成 9 種 section 型別各一個開關，全部預設 false：
  paragraph、list、blockquote、callout、code、table、math、html、footnoteDefinition。
  heading 一定是節點；thematicBreak、comment、element、text 永遠不顯示；yaml 屬於「呈現檔案屬性」另一項目。
- `defaultLayout` 分桌面與手機兩個值（`Platform.isMobile`），預設桌面 `mindmap`、手機 `outline`。
- 節點最大寬度，預設 320px，超過的 code / table 在節點內橫向捲動。

### 統一 view
- view type 改為 `headings-view`，class `HeadingsView`。ribbon 與指令改為「開啟 Headings 視圖」。
- Layout registry 註冊 `mindmap`、`tree-table`、`outline`，header action 按鈕切換。
- 選擇寫進該檔 YAML：`headings-layout: mindmap | tree-table | outline`。
- view 層級的節點型別 override（header action 的 Menu，9 個可勾選項，初始值來自全域設定）寫進 `headings-nodes: [list, code]`。
- 用 `app.fileManager.processFrontMatter` 寫入，沒有 frontmatter 就建立；只在使用者實際改動時才寫。
- 讀不到 key 時退回全域設定。
- 寫入會觸發 metadataCache.changed 重建樹，靠穩定 id 保住節點狀態。

### 三種佈局
共用：節點外觀一致，圓角矩形、1px 分支色邊框、分支色淡底（透明度約 0.22），根節點中性色。
分支色依頂層分支序號循環主題八色 `--color-red/orange/yellow/green/cyan/blue/purple/pink`。
heading 節點標題用 markdown inline 渲染；升級節點渲染完整內容。

- **mindmap**（參考 obsidianmd/pele `src/diagrams/mindmap/render.ts`）：
  左右平衡樹，根置中，前幾個分支往右、其餘往左，切點選兩側高度最接近處。
  子樹由下往上疊；間距 GAP_Y 8、GROUP_GAP 18、BRANCH_GAP_Y 28、GAP_X 36、BRANCH_GAP_X 52，抽成 layout options。
  節點是 HTML，父子邊線是 SVG overlay 的三次貝茲曲線（控制點在水平中點）。
  兩段式：先用估計尺寸排，ResizeObserver 回報實際尺寸後重排；layout 輸入含 `sizes: Map<id, {w, h}>`。
  不採用 Pele 的藥丸 / 純文字區分與節點形狀；不做 Pele 的自動大綱切換；只做平衡方向，`side` 參數保留以便之後加「只往右」。
- **tree-table**：現有 CSS grid 搬過來，cell 邊框改用分支色。不需要 SVG 邊線。
- **outline**：縱向排列、依深度縮排（參考 Pele INDENT 28 / STEM 12 / BEND 8），連線用 CSS border + pseudo-element，不進 PanZoom，直接用一般捲動。
  根節點是最上面一列、不縮排、顯示檔名。

### 節點互動
- cell 三塊：標題列、icon 列、內容區。內容區只渲染被點亮型別的 sections，照原文順序，不依型別分組；預設全部不點亮。
- icon 列預設收合：節點只顯示一個小徽章（底下 section 型別數量），點徽章展開 icon 列。
  header 另有「永遠顯示 icon」切換。徽章與 icon 點擊範圍 28px 以上。
- icon 點亮即顯示該型別內容，再點收回。另有「全部展開 / 收合內容」獨立按鈕（不是點標題）。
- chevron 子樹收合：收合節點在 layout 中視為葉節點，顯示隱藏後代數量。三種佈局共用同一份狀態。
- link icon：點開 popover 列出同節點 range 內（不含子孫）的 `cache.links` 加 `cache.embeds`，排除 http 外部網址；
  未解析的連結顯示但不可點。點擊在新的分割 leaf 開該檔的 Headings 視圖。
  節點內文中的連結本身維持 Obsidian 預設行為。
- 升級節點：無標題、直接顯示全部內容、只有含連結時顯示 link icon，沒有內容展開行為。只有 list 有子節點，不往 callout / blockquote 內部拆。
- 穩定 id：heading 用祖先標題文字路徑串接，同名兄弟加序號；升級節點用父 id + 型別 + 序號；list item 用父 id + 序號。
  點亮、icon 展開、子樹收合狀態只存在 view 實例記憶體。

### 其他
- PanZoom 補雙指縮放與雙指平移。
- MindMapMdView 只改名為 BlockView（view type `block-view`），維持未註冊狀態。

## 進度 (2026-11-11)
設計共識的 8 個步驟都已實作：分層重構、設定遷移、統一 view 與 YAML、三種佈局、節點互動、升級節點、PanZoom 雙指、BlockView 改名。
以 vitest 與 svelte-check 驗證，尚未在 Obsidian 內手動測試，第一次實際開啟時要看的點：
- mindmap 兩段式量測是否會抖動（ResizeObserver 回報後重排）。
- `color-mix` 與 `--color-*` 在目前使用的 Obsidian 版本是否有效。
- header 的佈局 / 節點型別選單寫入 YAML 後，cache 更新是否正確重算且不丟節點狀態。
- 手機上雙指縮放與按鈕點擊範圍。
已知未處理：tests/util/parse.test.ts 的 import 路徑在重構前就已失效；eslint 缺 `@eslint/json` 模組跑不起來。

## 延後項目
- 文件內段落連結畫虛線：只畫目標解析為同一檔案且有 `#` 片段的連結，起點是含連結的節點，終點是包含目標位置的節點。
  label 取含連結那一句的開頭 10 字，點擊展開全文。SVG overlay 放 PanZoom 內容層內，ResizeObserver 重算。
- 拖曳重排：第一版只做同父節點重排，寫回重用 HeadingHandlers 的搬移邏輯；跨父節點之後再做。
- 區塊縮放（本文件最上方）。
- BlockView 整合成第四個 Layout（含編輯功能）。
- mindmap「只往右」方向。
- 手機上虛線與拖曳的行為。

## Backlog

呈現檔案名稱、檔案屬性yaml

headings 需要收集底下的段落，
quote、callout、code、links、分隔線、外部連接、圖片、pdf...，
所有 obsidian 支援的 section 格式。

讓 list 也能當作 headings 呈現。
list 本身可能包含子 list

檔案連接呈現

todo list 呈現

## Tree Table


## 時序圖

## 魚骨圖


## algorithm
遇到較小的先不要收斂，因為可能還有更小的需要收斂至該子標題底下
[h1,h2,h3,]
遇到同級或更大的代表當前的子標題都呈現出來了，所以可以開始收斂
[h1,h2,h3,h4,h5,h3_new]
收斂的話往前找到比當前的同級或更大的時候停止，
並且將原來要收斂其他更小的那個標題加入至前一個大標題地下後，
以當前的標題當作新的待會要收斂其他小標題的標題
[h1,h2,h3_new]


將 obsidian CachedMetadata 轉換成 HeadingTree，
規則為標題至下一個標題前的區塊都屬於該標題底下的 sections，
如果下一個標題的階層比較大 (ex: level 3> level 2) 則該標題屬於當前標題的子標題，
需要放入 children 屬性
