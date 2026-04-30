

## 分析
obsidian metatdata-cache 有 sections 屬性，

此 sections 屬性會列出從上到下的各個以 [obsidian 規則](obsidian-markdown-all-syntax-example.md) 所裁切的
段落文字和此段落起始位置(start offset)及結束位置(end offset)。

注意事項
只會標註文字所在位置，所以像 Heading 這種會有內容物的，可能會以為結束位置也應包含內容段落的結束位置，
但實際上結束位置只會是實際 Heading 文字的結束位置。

Heading 的層級，是 Heading1 還是 Heading2 需要看 metadata-cache 的 headings 屬性才知道，
且 start offset 是從 # 字號開始，雖然在 headings 屬性中顯示的 text 是沒有包含 # 字號(且會 trim 前後空白)，但 offset 與 section 一樣，都是從 # 字號開始算，也就的包含 # 字號。

如果 section 物件有 id 代表使用者有使用 block id 進行該段落的標註。

ex:
```json
{
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
        }
    ]
}
```


所以先將段落分類，給出段落的層級

yaml -> 0
Heading1 -> 1
Heading2 -> 2
Heading3 -> 3
Heading4 -> 4
Heading5 -> 5
Heading6 -> 6
paragraph -> 7
other -> 8

other:
thematicBreak
list
blockquote
callout
code
table
math (這肯定要與段落合併的吧？層級要比 paragraph 低？)
footnoteDefinition （這個 obsidian 自己在 preview mdoe 也是統整放在最後，不論你原本 footnoteDefenition 寫在哪，渲染後統統放最後）
comment （preview mode 會被隱藏的區塊）
html
text? （最後的結元素？）
element?（最後的結元素？）


## 物件 Mapping

```markdown

# HeadingA

paragraphA
Lorem ipsum dolor sit amet consectetur adipiscing elit. Dolor sit amet consectetur adipiscing elit quisque faucibus.

## HeadingA2

paragraph a2
Lorem ipsum dolor sit amet consectetur adipiscing elit. Dolor sit amet consectetur adipiscing elit quisque faucibus.
#### HeadingA4

paragraphA4
Lorem ipsum dolor sit amet consectetur adipiscing elit. Dolor sit amet consectetur adipiscing elit quisque faucibus.
# HeadingB

paragraphB
Lorem ipsum dolor sit amet consectetur adipiscing elit. Dolor sit amet consectetur adipiscing elit quisque faucibus.
## HeadingB2

### HeadingB3
paragraph b3
Lorem ipsum dolor sit amet consectetur adipiscing elit. Dolor sit amet consectetur adipiscing elit quisque faucibus.

```


```ts

const meta_data = 
{
  headings: [
    {
      position: {
        start: {
          line: 1,
          col: 0,
          offset: 1
        },
        end: {
          line: 1,
          col: 10,
          offset: 11
        }
      },
      heading: HeadingA,
      level: 1
    },
    {
      position: {
        start: {
          line: 6,
          col: 0,
          offset: 142
        },
        end: {
          line: 6,
          col: 12,
          offset: 154
        }
      },
      heading: HeadingA2,
      level: 2
    },
    {
      position: {
        start: {
          line: 10,
          col: 0,
          offset: 286
        },
        end: {
          line: 10,
          col: 14,
          offset: 300
        }
      },
      heading: HeadingA4,
      level: 4
    },
    {
      position: {
        start: {
          line: 14,
          col: 0,
          offset: 431
        },
        end: {
          line: 14,
          col: 10,
          offset: 441
        }
      },
      heading: HeadingB,
      level: 1
    },
    {
      position: {
        start: {
          line: 18,
          col: 0,
          offset: 571
        },
        end: {
          line: 18,
          col: 12,
          offset: 583
        }
      },
      heading: HeadingB2,
      level: 2
    },
    {
      position: {
        start: {
          line: 20,
          col: 0,
          offset: 585
        },
        end: {
          line: 20,
          col: 13,
          offset: 598
        }
      },
      heading: HeadingB3,
      level: 3
    }
  ],
  sections: [
    {
      type: heading,
      position: {
        start: {
          line: 1,
          col: 0,
          offset: 1
        },
        end: {
          line: 1,
          col: 10,
          offset: 11
        }
      }
    },
    {
      type: paragraph,
      position: {
        start: {
          line: 3,
          col: 0,
          offset: 13
        },
        end: {
          line: 4,
          col: 116,
          offset: 140
        }
      }
    },
    {
      type: heading,
      position: {
        start: {
          line: 6,
          col: 0,
          offset: 142
        },
        end: {
          line: 6,
          col: 12,
          offset: 154
        }
      }
    },
    {
      type: paragraph,
      position: {
        start: {
          line: 8,
          col: 0,
          offset: 156
        },
        end: {
          line: 9,
          col: 116,
          offset: 285
        }
      }
    },
    {
      type: heading,
      position: {
        start: {
          line: 10,
          col: 0,
          offset: 286
        },
        end: {
          line: 10,
          col: 14,
          offset: 300
        }
      }
    },
    {
      type: paragraph,
      position: {
        start: {
          line: 12,
          col: 0,
          offset: 302
        },
        end: {
          line: 13,
          col: 116,
          offset: 430
        }
      }
    },
    {
      type: heading,
      position: {
        start: {
          line: 14,
          col: 0,
          offset: 431
        },
        end: {
          line: 14,
          col: 10,
          offset: 441
        }
      }
    },
    {
      type: paragraph,
      position: {
        start: {
          line: 16,
          col: 0,
          offset: 443
        },
        end: {
          line: 17,
          col: 116,
          offset: 570
        }
      }
    },
    {
      type: heading,
      position: {
        start: {
          line: 18,
          col: 0,
          offset: 571
        },
        end: {
          line: 18,
          col: 12,
          offset: 583
        }
      }
    },
    {
      type: heading,
      position: {
        start: {
          line: 20,
          col: 0,
          offset: 585
        },
        end: {
          line: 20,
          col: 13,
          offset: 598
        }
      }
    },
    {
      type: paragraph,
      position: {
        start: {
          line: 21,
          col: 0,
          offset: 599
        },
        end: {
          line: 22,
          col: 116,
          offset: 728
        }
      }
    }
  ]
}

```

```ts

const root = {
  fileName: "MindMapMdView.md",
  yaml: "",
  content: [],
};
const column_layout = [
  {
    blocks: [
      {
        content: [{
          text: "HeadingA",
          type: "heading",
          level: 1,
          startOffset: 1,
          endOffset: 11,
        }],
        parent: root,
        index: 0,
        columnIndex: 0,
        state: 'unselected',
        startOffset: 1,
        endOffset: 11,
      },
      {
        content: [{
          text: "HeadingB",
          type: "heading",
          level: 1,
          startOffset: 431,
          endOffset: 441,
        }],
        parent: root,
        index: 1,
        columnIndex: 0,
        state: 'road',
        startOffset: 431,
        endOffset: 441,
      },
    ],
    centerBlockIndex: 1,
  },
  {
    blocks: [
      {
        content: [{
          text: "paragraphA\nLorem ipsum dolor sit amet consectetur adipiscing elit. Dolor sit amet consectetur adipiscing elit quisque faucibus.",
          type: "paragraph",
          level: 7,
          startOffset: 13,
          endOffset: 140,
        }],
        parent: {
          content: [{
            text: "HeadingA",
            type: "heading",
            level: 1,
            startOffset: 1,
            endOffset: 11,
          }],
          parent: root,
          index: 0,
          columnIndex: 0,
          state: 'unselected',
          startOffset: 1,
          endOffset: 11,
        },
        index: 0,
        columnIndex: 1,
        state: 'unselected',
        startOffset: 13,
        endOffset: 140,
      },
      {
        content: [{
          text: "HeadingA2",
          type: "heading",
          level: 2,
          startOffset: 142,
          endOffset: 154,
        }],
        parent: {
          content: [{
            text: "HeadingA",
            type: "heading",
            level: 1,
            startOffset: 1,
            endOffset: 11,
          }],
          parent: root,
          index: 0,
          columnIndex: 0,
          state: 'unselected',
          startOffset: 1,
          endOffset: 11,
        },
        index: 1,
        columnIndex: 1,
        state: 'unselected',
        startOffset: 142,
        endOffset: 154,
      },
      {
        content: [{
          text: "paragraphB\nLorem ipsum dolor sit amet consectetur adipiscing elit. Dolor sit amet consectetur adipiscing elit quisque faucibus.",
          type: "paragraph",
          level: 7,
          startOffset: 443,
          endOffset: 570,
        }],
        parent: {
          content: [{
            text: "HeadingB",
            type: "heading",
            level: 1,
            startOffset: 431,
            endOffset: 441,
          }],
          parent: root,
          index: 1,
          columnIndex: 0,
          state: 'road',
          startOffset: 431,
          endOffset: 441,
        },
        index: 2,
        columnIndex: 1,
        state: 'unselected',
        startOffset: 443,
        endOffset: 570,
      },
      {
        content: [{
          text: "HeadingB2",
          type: "heading",
          level: 2,
          startOffset: 571,
          endOffset: 583,
        }],
        parent: {
          content: [{
            text: "HeadingB",
            type: "heading",
            level: 1,
            startOffset: 431,
            endOffset: 441,
          }],
          parent: root,
          index: 1,
          columnIndex: 0,
          state: 'road',
          startOffset: 431,
          endOffset: 441,
        },
        index: 3,
        columnIndex: 1,
        state: 'fork',
        startOffset: 571,
        endOffset: 583,
      },
    ],
    centerBlockIndex: 3,
  },
  {
    blocks: [
      {
        content: [{
          text: "paragraph a2\nLorem ipsum dolor sit amet consectetur adipiscing elit. Dolor sit amet consectetur adipiscing elit quisque faucibus.",
          type: "paragraph",
          level: 7,
          startOffset: 156,
          endOffset: 285,
        }],
        parent: {
          content: [{
            text: "HeadingA2",
            type: "heading",
            level: 2,
            startOffset: 142,
            endOffset: 154,
          }],
          parent: {
            content: [{
              text: "HeadingA",
              type: "heading",
              level: 1,
              startOffset: 1,
              endOffset: 11,
            }],
            parent: root,
            index: 0,
            columnIndex: 0,
            state: 'unselected',
            startOffset: 1,
            endOffset: 11,
          },
          index: 1,
          columnIndex: 1,
          state: 'unselected',
          startOffset: 142,
          endOffset: 154,
        },
        index: 0,
        columnIndex: 2,
        state: 'unselected',
        startOffset: 156,
        endOffset: 285,
      },
      {
        content: [{
          text: "HeadingA4",
          type: "heading",
          level: 4,
          startOffset: 286,
          endOffset: 300,
        }],
        parent: {
          content: [{
            text: "HeadingA2",
            type: "heading",
            level: 2,
            startOffset: 142,
            endOffset: 154,
          }],
          parent: {
            content: [{
              text: "HeadingA",
              type: "heading",
              level: 1,
              startOffset: 1,
              endOffset: 11,
            }],
            parent: root,
            index: 0,
            columnIndex: 0,
            state: 'unselected',
            startOffset: 1,
            endOffset: 11,
          },
          index: 1,
          columnIndex: 1,
          state: 'unselected',
          startOffset: 142,
          endOffset: 154,
        },
        index: 1,
        columnIndex: 2,
        state: 'unselected',
        startOffset: 286,
        endOffset: 300,
      },
      {
        content: [{
          text: "HeadingB3",
          type: "heading",
          level: 3,
          startOffset: 585,
          endOffset: 598,
        }],
        parent: {
          content: [{
            text: "HeadingB2",
            type: "heading",
            level: 2,
            startOffset: 571,
            endOffset: 583,
          }],
          parent: {
            content: [{
              text: "HeadingB",
              type: "heading",
              level: 1,
              startOffset: 431,
              endOffset: 441,
            }],
            parent: root,
            index: 1,
            columnIndex: 0,
            state: 'road',
            startOffset: 431,
            endOffset: 441,
          },
          index: 3,
          columnIndex: 1,
          state: 'fork',
          startOffset: 571,
          endOffset: 583,
        },
        index: 2,
        columnIndex: 2,
        state: 'path',
        startOffset: 585,
        endOffset: 598,
      },
    ],
    centerBlockIndex: 2,
  },
  {
    blocks: [
      {
        content: [{
          text: "paragraphA4\nLorem ipsum dolor sit amet consectetur adipiscing elit. Dolor sit amet consectetur adipiscing elit quisque faucibus.",
          type: "paragraph",
          level: 7,
          startOffset: 302,
          endOffset: 430,
        }],
        parent: {
          content: [{
            text: "HeadingA4",
            type: "heading",
            level: 4,
            startOffset: 286,
            endOffset: 300,
          }],
          parent: {
            content: [{
              text: "HeadingA2",
              type: "heading",
              level: 2,
              startOffset: 142,
              endOffset: 154,
            }],
            parent: {
              content: [{
                text: "HeadingA",
                type: "heading",
                level: 1,
                startOffset: 1,
                endOffset: 11,
              }],
              parent: root,
              index: 0,
              columnIndex: 0,
              state: 'unselected',
              startOffset: 1,
              endOffset: 11,
            },
            index: 1,
            columnIndex: 1,
            state: 'unselected',
            startOffset: 142,
            endOffset: 154,
          },
          index: 1,
          columnIndex: 2,
          state: 'unselected',
          startOffset: 286,
          endOffset: 300,
        },
        index: 0,
        columnIndex: 3,
        state: 'unselected',
        startOffset: 302,
        endOffset: 430,
      },
      {
        content: [{
          text: "paragraph b3\nLorem ipsum dolor sit amet consectetur adipiscing elit. Dolor sit amet consectetur adipiscing elit quisque faucibus.",
          type: "paragraph",
          level: 7,
          startOffset: 599,
          endOffset: 728,
        }],
        parent: {
          content: [{
            text: "HeadingB3",
            type: "heading",
            level: 3,
            startOffset: 585,
            endOffset: 598,
          }],
          parent: {
            content: [{
              text: "HeadingB2",
              type: "heading",
              level: 2,
              startOffset: 571,
              endOffset: 583,
            }],
            parent: {
              content: [{
                text: "HeadingB",
                type: "heading",
                level: 1,
                startOffset: 431,
                endOffset: 441,
              }],
              parent: root,
              index: 1,
              columnIndex: 0,
              state: 'road',
              startOffset: 431,
              endOffset: 441,
            },
            index: 3,
            columnIndex: 1,
            state: 'fork',
            startOffset: 571,
            endOffset: 583,
          },
          index: 2,
          columnIndex: 2,
          state: 'path',
          startOffset: 585,
          endOffset: 598,
        },
        index: 1,
        columnIndex: 3,
        state: 'path',
        startOffset: 599,
        endOffset: 728,
      },
    ],
    centerBlockIndex: 1,
  },
];

```