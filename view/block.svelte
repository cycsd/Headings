
<script lang="ts">
	import type { Attachment } from "svelte/attachments";
	import type { Block, NonStateBlock, Root } from "../util/block_level";
	import { MarkdownRenderer } from "obsidian";
	import type MindMapMdPlugin from "../src/main";
	import type { MindMapMdView } from "./MindMapMdView";

    type BlockWithParent = Omit<NonStateBlock, 'parent'> & { parent: BlockWithParent | Root };
    interface Props {
        block: BlockWithParent;//todo Block 暫時;
        plugin: MindMapMdPlugin;
        view: MindMapMdView;
        filePath: string;
    }
    let { block, plugin, view, filePath }: Props = $props();
    function renderObsidianMarkdown(content: string): Attachment {
        
        return (element:HTMLElement)=>{
            //todo DI 不應該在這邊還在給 Plugin 和 View ，之後不好測試
            // onPreivewRender(element) or svelte snippet ;
            if(!filePath) return;
            MarkdownRenderer.render(plugin.app,content, element, filePath, view);
        };
    }
</script>

<div>
    <div {@attach renderObsidianMarkdown(block.content[0]!.text)}>
    </div>
    <span>{block.content[0]!.type}</span>
</div>