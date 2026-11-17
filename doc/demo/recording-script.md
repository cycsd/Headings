# README 示範圖錄製腳本

三張圖對應 README「Headings view」一節開頭註解裡的檔名。示範文件用 `doc/demo/headings-view-demo.md`，先複製進一個乾淨的測試 vault。

## 事前準備

- 主題：Obsidian 預設主題，淺色或深色都可以，三張圖用同一個。
- 視窗：約 1400 × 900。把 Headings view 開在右側 split，左側放示範文件的編輯器，寬度大約 4 : 6（編輯器 : view）。
- 外掛設定：
  - 顯示為節點的段落類型：只開「清單」。
  - 預設顯示的內容：開「表格」「程式碼」「callout」。
  - 佈局：桌面預設「心智圖」。節點最大寬度 320、內容最大高度 320。
  - 關閉「開啟檔案時限制展開層數」（全部展開）。
  - 節點外觀：邊框與背景都套用分支顏色。編輯器自訂尺寸關閉。
- 錄 GIF 的工具任選（ScreenToGif、LICEcap、Kap 都可以），15 fps、迴圈播放，每段控制在 6 到 10 秒。
- 錄之前把滑鼠游標放進 view 裡，先滾一下讓根節點置中。

## 1. `headings_view_mindmap.png`（靜態截圖）

目的：一眼看出三件事：心智圖佈局、麵包屑、節點內容。

1. 開啟示範文件，view 切到心智圖，全部展開。
2. 點一下「Day 2: Temples」節點，讓麵包屑顯示「Headings view demo › Itinerary › Day 2: Temples」。
3. 「Day 2」節點的 callout 要是顯示狀態（預設顯示有開 callout）。「Budget」的表格也要看得到。
4. 「Packing list」底下的清單項已升級成節點，會看到「Rail pass」「Camera」各自再分出子節點。
5. 縮放到整張圖剛好塞進 view，截取整個 view 面板（含頂部麵包屑與標題列的圖示）。

## 2. `headings_view_drag.gif`（6–8 秒）

目的：看到小影子、落點佔位框、其他節點讓位，以及三種落點。

1. 起點同上，但把「Budget」與「Notes for later」兩個分支收合（分叉把手點一下），畫面乾淨一點。
2. 按住「Day 3: Arashiyama」的標題列開始拖。
3. 先滑到「Day 1: Arrival」的**上緣**停 1 秒：佔位框出現在 Day 1 前面。
4. 再滑到「Day 1」的**中間**停 1 秒：佔位框變成 Day 1 的子節點。
5. 最後滑到「Day 1」的**下緣**放開：Day 3 插到 Day 1 與 Day 2 之間，寫回後節點被選取。
6. 錄完回到編輯器按一次 Ctrl+Z 還原文件（或直接重新複製示範文件）。

## 3. `headings_view_edit.gif`（8–10 秒）

目的：看到進編輯不跳動、編輯器就是 Obsidian 的編輯器、寫回後左側文件同步。

1. 起點同第 1 張，但「Day 1: Arrival」的內容區要顯示（點節點上的段落 / 清單圖示把它點亮，或直接開「預設顯示：段落、清單」）。
2. 雙擊「Day 1: Arrival」進入編輯。
3. 在「Reserve dinner near the station」那一行末尾按 Enter，清單會自動接續，輸入 `Check the weather`。
4. 把游標移到「Buy an IC card」那行，按 Ctrl+Enter 寫回。
5. 停 1 秒讓觀眾看到左側編輯器裡多了那一行，再點一下 view 裡「Day 1」節點的核取方塊勾選「Buy an IC card」，左側同步變成 `[x]`。

## 收尾

- 三個檔案放到 `doc/img/`，檔名照上面。
- README 七個語言版本的「Headings view」一節開頭都有一行 `<!-- Screenshots to add … -->` 註解，把它換成：

```markdown
![Headings view](./doc/img/headings_view_mindmap.png)
![Drag and drop](./doc/img/headings_view_drag.gif)
![Edit in place](./doc/img/headings_view_edit.gif)
```

- GIF 超過 5 MB 的話降到 12 fps 或縮小錄製範圍，GitHub 的 README 載入會比較快。
