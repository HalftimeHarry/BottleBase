<script lang="ts">
	let { data } = $props<{ data: { hasSession: boolean } }>();

	const sections = [
		{
			title: 'Bottle Search',
			body: 'Fast lookup for bottles, aliases, brands, and cocktail uses.',
			status: 'Ready for live search',
			href: '/dashboard/search'
		},
		{
			title: 'Bottle Details',
			body: 'Review catalog records, linked images, and bottle-level metadata.',
			status: 'Catalog records',
			href: '/dashboard/bottles'
		},
		{
			title: 'Bar Inventory',
			body: 'Track bar-specific stock, par levels, and visibility settings.',
			status: 'Inventory workspace',
			href: '/dashboard/bars'
		},
		{
			title: 'Catalog Tools',
			body: 'Manage sections, aliases, and the structure behind the bottle catalog.',
			status: 'Catalog admin',
			href: '/dashboard/catalog'
		}
	];
</script>

<svelte:head>
	<title>BottleBase Dashboard</title>
</svelte:head>

<main class="dashboard-shell">
	<section class="dashboard-card">
		<div class="hero-copy">
			<div class="mobile-branding" aria-label="BottleBase">
				<img src="/logos/bb_logo_primary.png" alt="BottleBase" class="mobile-logo" />
			</div>
			<p class="eyebrow">BottleBase</p>
			<h1>Dashboard</h1>
			<p class="lede">
				Your session is active. This is the workspace where bottle search, bar inventory, and
				catalog tools will live next.
			</p>
			<p class="session-state">
				Session status: <span>{data.hasSession ? 'Active' : 'Missing'}</span>
			</p>
		</div>

			<div class="section-table-wrap">
				<table class="section-table" aria-label="BottleBase workspace sections">
					<thead>
						<tr>
							<th scope="col">Section</th>
							<th scope="col">Purpose</th>
							<th scope="col">Status</th>
							<th scope="col">Open</th>
						</tr>
					</thead>
					<tbody>
						{#each sections as section}
							<tr>
								<th scope="row" data-label="Section">{section.title}</th>
								<td data-label="Purpose">{section.body}</td>
								<td data-label="Status"><span class="status-pill">{section.status}</span></td>
								<td data-label="Open"><a class="table-link" href={section.href}>Open</a></td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
	</section>
</main>

<style>
	.dashboard-shell {
		min-height: 100dvh;
		display: grid;
		place-items: center;
		padding: 1rem;
		background:
			radial-gradient(circle at top left, rgba(155, 52, 30, 0.16), transparent 32%),
			radial-gradient(circle at bottom right, rgba(240, 188, 74, 0.18), transparent 30%),
			linear-gradient(160deg, #f8f1e3 0%, #e5d2b7 100%);
	}

	.dashboard-card {
		width: min(48rem, 100%);
		background: color-mix(in srgb, var(--bb-card) 90%, white 10%);
		padding: clamp(1.25rem, 4vw, 2.5rem);
		border-radius: 1.25rem;
		box-shadow: 0 24px 52px rgba(20, 15, 10, 0.28);
		border: 1px solid rgba(73, 41, 18, 0.12);
		backdrop-filter: blur(4px);
	}

	.hero-copy {
		margin-bottom: 1.5rem;
	}

	.mobile-branding {
		display: none;
		margin-bottom: 0.75rem;
	}

	.mobile-logo {
		display: block;
		width: min(13rem, 72vw);
		height: auto;
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
		font-size: clamp(2rem, 4vw, 3rem);
		line-height: 1.05;
	}

	.lede,
	.session-state {
		line-height: 1.6;
	}

	.session-state {
		margin-top: 1rem;
		font-weight: 700;
		color: color-mix(in srgb, var(--bb-ink) 88%, var(--bb-accent) 12%);
	}

	.session-state span {
		padding: 0.15rem 0.55rem;
		border-radius: 999px;
		background: rgba(155, 52, 30, 0.12);
		color: var(--bb-accent);
	}

	.section-table-wrap {
		overflow-x: auto;
		border-radius: 1rem;
		border: 1px solid rgba(73, 41, 18, 0.1);
		background: rgba(255, 255, 255, 0.6);
	}

	.section-table {
		width: 100%;
		border-collapse: collapse;
		min-width: 42rem;
	}

	.section-table th,
	.section-table td {
		padding: 1rem 1.1rem;
		text-align: left;
		vertical-align: top;
		border-bottom: 1px solid rgba(73, 41, 18, 0.08);
	}

	.section-table thead th {
		font-size: 0.78rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: color-mix(in srgb, var(--bb-ink) 65%, var(--bb-accent) 35%);
		background: rgba(255, 255, 255, 0.45);
	}

	.section-table tbody th {
		font-size: 1rem;
	}

	.section-table tbody tr:last-child th,
	.section-table tbody tr:last-child td {
		border-bottom: none;
	}

	.status-pill {
		display: inline-flex;
		align-items: center;
		padding: 0.2rem 0.65rem;
		border-radius: 999px;
		background: rgba(155, 52, 30, 0.12);
		color: var(--bb-accent);
		font-size: 0.88rem;
		font-weight: 700;
	}

	.table-link {
		font-weight: 700;
		color: var(--bb-accent);
		text-decoration: none;
	}

	.table-link:hover {
		text-decoration: underline;
	}

	@media (max-width: 720px) {
		.dashboard-card {
			padding: 1rem;
		}

		.mobile-branding {
			display: block;
		}

		.eyebrow,
		h1,
		.lede {
			display: none;
		}

		.hero-copy {
			margin-bottom: 1rem;
		}

		.section-table {
			min-width: 0;
		}

		.section-table thead {
			display: none;
		}

		.section-table,
		.section-table tbody,
		.section-table tr,
		.section-table th,
		.section-table td {
			display: block;
			width: 100%;
		}

		.section-table tbody tr {
			padding: 0.95rem;
			border-bottom: 1px solid rgba(73, 41, 18, 0.08);
		}

		.section-table tbody tr:last-child {
			border-bottom: none;
		}

		.section-table tbody th,
		.section-table tbody td {
			padding: 0;
			border: 0;
		}

		.section-table tbody th {
			margin-bottom: 0.55rem;
			font-size: 1.05rem;
		}

		.section-table tbody td {
			display: grid;
			grid-template-columns: 6.5rem minmax(0, 1fr);
			gap: 0.75rem;
			align-items: start;
			padding: 0.32rem 0;
		}

		.section-table tbody td::before {
			content: attr(data-label);
			font-size: 0.78rem;
			font-weight: 700;
			letter-spacing: 0.08em;
			text-transform: uppercase;
			color: color-mix(in srgb, var(--bb-ink) 58%, var(--bb-accent) 42%);
		}
	}
</style>
