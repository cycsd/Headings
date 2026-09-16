<script lang="ts">
	import type { Attachment } from "svelte/attachments";
	import type { Heading } from "./HeadingSuggester";
	import { setIcon } from "obsidian";

	interface Props {
		heading: Heading;
	}
	const { heading }: Props = $props();
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
</script>

	<div class="heading-suggester-item" style:--heading-level={heading.level}>
	<div class="heading-suggester-content">
		<span class="heading-suggester-icon" {@attach icon}></span>
		<div class="heading-suggester-title">{content}</div>
	</div>
	<div class="heading-suggester-level">{`H${heading.level}`}</div>
</div>
