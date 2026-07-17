<script lang="ts">
	let { data, form } = $props<{
		data: {
			bottles: Array<{
				id: string;
				name: string;
				slug: string;
				brand: string;
				category: string;
				abv: number | null;
				description: string;
				expand?: {
					section?: { name: string; slug: string };
					image?: { name: string; slug: string };
				};
			}>;
			sections: Array<{ id: string; name: string; slug: string; kind: string }>;
			images: Array<{ id: string; name: string; slug: string }>;
			totalBottles: number;
			totalSections: number;
			totalImages: number;
			setupError: string | null;
		};
		form?: { error?: string };
	}>();
</script>

<svelte:head>
	<title>BottleBase Bottles</title>
</svelte:head>

<main class="workspace-shell">
	<section class="workspace-card">
		<div class="hero">
			<div>
				<p class="eyebrow">BottleBase</p>
				<h1>Bottle Details</h1>
			</div>
		</div>

		{#if data.setupError}
			<p class="notice">{data.setupError}</p>
		{/if}

		{#if form?.error}
			<p class="notice notice-error">{form.error}</p>
		{/if}

		<div class="layout">
			<section class="panel">
				<h2>Create bottle record</h2>
				<p class="panel-copy">
					Add a new bottle record, then link it to an image and section.
				</p>

				<form method="POST" action="?/create" class="form-grid">
					<label>
						<span>Name</span>
						<input name="name" autocomplete="off" required />
					</label>

					<label>
						<span>Slug</span>
						<input name="slug" autocomplete="off" placeholder="auto-generated if blank" />
					</label>

					<label>
						<span>Brand</span>
						<input name="brand" autocomplete="off" required />
					</label>

					<label>
						<span>Category</span>
						<input name="category" autocomplete="off" required />
					</label>

					<label>
						<span>Section</span>
						<select name="section">
							<option value="">No section</option>
							{#each data.sections as section}
								<option value={section.id}>{section.name}</option>
							{/each}
						</select>
					</label>

					<label>
						<span>Image record</span>
						<select name="image" required>
							<option value="" disabled selected>Select an image</option>
							{#each data.images as image}
								<option value={image.id}>{image.name}</option>
							{/each}
						</select>
					</label>

					<label>
						<span>ABV</span>
						<input name="abv" type="number" min="0" max="100" step="0.1" />
					</label>

					<label class="full-width">
						<span>Description</span>
						<textarea name="description" rows="4" placeholder="Bottle notes and metadata"></textarea>
					</label>

					<div class="form-actions full-width">
						<button type="submit">Create bottle</button>
					</div>
				</form>
			</section>

			<section class="panel records-panel">
				<h2>Catalog records</h2>
				<p class="panel-copy">Live records from PocketBase with linked image and section metadata.</p>

				<div class="table-wrap">
					<table class="records-table">
						<thead>
							<tr>
								<th scope="col">Bottle</th>
								<th scope="col">Brand</th>
								<th scope="col">Section</th>
								<th scope="col">Image</th>
							</tr>
						</thead>
						<tbody>
							{#each data.bottles as bottle}
								<tr>
									<th scope="row" data-label="Bottle">
										<div class="bottle-name">{bottle.name}</div>
										<div class="bottle-meta">
											<span>{bottle.category}</span>
											{#if bottle.abv !== null}
												<span>{bottle.abv}% ABV</span>
											{/if}
										</div>
									</th>
									<td data-label="Brand">{bottle.brand}</td>
									<td data-label="Section">
										{bottle.expand?.section?.name ?? 'Unassigned'}
									</td>
									<td data-label="Image">
										{bottle.expand?.image?.name ?? 'Linked image'}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</section>
		</div>

		<a class="back-link" href="/dashboard">Back to dashboard</a>
	</section>
</main>

<style>
	.workspace-shell {
		min-height: 100dvh;
		padding: 1rem;
		background:
			radial-gradient(circle at top left, rgba(155, 52, 30, 0.16), transparent 32%),
			radial-gradient(circle at bottom right, rgba(240, 188, 74, 0.18), transparent 30%),
			linear-gradient(160deg, #f8f1e3 0%, #e5d2b7 100%);
	}

	.workspace-card {
		width: min(72rem, 100%);
		margin: 0 auto;
		background: color-mix(in srgb, var(--bb-card) 90%, white 10%);
		padding: clamp(1.1rem, 3vw, 2rem);
		border-radius: 1.25rem;
		box-shadow: 0 24px 52px rgba(20, 15, 10, 0.28);
		border: 1px solid rgba(73, 41, 18, 0.12);
	}

	.hero {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 1rem;
		align-items: start;
		margin-bottom: 1rem;
	}

	.eyebrow {
		font-size: 0.85rem;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--bb-accent);
	}

	h1,
	h2,
	p {
		margin: 0;
	}

	h1 {
		margin-top: 0.25rem;
		font-size: clamp(1.9rem, 4vw, 3rem);
		line-height: 1.05;
	}

	.notice {
		margin: 1rem 0;
		padding: 0.85rem 1rem;
		border-radius: 0.9rem;
		background: rgba(155, 52, 30, 0.1);
		color: color-mix(in srgb, var(--bb-ink) 88%, var(--bb-accent) 12%);
	}

	.notice-error {
		background: rgba(155, 52, 30, 0.16);
		color: var(--bb-accent);
	}

	.layout {
		display: grid;
		grid-template-columns: minmax(0, 20rem) minmax(0, 1fr);
		gap: 1rem;
		align-items: start;
	}

	.panel {
		padding: 1rem;
		border-radius: 1rem;
		background: rgba(255, 255, 255, 0.6);
		border: 1px solid rgba(73, 41, 18, 0.08);
	}

	.panel-copy {
		margin-top: 0.35rem;
		line-height: 1.5;
		color: color-mix(in srgb, var(--bb-ink) 80%, var(--bb-accent) 20%);
	}

	.form-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.85rem;
		margin-top: 1rem;
	}

	label {
		display: grid;
		gap: 0.4rem;
		font-weight: 600;
		font-size: 0.92rem;
	}

	.full-width {
		grid-column: 1 / -1;
	}

	input,
	select,
	textarea {
		width: 100%;
		border-radius: 0.85rem;
		border: 1px solid rgba(73, 41, 18, 0.14);
		background: rgba(255, 255, 255, 0.9);
		padding: 0.75rem 0.85rem;
		font: inherit;
		color: inherit;
	}

	textarea {
		resize: vertical;
		min-height: 7.5rem;
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
	}

	button {
		border: 0;
		border-radius: 999px;
		padding: 0.8rem 1.2rem;
		background: var(--bb-accent);
		color: white;
		font-weight: 700;
		cursor: pointer;
	}

	.records-panel {
		min-width: 0;
	}

	.table-wrap {
		margin-top: 1rem;
		overflow-x: auto;
		border-radius: 1rem;
		border: 1px solid rgba(73, 41, 18, 0.1);
		background: rgba(255, 255, 255, 0.55);
	}

	.records-table {
		width: 100%;
		border-collapse: collapse;
		min-width: 42rem;
	}

	.records-table th,
	.records-table td {
		padding: 1rem 1.05rem;
		border-bottom: 1px solid rgba(73, 41, 18, 0.08);
		text-align: left;
		vertical-align: top;
	}

	.records-table thead th {
		font-size: 0.78rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--bb-ink) 65%, var(--bb-accent) 35%);
		background: rgba(255, 255, 255, 0.45);
	}

	.records-table tbody tr:last-child th,
	.records-table tbody tr:last-child td {
		border-bottom: none;
	}

	.bottle-name {
		font-weight: 700;
	}

	.bottle-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem 0.55rem;
		margin-top: 0.35rem;
		font-size: 0.85rem;
		color: color-mix(in srgb, var(--bb-ink) 75%, var(--bb-accent) 25%);
	}

	.back-link {
		display: inline-block;
		margin-top: 1rem;
		font-weight: 700;
		color: var(--bb-accent);
		text-decoration: none;
	}

	@media (max-width: 900px) {
		.hero,
		.layout {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 720px) {
		.workspace-shell {
			padding: 0.75rem;
		}

		.workspace-card {
			padding: 1rem;
		}

		.form-grid {
			grid-template-columns: 1fr;
		}

		.records-table {
			min-width: 0;
		}

		.records-table thead {
			display: none;
		}

		.records-table,
		.records-table tbody,
		.records-table tr,
		.records-table th,
		.records-table td {
			display: block;
			width: 100%;
		}

		.records-table tbody tr {
			padding: 0.9rem 1rem;
			border-bottom: 1px solid rgba(73, 41, 18, 0.08);
		}

		.records-table tbody tr:last-child {
			border-bottom: none;
		}

		.records-table tbody th,
		.records-table tbody td {
			padding: 0.3rem 0;
			border-bottom: 0;
		}

		.records-table tbody td {
			display: grid;
			grid-template-columns: 5.5rem minmax(0, 1fr);
			gap: 0.75rem;
			align-items: start;
		}

		.records-table tbody td::before {
			content: attr(data-label);
			font-size: 0.75rem;
			font-weight: 700;
			letter-spacing: 0.08em;
			text-transform: uppercase;
			color: color-mix(in srgb, var(--bb-ink) 58%, var(--bb-accent) 42%);
		}
	}
</style>