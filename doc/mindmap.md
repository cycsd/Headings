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

## 閱讀性共識 (2026-11-11)
起因：全部展開後每個節點都帶整段內容，心智圖退化成兩條長直欄，父子距離被內容撐開。

### 分層揭露
- header 多一個「展開層級」動作，選單列出 1 層 … N 層、全部，N 為目前樹的最大深度。深度含升級節點，root 為第 0 層。
- 只改子樹收合狀態，不碰已點亮的內容型別。不寫 YAML。
- 指令「展開一層」「收合一層」：基準是 HostState 記住的最後套用層數（0 = 全部），手動點 chevron 不改基準。
  展開一層到最大深度即等同全部；收合一層最少到 1；從全部收合一層等於最大深度減 1。
- 全域設定「預設展開深度」，0 為全部，預設 0，開檔與換檔時套用。

### 內容最大高度
- 設定滑桿與 maxNodeWidth 並列：0 為不限制，120–1200、步進 20，預設 320。
- 限制整個內容區（不是逐個 section），超出在節點內垂直捲動；PanZoom 不處理無修飾鍵的垂直滾輪，所以不衝突。三種佈局都套用。

### 聚焦子樹
- 入口：桌面右鍵、icon 列尾端「…」按鈕，開同一個 Obsidian Menu：「收合其他節點」「以此為根」「展開此子樹」「收合此子樹」。不做雙擊。
- 「以此為根」對 heading 與 list item 啟用（葉節點也可以，用來單獨看一段內容）；升級的一般段落反灰。
- 聚焦後只畫該子樹，該節點套 root 樣式。
- 聚焦是 view 層級暫時狀態：換佈局保留、換檔清掉、不寫 YAML。聚焦中「展開層級」與「收合其他」都以聚焦根為準；離開聚焦不重算。
- 聚焦節點在文件更新後消失時，自動退回完整樹。

### 選取節點與麵包屑 (2026-11-12，取代原本「只在聚焦時顯示」的麵包屑)
- 在節點任何地方放開且沒有拖曳就選取，右鍵也選取；按鈕與連結除外。選取節點加一圈 `--interactive-accent` 外框。
  沒有取消選取，換檔案清掉；id 消失時麵包屑退回只有檔名。選取狀態存 HostState，三種佈局共用。
- 麵包屑放在 LayoutHost 最上方、佈局之前，永遠顯示：檔名 → … → 選取節點的完整路徑，不因聚焦截短。
- 每段為圖示加純文字（不渲染 markdown）：heading 用 heading-1 … heading-6 與 cache 的標題文字；
  list item 用 list、升級段落用 sectionIcon，文字取內容第一行，超過 40 字截斷；檔名段用 file-text。
- 點任一段像 VS Code 一樣彈出 Obsidian Menu，列出該節點父層的全部 children（含自己並打勾，不管收合與型別），每項帶型別圖示；
  檔名那段列第一層節點。不做搜尋與巢狀。
- 選了之後：祖先全部展開，設為選取，再帶到畫面上（心智圖與樹狀表格 PanZoom.centerOnElement 置中、大綱 scrollIntoView，不改縮放）。
  目標在聚焦子樹之外就先離開聚焦。實作：HostState.reveal = { id, seq }，各佈局在下一個 frame 以 data-node-id 找到元素。
- 定位到的節點閃兩下強調色光暈（box-shadow 0 → 10px 淡出，共約 1 秒），置中後的下一個 frame 才開始；直接點選不閃；
  flat 節點向內發光；prefers-reduced-motion 時不播。

### 收合其他節點
- 路徑上的節點（祖先與被點節點）保持展開，其他有子節點的全部收合，包含被點節點的後代，所以結果是只看到它的直接子節點。
  點 root 等於收合到第 1 層。（實作時發現「子樹不變」與「點 root 收合到第 1 層」互相矛盾，取後者。）

### 實作狀態 (2026-11-11)
全部實作完成：core/tree-ops.ts（純函式 + 測試）、view/tree-state.ts（寫回 HostState）、view/breadcrumb.ts、
LayoutHost 麵包屑、TreeNodeBox 右鍵與「…」、HeadingsView 的 layers 動作與節點選單、main.ts 兩個指令、設定兩個滑桿。
手動測試要看的點：右鍵在節點內的連結或程式碼上是否被 Obsidian 的選單搶走；手機長按是否觸發 contextmenu；
聚焦後 mindmap 是否把新的根置中（LayoutHost 以 focusId 當 key 重新掛載）。

### 這輪不做
縮放至全圖、小地圖、點標題置中、「用大綱開啟此子樹」、依層級調整字級與線粗。

## 編輯功能共識 (2026-11-13)

### 分層
- `core/edit.ts` 純函式：節點編輯範圍、新增兄弟、新增子節點、刪除、搬移、調層級。輸入樹與原文，輸出文字補丁 `{from, to, insert}`，vitest 可測。
- `service/document-editor.ts`：headless CodeMirror EditorState 當文件鏡像，帶 history；補丁套上後用 `vault.process` 寫回；
  外部改動（metadataCache.changed 的 doc 與鏡像不同）進來就重設鏡像並清歷史。
- view 只負責進出編輯模式與鍵盤滑鼠，不直接碰文字。

### 節點內編輯
- 用 `createEmbeddableMarkdownEditor`（Obsidian 自己的編輯器）取代節點的標題列與內容區。
- 範圍：heading 節點是標題行到第一個子 heading 之前的全部內容，含已升級的段落；list item 只有自己這一項（不含巢狀子項）；其他升級段落只有自己。
- list item 的縮排：進編輯器前去掉共同縮排，寫回時每一行補回原本的縮排字串（使用者多打的子項也一起縮）。
- 進入：雙擊、F2、節點選單「編輯」。離開並一次寫回：Mod+Enter、點外面。沒有獨立的取消鍵，離開前用 Mod+Z 復原。
  編輯器的其他預設按鍵一律不攔（Enter 清單接續、Esc 取消選取、Mod+B 等照 Obsidian）；Mod+Enter 原本是切換核取方塊，在節點編輯器裡被「送出」蓋掉。
  編輯中不即時寫回，cache 更新不重建樹。
- 寫回時檔案已被外部改過（快照不同）：不硬套，Notice 說明並把輸入放進剪貼簿。

### 新增與刪除
- Enter 新增兄弟：插在選取節點整個子樹之後；heading 同層級 `#` 前綴、list item 同縮排 `- `、升級段落空段落。
- Tab 新增子節點：heading 加在子樹最後、層級加一（最多 6）；list item 加在子項最後、縮排再加一層；升級段落不能加子節點。
  縮排單位從文件既有巢狀項目偵測，偵測不到用 Tab。
- 新增後立刻選取並進入編輯模式。Delete 刪除含子樹，先確認。
- 滑鼠走節點選單：編輯、新增兄弟、新增子節點、刪除。只在 view 內監聽按鍵，不註冊全域指令。

### 方向鍵
- 只在看得到的節點間移動，到邊界不動，沒選取時選根。
- 大綱與樹狀表格：上下為上一列 / 下一列，左父、右第一個子。
- 心智圖：上下為兄弟；左右依分支側別（右側分支右=子、左=父，左側相反）；根節點左右各到該側第一個子節點。
- 移動後一律閃光暈；節點（含把手）有部分在視口外才平移到整個節點可見，節點比視口大就對齊上緣左緣。麵包屑定位維持置中。
  實作：reveal 多一個 mode（center / ensure）。

### 復原
- Mod+Z / Mod+Shift+Z 在 view 有焦點時走 DocumentEditor 的 history，涵蓋新增、刪除、搬移與節點內編輯。

### 第一階段實作狀態 (2026-11-13)
完成：core/edit.ts（+ tests/core/edit.test.ts，13 項）、service/document-editor.ts、view/node-editing.ts、view/keyboard-nav.ts（+ 5 項測試）、
view/confirm-modal.ts、TreeNodeBox 編輯模式與雙擊、LayoutHost 鍵盤與焦點、節點選單四個項目、PanZoom.ensureVisible、reveal mode。
實作上的取捨：
- 新增節點後要等 cache 更新才有節點，所以 NodeEditing 記住新節點的文字起點，收到新樹時用 range.from 找到它再進入編輯。
- 升級段落的兄弟插入「新段落」佔位文字（cache 不會為空行建 section），編輯器掛上時全選，直接打字就取代。
- 以段落為兄弟但 paragraph 沒升級成節點時，新段落會併進父 heading 的內容區，找不到節點就不進入編輯。
- list item 的 range 從「-」開始，第一行縮排在 range 外，寫回只對第二行以後補縮排。
- 每節結尾的 `---` 是 thematicBreak section，屬於前一個 heading，新增兄弟會插在它後面。
手動測試要看：嵌入式編輯器失焦（onBlur）會不會被連結補全的彈窗觸發；Mod+Z 在 view 有焦點時是否被 Obsidian 的全域快捷鍵搶走；
手機上雙擊與 F2 都沒有，只能走「…」選單的「編輯」。

### 拖曳（第二階段）
- 拖到節點上變成它的最後一個子節點，可跨父節點；heading 子樹整體調層級（h2 搬到 h3 底下變 h4，子孫跟著加）。
- 兄弟之間的插入線第二版再做。
- 實作狀態 (2026-11-14)：core/edit.ts 的 canMove / moveNode / shiftHeadingLevels（+ 7 項測試）、view/node-drag.ts（pointer 事件、8px 門檻、
  elementFromPoint 找 data-node-id）、HostState.drag、TreeNodeBox 標題列按下開始、來源淡化與目標虛線外框、搬完用 nodeStart 找回節點並選取。
  規則補充：list item → heading 放在該 heading 內容區最後（editRange 末端，含結尾的 ---）；heading → list item、升級段落 → list item 不允許；
  deleteNode 對 list item 會連同前面的縮排一起刪，否則殘留縮排會黏到下一行。
  第一版的拖曳外觀（游標旁的小影子）被使用者否決，改法見下一節。

### 拖曳外觀共識 (2026-11-14)
- 小影子：超過 8px 門檻後把節點 DOM 複製一份（完整外觀：邊框、顏色、標題、內容）縮成畫面上的 0.6 倍，左上角固定在游標右下 12px，
  最高 240px、超過裁掉並底部淡出。原位的節點與子樹留在原地淡化到 0.4，內容照常顯示（使用者否決了虛線佔位與藏內容）。
  複製品與落點佔位都 pointer-events: none，不擋 elementFromPoint。
- 落點提示：游標停在合法目標上時，用 withDropPlaceholder 複製一棵在目標 children 最後多一個佔位節點的樹（來源不先拿掉），
  三種佈局重算，其他節點真的讓出空間，佔位畫成強調色虛線框、連線一起畫到目標。心智圖在拖曳中對 .placed 的 left/top 加 120ms 過渡。
- 目標收合著看不到預覽時，改在目標節點上畫虛線外框。
- 靠邊自動平移：心智圖與樹狀表格用 PanZoom.panBy、大綱用 scrollBy，邊緣 24px 內每 frame 最多 12px，平移後重算落點。
- Esc 取消；游標不在合法目標上放開等於取消。放開後複製品移除、節點先回原位，寫回後 cache 更新才出現在新位置並選取。

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
