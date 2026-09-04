<script lang="ts">
	import { onMount } from "svelte";
	import type { Attachment } from "svelte/attachments";
	import type { Heading } from "./HeadingSuggester";
	import { setIcon } from "obsidian";

	interface Props {
		heading: Heading;
	}
	const { heading }: Props = $props();
	const indent = "   ".repeat(heading.level - 1);
	const content = heading.heading;

	const icon: Attachment<HTMLElement> = (el) => {
		const color = heading.locate === "upper" ? "green" : "red";
		if (heading.isParent) {
			setIcon(el, "chevron-down");
			el.style.color = color;
		} else {
			// el.style.borderRight = `3px solid ${color}`;
			setIcon(el, "tally-1");
			el.style.color = color;
			el.style.paddingLeft = "6px";
		}
	};
	let el: HTMLElement;
	onMount(() => {
		// el.scrollIntoView({ block: "center" });
		// console.log("fuzzySuggesterItem onMount", heading);
	});
</script>

<div bind:this={el} class="flex items-center justify-between grow">
	<div class="flex items-center gap-2">
		<div>{indent}</div>
		<span {@attach icon}></span>
		<div>{content}</div>
	</div>
	<div>{`H${heading.level}`}</div>
</div>
