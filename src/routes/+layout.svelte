<script lang="ts">
	import { onMount } from 'svelte';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let showTopButton = $state(false);
	let { children } = $props();

	const toggleTopButton = () => {
		showTopButton = window.scrollY > 180;
	};

	const scrollToTop = () => {
		window.scrollTo({ top: 0, behavior: 'smooth' });
	};

	onMount(() => {
		toggleTopButton();
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<svelte:window onscroll={toggleTopButton} />
{@render children()}
<button
	type="button"
	class="top-button"
	class:is-visible={showTopButton}
	aria-label="Back to top"
	onclick={scrollToTop}
>
	Top
</button>
