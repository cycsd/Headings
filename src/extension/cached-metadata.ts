import type { CachedMetadata } from "obsidian";
import type { Heading } from "../handlers/HeadingSuggester";


export function find_next_heading(cached: CachedMetadata, heading: Heading) {
    const next_heading = cached
        .headings
        ?.find(h => h.position.start.line > heading.position.end.line)

    return {
        next_heading,
        offset: next_heading?.position.start.offset
    };
}

export function find_heading_block(cached: CachedMetadata, heading: Heading) {
    const next_heading = cached
        .headings
        ?.find(h => h.position.start.line > heading.position.end.line && h.level <= heading.level)

    return {
        next_heading,
        offset: next_heading?.position.start.offset
    };
}