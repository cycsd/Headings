import { describe, expect, it } from "vitest";
import type { HeadingCache, SectionCache } from "obsidian";
import {
  headingsCacheToMap,
  parseCacheMetadata2Content,
    parseContent2Blocks,
  parseSection2Content,
    traceBackToOrigin,
} from "../../util/parse";
import { unselected, type Block, type Content, type Root } from "../../util/block_level";
import {
    obsidianMarkdownAllSyntaxExampleDoc as doc,
    obsidianMarkdownAllSyntaxExampleMetadata as metadata,
} from "../fixtures/obsidian-markdown-fixture";



function getSection(offsetStart: number, offsetEnd: number): SectionCache {
    const section = metadata.sections?.find(
        (item) =>
            item.position.start.offset === offsetStart &&
            item.position.end.offset === offsetEnd,
    );

    if (!section) {
        throw new Error(`Missing section fixture for offsets ${offsetStart}-${offsetEnd}`);
    }

    return section;
}

function getContentItem(
    items: ReturnType<typeof parseCacheMetadata2Content>,
    offsetStart: number,
    offsetEnd: number,
    type?: string,
) {
    const item = items.find(
        (content) =>
            content.startOffset === offsetStart && content.endOffset === offsetEnd,

    );

    const matchedItem = type
        ? items.find(
            (content) =>
                content.startOffset === offsetStart &&
                content.endOffset === offsetEnd &&
                content.type === type,
        )
        : item;

    if (!matchedItem) {
        throw new Error(
            `Missing parsed content fixture for offsets ${offsetStart}-${offsetEnd}${type ? ` and type ${type}` : ""}`,
        );
    }

    return matchedItem;
}

function createContent(
    level: number,
    startOffset: number,
    type = "heading",
    text = `${type}-${startOffset}`,
): Content {
    return {
        text,
        type,
        level,
        startOffset,
        endOffset: startOffset + text.length,
    };
}

function createRoot(): Root {
    return {
        fileName: "fixture.md",
        yaml: createContent(0, -100, "yaml", "yaml"),
    };
}

function createBlock(content: Content, overrides: Partial<Block> = {}): Block {
    const block: Block = {
        content: [content],
        index: 0,
        columnIndex: 0,
        parent: createRoot(),
        state: unselected,
        startOffset: content.startOffset,
        endOffset: content.endOffset,
        ...overrides,
    };

    return block;
}

describe("split one element array", () => {
    it("should split array into groups based on a condition", () => {
        const array_length_one = [1, 2, 3, 4, 5, 6];
        const [first, ...rest] = array_length_one;
        expect(first).toBe(1);
    });
});

describe("headingsCacheToMap", () => {
  it("returns an empty map for undefined input", () => {
    const result = headingsCacheToMap(undefined);

    expect(result.size).toBe(0);
  });

    it("maps fixture heading items by offset key", () => {
        const headings = metadata.headings as HeadingCache[];

    const result = headingsCacheToMap(headings);

        expect(result.get("287-311")).toEqual(headings[0]);
        expect(result.get("3331-3349")?.heading).toBe("18. 參考範例（屬性與連結）");
  });
});

describe("parseSection2Content", () => {
    it("parses fixture yaml section with level 0", () => {
        const section = getSection(0, 285);

    const result = parseSection2Content(section, doc);

    expect(result).toEqual({
        text: doc.slice(0, 285),
        type: "yaml",
        level: 0,
      startOffset: 0,
        endOffset: 285,
    });
  });

    it("parses fixture paragraph section with level 7", () => {
        const section = getSection(313, 337);

    const result = parseSection2Content(section, doc);

        expect(result).toEqual({
            text: "這份文件示範 Obsidian 常用與進階語法。",
            type: "paragraph",
            level: 7,
            startOffset: 313,
            endOffset: 337,
        });
  });

    it("uses default level 8 for list sections from the fixture", () => {
        const section = getSection(588, 753);

    const result = parseSection2Content(section, doc);

    expect(result.level).toBe(8);
        expect(result.type).toBe("list");
        expect(result.text).toBe(doc.slice(588, 753));
  });
});

describe("parseCacheMetadata2Content", () => {
  it("returns empty array when sections are missing", () => {
    const result = parseCacheMetadata2Content({}, "anything");

    expect(result).toEqual([]);
  });

    it("parses all fixture sections and keeps the same section count", () => {
        const result = parseCacheMetadata2Content(metadata, doc);

        expect(result).toHaveLength(metadata.sections?.length ?? 0);
        expect(getContentItem(result, 0, 285)).toEqual({
            text: doc.slice(0, 285),
            type: "yaml",
            level: 0,
            startOffset: 0,
            endOffset: 285,
        });
        expect(getContentItem(result, 3429, 3429, "element")).toEqual({
            text: "",
            type: "element",
            level: 8,
            startOffset: 3429,
            endOffset: 3429,
        });
        // console.log(result);
  });

    it("uses fixture heading level when a heading section matches heading cache offsets", () => {
        const result = parseCacheMetadata2Content(metadata, doc);

        expect(getContentItem(result, 287, 311)).toEqual({
            text: "# Obsidian Markdown 語法總覽",
            type: "heading",
            level: 1,
            startOffset: 287,
            endOffset: 311,
        });
        expect(getContentItem(result, 344, 354)).toEqual({
            text: "## 1. 文字格式",
            type: "heading",
            level: 2,
            startOffset: 344,
            endOffset: 354,
        });
    });

    it("parses representative non-heading fixture sections with expected levels", () => {
    const result = parseCacheMetadata2Content(metadata, doc);

        expect(getContentItem(result, 588, 753)).toEqual({
            text: doc.slice(588, 753),
            type: "list",
            level: 8,
            startOffset: 588,
            endOffset: 753,
        });
        expect(getContentItem(result, 1196, 1224)).toEqual({
            text: doc.slice(1196, 1224),
            type: "callout",
            level: 8,
            startOffset: 1196,
            endOffset: 1224,
        });
        expect(getContentItem(result, 2845, 2860)).toEqual({
            text: doc.slice(2845, 2860),
            type: "footnoteDefinition",
            level: 8,
            startOffset: 2845,
            endOffset: 2860,
        });
  });
});

describe("parseContent2BlocksMatrix", () => {
    it("stores yaml on root and builds blocks across columns", () => {
        const root = createRoot();
        const yamlContent = createContent(0, 0, "yaml", "frontmatter");
        const topHeading = createContent(1, 20, "heading", "# Title");
        const childParagraph = createContent(7, 40, "paragraph", "body");
        const siblingHeading = createContent(1, 60, "heading", "# Next");

        const result = parseContent2Blocks(
            [yamlContent, topHeading, childParagraph, siblingHeading],
            root,
        );

        expect(root.yaml).toEqual(yamlContent);
        expect(result).toHaveLength(2);
        expect(result[0]).toHaveLength(2);
        expect(result[1]).toHaveLength(1);
        expect(result[0][0].content).toEqual([topHeading]);
        expect(result[0][1].content).toEqual([siblingHeading]);
        expect(result[1][0].content).toEqual([childParagraph]);
        expect(result[1][0].parent).toBe(result[0][0]);
        console.dir(result, { depth: null });
    });
});

describe("traceBackToOrigin", () => {
    it("appends a child block into the next column when content level increases", () => {
        const root = createRoot();
        const parentContent = createContent(1, 10, "heading", "# Parent");
        const currentContent = createContent(7, 30, "paragraph", "child");
        const parentBlock = createBlock(parentContent, { parent: root });
        const blocks: Block[][] = [[parentBlock]];

        const result = traceBackToOrigin(blocks, parentBlock, currentContent);

        expect(result.columnIndex).toBe(1);
        expect(result.index).toBe(0);
        expect(result.parent).toBe(parentBlock);
        expect(result.content).toEqual([currentContent]);
        expect(blocks).toHaveLength(2);
        expect(blocks[1]).toEqual([result]);
    });

    it("traces back to the parent branch before creating a sibling block", () => {
        const root = createRoot();
        const topContent = createContent(1, 10, "heading", "# Parent");
        const childContent = createContent(3, 30, "heading", "### Child");
        const siblingContent = createContent(2, 50, "heading", "## Sibling");
        const topBlock = createBlock(topContent, { parent: root, index: 0, columnIndex: 0 });
        const childBlock = createBlock(childContent, { parent: topBlock, index: 0, columnIndex: 1 });
        const blocks: Block[][] = [[topBlock], [childBlock]];

        const result = traceBackToOrigin(blocks, childBlock, siblingContent);

        expect(result.columnIndex).toBe(1);
        expect(result.index).toBe(1);
        expect(result.parent).toBe(topBlock);
        expect(result.content).toEqual([siblingContent]);
        expect(blocks[1]).toEqual([childBlock, result]);
        console.dir(blocks, { depth: null });
    });
});
