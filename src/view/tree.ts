
import { Effect } from "effect"
import type { CachedMetadata, HeadingCache, ListItemCache, SectionCache, TFile } from "obsidian"
import { heading } from "../util/parse"





export type ListItemTree = {
    listItem: ListItemCache
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



        const [root_tree, ...rest_trees] = trees;
        let stack: HeadingTree[] = [root_tree!];

        rest_trees.forEach(curr => {
            let head_container = stack.at(-1);
            while (head_container && head_container.heading.level >= curr.heading.level) {
                stack.pop();
                head_container = stack.at(-1);
            }
            head_container?.children.push(curr);
            stack.push(curr);
        })

        return root_tree;
    })

