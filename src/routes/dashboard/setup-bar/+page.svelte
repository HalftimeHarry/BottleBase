<svelte:head>
	<title>BottleBase Setup</title>
</svelte:head>

<main class="setup-shell">
	<section class="setup-card">
		<p class="eyebrow">BottleBase Setup</p>
		<h1>Create Your First Bar</h1>
		<p>
			Before using the dashboard, create and stock at least one bar. This keeps search and inventory
			ready for real service from day one.
		</p>

		<div class="actions">
			<a class="primary-link" href="/dashboard/bars">Start bar setup</a>
			<a class="secondary-link" href="/dashboard">Try dashboard again</a>
		</div>
	</section>
</main>

<style>
	.setup-shell {
		min-height: 100dvh;
		display: grid;
		place-items: center;
		padding: 1rem;
		background:
			radial-gradient(circle at top left, rgba(155, 52, 30, 0.16), transparent 32%),
			radial-gradient(circle at bottom right, rgba(240, 188, 74, 0.18), transparent 30%),
			linear-gradient(160deg, #f8f1e3 0%, #e5d2b7 100%);
	}

	.setup-card {
		width: min(44rem, 100%);
		padding: clamp(1.2rem, 4vw, 2.25rem);
		border-radius: 1.25rem;
		background: color-mix(in srgb, var(--bb-card) 90%, white 10%);
		box-shadow: 0 24px 52px rgba(20, 15, 10, 0.28);
		border: 1px solid rgba(73, 41, 18, 0.12);
	}

	.eyebrow {
		font-size: 0.85rem;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--bb-accent);
	}

	h1,
	p {
		margin: 0;
	}

	h1 {
		margin-top: 0.3rem;
		font-size: clamp(1.8rem, 4vw, 2.75rem);
		line-height: 1.08;
	}

	p {
		margin-top: 0.8rem;
		line-height: 1.6;
	}

	.actions {
		margin-top: 1rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0.7rem;
	}

	.primary-link,
	.secondary-link {
		display: inline-block;
		padding: 0.72rem 1.1rem;
		border-radius: 999px;
		font-weight: 700;
		text-decoration: none;
	}

	.primary-link {
		background: var(--bb-accent);
		color: white;
	}

	.secondary-link {
		background: color-mix(in srgb, var(--bb-ink) 72%, #5f4732 28%);
		color: white;
	}
</style>
