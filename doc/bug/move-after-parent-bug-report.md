# 拖曳搬移「最後一個子標題到父節點後面」造成標題被併進段落：問題報告

## 摘要

把某個標題的最後一個子標題，拖到該標題的「後面」（變成兄弟、層級升一級）時，下一個標題會直接黏在被搬走的段落最後一行後面，不再在行首，Markdown 不再把它當標題。

- 影響：資料結構被破壞（標題變成段落文字），可用 Ctrl+Z 還原，但畫面上看起來像整個後續章節被併進別的節點。
- 位置：`src/core/edit.ts` 的 `moveNode`。
- 狀態：已修正，並有回歸測試。

## 重現步驟

文件：

```markdown
## Packing list

- Passport and copies
- Rail pass
  - Exchange order

### Budget
buget paragraph
## Notes for later

The exchange rate is ...
```

1. 拖曳 `### Budget`，放到 `## Packing list` 與 `## Notes for later` 之間的縫。
2. 預期：`## Budget` 成為 `## Packing list` 與 `## Notes for later` 之間的兄弟。
3. 實際：`## Notes for later` 變成 `buget paragraph## Notes for later` 這一行段落文字，被判定為 Budget 的內容。

## 原因

### 落點的解讀

縫的位置可能被解讀成「Notes 的前面」（`before`），也可能是「Packing list 的後面」（`after`）。這次是後者。

`after` 的插入點是目標「整個子樹的結尾」。Budget 本來就是 Packing list 的最後一個子節點，所以插入點落在 Budget 自己的範圍內，也就是會被剪掉的範圍內。

### 搬移的做法

`moveNode` 用「剪下 + 貼上」兩個補丁：

1. 剪下：`deleteNode` 刪掉 Budget。為了不留下多餘空行，它會把段落後面的換行一併吃掉，只在接合處保留一個空行。
2. 貼上：把層級調好的文字插進去。

兩個補丁的範圍不能重疊，所以插入點落在剪掉範圍裡時，程式把它移到剪掉範圍的結尾，也就是 `## Notes for later` 的行首。

### 缺陷

`after` 的寫法是「分隔 + body」，即 `\n\n## Budget\nbuget paragraph`，body 後面不加任何東西。這個寫法的前提是：插入點後面本來就有換行（一般 `after` 時，目標子樹後面還有原本的空行）。

但這個情況下，後面的換行已經在剪下時被吃掉，貼上後變成：

```
...接合處的空行
## Budget
buget paragraph## Notes for later
```

`## Notes for later` 前面沒有換行，不在行首，不再是標題。

### 為什麼其他情況沒事

| 情況 | 為什麼正常 |
|---|---|
| 拖到別的節點旁邊 | 插入點不在剪掉範圍內，後面的換行沒被吃掉 |
| `before`（插在目標前面） | 寫法本來就是「body + 分隔」，分隔接在 body 後面 |
| 搬到檔尾 | 剪掉範圍之後沒有內容，沒有東西會黏上來 |

只有「插入點落在剪掉範圍內、而且是 `after`、而且後面還有內容」會觸發。典型就是把最後一個子標題升級成父節點的兄弟。

## 解法

插入點被移到剪掉範圍結尾時（且是 `after`、後面還有內容），改用 `before` 的寫法：

- body 在前，後面補換行，補到「body 與下一個內容之間剛好一個空行」。
- 後面已經有換行就只補不足的部分，不重複補，避免多出空行。
- 接合處前面的空行是剪下時保留的，所以不再於前面加分隔。
- `nodeStart` 同步改為不含前置分隔的位置，編輯後仍指到 `## Budget`。

修正後的結果：

```markdown
## Packing list

- Passport and copies
...

## Budget
buget paragraph

## Notes for later
```

## 驗證

- 回歸測試：`tests/core/edit.test.ts` 的「最後一個子標題插到父節點後面（插入點落在剪掉的範圍內）：下一個標題不能黏到段落後面」，比對完整輸出與 `nodeStart`。
- 暫時還原修正，測試失敗；套回修正，`tests/core` 78 個測試全過。
- 尚未在 Obsidian 實機操作驗證。

## 後續可考慮

- `moveNode` 的換行處理分散在 `deleteNode` 與貼上兩邊，兩邊對「誰負責空行」的假設只靠註解約定。之後若再遇到類似的黏行問題，可以考慮改成：貼上後統一正規化接合處的換行數，而不是各處各自補。
- 目前測試只涵蓋 `after` 且插入點落在剪掉範圍的一個案例；`list item` 與 section 走的是同一段邏輯，但沒有各自的案例。
