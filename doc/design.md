
# CodeMirror 6 問題
將文字移往前，遊標位置如何變化？
將文字移往後，遊標位置如何變化？
改動的地方在遊標之後，遊標位置不變，
如果改動的地方在遊標之前，遊標位置會變化

## CodeMirror如何處理變更
會整合所有改動，在對原文件做變更，
下面這個範例雖然 2~3 的範圍重疊了，
但 codemirror 會先將刪除的範圍擴展成 0~5 ，
然後看分別要插入哪些值，將這些值合併後，在一次對原文件進行更改
```js
const tr = view.state.update(
  {
    changes:[{from:2,to:3,insert:'2'},{from:0,to:5,'05'}]
  }
)

view.dispatch({
  changes:tr.changes
})
```



# Move Block Example

## Move to this Heading


## Current Heading
block under heading 與 heading 間沒有分段 line break，
只有一個換行 Line break

block 與 block 之間除了換行 Line break ，才有再多一個分段 line break。