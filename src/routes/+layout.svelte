<script lang="ts">
	import favicon from "$lib/assets/favicon.svg";
	import { resolve } from "$app/paths";

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<nav>
	<div><a href={resolve("/")}> home </a></div>
	<div><a href={resolve("/abyss")}> abyss </a></div>
</nav>
{@render children()}
