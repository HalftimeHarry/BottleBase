<svelte:head>
	<title>BottleBase Search</title>
</svelte:head>

<main class="workspace-shell">
	<section class="workspace-card">
		<p class="eyebrow">BottleBase</p>
		<h1>Bottle Search</h1>
		<p>Search bottles, aliases, brands, sections, and cocktail usage from one fast workspace.</p>
		<a class="back-link" href="/dashboard">Back to dashboard</a>
	</section>
</main>

<style>
	.workspace-shell {
		min-height: 100dvh;
		display: grid;
		place-items: center;
		padding: 1rem;
	}

	.workspace-card {
		width: min(42rem, 100%);
		background: color-mix(in srgb, var(--bb-card) 90%, white 10%);
		padding: 2rem;
		border-radius: 1.25rem;
		box-shadow: 0 24px 52px rgba(20, 15, 10, 0.28);
	}

	.eyebrow {
		font-size: 0.85rem;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--bb-accent);
	}

	h1 {
		margin: 0.25rem 0 0.75rem;
	}

	.back-link {
		display: inline-block;
		margin-top: 1rem;
		font-weight: 700;
		color: var(--bb-accent);
		text-decoration: none;
	}
</style>
