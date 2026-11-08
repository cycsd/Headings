
import { Effect } from "effect"
import type { CachedMetadata, HeadingCache, ListItemCache, SectionCache, TFile } from "obsidian"
import { heading, list } from "../util/parse"





export type ListItemTree = {
    listItem: ListItemCache
    /** list item 本身的 markdown 原文(含 list 符號，不含子 list)，已去除縮排 */
    text: string
    children: ListItemTree[]
}

export type HeadingTree = {
    heading: HeadingCache
    sections: SectionCache[]
    children: (HeadingTree | ListItemTree)[]
}


// type TreeNode = HeadingTree | ListItemTree


export const createTreeNode = (cache: CachedMetadata, file: TFile) =>
    Effect.gen(function* () {
        const title_heading: HeadingCache = {
            heading: file.name,
            level: 0,
            position: {
                start: { line: 0, col: 0, offset: 0 },
                end: { line: 0, col: 0, offset: 0 }
            }
        }
        const root: HeadingTree = {
            heading: title_heading,
            sections: [],
            children: []
        }


        const rev_sections = [...(yield* Effect.fromNullishOr(cache.sections))].reverse();
        const headings = yield* Effect.fromNullishOr(cache.headings)
        const headtrees: HeadingTree[] = [root, ...headings
            .map(h => {
                return {
                    heading: h,
                    sections: [],
                    children: []
                }
            })
        ]

        const trees = yield* Effect.forEach(headtrees, (currentHeading, i) => {
            const current_sections = []
            let section = rev_sections.pop();
            while (section) {
                if (section.type === heading) {
                    break
                }
                current_sections.push(section);
                section = rev_sections.pop();
            }
            currentHeading.sections = current_sections;
            return Effect.succeed(currentHeading)
        })



        // trees[0] 即為 root (同一個物件)
        const [, ...rest_trees] = trees;
        let stack: HeadingTree[] = [root];

        rest_trees.forEach(curr => {
            let head_container = stack.at(-1);
            while (head_container && head_container.heading.level >= curr.heading.level) {
                stack.pop();
                head_container = stack.at(-1);
            }
            head_container?.children.push(curr);
            stack.push(curr);
        })

        return root;
    })


const isHeadingTree = (node: HeadingTree | ListItemTree): node is HeadingTree => "heading" in node

// 依 ListItemCache.parent 組出 list item 的樹狀結構
// parent < 0 表示該 item 為 list 的最外層，parent >= 0 則為父 item 所在的行號
const buildListItemTrees = (items: ListItemCache[], doc: string): ListItemTree[] => {
    const byLine = new Map<number, ListItemTree>()
    const roots: ListItemTree[] = []
    for (const item of items) {
        const text = doc.slice(item.position.start.offset, item.position.end.offset)
            .split("\n")
            .map(line => line.trimStart())
            .join("\n")
        const node: ListItemTree = { listItem: item, text, children: [] }
        byLine.set(item.position.start.line, node)
        const parent = item.parent < 0 ? undefined : byLine.get(item.parent)
        if (parent) {
            parent.children.push(node)
        } else {
            roots.push(node)
        }
    }
    return roots
}

/**
 * 在 createTreeNode 之後呼叫，將各 heading 底下的 list section 展開成 ListItemTree 節點(含子 list)。
 * listAsNode 為 false 時原樣回傳，list 仍保留在 heading 的 sections 中。
 */
export const expandListNodes = (cache: CachedMetadata, doc: string, listAsNode: boolean) =>
    (root: HeadingTree): HeadingTree => {
        if (!listAsNode) return root
        const listItems = [...(cache.listItems ?? [])]
            .sort((a, b) => a.position.start.offset - b.position.start.offset)

        const listItemTrees = buildListItemTrees(listItems, doc);

        const expand = (node: HeadingTree): HeadingTree => {
            const listTrees = node.sections
                .filter(s => s.type === list)
                .flatMap(s => listItemTrees.filter(item =>
                    item.listItem.position.start.offset >= s.position.start.offset
                    && item.listItem.position.end.offset <= s.position.end.offset))
            return {
                heading: node.heading,
                sections: node.sections.filter(s => s.type !== list),
                // heading 的 sections 都位於子 heading 之前，所以 list 節點排在前面
                children: [
                    ...listTrees,
                    ...node.children.map(child => isHeadingTree(child) ? expand(child) : child)
                ]
            }
        }
        return expand(root)
    }

