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
- 兄弟之間的插入見下方「拖曳插入兄弟共識」。
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
- 複製品的 position / z-index / pointer-events 寫 inline：節點的 scoped 樣式 `.node.svelte-xxx` 比 `.headings-drag-clone` specific，
  寫在 CSS 會被 `.node { position: relative }` 蓋掉，複製品排到 body 最底下看不見（2026-11-14 修正）。

### 拖曳插入兄弟共識 (2026-11-14)
- 分區：以游標在目標節點上的垂直位置決定操作。「放進去」與「插前後」都合法時上 25% 插前面、中 50% 放進去、下 25% 插後面
  （以螢幕像素算，邊區至少 8px、最多節點高的 1/3）；只有「放進去」合法時整個節點都是放進去；只有「插前後」合法時上下各半；
  都不合法就不是目標。不用修飾鍵、不用節點之間的空隙。
- 合法性：「放進去」沿用原規則。「插前後」只允許同種類（標題↔標題、清單項↔清單項、段落↔段落）；跨種類在文字上會變成別的結構
  （段落放在 `## H` 前面其實是前一個節點的內容），結果會跟預覽不一致，所以不允許。目標不能是根節點、聚焦時的可見根、自己、自己的子孫；
  插入位置等於現在位置（放在自己的正上方 / 正下方）視為無效目標。拖到自己父節點的下半部 = 插在父節點後面（往上提一層），合法。
- 文字位置：插前面 = 寫在目標那一行之前（清單項從行首含縮排）；插後面 = 寫在目標整個子樹之後（含收合中的子孫與尾端的 `---`）。
  標題階層改成跟目標一樣、子樹跟著位移；清單項縮排改成跟目標一樣；段落純搬位置。
- 預覽：沿用佔位節點，插在兄弟列的那個 index，其他兄弟讓位；目標外框只在「放進去」且目標收合時畫。
  心智圖根的直接子節點本來依高度切左右兩半，拖曳中把左右分配固定成拖曳開始時的樣子，佔位跟目標同側，不會跳邊。
- 大綱與樹狀表格是流式 / grid 排版，讓位直接跳位不加過渡；排版模式不改（換絕對定位要自己量尺寸、表格同列等高也要自己算，
  只換得拖曳中的滑動）。之後要滑動用 FLIP 疊在現有排版上即可。
- 鍵盤 Alt+↑/↓ 移動順序這輪不做；核心函式以 position（into / before / after）參數設計，之後接鍵盤只是多一個呼叫。
- 實作狀態 (2026-11-14)：core/edit.ts 的 DropPosition / canInsertBeside / canMoveTo / canDrop（含原地判斷）、moveNode 加 position 參數；
  tree-ops.withDropPlaceholder 加 position；HostState.drag.overPosition；node-drag.dropPosition 做分區；mindmapLayout 加 sides 選項，
  MindMap 在拖曳開始時凍結根子節點的左右分配。vitest +8（edit 6、tree-ops 1、deleteNode 1）。
  順手修 deleteNode：原本把後面的空行全吃掉，刪清單最後一項會讓下一段黏進清單；改成接合處最多留一個空行、檔尾一個都不留。
- 抖動修正 (2026-11-14)：使用者回報游標停在分區交界會一直抖。原因是佔位一插進去目標就被推開，用目標的即時矩形重算分區就會
  「插入 → 目標移走 → 取消 → 目標移回 → 插入」循環。改成錨點制：決定目標時記下它當時的螢幕矩形，游標在矩形內只在矩形內換區、
  在佔位框（data-drop-placeholder）上維持原決策、離開兩者才重新 elementFromPoint；自動平移時把內容位移量傳進 refreshDropTarget 移動錨點。
  小影子同時改成只留節點本體，複製時把所有 button（收合把手、icon 列、「…」）拿掉。

### 編輯器尺寸共識 (2026-11-14)
- 使用者回報進編輯節點會突然變很大：編輯器寬度原本撐到節點最大寬度，標題節點的編輯範圍又是整段原文，高度只受節點最大高度限制。
- 新設定「編輯器自訂尺寸」（editorSizeEnabled，預設關）放在節點外觀那組；開著時才顯示「編輯器寬度」（200–1200，預設 360）與
  「編輯器最大高度」（0 不限 / 120–1200，預設 320）。關：寬度 = 節點最大寬度、高度上限 = 節點內容最大高度（現狀）。
- 寬度是固定寬不是上限：進編輯跳一次、之後打字只有高度在動；上限模式會每打一字變寬一點、整排兄弟跟著左右抖，換行點也會飄。
- 高度兜底不綁開關：最後算出的上限為 0 時 CSS 用 50vh，節點不會比畫面高，超過在編輯器內捲動。
- 保持在畫面內：編輯器掛好的下一個 frame 與每次 ResizeObserver 量到變大時 revealNode(ensure, flash=false)；
  看得到就不動，有一部分被遮才最小平移 / 捲動；節點比視口大時 PanZoom.ensureVisible 對齊左上。reveal 多了 flash 欄位，編輯用的不閃光暈。
- 實作：settings-model 的 editorSize() 解析成 HostState.editorWidth / editorMaxHeight；TreeNodeBox 以 --editor-width / --editor-max-height
  畫 .editor，.node.editing 放開 max-width（自訂寬可比節點最大寬度大），flat 的 cell 內仍 max-width: 100%。
- 抖動共識 (2026-11-14，取代上面「保持在畫面內」的 ResizeObserver 做法)：使用者回報進編輯會不自然地抖，起因是編輯器跟著內容長、
  每次長高都重排加平移。改成**尺寸進入時一次定好、編輯期間不變**，內容多了在編輯器內捲動：
  - 關閉自訂尺寸（預設）：依內容貼合。寬 = 原文最長一行的自然寬度，夾在「節點原本的寬」與「節點最大寬度」之間；
    高 = 以該寬度量原文換行後的高度，夾在「節點原本的高」與「節點內容最大高度」（0 時 50vh）之間。
    節點顯示的就是全部內容時幾乎不動；只顯示標題但底下有內容時長一次到剛好裝下。
  - 開啟自訂尺寸：寬 = 設定值；高 = 量原文換行後的高度，至少 4 行、不超過「編輯器最大高度」（0 時 50vh）。
  - 量測在掛 CodeMirror 之前用隱藏探針（editor-size.ts domMeasurer）做，TreeNodeBox 用 $effect.pre 在 DOM 換成編輯器前量節點原本的內容框。
    resolveEditorBox 是純夾值函式，量測注入，有測試。
  - 心智圖的錨點：平常根節點中心不動；編輯中改為編輯節點靠根那一側的上角不動（兄弟往外讓），離開編輯後的第一次重排也沿用。
  - ensure 只在掛好後的下一個 frame 做一次；不再有 ResizeObserver。
  - 編輯器右下角 CSS resize 把手讓使用者自己拉，不記憶。
  - 游標放在開頭（標題行行首）；新增的節點放結尾、新段落全選佔位文字。
  - 開關說明改成「關閉時依節點內容與原本大小決定」。
- 節點定位到 Markdown 共識 (2026-11-15)：節點選單最上面加「在 Markdown 文件定位」（file-text），只有這一個入口（使用者不要快捷鍵與 Mod+點擊）。
  游標放在節點那一行的行首、不選取、捲到中央；根節點到檔案開頭。分頁：先找工作區裡已開著該檔的 Markdown 分頁（多個時優先最近用過的），
  沒有才開：桌面 split、手機 tab。焦點移到編輯器。閱讀模式不切模式，用 setEphemeralState({ line }) 捲到那一行。
  反向（編輯器游標 → 高亮節點）先不做，做法已討論：registerEditorExtension 的 updateListener 看 selectionSet、節流、offset 找最深包含的節點、
  選取 + ensure、不展開收合、編輯 / 拖曳中與自己定位送出的變動略過、標題列開關預設關。
  實作：document-service 的 locate / reveal 改掉只認自己開過的 view 的做法（Effect 版換成 async）。
- 渲染容器 (2026-11-15)：使用者覺得節點渲染出來跟 Canvas 文字節點不像，問是否改用唯讀編輯器顯示。查證：Canvas 沒編輯時用的也是
  閱讀模式渲染（MarkdownRenderer），點進去才換 CodeMirror；差異來自本外掛的渲染 DOM 沒包在 `.markdown-preview-view.markdown-rendered`
  裡，主題的標題字級、標籤膠囊、callout 樣式都沒套上。改法：onRenderMarkdown 包 `.markdown-embed-content > .markdown-preview-view.markdown-rendered`，
  TreeNodeBox 把容器的整頁用樣式（height 100%、overflow、檔案邊距）歸零。渲染器維持 MarkdownRenderer，不換唯讀編輯器（幾百個 CM 實例太重）。
  顯示時標題沒有 `#`、進編輯才有，使用者確認這是要的。
- 尺寸修正共識 (2026-11-14)：使用者要「打開時高度剛好顯示全部內容、不出捲軸，之後多打才出」，而且太小的節點打開編輯器太窄。
  原因是探針用內文字級量「# H1」，即時預覽把標題畫成大字，實際又高又寬。改法：
  - 高度畫完再定：掛上時用估算，CodeMirror 畫完（兩個 frame 後、250ms 再補一次）量 activeCM.scrollDOM.scrollHeight + 4，
    夾在同一組上下限（不低於節點原本的高、不高於上限）後經 onHeight 回給 TreeNodeBox 鎖住；使用者自己拉過就不再碰。可放大也可縮小。
  - 寬度下限：關閉自訂時「節點原本的寬與 200px 取大者」；探針逐行套 --hN-size / --hN-weight / --hN-line-height、程式碼圍欄套等寬字。
  - id 兩題定案：維持標題式 id；外部改動用鏡像與新文件的差異搬狀態，diffPatch 以「行」為單位找共同前綴 / 後綴
    （字元級會把「在 B 前插入 New」算成「B 改名 New」而對錯節點），lastStarts 記上一次載入的樹的起點。
- id 搬移 (2026-11-14)：使用者回報編輯後節點會自己展開 / 收合。節點 id 由標題（heading：父 id/標題）與序號（list item、section）組成，
  改標題、插入或刪除兄弟都會讓 id 變，collapsed / iconsOpen / litTypes / selectedId / focusId 用舊 id 記就對不上，甚至跑到別的節點。
  修法見 view/id-remap.ts：寫回前 collectStarts 記下每個節點的文字起點，DocumentEditor.apply / undo / redo 回傳實際套上的補丁
  （ChangeSet 轉 TextPatch），cache 更新後 mapOffset 把起點穿過補丁、findByStart 在新樹找回同一個節點，remapHostState 搬狀態。
  拖曳搬移的子樹起點對不回去，改用新位置節點的 id 換前綴；搬移的復原則會掉子樹狀態（已知限制）。
  另外 cache 更新是非同步的，編輯中擱置的舊版可能比自己寫回的那版先到：pendingWrite 記 before / after，before 略過（連鏡像都不動）、
  after 才搬狀態與處理 pendingNew、其他內容代表別人改了就放棄。有 mapOffset / buildIdMap 測試。
- 當機修正 (2026-11-14)：第一版編輯中每次長高都走 revealNode，它會 clear + add 整個 collapsed 集合，三種佈局的 placement 全部重算；
  心智圖的 measure attachment 又是每次 render 新函式，Svelte 會把所有節點 unobserve / observe 一輪，全部重新回報初始尺寸，
  一個鍵就是一場風暴，畫面卡死、尺寸量到一半時佈局跑掉。改法：replaceCollapsed 內容相同就不寫；編輯用 requestReveal 只設 reveal 請求；
  ResizeObserver 第一次回報只當基準、之後一個 frame 最多一次；measure attachment 依 id 快取。

## 進度 (2026-11-11)
設計共識的 8 個步驟都已實作：分層重構、設定遷移、統一 view 與 YAML、三種佈局、節點互動、升級節點、PanZoom 雙指、BlockView 改名。
以 vitest 與 svelte-check 驗證，尚未在 Obsidian 內手動測試，第一次實際開啟時要看的點：
- mindmap 兩段式量測是否會抖動（ResizeObserver 回報後重排）。
- `color-mix` 與 `--color-*` 在目前使用的 Obsidian 版本是否有效。
- header 的佈局 / 節點型別選單寫入 YAML 後，cache 更新是否正確重算且不丟節點狀態。
- 手機上雙指縮放與按鈕點擊範圍。
已知未處理：tests/util/parse.test.ts 的 import 路徑在重構前就已失效；eslint 缺 `@eslint/json` 模組跑不起來。

### 核取方塊勾選寫回 (2026-11-15)
- MarkdownRenderer 畫出來的 `input.task-list-item-checkbox` 在非 MarkdownView 容器裡點了不會寫回，自己接 click：
  渲染出來的第 n 個 checkbox 對應該段原文的第 n 個任務行（core/edit.ts taskLineOffsets，跳過程式碼圍欄），
  onRenderMarkdown 多帶這段文字的起點 from，算出行起點後交給 NodeEditing.toggleTask → core toggleTask（空格變 x、其他狀態變空格，長度不變）→ write。
  畫面不自己改 DOM，等 cache 更新重畫。button / a / input 都不算點節點（不選取、不拖曳、不進編輯）。

### 鍵盤收合展開 (2026-11-15)
- 選取節點後 Space 切換它的子節點（同分叉把手），Shift+Space 切換整棵子樹（子樹裡有任何收合就全部展開，否則全部收合）。
  沒有子節點不做事、不往上收父層（左右鍵已是導覽）。展開後 requestReveal(ensure, 不閃)，收合不動。不另外註冊 Obsidian 指令（使用者不要）。

### README 與 description (2026-11-15)
- 七個語言的 README 在簡介後、Commands 前新增「Headings view」一節：佈局、節點、瀏覽、編輯、拖曳、鍵盤表、設定、注意；開頭留待補圖註解。
  簡介改成先講 view 再講指令。package.json 與 manifest.json 的 description 改成以 mind map / outline / drag and drop 等搜尋詞開頭的句子；
  package.json 補 keywords。示範文件 doc/demo/headings-view-demo.md 與錄製腳本 doc/demo/recording-script.md 給使用者截圖用。

### 連結點擊與重複提示 (2026-11-15)
- 非 MarkdownView 容器裡 MarkdownRenderer 畫出的 a.internal-link 沒人處理：onRenderMarkdown 接 click → openLinkText（Mod 開新 leaf）。
  同檔案的 #標題 / #^區塊 用 resolveSubpath 轉成位置、core nodeAtOffset 找含該位置的最深節點 → revealNode，不離開視圖。連結選單原本略過同檔連結（節點只有這種連結時選單是空的、按鈕像壞掉），現在列出並走同一條路。
- Obsidian 會替 aria-label 自動顯示 tooltip，元素再加 title 就兩個；PanZoom 視口的 aria-label="Canvas" 變成常駐提示。全部拿掉 title，容器層（視口、工具列、麵包屑 nav）不放 aria-label。

### 重開 Obsidian 視圖空白 (2026-11-15)
- HeadingsView 沒覆寫 getState()，workspace.json 存到空物件，重開後 setState 沒有檔案。現在 getState 回 { filePath }，setState 用 getAbstractFileByPath 解析回 TFile；
  cache 可能還沒建好，metadataCache resolved 時若還沒 loaded 再 refresh 一次。檔案與分頁的對應放 workspace.json，不進 data.json。

### 每檔記住視圖狀態 (2026-11-15)
- 記收合、聚焦、展開層數、各節點點亮型別；不記選取與 icon 列。有記錄就用記錄，沒有才套「開檔時限制展開層數」。分割視窗各自獨立，最後寫的贏。
- 存 data.json 的 fileViews（路徑 → FileViewMemory），跟設定同一份、saveSettings 一起寫；migrateSettings 把 fileViews 列為已知欄位不丟。
  view/view-memory.ts：讀取驗證（壞的單筆丟掉）、pruneMemory（去掉樹上沒有的 id）、FileViewStore（Map 插入順序當 LRU，上限 200）。
- 寫入：host-state watchFileMemory 用 $effect.root 監看四個欄位 → 500ms debounce → plugin.rememberFileView（內容沒變不寫檔）；換檔與關閉視圖立即 flush。
  memoryPath 在換檔 reset 到第一次建樹之間為 null，那段的清空不算變動，否則會用空狀態蓋掉新檔的記錄。
- 還原：render() 第一次建樹時 restoreNodeState。vault rename / delete 事件搬 / 刪記錄。設定 rememberFileViews（預設開）＋「清除所有記錄」整列動作（SettingDefinitionAction）。

### 搜尋與過濾節點 (2026-11-15)
- 一條搜尋列、兩種模式（漏斗鈕切換，settings.searchMode 記住上次，設定頁不露出）。入口：header 按鈕、指令 search-nodes、LayoutHost 的 Mod+F。
  HostState.search 只放 { query, mode, current, seq }；命中與修剪後的樹在 LayoutHost 用 $derived 算（範圍 visibleRoot，即聚焦子樹；prepareSimpleSearch 比對 contentRange 原文或 listItem.text；core filterTree），
  聚焦改變、樹重建都自動重算，view 不用手動觸發。節點元件經 NodeUi.search（getter 包 $derived）讀 active / filtering / hits。
- 搜尋模式：整棵樹照畫、不淡化。命中用 --text-highlight-bg 畫 2px 環＋淡染背景，目前命中（NodeUi.search.currentId = order[current]）用 --text-highlight-bg-active 3px，跟編輯器 Ctrl+F 同色、與選取的 accent 外框分得開；選取外框照畫在內圈。Enter / Shift+Enter stepSearch 走 revealNode（真的展開路徑、會被每檔記住），所有操作照常。打字不自動跳。
- 過濾模式：LayoutHost 畫修剪後的樹、collapsed 傳空集合；路過祖先淡化；把手不畫、不拖；Space / Enter / Tab / Delete 無聲忽略；
  節點選單的新增 / 刪除 / 收合其他 / 展開收合子樹變灰，以此為根保留（在過濾結果上再縮小範圍）。stepSearch 只選取＋requestReveal，不寫 collapsed。
- 聚焦中搜尋列顯示「在『節點』內」標籤，點了 setFocus(null) 回整份檔案。不用模糊搜尋：內文長時子序列幾乎全中。第一版不在內文 mark 字。

### 心智圖只往右 (2026-11-15)
- 做成心智圖的方向選項而不是第四個佈局 id（使用者的考量：獨立 id 會讓每個 `layoutId === "mindmap"` 判斷都要記兩個，選項以後加「往左」「由上往下」也只是多一個值）。
- 走「設定預設 + YAML 覆寫 + 標題列選單」同一套：設定 `mindmapDirection`（both / right，設定頁是開關「心智圖只往右」），
  YAML `headings-mindmap-direction`，佈局選單底下加分隔線與勾選項「心智圖只往右」（寫 YAML，任何佈局下可見、只在心智圖生效）。
- mindmapLayout 的 `direction: "right"` 等於 sides 全部往右（measureRoot 走 fixedSides 空表）。第一次佈局根不置中，改成左緣在視口 10%、垂直置中
  （PanZoom.positionAt）；方向切換時把錨點歸零當第一次佈局。鍵盤導覽把 direction 傳進 mindmapLayout，規則不變。

### 記住縮放倍率 (2026-11-15)
- 使用者問要不要把倍率記進每檔記錄。結論：記（倍率是對文件調的，Canvas 也記；重開回 1.0 每次都要重調），只記倍率不記平移位置
  （位置跟量測後的座標綁在一起，重開會重新置中），依佈局（mindmap / tree-table）再依平台（desktop / mobile）分開，因為 data.json 會跟 vault 同步。
- 實作：FileViewMemory 多 `zoom?: { desktop?: {...}, mobile?: {...} }`，readFileViews 只留合理值；withZoom 併入目前平台、保留另一平台。
  HostState.zoom 是目前平台的倍率表；PanZoom 加 `zoomLevel` prop（變了就套、不回呼）與 `onZoomChange`（滾輪 / 雙指 / 工具列才回呼），
  MindMap / TreeTable 把它接到 HostState.zoom；watchFileMemory 多追蹤 zoom。沒記錄或關掉記住功能時 zoom 為空，倍率 1。
  設定說明七種語言補上「與縮放倍率（桌面與手機分開記）」。
- 視口位置也記 (2026-11-16)：使用者質疑「記平移會不準」。精確說法：直接存 panX / panY 不準（畫布座標隨尺寸量測與留白變、第一次佈局用預設
  尺寸、還會主動置中），但存「參考點在視口的相對位置」是準的：心智圖存根節點中心的 (fx, fy)、樹狀表格存左上角 (0, 0) 的 (fx, fy)。
  重開時第一次佈局用 positionAt 擺回去，之後「錨點不動」補償會讓它留在那裡。PanZoom 加 onViewportChange（任何平移縮放都叫）與 fractionOf；
  HostState.pan + viewportSeq（換檔加一，佈局據此重擺）；FileViewMemory.pan 與 zoom 同樣依平台、佈局分，withViewport 一起併。

### 新節點的游標與尺寸 (2026-11-16)
- 使用者回報新增標題節點游標在開頭（清單項正常）。程式碼兩者都是 set(value) 後 dispatch 到結尾，差別看不出來；修法不猜：
  聚焦的 setTimeout 裡依 cm.state.doc.length 再 dispatch 一次選取（all / end / start），以最終文件為準。
- 新節點一掛上就在編輯中，量不到原本大小（EditorSizeInput.node 為 null）：關閉自訂時寬 320（夾在 200 與節點最大寬度之間）、高至少 4 行；
  開啟自訂時寬照設定、高至少 4 行。既有節點規則不變。佔位文字「新段落」維持全選。

### 新增節點延後寫入 (2026-11-16)
- 診斷結果：新增一個標題 / 清單項時編輯器被重掛三次（第一次游標在結尾、之後被重設到開頭）。使用者推論是新增當下就把 `## ` 寫進檔案、
  觸發 cache 更新所致。改成「檔案先不動」：HostState.newNode 記下 anchorId / position（after、into）/ 虛擬節點 / 起始文字 / lead（分隔與縮排）/ at，
  LayoutHost 用 insertNodeAt 把虛擬節點（id NEW_NODE_ID）放進顯示的樹，進入編輯；離開時才寫入一次（lead + 內容，清單後續行補縮排），
  寫完 cache 更新後用起點找回節點並選取。編輯期間沒有 cache 更新，不重建樹、不重掛編輯器。
- 離開時內容是空的（只有標記、或沒改佔位文字）直接丟棄、檔案不留痕跡，並選回錨點。Esc 維持編輯器原本的行為，不另外攔。
- 衝突沿用鏡像快照：寫入時檔案與鏡像不同就放棄並把內容放進剪貼簿。新增子節點時先展開目標。錨點被搜尋過濾濾掉等放不進樹時取消新增。
- 已知的小代價：寫入到 cache 更新之間（毫秒級）虛擬節點已消失、真節點還沒出現，可能閃一下。

### 社群外掛審核的風險 (2026-11-17)
- 頁面的 Risks 抓不到（動態載入），由使用者貼上清單。本機補裝 `@eslint/json`（早就列在 devDependencies 卻沒裝，eslint 一直跑不起來）後可用 `npx eslint src` 重現。
- 錯誤：① no-unsupported-api：`revealLeaf`（1.7.2）與 `update()`（1.13.0）比 minAppVersion 1.5.11 新 → 以功能偵測包起來
  （extension/workspace.ts 的 `revealLeaf` helper 有就用、沒有退回 `setActiveLeaf`；設定頁 `rerender` 有 update 才呼叫，否則 `display()`），
  不用調高 minAppVersion。② no-static-styles-assignment：視圖容器的 flex 樣式改成 app.css 的 `.headings-view-content`；拖曳小影子的固定定位樣式改到
  LayoutHost 的全域 CSS（`body > .headings-drag-clone.node` 夠 specific、不會被 `.node` 的 scoped 樣式蓋掉），inline 只剩隨游標與縮放變的值。
  規則只放行「右邊不是字面量」的賦值，`setCssProps` 也只放行 `--` 開頭的鍵。
- 警告：`@codemirror/commands` 補進 dependencies；`instanceof HTMLInputElement` 改 `.instanceOf()`（跨視窗）；探針改用 `createDiv()`；
  `setTimeout` / `requestAnimationFrame` / `clearTimeout` 改 `window.` 版（popout 視窗）。
- 順手修了本機 lint 的幾個錯誤：模板字串裡的物件、`unknown` 轉字串、`any` 賦值。仍保留的警告：`setDynamicTooltip` 與 `display` 被標 deprecated，
  但舊版 Obsidian 的設定頁還需要；Svelte 的 `$state` / `$effect` 在 .svelte.ts 被當成未定義（eslint 設定問題）。

### 進入編輯的快捷鍵 (2026-11-16)
- 使用者回報 F2 進不了編輯。一開始推測是 F2 被 Obsidian 內建「重新命名檔案」搶走，改註冊在視圖 Scope 後仍沒反應；加診斷發現
  `this.scope` 是 null（ItemView 預設沒有 Scope，`this.scope?.register` 靜默什麼都沒做）。真正的原因是這個。
  修法：HeadingsView 建構時 `this.scope = new Scope(this.app.scope)`（父層接全域，沒註冊的快捷鍵照常往上找），onOpen 註冊 F2：
  選取節點進入編輯，編輯中不處理（交給編輯器），回傳 false 代表已處理。LayoutHost 裡原本掛在 DOM 的 F2 分支移除。
- 曾試過 Alt+F2 與 F3 當替代，使用者實測 F2 可用後決定只留 F2，README 七個語言維持「F2 或雙擊」。

### 新增清單項的符號與編號 (2026-11-16)
- 來源是任務清單（`[ ]`、`[x]`、自訂狀態）：新項預設 `- [ ] `，一律未完成；符號跟隨來源的 `-`、`*`、`+`。不打字離開仍視為空、丟棄。
- 有序清單改成自動編號：新增兄弟 = 來源編號加一，分隔符號跟隨來源（`.` / `)`）；後面同一份清單的有序兄弟依序順延，
  只換數字那幾個字元（補丁放 Insertion.extra，與插入補丁同一個交易，所以復原仍一步；NewNodeState.extra 延後到離開編輯才寫）。
  來源與下一個兄弟編號相同（全寫 1. 的懶人寫法）視為不維護編號：新項同數字、不重排。
- 找「同一份清單的後續兄弟」靠樹加 id，不掃文字：清單項 id 是「清單區塊 id : 序號」，去掉最後一段的前綴相同就是同一份
  （tree-ops.followingSiblings，遇到別份清單或非清單項就停）。先前我說「樹分不出來」是錯的，使用者指出後更正。
- 新增子項：有序來源接在最後一個有序子項後面（沒有就從 1 起），無序來源的子項維持原符號。
- 已知取捨：數字位數變多（9 → 10）標記變寬，子項縮排理論上要跟著多一格，Obsidian 對 2 / 4 空格與 Tab 都容忍，需實測。
  Obsidian 對「有序清單緊接無序清單、中間無空行」算一個還是兩個區塊未實測，followingSiblings 之後以標記格式判斷會在換種類處停下，結果仍對。

## 候選功能 (2026-11-15，待使用者篩選)
設計過但延後：反向跟隨（編輯器游標 → 高亮節點，做法見上）、Alt+↑/↓ 移動兄弟順序（順便修搬移復原掉子樹狀態）、
大綱 / 樹狀表格讓位 FLIP 過渡、文件內段落連結畫虛線、區塊縮放、BlockView 第四種佈局、心智圖只往右、手機一輪驗證（拖曳、選取複製、軟鍵盤）。
建議補的：點亮內容進視口才渲染、匯出 PNG / SVG / Markdown 大綱。（每檔記住狀態、搜尋過濾、checkbox 勾選寫回已做，見上。）
另外建議開新功能前先在 Obsidian 內實測這兩天沒驗證的點（Scope 攔 Mod+Enter、衝突 Notice、刪除確認、閱讀模式定位、貼合尺寸）。

## 延後項目
- 文件內段落連結畫虛線：只畫目標解析為同一檔案且有 `#` 片段的連結，起點是含連結的節點，終點是包含目標位置的節點。
  label 取含連結那一句的開頭 10 字，點擊展開全文。SVG overlay 放 PanZoom 內容層內，ResizeObserver 重算。
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
