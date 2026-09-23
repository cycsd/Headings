
# 心智圖


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

