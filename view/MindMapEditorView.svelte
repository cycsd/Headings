<script lang="ts">
	import MyPlugin from "../src/main";

  interface Props {
    startCount: number;
    plugin: MyPlugin;
  }

  let {
    startCount,
    plugin
  }: Props = $props();

  let count = $state(startCount);

  export function increment() {
    count += 1;
  }
  function logEditor() {
    console.log("Current Markdown Editor:");
    console.log(plugin.currentMarkdownEditor);
    console.log("editor text:",plugin.currentMarkdownEditor?.getValue());
  }
</script>

<div class="number">
  <span>My number is {count}!</span>
</div>

<button onclick={logEditor}>Decrement</button>

<span>{plugin.currentMarkdownDoc}</span>
<h1>in plugin</h1>
<span>{plugin.currentMarkdownEditor?.getValue()}</span>

<style>
  .number {
    color: red;
  }
</style>