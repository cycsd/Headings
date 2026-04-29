import type { CachedMetadata } from "obsidian";

export const obsidianMarkdownAllSyntaxExampleDoc = "---\ntitle: Obsidian Markdown All Syntax Example\naliases:\n  - OFM Full Demo\n  - Markdown Demo Note\ntags:\n  - demo\n  - obsidian/syntax\ncssclasses:\n  - syntax-demo\nstatus: in-progress\npriority: 5\nreviewed: false\ncreated: 2026-04-21\ndue: 2026-05-01T10:30:00\nrelated: \"[[Another Note]]\"\n---\n\n# Obsidian Markdown 語法總覽\n\n這份文件示範 Obsidian 常用與進階語法。\n\n---\n\n## 1. 文字格式\n\n一般文字、**粗體**、*斜體*、***粗斜體***、~~刪除線~~、==高亮==、`inline code`。\n\n跳脫字元示範：\\*不是斜體\\*、\\#不是標題、1\\. 不是清單。\n\n段落換行示範：這是第一行。  \n這是同段落的下一行（行尾兩個空白）。\n\n---\n\n## 2. 標題層級\n\n# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6\n\n---\n\n## 3. 連結（Wikilink / Markdown Link）\n\n- 基本 wikilink: [[Another Note]]\n- 顯示文字: [[Another Note|自訂顯示名稱]]\n- 指向標題: [[Another Note#Section A]]\n- 同檔標題: [[#4. 清單]]\n- 依關鍵字搜尋標題: [[##syntax]]\n- 依關鍵字搜尋區塊: [[^^demo]]\n\nMarkdown 連結：\n\n- [Obsidian 官方網站](https://obsidian.md)\n- [Vault 內檔案（URL encoded）](Another%20Note.md)\n- [Obsidian URI](obsidian://open?vault=MyVault&file=Another%20Note.md)\n\n---\n\n## 4. 清單\n\n無序清單：\n\n- 項目 A\n- 項目 B\n  - 子項目 B-1\n  - 子項目 B-2\n- 項目 C\n\n有序清單：\n\n1. 步驟一\n2. 步驟二\n   1. 子步驟 2-1\n   2. 子步驟 2-2\n3. 步驟三\n\n待辦清單：\n\n- [ ] 未完成任務\n- [x] 已完成任務\n- [ ] 多層任務\n  - [ ] 子任務 1\n  - [x] 子任務 2\n\n---\n\n## 5. 引用與水平線\n\n> 這是引用。\n> 同一個引用可多行。\n>\n> > 這是巢狀引用。\n\n---\n\n## 6. Callout\n\n> [!note]\n> 這是 note callout。\n\n> [!tip] 自訂標題\n> 這是 tip callout。\n\n> [!warning]- 預設收合\n> 點開才會看到內容。\n\n> [!question]+ 預設展開\n> 可以手動收合。\n\n> [!example] 巢狀 callout\n> > [!info]\n> > 這是內層 callout。\n\n---\n\n## 7. 程式碼\n\nInline code：`const x = 1;`\n\n```ts\nfunction greet(name: string): string {\n  return `Hello, ${name}`;\n}\n```\n\n````markdown\n```python\nprint(\"nested code block demo\")\n```\n````\n\n---\n\n## 8. 表格\n\n| 欄位 | 類型 | 說明 |\n|:-----|:----:|-----:|\n| name | text | 使用者名稱 |\n| age  | num  | 年齡 |\n| vip  | bool | 是否 VIP |\n\n表格中有管線符號需跳脫：\n\n| 範例 | 值 |\n|------|----|\n| link | [[Another Note\\|顯示文字]] |\n| embed | ![[image.png\\|120]] |\n\n---\n\n## 9. 數學公式（LaTeX）\n\n行內公式：$e^{i\\pi} + 1 = 0$。\n\n區塊公式：\n\n$$\n\\frac{d}{dx}(x^2) = 2x\n$$\n\n矩陣：\n\n$$\n\\begin{bmatrix}\na & b \\\\\nc & d\n\\end{bmatrix}\n$$\n\n---\n\n## 10. Mermaid 圖\n\n```mermaid\ngraph TD\n    A[開始] --> B{是否通過?}\n    B -->|是| C[繼續]\n    B -->|否| D[修正]\n    C --> E[完成]\n    D --> B\n```\n\n```mermaid\nsequenceDiagram\n    participant U as User\n    participant P as Plugin\n    U->>P: Open note\n    P-->>U: Render view\n```\n\n---\n\n## 11. 嵌入（Embeds）\n\n- 嵌入整篇筆記：![[Another Note]]\n- 嵌入指定標題：![[Another Note#Section A]]\n- 嵌入區塊：![[Another Note#^block-demo]]\n- 圖片嵌入：![[image.png]]\n- 指定寬度：![[image.png|300]]\n- 指定寬高：![[image.png|640x360]]\n- PDF 指定頁：![[sample.pdf#page=2]]\n- PDF 指定高度：![[sample.pdf#height=400]]\n- 音訊嵌入：![[demo.mp3]]\n\n外部圖片：\n\n![External image](https://picsum.photos/320/180)\n\n---\n\n## 12. 區塊連結（Block ID）\n\n這段文字有 block id，可被連結或嵌入。 ^block-demo\n\n- 連結到本段：[[#^block-demo]]\n- 嵌入本段：![[#^block-demo]]\n\n清單也可有 block id：\n\n- 項目一\n- 項目二\n\n^list-demo\n\n嵌入清單：![[#^list-demo]]\n\n---\n\n## 13. 腳註（Footnotes）\n\n這句話有腳註[^1]，也有命名腳註[^obsidian]。\n\nInline footnote 也可用。^[這是 inline footnote。]\n\n[^1]: 這是數字腳註內容。\n[^obsidian]: 這是命名腳註內容。\n\n---\n\n## 14. 註解（Comments）\n\n這段可見，%%中間這段隱藏%%，閱讀模式不顯示。\n\n%%\n這是多行隱藏註解。\n通常用於草稿、內部備註。\n%%\n\n---\n\n## 15. 標籤（Tags）\n\n內文標籤：#demo #obsidian/syntax #tag-with-dash #tag_with_underscore\n\n---\n\n## 16. HTML 內嵌\n\n<div style=\"padding:8px;border:1px solid #999;border-radius:6px;\">\n  這是 HTML 區塊。\n</div>\n\n<details>\n  <summary>點我展開</summary>\n  這是 details / summary 內容。\n</details>\n\n快捷鍵示範：<kbd>Ctrl</kbd> + <kbd>P</kbd>\n\n---\n\n## 17. 查詢區塊（Query）\n\n```query\ntag:#demo\n```\n\n---\n\n## 18. 參考範例（屬性與連結）\n\n- 這份筆記有 frontmatter 屬性。\n- 可在 Properties 面板直接編輯。\n- 建議搭配 Dataview 或 Bases 做進階查詢。\n";

export const obsidianMarkdownAllSyntaxExampleMetadata = {
  "links": [
    {
      "link": "Another Note",
      "original": "[[Another Note]]",
      "displayText": "Another Note",
      "position": {
        "start": {
          "line": 48,
          "col": 15,
          "offset": 603
        },
        "end": {
          "line": 48,
          "col": 31,
          "offset": 619
        }
      }
    },
    {
      "link": "Another Note",
      "original": "[[Another Note|自訂顯示名稱]]",
      "displayText": "自訂顯示名稱",
      "position": {
        "start": {
          "line": 49,
          "col": 8,
          "offset": 628
        },
        "end": {
          "line": 49,
          "col": 31,
          "offset": 651
        }
      }
    },
    {
      "link": "Another Note#Section A",
      "original": "[[Another Note#Section A]]",
      "displayText": "Another Note > Section A",
      "position": {
        "start": {
          "line": 50,
          "col": 8,
          "offset": 660
        },
        "end": {
          "line": 50,
          "col": 34,
          "offset": 686
        }
      }
    },
    {
      "link": "#4. 清單",
      "original": "[[#4. 清單]]",
      "displayText": "4. 清單",
      "position": {
        "start": {
          "line": 51,
          "col": 8,
          "offset": 695
        },
        "end": {
          "line": 51,
          "col": 18,
          "offset": 705
        }
      }
    },
    {
      "link": "##syntax",
      "original": "[[##syntax]]",
      "displayText": "syntax",
      "position": {
        "start": {
          "line": 52,
          "col": 12,
          "offset": 718
        },
        "end": {
          "line": 52,
          "col": 24,
          "offset": 730
        }
      }
    },
    {
      "link": "^^demo",
      "original": "[[^^demo]]",
      "displayText": "^^demo",
      "position": {
        "start": {
          "line": 53,
          "col": 12,
          "offset": 743
        },
        "end": {
          "line": 53,
          "col": 22,
          "offset": 753
        }
      }
    },
    {
      "link": "Another Note.md",
      "original": "[Vault 內檔案（URL encoded）](Another%20Note.md)",
      "displayText": "Vault 內檔案（URL encoded）",
      "position": {
        "start": {
          "line": 58,
          "col": 2,
          "offset": 810
        },
        "end": {
          "line": 58,
          "col": 45,
          "offset": 853
        }
      }
    },
    {
      "link": "Another Note",
      "original": "[[Another Note\\|顯示文字]]",
      "displayText": "顯示文字",
      "position": {
        "start": {
          "line": 150,
          "col": 9,
          "offset": 1739
        },
        "end": {
          "line": 150,
          "col": 31,
          "offset": 1761
        }
      }
    },
    {
      "link": "#^block-demo",
      "original": "[[#^block-demo]]",
      "displayText": "^block-demo",
      "position": {
        "start": {
          "line": 219,
          "col": 8,
          "offset": 2635
        },
        "end": {
          "line": 219,
          "col": 24,
          "offset": 2651
        }
      }
    }
  ],
  "embeds": [
    {
      "link": "image.png",
      "original": "![[image.png\\|120]]",
      "displayText": "120",
      "position": {
        "start": {
          "line": 151,
          "col": 10,
          "offset": 1774
        },
        "end": {
          "line": 151,
          "col": 29,
          "offset": 1793
        }
      }
    },
    {
      "link": "Another Note",
      "original": "![[Another Note]]",
      "displayText": "Another Note",
      "position": {
        "start": {
          "line": 199,
          "col": 9,
          "offset": 2242
        },
        "end": {
          "line": 199,
          "col": 26,
          "offset": 2259
        }
      }
    },
    {
      "link": "Another Note#Section A",
      "original": "![[Another Note#Section A]]",
      "displayText": "Another Note > Section A",
      "position": {
        "start": {
          "line": 200,
          "col": 9,
          "offset": 2269
        },
        "end": {
          "line": 200,
          "col": 36,
          "offset": 2296
        }
      }
    },
    {
      "link": "Another Note#^block-demo",
      "original": "![[Another Note#^block-demo]]",
      "displayText": "Another Note > ^block-demo",
      "position": {
        "start": {
          "line": 201,
          "col": 7,
          "offset": 2304
        },
        "end": {
          "line": 201,
          "col": 36,
          "offset": 2333
        }
      }
    },
    {
      "link": "image.png",
      "original": "![[image.png]]",
      "displayText": "image.png",
      "position": {
        "start": {
          "line": 202,
          "col": 7,
          "offset": 2341
        },
        "end": {
          "line": 202,
          "col": 21,
          "offset": 2355
        }
      }
    },
    {
      "link": "image.png",
      "original": "![[image.png|300]]",
      "displayText": "300",
      "position": {
        "start": {
          "line": 203,
          "col": 7,
          "offset": 2363
        },
        "end": {
          "line": 203,
          "col": 25,
          "offset": 2381
        }
      }
    },
    {
      "link": "image.png",
      "original": "![[image.png|640x360]]",
      "displayText": "640x360",
      "position": {
        "start": {
          "line": 204,
          "col": 7,
          "offset": 2389
        },
        "end": {
          "line": 204,
          "col": 29,
          "offset": 2411
        }
      }
    },
    {
      "link": "sample.pdf#page=2",
      "original": "![[sample.pdf#page=2]]",
      "displayText": "sample.pdf > page=2",
      "position": {
        "start": {
          "line": 205,
          "col": 10,
          "offset": 2422
        },
        "end": {
          "line": 205,
          "col": 32,
          "offset": 2444
        }
      }
    },
    {
      "link": "sample.pdf#height=400",
      "original": "![[sample.pdf#height=400]]",
      "displayText": "sample.pdf > height=400",
      "position": {
        "start": {
          "line": 206,
          "col": 11,
          "offset": 2456
        },
        "end": {
          "line": 206,
          "col": 37,
          "offset": 2482
        }
      }
    },
    {
      "link": "demo.mp3",
      "original": "![[demo.mp3]]",
      "displayText": "demo.mp3",
      "position": {
        "start": {
          "line": 207,
          "col": 7,
          "offset": 2490
        },
        "end": {
          "line": 207,
          "col": 20,
          "offset": 2503
        }
      }
    },
    {
      "link": "#^block-demo",
      "original": "![[#^block-demo]]",
      "displayText": "^block-demo",
      "position": {
        "start": {
          "line": 220,
          "col": 7,
          "offset": 2659
        },
        "end": {
          "line": 220,
          "col": 24,
          "offset": 2676
        }
      }
    },
    {
      "link": "#^list-demo",
      "original": "![[#^list-demo]]",
      "displayText": "^list-demo",
      "position": {
        "start": {
          "line": 229,
          "col": 5,
          "offset": 2725
        },
        "end": {
          "line": 229,
          "col": 21,
          "offset": 2741
        }
      }
    }
  ],
  "tags": [
    {
      "tag": "#obsidian/syntax",
      "position": {
        "start": {
          "line": 257,
          "col": 11,
          "offset": 3000
        },
        "end": {
          "line": 257,
          "col": 27,
          "offset": 3016
        }
      }
    },
    {
      "tag": "#tag-with-dash",
      "position": {
        "start": {
          "line": 257,
          "col": 28,
          "offset": 3017
        },
        "end": {
          "line": 257,
          "col": 42,
          "offset": 3031
        }
      }
    },
    {
      "tag": "#tag_with_underscore",
      "position": {
        "start": {
          "line": 257,
          "col": 43,
          "offset": 3032
        },
        "end": {
          "line": 257,
          "col": 63,
          "offset": 3052
        }
      }
    }
  ],
  "headings": [
    {
      "heading": "Obsidian Markdown 語法總覽",
      "level": 1,
      "position": {
        "start": {
          "line": 18,
          "col": 0,
          "offset": 287
        },
        "end": {
          "line": 18,
          "col": 24,
          "offset": 311
        }
      }
    },
    {
      "heading": "1. 文字格式",
      "level": 2,
      "position": {
        "start": {
          "line": 24,
          "col": 0,
          "offset": 344
        },
        "end": {
          "line": 24,
          "col": 10,
          "offset": 354
        }
      }
    },
    {
      "heading": "2. 標題層級",
      "level": 2,
      "position": {
        "start": {
          "line": 35,
          "col": 0,
          "offset": 489
        },
        "end": {
          "line": 35,
          "col": 10,
          "offset": 499
        }
      }
    },
    {
      "heading": "H1",
      "level": 1,
      "position": {
        "start": {
          "line": 37,
          "col": 0,
          "offset": 501
        },
        "end": {
          "line": 37,
          "col": 4,
          "offset": 505
        }
      }
    },
    {
      "heading": "H2",
      "level": 2,
      "position": {
        "start": {
          "line": 38,
          "col": 0,
          "offset": 506
        },
        "end": {
          "line": 38,
          "col": 5,
          "offset": 511
        }
      }
    },
    {
      "heading": "H3",
      "level": 3,
      "position": {
        "start": {
          "line": 39,
          "col": 0,
          "offset": 512
        },
        "end": {
          "line": 39,
          "col": 6,
          "offset": 518
        }
      }
    },
    {
      "heading": "H4",
      "level": 4,
      "position": {
        "start": {
          "line": 40,
          "col": 0,
          "offset": 519
        },
        "end": {
          "line": 40,
          "col": 7,
          "offset": 526
        }
      }
    },
    {
      "heading": "H5",
      "level": 5,
      "position": {
        "start": {
          "line": 41,
          "col": 0,
          "offset": 527
        },
        "end": {
          "line": 41,
          "col": 8,
          "offset": 535
        }
      }
    },
    {
      "heading": "H6",
      "level": 6,
      "position": {
        "start": {
          "line": 42,
          "col": 0,
          "offset": 536
        },
        "end": {
          "line": 42,
          "col": 9,
          "offset": 545
        }
      }
    },
    {
      "heading": "3. 連結（Wikilink / Markdown Link）",
      "level": 2,
      "position": {
        "start": {
          "line": 46,
          "col": 0,
          "offset": 552
        },
        "end": {
          "line": 46,
          "col": 34,
          "offset": 586
        }
      }
    },
    {
      "heading": "4. 清單",
      "level": 2,
      "position": {
        "start": {
          "line": 63,
          "col": 0,
          "offset": 931
        },
        "end": {
          "line": 63,
          "col": 8,
          "offset": 939
        }
      }
    },
    {
      "heading": "5. 引用與水平線",
      "level": 2,
      "position": {
        "start": {
          "line": 91,
          "col": 0,
          "offset": 1127
        },
        "end": {
          "line": 91,
          "col": 12,
          "offset": 1139
        }
      }
    },
    {
      "heading": "6. Callout",
      "level": 2,
      "position": {
        "start": {
          "line": 100,
          "col": 0,
          "offset": 1181
        },
        "end": {
          "line": 100,
          "col": 13,
          "offset": 1194
        }
      }
    },
    {
      "heading": "7. 程式碼",
      "level": 2,
      "position": {
        "start": {
          "line": 120,
          "col": 0,
          "offset": 1382
        },
        "end": {
          "line": 120,
          "col": 9,
          "offset": 1391
        }
      }
    },
    {
      "heading": "8. 表格",
      "level": 2,
      "position": {
        "start": {
          "line": 138,
          "col": 0,
          "offset": 1570
        },
        "end": {
          "line": 138,
          "col": 8,
          "offset": 1578
        }
      }
    },
    {
      "heading": "9. 數學公式（LaTeX）",
      "level": 2,
      "position": {
        "start": {
          "line": 155,
          "col": 0,
          "offset": 1802
        },
        "end": {
          "line": 155,
          "col": 17,
          "offset": 1819
        }
      }
    },
    {
      "heading": "10. Mermaid 圖",
      "level": 2,
      "position": {
        "start": {
          "line": 176,
          "col": 0,
          "offset": 1946
        },
        "end": {
          "line": 176,
          "col": 16,
          "offset": 1962
        }
      }
    },
    {
      "heading": "11. 嵌入（Embeds）",
      "level": 2,
      "position": {
        "start": {
          "line": 197,
          "col": 0,
          "offset": 2214
        },
        "end": {
          "line": 197,
          "col": 17,
          "offset": 2231
        }
      }
    },
    {
      "heading": "12. 區塊連結（Block ID）",
      "level": 2,
      "position": {
        "start": {
          "line": 215,
          "col": 0,
          "offset": 2567
        },
        "end": {
          "line": 215,
          "col": 21,
          "offset": 2588
        }
      }
    },
    {
      "heading": "13. 腳註（Footnotes）",
      "level": 2,
      "position": {
        "start": {
          "line": 233,
          "col": 0,
          "offset": 2748
        },
        "end": {
          "line": 233,
          "col": 20,
          "offset": 2768
        }
      }
    },
    {
      "heading": "14. 註解（Comments）",
      "level": 2,
      "position": {
        "start": {
          "line": 244,
          "col": 0,
          "offset": 2890
        },
        "end": {
          "line": 244,
          "col": 19,
          "offset": 2909
        }
      }
    },
    {
      "heading": "15. 標籤（Tags）",
      "level": 2,
      "position": {
        "start": {
          "line": 255,
          "col": 0,
          "offset": 2972
        },
        "end": {
          "line": 255,
          "col": 15,
          "offset": 2987
        }
      }
    },
    {
      "heading": "16. HTML 內嵌",
      "level": 2,
      "position": {
        "start": {
          "line": 261,
          "col": 0,
          "offset": 3059
        },
        "end": {
          "line": 261,
          "col": 14,
          "offset": 3073
        }
      }
    },
    {
      "heading": "17. 查詢區塊（Query）",
      "level": 2,
      "position": {
        "start": {
          "line": 276,
          "col": 0,
          "offset": 3282
        },
        "end": {
          "line": 276,
          "col": 18,
          "offset": 3300
        }
      }
    },
    {
      "heading": "18. 參考範例（屬性與連結）",
      "level": 2,
      "position": {
        "start": {
          "line": 284,
          "col": 0,
          "offset": 3331
        },
        "end": {
          "line": 284,
          "col": 18,
          "offset": 3349
        }
      }
    }
  ],
  "footnotes": [
    {
      "position": {
        "start": {
          "line": 237,
          "col": 22,
          "offset": 2823
        },
        "end": {
          "line": 237,
          "col": 41,
          "offset": 2842
        }
      },
      "id": "[inline2"
    },
    {
      "position": {
        "start": {
          "line": 239,
          "col": 0,
          "offset": 2845
        },
        "end": {
          "line": 239,
          "col": 15,
          "offset": 2860
        }
      },
      "id": "1"
    },
    {
      "position": {
        "start": {
          "line": 240,
          "col": 0,
          "offset": 2861
        },
        "end": {
          "line": 240,
          "col": 22,
          "offset": 2883
        }
      },
      "id": "obsidian"
    }
  ],
  "footnoteRefs": [
    {
      "position": {
        "start": {
          "line": 235,
          "col": 6,
          "offset": 2776
        },
        "end": {
          "line": 235,
          "col": 10,
          "offset": 2780
        }
      },
      "id": "1"
    },
    {
      "position": {
        "start": {
          "line": 235,
          "col": 17,
          "offset": 2787
        },
        "end": {
          "line": 235,
          "col": 28,
          "offset": 2798
        }
      },
      "id": "obsidian"
    }
  ],
  "sections": [
    {
      "type": "yaml",
      "position": {
        "start": {
          "line": 0,
          "col": 0,
          "offset": 0
        },
        "end": {
          "line": 16,
          "col": 3,
          "offset": 285
        }
      }
    },
    {
      "type": "heading",
      "position": {
        "start": {
          "line": 18,
          "col": 0,
          "offset": 287
        },
        "end": {
          "line": 18,
          "col": 24,
          "offset": 311
        }
      }
    },
    {
      "type": "paragraph",
      "position": {
        "start": {
          "line": 20,
          "col": 0,
          "offset": 313
        },
        "end": {
          "line": 20,
          "col": 24,
          "offset": 337
        }
      }
    },
    {
      "type": "thematicBreak",
      "position": {
        "start": {
          "line": 22,
          "col": 0,
          "offset": 339
        },
        "end": {
          "line": 22,
          "col": 3,
          "offset": 342
        }
      }
    },
    {
      "type": "heading",
      "position": {
        "start": {
          "line": 24,
          "col": 0,
          "offset": 344
        },
        "end": {
          "line": 24,
          "col": 10,
          "offset": 354
        }
      }
    },
    {
      "type": "paragraph",
      "position": {
        "start": {
          "line": 26,
          "col": 0,
          "offset": 356
        },
        "end": {
          "line": 26,
          "col": 56,
          "offset": 412
        }
      }
    },
    {
      "type": "paragraph",
      "position": {
        "start": {
          "line": 28,
          "col": 0,
          "offset": 414
        },
        "end": {
          "line": 28,
          "col": 32,
          "offset": 446
        }
      }
    },
    {
      "type": "paragraph",
      "position": {
        "start": {
          "line": 30,
          "col": 0,
          "offset": 448
        },
        "end": {
          "line": 31,
          "col": 18,
          "offset": 482
        }
      }
    },
    {
      "type": "thematicBreak",
      "position": {
        "start": {
          "line": 33,
          "col": 0,
          "offset": 484
        },
        "end": {
          "line": 33,
          "col": 3,
          "offset": 487
        }
      }
    },
    {
      "type": "heading",
      "position": {
        "start": {
          "line": 35,
          "col": 0,
          "offset": 489
        },
        "end": {
          "line": 35,
          "col": 10,
          "offset": 499
        }
      }
    },
    {
      "type": "heading",
      "position": {
        "start": {
          "line": 37,
          "col": 0,
          "offset": 501
        },
        "end": {
          "line": 37,
          "col": 4,
          "offset": 505
        }
      }
    },
    {
      "type": "heading",
      "position": {
        "start": {
          "line": 38,
          "col": 0,
          "offset": 506
        },
        "end": {
          "line": 38,
          "col": 5,
          "offset": 511
        }
      }
    },
    {
      "type": "heading",
      "position": {
        "start": {
          "line": 39,
          "col": 0,
          "offset": 512
        },
        "end": {
          "line": 39,
          "col": 6,
          "offset": 518
        }
      }
    },
    {
      "type": "heading",
      "position": {
        "start": {
          "line": 40,
          "col": 0,
          "offset": 519
        },
        "end": {
          "line": 40,
          "col": 7,
          "offset": 526
        }
      }
    },
    {
      "type": "heading",
      "position": {
        "start": {
          "line": 41,
          "col": 0,
          "offset": 527
        },
        "end": {
          "line": 41,
          "col": 8,
          "offset": 535
        }
      }
    },
    {
      "type": "heading",
      "position": {
        "start": {
          "line": 42,
          "col": 0,
          "offset": 536
        },
        "end": {
          "line": 42,
          "col": 9,
          "offset": 545
        }
      }
    },
    {
      "type": "thematicBreak",
      "position": {
        "start": {
          "line": 44,
          "col": 0,
          "offset": 547
        },
        "end": {
          "line": 44,
          "col": 3,
          "offset": 550
        }
      }
    },
    {
      "type": "heading",
      "position": {
        "start": {
          "line": 46,
          "col": 0,
          "offset": 552
        },
        "end": {
          "line": 46,
          "col": 34,
          "offset": 586
        }
      }
    },
    {
      "type": "list",
      "position": {
        "start": {
          "line": 48,
          "col": 0,
          "offset": 588
        },
        "end": {
          "line": 53,
          "col": 22,
          "offset": 753
        }
      }
    },
    {
      "type": "paragraph",
      "position": {
        "start": {
          "line": 55,
          "col": 0,
          "offset": 755
        },
        "end": {
          "line": 55,
          "col": 12,
          "offset": 767
        }
      }
    },
    {
      "type": "list",
      "position": {
        "start": {
          "line": 57,
          "col": 0,
          "offset": 769
        },
        "end": {
          "line": 59,
          "col": 70,
          "offset": 924
        }
      }
    },
    {
      "type": "thematicBreak",
      "position": {
        "start": {
          "line": 61,
          "col": 0,
          "offset": 926
        },
        "end": {
          "line": 61,
          "col": 3,
          "offset": 929
        }
      }
    },
    {
      "type": "heading",
      "position": {
        "start": {
          "line": 63,
          "col": 0,
          "offset": 931
        },
        "end": {
          "line": 63,
          "col": 8,
          "offset": 939
        }
      }
    },
    {
      "type": "paragraph",
      "position": {
        "start": {
          "line": 65,
          "col": 0,
          "offset": 941
        },
        "end": {
          "line": 65,
          "col": 5,
          "offset": 946
        }
      }
    },
    {
      "type": "list",
      "position": {
        "start": {
          "line": 67,
          "col": 0,
          "offset": 948
        },
        "end": {
          "line": 71,
          "col": 6,
          "offset": 992
        }
      }
    },
    {
      "type": "paragraph",
      "position": {
        "start": {
          "line": 73,
          "col": 0,
          "offset": 994
        },
        "end": {
          "line": 73,
          "col": 5,
          "offset": 999
        }
      }
    },
    {
      "type": "list",
      "position": {
        "start": {
          "line": 75,
          "col": 0,
          "offset": 1001
        },
        "end": {
          "line": 79,
          "col": 6,
          "offset": 1049
        }
      }
    },
    {
      "type": "paragraph",
      "position": {
        "start": {
          "line": 81,
          "col": 0,
          "offset": 1051
        },
        "end": {
          "line": 81,
          "col": 5,
          "offset": 1056
        }
      }
    },
    {
      "type": "list",
      "position": {
        "start": {
          "line": 83,
          "col": 0,
          "offset": 1058
        },
        "end": {
          "line": 87,
          "col": 13,
          "offset": 1120
        }
      }
    },
    {
      "type": "thematicBreak",
      "position": {
        "start": {
          "line": 89,
          "col": 0,
          "offset": 1122
        },
        "end": {
          "line": 89,
          "col": 3,
          "offset": 1125
        }
      }
    },
    {
      "type": "heading",
      "position": {
        "start": {
          "line": 91,
          "col": 0,
          "offset": 1127
        },
        "end": {
          "line": 91,
          "col": 12,
          "offset": 1139
        }
      }
    },
    {
      "type": "blockquote",
      "position": {
        "start": {
          "line": 93,
          "col": 0,
          "offset": 1141
        },
        "end": {
          "line": 96,
          "col": 11,
          "offset": 1174
        }
      }
    },
    {
      "type": "thematicBreak",
      "position": {
        "start": {
          "line": 98,
          "col": 0,
          "offset": 1176
        },
        "end": {
          "line": 98,
          "col": 3,
          "offset": 1179
        }
      }
    },
    {
      "type": "heading",
      "position": {
        "start": {
          "line": 100,
          "col": 0,
          "offset": 1181
        },
        "end": {
          "line": 100,
          "col": 13,
          "offset": 1194
        }
      }
    },
    {
      "type": "callout",
      "position": {
        "start": {
          "line": 102,
          "col": 0,
          "offset": 1196
        },
        "end": {
          "line": 103,
          "col": 18,
          "offset": 1224
        }
      }
    },
    {
      "type": "callout",
      "position": {
        "start": {
          "line": 105,
          "col": 0,
          "offset": 1226
        },
        "end": {
          "line": 106,
          "col": 17,
          "offset": 1257
        }
      }
    },
    {
      "type": "callout",
      "position": {
        "start": {
          "line": 108,
          "col": 0,
          "offset": 1259
        },
        "end": {
          "line": 109,
          "col": 11,
          "offset": 1289
        }
      }
    },
    {
      "type": "callout",
      "position": {
        "start": {
          "line": 111,
          "col": 0,
          "offset": 1291
        },
        "end": {
          "line": 112,
          "col": 9,
          "offset": 1320
        }
      }
    },
    {
      "type": "callout",
      "position": {
        "start": {
          "line": 114,
          "col": 0,
          "offset": 1322
        },
        "end": {
          "line": 116,
          "col": 17,
          "offset": 1375
        }
      }
    },
    {
      "type": "thematicBreak",
      "position": {
        "start": {
          "line": 118,
          "col": 0,
          "offset": 1377
        },
        "end": {
          "line": 118,
          "col": 3,
          "offset": 1380
        }
      }
    },
    {
      "type": "heading",
      "position": {
        "start": {
          "line": 120,
          "col": 0,
          "offset": 1382
        },
        "end": {
          "line": 120,
          "col": 9,
          "offset": 1391
        }
      }
    },
    {
      "type": "paragraph",
      "position": {
        "start": {
          "line": 122,
          "col": 0,
          "offset": 1393
        },
        "end": {
          "line": 122,
          "col": 26,
          "offset": 1419
        }
      }
    },
    {
      "type": "code",
      "position": {
        "start": {
          "line": 124,
          "col": 0,
          "offset": 1421
        },
        "end": {
          "line": 128,
          "col": 3,
          "offset": 1498
        }
      }
    },
    {
      "type": "code",
      "position": {
        "start": {
          "line": 130,
          "col": 0,
          "offset": 1500
        },
        "end": {
          "line": 134,
          "col": 4,
          "offset": 1563
        }
      }
    },
    {
      "type": "thematicBreak",
      "position": {
        "start": {
          "line": 136,
          "col": 0,
          "offset": 1565
        },
        "end": {
          "line": 136,
          "col": 3,
          "offset": 1568
        }
      }
    },
    {
      "type": "heading",
      "position": {
        "start": {
          "line": 138,
          "col": 0,
          "offset": 1570
        },
        "end": {
          "line": 138,
          "col": 8,
          "offset": 1578
        }
      }
    },
    {
      "type": "table",
      "position": {
        "start": {
          "line": 140,
          "col": 0,
          "offset": 1580
        },
        "end": {
          "line": 144,
          "col": 24,
          "offset": 1689
        }
      }
    },
    {
      "type": "paragraph",
      "position": {
        "start": {
          "line": 146,
          "col": 0,
          "offset": 1691
        },
        "end": {
          "line": 146,
          "col": 12,
          "offset": 1703
        }
      }
    },
    {
      "type": "table",
      "position": {
        "start": {
          "line": 148,
          "col": 0,
          "offset": 1705
        },
        "end": {
          "line": 151,
          "col": 31,
          "offset": 1795
        }
      }
    },
    {
      "type": "thematicBreak",
      "position": {
        "start": {
          "line": 153,
          "col": 0,
          "offset": 1797
        },
        "end": {
          "line": 153,
          "col": 3,
          "offset": 1800
        }
      }
    },
    {
      "type": "heading",
      "position": {
        "start": {
          "line": 155,
          "col": 0,
          "offset": 1802
        },
        "end": {
          "line": 155,
          "col": 17,
          "offset": 1819
        }
      }
    },
    {
      "type": "paragraph",
      "position": {
        "start": {
          "line": 157,
          "col": 0,
          "offset": 1821
        },
        "end": {
          "line": 157,
          "col": 24,
          "offset": 1845
        }
      }
    },
    {
      "type": "paragraph",
      "position": {
        "start": {
          "line": 159,
          "col": 0,
          "offset": 1847
        },
        "end": {
          "line": 159,
          "col": 5,
          "offset": 1852
        }
      }
    },
    {
      "type": "math",
      "position": {
        "start": {
          "line": 161,
          "col": 0,
          "offset": 1854
        },
        "end": {
          "line": 163,
          "col": 2,
          "offset": 1882
        }
      }
    },
    {
      "type": "paragraph",
      "position": {
        "start": {
          "line": 165,
          "col": 0,
          "offset": 1884
        },
        "end": {
          "line": 165,
          "col": 3,
          "offset": 1887
        }
      }
    },
    {
      "type": "math",
      "position": {
        "start": {
          "line": 167,
          "col": 0,
          "offset": 1889
        },
        "end": {
          "line": 172,
          "col": 2,
          "offset": 1939
        }
      }
    },
    {
      "type": "thematicBreak",
      "position": {
        "start": {
          "line": 174,
          "col": 0,
          "offset": 1941
        },
        "end": {
          "line": 174,
          "col": 3,
          "offset": 1944
        }
      }
    },
    {
      "type": "heading",
      "position": {
        "start": {
          "line": 176,
          "col": 0,
          "offset": 1946
        },
        "end": {
          "line": 176,
          "col": 16,
          "offset": 1962
        }
      }
    },
    {
      "type": "code",
      "position": {
        "start": {
          "line": 178,
          "col": 0,
          "offset": 1964
        },
        "end": {
          "line": 185,
          "col": 3,
          "offset": 2076
        }
      }
    },
    {
      "type": "code",
      "position": {
        "start": {
          "line": 187,
          "col": 0,
          "offset": 2078
        },
        "end": {
          "line": 193,
          "col": 3,
          "offset": 2207
        }
      }
    },
    {
      "type": "thematicBreak",
      "position": {
        "start": {
          "line": 195,
          "col": 0,
          "offset": 2209
        },
        "end": {
          "line": 195,
          "col": 3,
          "offset": 2212
        }
      }
    },
    {
      "type": "heading",
      "position": {
        "start": {
          "line": 197,
          "col": 0,
          "offset": 2214
        },
        "end": {
          "line": 197,
          "col": 17,
          "offset": 2231
        }
      }
    },
    {
      "type": "list",
      "position": {
        "start": {
          "line": 199,
          "col": 0,
          "offset": 2233
        },
        "end": {
          "line": 207,
          "col": 20,
          "offset": 2503
        }
      }
    },
    {
      "type": "paragraph",
      "position": {
        "start": {
          "line": 209,
          "col": 0,
          "offset": 2505
        },
        "end": {
          "line": 209,
          "col": 5,
          "offset": 2510
        }
      }
    },
    {
      "type": "paragraph",
      "position": {
        "start": {
          "line": 211,
          "col": 0,
          "offset": 2512
        },
        "end": {
          "line": 211,
          "col": 48,
          "offset": 2560
        }
      }
    },
    {
      "type": "thematicBreak",
      "position": {
        "start": {
          "line": 213,
          "col": 0,
          "offset": 2562
        },
        "end": {
          "line": 213,
          "col": 3,
          "offset": 2565
        }
      }
    },
    {
      "type": "heading",
      "position": {
        "start": {
          "line": 215,
          "col": 0,
          "offset": 2567
        },
        "end": {
          "line": 215,
          "col": 21,
          "offset": 2588
        }
      }
    },
    {
      "type": "paragraph",
      "id": "block-demo",
      "position": {
        "start": {
          "line": 217,
          "col": 0,
          "offset": 2590
        },
        "end": {
          "line": 217,
          "col": 35,
          "offset": 2625
        }
      }
    },
    {
      "type": "list",
      "position": {
        "start": {
          "line": 219,
          "col": 0,
          "offset": 2627
        },
        "end": {
          "line": 220,
          "col": 24,
          "offset": 2676
        }
      }
    },
    {
      "type": "paragraph",
      "position": {
        "start": {
          "line": 222,
          "col": 0,
          "offset": 2678
        },
        "end": {
          "line": 222,
          "col": 15,
          "offset": 2693
        }
      }
    },
    {
      "type": "list",
      "id": "list-demo",
      "position": {
        "start": {
          "line": 224,
          "col": 0,
          "offset": 2695
        },
        "end": {
          "line": 225,
          "col": 5,
          "offset": 2706
        }
      }
    },
    {
      "type": "paragraph",
      "position": {
        "start": {
          "line": 229,
          "col": 0,
          "offset": 2720
        },
        "end": {
          "line": 229,
          "col": 21,
          "offset": 2741
        }
      }
    },
    {
      "type": "thematicBreak",
      "position": {
        "start": {
          "line": 231,
          "col": 0,
          "offset": 2743
        },
        "end": {
          "line": 231,
          "col": 3,
          "offset": 2746
        }
      }
    },
    {
      "type": "heading",
      "position": {
        "start": {
          "line": 233,
          "col": 0,
          "offset": 2748
        },
        "end": {
          "line": 233,
          "col": 20,
          "offset": 2768
        }
      }
    },
    {
      "type": "paragraph",
      "position": {
        "start": {
          "line": 235,
          "col": 0,
          "offset": 2770
        },
        "end": {
          "line": 235,
          "col": 29,
          "offset": 2799
        }
      }
    },
    {
      "type": "paragraph",
      "position": {
        "start": {
          "line": 237,
          "col": 0,
          "offset": 2801
        },
        "end": {
          "line": 237,
          "col": 42,
          "offset": 2843
        }
      }
    },
    {
      "type": "footnoteDefinition",
      "position": {
        "start": {
          "line": 239,
          "col": 0,
          "offset": 2845
        },
        "end": {
          "line": 239,
          "col": 15,
          "offset": 2860
        }
      }
    },
    {
      "type": "footnoteDefinition",
      "position": {
        "start": {
          "line": 240,
          "col": 0,
          "offset": 2861
        },
        "end": {
          "line": 240,
          "col": 22,
          "offset": 2883
        }
      }
    },
    {
      "type": "thematicBreak",
      "position": {
        "start": {
          "line": 242,
          "col": 0,
          "offset": 2885
        },
        "end": {
          "line": 242,
          "col": 3,
          "offset": 2888
        }
      }
    },
    {
      "type": "heading",
      "position": {
        "start": {
          "line": 244,
          "col": 0,
          "offset": 2890
        },
        "end": {
          "line": 244,
          "col": 19,
          "offset": 2909
        }
      }
    },
    {
      "type": "paragraph",
      "position": {
        "start": {
          "line": 246,
          "col": 0,
          "offset": 2911
        },
        "end": {
          "line": 246,
          "col": 24,
          "offset": 2935
        }
      }
    },
    {
      "type": "comment",
      "position": {
        "start": {
          "line": 248,
          "col": 0,
          "offset": 2937
        },
        "end": {
          "line": 251,
          "col": 2,
          "offset": 2965
        }
      }
    },
    {
      "type": "thematicBreak",
      "position": {
        "start": {
          "line": 253,
          "col": 0,
          "offset": 2967
        },
        "end": {
          "line": 253,
          "col": 3,
          "offset": 2970
        }
      }
    },
    {
      "type": "heading",
      "position": {
        "start": {
          "line": 255,
          "col": 0,
          "offset": 2972
        },
        "end": {
          "line": 255,
          "col": 15,
          "offset": 2987
        }
      }
    },
    {
      "type": "paragraph",
      "position": {
        "start": {
          "line": 257,
          "col": 0,
          "offset": 2989
        },
        "end": {
          "line": 257,
          "col": 63,
          "offset": 3052
        }
      }
    },
    {
      "type": "thematicBreak",
      "position": {
        "start": {
          "line": 259,
          "col": 0,
          "offset": 3054
        },
        "end": {
          "line": 259,
          "col": 3,
          "offset": 3057
        }
      }
    },
    {
      "type": "heading",
      "position": {
        "start": {
          "line": 261,
          "col": 0,
          "offset": 3059
        },
        "end": {
          "line": 261,
          "col": 14,
          "offset": 3073
        }
      }
    },
    {
      "type": "html",
      "position": {
        "start": {
          "line": 263,
          "col": 0,
          "offset": 3075
        },
        "end": {
          "line": 265,
          "col": 6,
          "offset": 3162
        }
      }
    },
    {
      "type": "html",
      "position": {
        "start": {
          "line": 267,
          "col": 0,
          "offset": 3164
        },
        "end": {
          "line": 270,
          "col": 10,
          "offset": 3237
        }
      }
    },
    {
      "type": "paragraph",
      "position": {
        "start": {
          "line": 272,
          "col": 0,
          "offset": 3239
        },
        "end": {
          "line": 272,
          "col": 36,
          "offset": 3275
        }
      }
    },
    {
      "type": "thematicBreak",
      "position": {
        "start": {
          "line": 274,
          "col": 0,
          "offset": 3277
        },
        "end": {
          "line": 274,
          "col": 3,
          "offset": 3280
        }
      }
    },
    {
      "type": "heading",
      "position": {
        "start": {
          "line": 276,
          "col": 0,
          "offset": 3282
        },
        "end": {
          "line": 276,
          "col": 18,
          "offset": 3300
        }
      }
    },
    {
      "type": "code",
      "position": {
        "start": {
          "line": 278,
          "col": 0,
          "offset": 3302
        },
        "end": {
          "line": 280,
          "col": 3,
          "offset": 3324
        }
      }
    },
    {
      "type": "thematicBreak",
      "position": {
        "start": {
          "line": 282,
          "col": 0,
          "offset": 3326
        },
        "end": {
          "line": 282,
          "col": 3,
          "offset": 3329
        }
      }
    },
    {
      "type": "heading",
      "position": {
        "start": {
          "line": 284,
          "col": 0,
          "offset": 3331
        },
        "end": {
          "line": 284,
          "col": 18,
          "offset": 3349
        }
      }
    },
    {
      "type": "list",
      "position": {
        "start": {
          "line": 286,
          "col": 0,
          "offset": 3351
        },
        "end": {
          "line": 288,
          "col": 30,
          "offset": 3429
        }
      }
    },
    {
      "type": "text",
      "position": {
        "start": {
          "line": 289,
          "col": 0,
          "offset": 3429
        },
        "end": {
          "line": 289,
          "col": 0,
          "offset": 3429
        }
      }
    },
    {
      "type": "element",
      "position": {
        "start": {
          "line": 289,
          "col": 0,
          "offset": 3429
        },
        "end": {
          "line": 289,
          "col": 0,
          "offset": 3429
        }
      }
    }
  ],
  "listItems": [
    {
      "parent": -48,
      "position": {
        "start": {
          "line": 48,
          "col": 0,
          "offset": 588
        },
        "end": {
          "line": 48,
          "col": 31,
          "offset": 619
        }
      }
    },
    {
      "parent": -48,
      "position": {
        "start": {
          "line": 49,
          "col": 0,
          "offset": 620
        },
        "end": {
          "line": 49,
          "col": 31,
          "offset": 651
        }
      }
    },
    {
      "parent": -48,
      "position": {
        "start": {
          "line": 50,
          "col": 0,
          "offset": 652
        },
        "end": {
          "line": 50,
          "col": 34,
          "offset": 686
        }
      }
    },
    {
      "parent": -48,
      "position": {
        "start": {
          "line": 51,
          "col": 0,
          "offset": 687
        },
        "end": {
          "line": 51,
          "col": 18,
          "offset": 705
        }
      }
    },
    {
      "parent": -48,
      "position": {
        "start": {
          "line": 52,
          "col": 0,
          "offset": 706
        },
        "end": {
          "line": 52,
          "col": 24,
          "offset": 730
        }
      }
    },
    {
      "parent": -48,
      "position": {
        "start": {
          "line": 53,
          "col": 0,
          "offset": 731
        },
        "end": {
          "line": 53,
          "col": 22,
          "offset": 753
        }
      }
    },
    {
      "parent": -57,
      "position": {
        "start": {
          "line": 57,
          "col": 0,
          "offset": 769
        },
        "end": {
          "line": 57,
          "col": 38,
          "offset": 807
        }
      }
    },
    {
      "parent": -57,
      "position": {
        "start": {
          "line": 58,
          "col": 0,
          "offset": 808
        },
        "end": {
          "line": 58,
          "col": 45,
          "offset": 853
        }
      }
    },
    {
      "parent": -57,
      "position": {
        "start": {
          "line": 59,
          "col": 0,
          "offset": 854
        },
        "end": {
          "line": 59,
          "col": 70,
          "offset": 924
        }
      }
    },
    {
      "parent": -67,
      "position": {
        "start": {
          "line": 67,
          "col": 0,
          "offset": 948
        },
        "end": {
          "line": 67,
          "col": 6,
          "offset": 954
        }
      }
    },
    {
      "parent": -67,
      "position": {
        "start": {
          "line": 68,
          "col": 0,
          "offset": 955
        },
        "end": {
          "line": 68,
          "col": 6,
          "offset": 961
        }
      }
    },
    {
      "parent": 68,
      "position": {
        "start": {
          "line": 69,
          "col": 2,
          "offset": 964
        },
        "end": {
          "line": 69,
          "col": 11,
          "offset": 973
        }
      }
    },
    {
      "parent": 68,
      "position": {
        "start": {
          "line": 70,
          "col": 2,
          "offset": 976
        },
        "end": {
          "line": 70,
          "col": 11,
          "offset": 985
        }
      }
    },
    {
      "parent": -67,
      "position": {
        "start": {
          "line": 71,
          "col": 0,
          "offset": 986
        },
        "end": {
          "line": 71,
          "col": 6,
          "offset": 992
        }
      }
    },
    {
      "parent": -75,
      "position": {
        "start": {
          "line": 75,
          "col": 0,
          "offset": 1001
        },
        "end": {
          "line": 75,
          "col": 6,
          "offset": 1007
        }
      }
    },
    {
      "parent": -75,
      "position": {
        "start": {
          "line": 76,
          "col": 0,
          "offset": 1008
        },
        "end": {
          "line": 76,
          "col": 6,
          "offset": 1014
        }
      }
    },
    {
      "parent": 76,
      "position": {
        "start": {
          "line": 77,
          "col": 3,
          "offset": 1018
        },
        "end": {
          "line": 77,
          "col": 13,
          "offset": 1028
        }
      }
    },
    {
      "parent": 76,
      "position": {
        "start": {
          "line": 78,
          "col": 3,
          "offset": 1032
        },
        "end": {
          "line": 78,
          "col": 13,
          "offset": 1042
        }
      }
    },
    {
      "parent": -75,
      "position": {
        "start": {
          "line": 79,
          "col": 0,
          "offset": 1043
        },
        "end": {
          "line": 79,
          "col": 6,
          "offset": 1049
        }
      }
    },
    {
      "parent": -83,
      "task": " ",
      "position": {
        "start": {
          "line": 83,
          "col": 0,
          "offset": 1058
        },
        "end": {
          "line": 83,
          "col": 11,
          "offset": 1069
        }
      }
    },
    {
      "parent": -83,
      "task": "x",
      "position": {
        "start": {
          "line": 84,
          "col": 0,
          "offset": 1070
        },
        "end": {
          "line": 84,
          "col": 11,
          "offset": 1081
        }
      }
    },
    {
      "parent": -83,
      "task": " ",
      "position": {
        "start": {
          "line": 85,
          "col": 0,
          "offset": 1082
        },
        "end": {
          "line": 85,
          "col": 10,
          "offset": 1092
        }
      }
    },
    {
      "parent": 85,
      "task": " ",
      "position": {
        "start": {
          "line": 86,
          "col": 2,
          "offset": 1095
        },
        "end": {
          "line": 86,
          "col": 13,
          "offset": 1106
        }
      }
    },
    {
      "parent": 85,
      "task": "x",
      "position": {
        "start": {
          "line": 87,
          "col": 2,
          "offset": 1109
        },
        "end": {
          "line": 87,
          "col": 13,
          "offset": 1120
        }
      }
    },
    {
      "parent": -199,
      "position": {
        "start": {
          "line": 199,
          "col": 0,
          "offset": 2233
        },
        "end": {
          "line": 199,
          "col": 26,
          "offset": 2259
        }
      }
    },
    {
      "parent": -199,
      "position": {
        "start": {
          "line": 200,
          "col": 0,
          "offset": 2260
        },
        "end": {
          "line": 200,
          "col": 36,
          "offset": 2296
        }
      }
    },
    {
      "parent": -199,
      "position": {
        "start": {
          "line": 201,
          "col": 0,
          "offset": 2297
        },
        "end": {
          "line": 201,
          "col": 36,
          "offset": 2333
        }
      }
    },
    {
      "parent": -199,
      "position": {
        "start": {
          "line": 202,
          "col": 0,
          "offset": 2334
        },
        "end": {
          "line": 202,
          "col": 21,
          "offset": 2355
        }
      }
    },
    {
      "parent": -199,
      "position": {
        "start": {
          "line": 203,
          "col": 0,
          "offset": 2356
        },
        "end": {
          "line": 203,
          "col": 25,
          "offset": 2381
        }
      }
    },
    {
      "parent": -199,
      "position": {
        "start": {
          "line": 204,
          "col": 0,
          "offset": 2382
        },
        "end": {
          "line": 204,
          "col": 29,
          "offset": 2411
        }
      }
    },
    {
      "parent": -199,
      "position": {
        "start": {
          "line": 205,
          "col": 0,
          "offset": 2412
        },
        "end": {
          "line": 205,
          "col": 32,
          "offset": 2444
        }
      }
    },
    {
      "parent": -199,
      "position": {
        "start": {
          "line": 206,
          "col": 0,
          "offset": 2445
        },
        "end": {
          "line": 206,
          "col": 37,
          "offset": 2482
        }
      }
    },
    {
      "parent": -199,
      "position": {
        "start": {
          "line": 207,
          "col": 0,
          "offset": 2483
        },
        "end": {
          "line": 207,
          "col": 20,
          "offset": 2503
        }
      }
    },
    {
      "parent": -219,
      "position": {
        "start": {
          "line": 219,
          "col": 0,
          "offset": 2627
        },
        "end": {
          "line": 219,
          "col": 24,
          "offset": 2651
        }
      }
    },
    {
      "parent": -219,
      "position": {
        "start": {
          "line": 220,
          "col": 0,
          "offset": 2652
        },
        "end": {
          "line": 220,
          "col": 24,
          "offset": 2676
        }
      }
    },
    {
      "parent": -224,
      "position": {
        "start": {
          "line": 224,
          "col": 0,
          "offset": 2695
        },
        "end": {
          "line": 224,
          "col": 5,
          "offset": 2700
        }
      }
    },
    {
      "parent": -224,
      "position": {
        "start": {
          "line": 225,
          "col": 0,
          "offset": 2701
        },
        "end": {
          "line": 225,
          "col": 5,
          "offset": 2706
        }
      }
    },
    {
      "parent": -286,
      "position": {
        "start": {
          "line": 286,
          "col": 0,
          "offset": 3351
        },
        "end": {
          "line": 286,
          "col": 23,
          "offset": 3374
        }
      }
    },
    {
      "parent": -286,
      "position": {
        "start": {
          "line": 287,
          "col": 0,
          "offset": 3375
        },
        "end": {
          "line": 287,
          "col": 23,
          "offset": 3398
        }
      }
    },
    {
      "parent": -286,
      "position": {
        "start": {
          "line": 288,
          "col": 0,
          "offset": 3399
        },
        "end": {
          "line": 288,
          "col": 30,
          "offset": 3429
        }
      }
    }
  ],
  "blocks": {
    "block-demo": {
      "id": "block-demo",
      "position": {
        "start": {
          "line": 217,
          "col": 0,
          "offset": 2590
        },
        "end": {
          "line": 217,
          "col": 35,
          "offset": 2625
        }
      }
    },
    "list-demo": {
      "id": "list-demo",
      "position": {
        "start": {
          "line": 224,
          "col": 0,
          "offset": 2695
        },
        "end": {
          "line": 225,
          "col": 5,
          "offset": 2706
        }
      }
    }
  },
  "frontmatter": {
    "title": "Obsidian Markdown All Syntax Example",
    "aliases": [
      "OFM Full Demo",
      "Markdown Demo Note"
    ],
    "tags": [
      "demo",
      "obsidian/syntax"
    ],
    "cssclasses": [
      "syntax-demo"
    ],
    "status": "in-progress",
    "priority": 5,
    "reviewed": false,
    "created": "2026-04-21",
    "due": "2026-05-01T10:30:00",
    "related": "[[Another Note]]"
  },
  "frontmatterLinks": [
    {
      "key": "related",
      "link": "Another Note",
      "original": "[[Another Note]]",
      "displayText": "Another Note"
    }
  ],
  "v": 1,
  "frontmatterPosition": {
    "start": {
      "line": 0,
      "col": 0,
      "offset": 0
    },
    "end": {
      "line": 16,
      "col": 3,
      "offset": 285
    }
  }
} as CachedMetadata;
