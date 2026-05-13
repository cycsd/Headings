<script lang="ts">
	import { Virtualizer, type VirtualizerHandle } from "virtua/svelte";
	import type { ColumnLayout } from "../util/block-level";
	import { onMount, tick, type Snippet } from "svelte";
	interface Props {
		column: ColumnLayout;
		children: Snippet<
			[block: ColumnLayout["blocks"][number], index: number]
		>;
	}

	let { column, children }: Props = $props();
	let virtualizer: VirtualizerHandle | null = null;

	let innerHeight = $state(0);
	let smooth = false;
	// let { centerBlockIndex: preIndex } = column;
	let preIndex = 0;
	function onscrollend() {
		//todo 將所有 path 置中顯示
		//先將正中間的元素移到中央，再計算 cache 裡的高度，
		//如果總和超出 viewport size 則應重新 scroll 到第一個 path 元素並 align 至 top
		// 如果 parent 沒有變就不用在重新計算總和？
		// requestAnimationFrame 不一定需要？
		// console.log("scroll end");
	}
	$effect(() => {
		const index = column.centerBlockIndex;
		const columni = column.blocks[0]?.columnIndex;

		if (index !== preIndex && index !== -1) {
			// virtualizer?.scrollToIndex(index, {
			// 	align: "center",
			// 	smooth,
			// });
			// virtualizer?.getItemSize
			// requestAnimationFrame(() => {
			// virtualizer?.scrollBy((startMargin * 8) / 12);
			//srcoll to  index +1 似乎也不錯，思考一下可能會有哪些問題？
			//如果 index +1 和 index 顯示的區塊都很大的話，index 的顯示會被畫面截斷，會很怪。
			//

			// smooth 如果是 true，用滑鼠點擊是沒問題，但如果用鍵盤控制不曉得為什麼只要該畫面有那個元素就不會滾動，
			// tick (micro) 無法解決，一樣需要 setTimeout (marcro)。
			// 推測 smooth 滾動需要畫面更新後重新計算才會正確，用鍵盤控制的話會在畫面更新前就觸發滾動，導致滾動位置不正確。
			// 有知道問題了，我會在 block render 的時候 focus 該元素讓他監聽鍵盤事件用以進到 editor mode
			// 但我沒有將 preventScroll 設為 true，導致每次 focus 都會觸發 scroll，
			// 所以如果使用鍵盤會先觸發 scrollIntoView 後， focus 的 scrll 也再次觸發造成沒有動作。
			// setTimeout(() => {
				virtualizer?.scrollToIndex(index + 1, {
					align: "center",//todo 如果沒有 subpath 且其他 block 都小於當前 block 是否 align 至 end 就好？(加上 header block 拉長)
					smooth: smooth,
				});
			// }, 0);
		}
		// if (columni === 2) {
		// 	console.log("cache?", virtualizer?.getCache());
		// 	console.log(
		// 		"scroll offset (scroll top)",
		// 		virtualizer?.getScrollOffset(),
		// 	);
		// 	console.log(
		// 		"scroll size (scroll height)",
		// 		virtualizer?.getScrollSize(),
		// 	);
		// 	console.log(
		// 		"viewport size(offset height)",
		// 		virtualizer?.getViewportSize(),
		// 	);
		// }
		return () => {
			preIndex = index;
		};
	});

	let startMargin = $derived(Math.floor((innerHeight * 2) / 12));
	let endMargin = $derived(Math.ceil(innerHeight - startMargin));
	onMount(() => {
		tick().then(() => {
			// 初始滾動如果是 smooth ，會滑到未知的位置，且造成上方元素一開始不會無法被滾動到，
			// 所以第一次滾動後在改成 true
			// 且如果 element 太多，會有效能問題，故如果 element 超過 100 就不使用 smooth
			smooth = column.blocks.length <= 100;
			console.log("set smooth?", smooth);
		});
		// 	console.log(
		// 		"scroll on mount?",
		// 		column.centerBlockIndex,
		// 		virtualizer !== null,
		// 	);
		// 	virtualizer?.scrollToIndex(column.centerBlockIndex, {
		// 		align: "center",
		// 	});
	});
</script>

<svelte:window bind:innerHeight />
<div style="height: {startMargin}px;"></div>
<Virtualizer
	data={column.blocks}
	{children}
	bind:this={virtualizer}
	{startMargin}
	{onscrollend}
></Virtualizer>
<div style="height: {endMargin}px;"></div>
