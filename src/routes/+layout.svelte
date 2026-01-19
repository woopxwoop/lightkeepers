<script lang="ts">
	import favicon from "$lib/assets/favicon.svg";
	import { page } from "$app/state";
	import { resolve } from "$app/paths";

	let { data, children } = $props();

	let mapping: Map<string, string> = $derived(data.mapping);

	// paths
	const homePath = resolve("/");
	const abyssPath = resolve("/abyss");
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<nav>
	<a href={homePath} aria-current={page.url.pathname === homePath}> home </a>
	<a href={abyssPath} aria-current={page.url.pathname === abyssPath}> abyss </a>
</nav>

<!-- <aside>
	{#each mapping as [character, url]}
		<img src={url} alt="portrait of {character}" />
	{/each}
</aside> -->

{@render children()}
