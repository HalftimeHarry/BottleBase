<script lang="ts">
	import { tick } from 'svelte';

	let { data, form } = $props<{
		data: {
			bottles: Array<{ id: string; name: string; brand: string; category: string }>;
			bars: Array<{
				id: string;
				name: string;
				slug: string;
				barType: string;
				defaultInventoryMode: string;
				stockingProfile: string;
				created: string;
				stockedCount: number;
			}>;
			selectedBarId: string;
			selectedStorageFilter: string;
			selectedBarStorageTypes: string[];
			selectedBarBottles: Array<{
				id: string;
				barId: string;
				bottleId: string;
				displayName: string;
				brand: string;
				category: string;
				location: string;
				locationType: string;
				currentCount: number;
				parLevel: number;
				reorderLevel: number;
				inventoryMode: string;
				isVisible: boolean;
			}>;
			setupError: string | null;
		};
		form?: { error?: string; fieldErrors?: Record<string, string> };
	}>();

	type StorageAreaType = 'well' | 'backbar' | 'cold-storage' | 'overflow';
	type StorageArea = { id: string; name: string; type: StorageAreaType };
	type StockValues = { current: string; par: string; reorder: string; storageAreaId: string };

	const AREA_TYPE_OPTIONS: Array<{ value: StorageAreaType; label: string }> = [
		{ value: 'well', label: 'Well' },
		{ value: 'backbar', label: 'Backbar' },
		{ value: 'cold-storage', label: 'Cold Storage' },
		{ value: 'overflow', label: 'Overflow' }
	];

	const LOCATION_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
		{ value: 'well', label: 'Well' },
		{ value: 'backbar', label: 'Backbar' },
		{ value: 'cold-storage', label: 'Cold Storage' },
		{ value: 'overflow', label: 'Overflow' }
	];

	const profileDefaults: Record<
		string,
		{
			label: string;
			current: string;
			par: string;
			reorder: string;
			storageAreas: Array<{ name: string; type: StorageAreaType }>;
		}
	> = {
		'full-service': {
			label: 'Full Service Back Bar',
			current: '2',
			par: '2',
			reorder: '1',
			storageAreas: [
				{ name: 'Main Back Bar', type: 'backbar' },
				{ name: 'Speed Rail', type: 'well' },
				{ name: 'Overstock Room', type: 'overflow' }
			]
		},
		'cocktail-focus': {
			label: 'Cocktail Program',
			current: '1',
			par: '1.5',
			reorder: '0.75',
			storageAreas: [
				{ name: 'Service Well', type: 'well' },
				{ name: 'Prep Shelf', type: 'backbar' },
				{ name: 'Cold Storage', type: 'cold-storage' }
			]
		},
		'event-pop-up': {
			label: 'Temporary Event Pop-up',
			current: '0.5',
			par: '1',
			reorder: '0.5',
			storageAreas: [
				{ name: 'Mobile Bar Cart', type: 'well' },
				{ name: 'Portable Cooler', type: 'cold-storage' }
			]
		}
	};

	let areaCounter = 0;

	function nextAreaId(): string {
		areaCounter += 1;
		return `area-${areaCounter}`;
	}

	function buildStorageAreas(
		areas: Array<{ name: string; type: StorageAreaType }>
	): StorageArea[] {
		return areas.map((area) => ({ id: nextAreaId(), ...area }));
	}

	let step = $state(1);
	let name = $state('');
	let barType = $state('permanent');
	let defaultInventoryMode = $state('simple-counts');
	let stockingProfile = $state('full-service');
	let storageAreas = $state<StorageArea[]>(buildStorageAreas(profileDefaults['full-service'].storageAreas));
	let defaultCurrent = $state(profileDefaults['full-service'].current);
	let defaultPar = $state(profileDefaults['full-service'].par);
	let defaultReorder = $state(profileDefaults['full-service'].reorder);
	let selectedBottleIds = $state<string[]>([]);
	let stockByBottle = $state<Record<string, StockValues>>({});
	let wizardForm = $state<HTMLFormElement | null>(null);

	function addStorageArea(): void {
		storageAreas = [...storageAreas, { id: nextAreaId(), name: '', type: 'backbar' }];
	}

	function removeStorageArea(id: string): void {
		if (storageAreas.length <= 1) {
			return;
		}
		storageAreas = storageAreas.filter((area) => area.id !== id);
	}

	function updateStorageAreaName(id: string, nameValue: string): void {
		storageAreas = storageAreas.map((area) =>
			area.id === id ? { ...area, name: nameValue } : area
		);
	}

	function updateStorageAreaType(id: string, typeValue: StorageAreaType): void {
		storageAreas = storageAreas.map((area) =>
			area.id === id ? { ...area, type: typeValue } : area
		);
	}

	function isValidNumber(value: string): boolean {
		if (!value.trim()) {
			return false;
		}
		const parsed = Number(value);
		return !Number.isNaN(parsed) && parsed >= 0;
	}

	function applyProfileDefaults(): void {
		const profile = profileDefaults[stockingProfile];
		defaultCurrent = profile.current;
		defaultPar = profile.par;
		defaultReorder = profile.reorder;
		storageAreas = buildStorageAreas(profile.storageAreas);
	}

	function ensureBottleStock(bottleId: string): void {
		if (stockByBottle[bottleId]) {
			return;
		}

		stockByBottle[bottleId] = {
			current: defaultCurrent,
			par: defaultPar,
			reorder: defaultReorder,
			storageAreaId: storageAreasList[0]?.id ?? ''
		};
		stockByBottle = { ...stockByBottle };
	}

	function applyDefaultsToSelected(): void {
		for (const bottleId of selectedBottleIds) {
			stockByBottle[bottleId] = {
				current: defaultCurrent,
				par: defaultPar,
				reorder: defaultReorder,
				storageAreaId: storageAreasList[0]?.id ?? ''
			};
		}
		stockByBottle = { ...stockByBottle };
	}

	function updateBottleValue(bottleId: string, key: keyof StockValues, value: string): void {
		ensureBottleStock(bottleId);
		stockByBottle[bottleId] = {
			...stockByBottle[bottleId],
			[key]: value
		};
		stockByBottle = { ...stockByBottle };
	}

	function valueForBottle(bottleId: string, key: keyof StockValues): string {
		const stock = stockByBottle[bottleId];
		if (stock) {
			return stock[key];
		}

		if (key === 'current') {
			return defaultCurrent;
		}
		if (key === 'par') {
			return defaultPar;
		}
		if (key === 'reorder') {
			return defaultReorder;
		}
		return storageAreasList[0]?.id ?? '';
	}

	function stepForFieldErrorKey(key: string): 1 | 2 | 3 {
		if (key === 'name' || key === 'barType' || key === 'defaultInventoryMode') {
			return 1;
		}

		if (key === 'stockingProfile' || key === 'storageAreas') {
			return 2;
		}

		return 3;
	}

	function selectorForErrorKey(key: string): string {
		if (key === 'storageAreas') {
			return '[data-storage-area-name="true"]';
		}

		if (key === 'selectedBottle') {
			return 'input[name="selectedBottle"]';
		}

		return `[name="${key}"]`;
	}

	const TOTAL_STEPS = 3;

	function goBack(): void {
		if (step > 1) {
			step -= 1;
		}
	}

	function goNext(): void {
		if (step === 1 && step1Complete) {
			step = 2;
			return;
		}
		if (step === 2 && step2Complete) {
			step = 3;
		}
	}

	async function focusFirstInvalidField(errorKey: string): Promise<void> {
		await tick();

		if (!wizardForm) {
			return;
		}

		const target = wizardForm.querySelector<HTMLElement>(selectorForErrorKey(errorKey));
		if (!target) {
			return;
		}

		target.scrollIntoView({ behavior: 'smooth', block: 'center' });
		target.focus({ preventScroll: true });
	}

	const step1Complete = $derived(name.trim().length > 1);
	const storageAreasList = $derived(
		storageAreas
			.map((area) => ({ ...area, name: area.name.trim() }))
			.filter((area) => area.name.length > 0)
	);
	const storageAreasPayload = $derived(
		JSON.stringify(storageAreasList.map((area) => ({ id: area.id, name: area.name, type: area.type })))
	);
	const step2Complete = $derived(
		step1Complete &&
			isValidNumber(defaultCurrent) &&
			isValidNumber(defaultPar) &&
			isValidNumber(defaultReorder) &&
			storageAreasList.length > 0
	);
	const step3Complete = $derived(
		step2Complete &&
			selectedBottleIds.length > 0 &&
			selectedBottleIds.every((bottleId) => {
				const stock = stockByBottle[bottleId];
				if (!stock) {
					return false;
				}
				return (
					isValidNumber(stock.current) &&
					isValidNumber(stock.par) &&
					isValidNumber(stock.reorder) &&
					storageAreasList.some((area) => area.id === stock.storageAreaId)
				);
			})
	);
	const canGoNext = $derived((step === 1 && step1Complete) || (step === 2 && step2Complete));

	$effect(() => {
		if (step > 1 && !step1Complete) {
			step = 1;
			selectedBottleIds = [];
		}
	});

	$effect(() => {
		if (step > 2 && !step2Complete) {
			step = 2;
			selectedBottleIds = [];
		}
	});

	$effect(() => {
		if (storageAreasList.length === 0) {
			return;
		}

		const fallback = storageAreasList[0].id;
		let changed = false;

		for (const bottleId of selectedBottleIds) {
			const stock = stockByBottle[bottleId];
			if (!stock) {
				continue;
			}
			if (!storageAreasList.some((area) => area.id === stock.storageAreaId)) {
				stockByBottle[bottleId] = { ...stock, storageAreaId: fallback };
				changed = true;
			}
		}

		if (changed) {
			stockByBottle = { ...stockByBottle };
		}
	});

	$effect(() => {
		if (step < 3) {
			return;
		}

		if (selectedBottleIds.length === 0 && data.bottles.length > 0) {
			selectedBottleIds = data.bottles.map((bottle: { id: string }) => bottle.id);
		}

		let changed = false;
		for (const bottleId of selectedBottleIds) {
			if (!stockByBottle[bottleId]) {
				stockByBottle[bottleId] = {
					current: defaultCurrent,
					par: defaultPar,
					reorder: defaultReorder,
					storageAreaId: storageAreasList[0]?.id ?? ''
				};
				changed = true;
			}
		}

		if (changed) {
			stockByBottle = { ...stockByBottle };
		}
	});

	$effect(() => {
		const fieldErrors = form?.fieldErrors;
		if (!fieldErrors) {
			return;
		}

		const firstKey = Object.keys(fieldErrors)[0];
		if (!firstKey) {
			return;
		}

		const targetStep = stepForFieldErrorKey(firstKey);
		if (step !== targetStep) {
			step = targetStep;
		}

		void focusFirstInvalidField(firstKey);
	});
</script>

<svelte:head>
	<title>BottleBase Bars</title>
</svelte:head>

<main class="workspace-shell">
	<section class="workspace-card">
		<div class="hero">
			<p class="eyebrow">BottleBase</p>
			<h1>Create and Stock a Bar</h1>
			<p>
				Every bar starts with setup defaults, then gets stocked from your bottle catalog. This flow
				requires both steps so permanent and temporary bars can be configured differently.
			</p>
		</div>

		{#if data.setupError}
			<p class="notice">{data.setupError}</p>
		{/if}

		{#if form?.error}
			<p class="notice notice-error">{form.error}</p>
		{/if}

		<form method="POST" action="?/createAndStock" class="wizard" bind:this={wizardForm}>
			<input type="hidden" name="storageAreasJson" value={storageAreasPayload} />
			{#if step !== 1}
				<input type="hidden" name="name" value={name} />
				<input type="hidden" name="barType" value={barType} />
				<input type="hidden" name="defaultInventoryMode" value={defaultInventoryMode} />
			{/if}
			{#if step !== 2}
				<input type="hidden" name="stockingProfile" value={stockingProfile} />
			{/if}

			{#if step === 1}
			<section class="step">
				<div class="step-heading">
					<span>Step 1</span>
					<h2>Create Bar</h2>
				</div>
				<div class="step-grid">
					<label>
						<span>Bar name</span>
						<input
							name="name"
							required
							autocomplete="off"
							bind:value={name}
							placeholder="Rooftop Main Bar"
						/>
						{#if form?.fieldErrors?.name}
							<p class="field-error">{form.fieldErrors.name}</p>
						{/if}
					</label>

					<label>
						<span>Bar type</span>
						<select name="barType" bind:value={barType}>
							<option value="permanent">Permanent bar</option>
							<option value="temporary">Temporary / event bar</option>
							<option value="satellite">Satellite service bar</option>
							<option value="seasonal">Seasonal patio bar</option>
						</select>
						{#if form?.fieldErrors?.barType}
							<p class="field-error">{form.fieldErrors.barType}</p>
						{/if}
					</label>

					<label>
						<span>Default inventory mode</span>
						<select name="defaultInventoryMode" bind:value={defaultInventoryMode}>
							<option value="disabled">Disabled</option>
							<option value="simple-counts">Simple counts</option>
							<option value="detailed-tracking">Detailed tracking</option>
						</select>
						{#if form?.fieldErrors?.defaultInventoryMode}
							<p class="field-error">{form.fieldErrors.defaultInventoryMode}</p>
						{/if}
					</label>
				</div>

			</section>
			{/if}

			{#if step === 2}
			<section class="step">
				<div class="step-heading">
					<span>Step 2</span>
					<h2>Set Stocking Defaults</h2>
				</div>
				<div class="step-grid">
					<label class="full-width">
						<span>Stocking profile</span>
						<select
							name="stockingProfile"
							bind:value={stockingProfile}
							onchange={applyProfileDefaults}
							disabled={!step1Complete}
						>
							{#each Object.entries(profileDefaults) as [value, profile]}
								<option value={value}>{profile.label}</option>
							{/each}
						</select>
						{#if form?.fieldErrors?.stockingProfile}
							<p class="field-error">{form.fieldErrors.stockingProfile}</p>
						{/if}
					</label>

					<label>
						<span>Default starting count</span>
						<input
							type="number"
							min="0"
							step="0.25"
							bind:value={defaultCurrent}
							disabled={!step1Complete}
						/>
					</label>

					<label>
						<span>Default par level</span>
						<input
							type="number"
							min="0"
							step="0.25"
							bind:value={defaultPar}
							disabled={!step1Complete}
						/>
					</label>

					<label>
						<span>Default reorder level</span>
						<input
							type="number"
							min="0"
							step="0.25"
							bind:value={defaultReorder}
							disabled={!step1Complete}
						/>
					</label>

					<div class="full-width storage-areas-block">
						<div class="storage-areas-head">
							<span>Storage areas with type tags</span>
							<button type="button" class="secondary tiny" onclick={addStorageArea} disabled={!step1Complete}
								>Add area</button
							>
						</div>
						<div class="storage-areas-grid">
							{#each storageAreas as area (area.id)}
								<div class="storage-row">
									<input
										type="text"
										data-storage-area-name="true"
										placeholder="Area name"
										value={area.name}
										oninput={(event) =>
											updateStorageAreaName(area.id, (event.currentTarget as HTMLInputElement).value)}
										disabled={!step1Complete}
									/>
									<select
										value={area.type}
										onchange={(event) =>
											updateStorageAreaType(area.id, (event.currentTarget as HTMLSelectElement).value as StorageAreaType)}
										disabled={!step1Complete}
									>
										{#each AREA_TYPE_OPTIONS as option}
											<option value={option.value}>{option.label}</option>
										{/each}
									</select>
									<button
										type="button"
										class="secondary tiny"
										onclick={() => removeStorageArea(area.id)}
										disabled={!step1Complete || storageAreas.length <= 1}
									>
										Remove
									</button>
								</div>
							{/each}
						</div>
						{#if form?.fieldErrors?.storageAreas}
							<p class="field-error">{form.fieldErrors.storageAreas}</p>
						{/if}
					</div>
				</div>

			</section>
			{/if}

			{#if step === 3}
			<section class="step">
				<div class="step-heading">
					<span>Step 3</span>
					<h2>Stock Bottles</h2>
				</div>
				<div class="step-tools">
					<p>{selectedBottleIds.length} bottle(s) selected</p>
					<button
						type="button"
						class="secondary"
						onclick={applyDefaultsToSelected}
						disabled={!step2Complete || selectedBottleIds.length === 0}
					>
						Apply defaults to selected
					</button>
				</div>
				{#if form?.fieldErrors?.selectedBottle}
					<p class="field-error">{form.fieldErrors.selectedBottle}</p>
				{/if}

				<div class="table-wrap">
					<table class="bottle-table" class:is-disabled={!step2Complete}>
						<thead>
							<tr>
								<th scope="col">Pick</th>
								<th scope="col">Bottle</th>
								<th scope="col">Storage area</th>
								<th scope="col">Current</th>
								<th scope="col">Par</th>
								<th scope="col">Reorder</th>
							</tr>
						</thead>
						<tbody>
							{#each data.bottles as bottle}
								<tr>
									<td data-label="Pick">
										<input
											type="checkbox"
											name="selectedBottle"
											value={bottle.id}
											bind:group={selectedBottleIds}
											onchange={() => ensureBottleStock(bottle.id)}
											disabled={!step2Complete}
										/>
									</td>
									<td data-label="Bottle">
										<div class="bottle-name">{bottle.name}</div>
										<div class="bottle-meta">{bottle.brand} • {bottle.category}</div>
									</td>
									<td data-label="Storage area">
										<select
											name={`storageArea_${bottle.id}`}
											value={valueForBottle(bottle.id, 'storageAreaId')}
											onchange={(event) =>
												updateBottleValue(
													bottle.id,
													'storageAreaId',
													(event.currentTarget as HTMLSelectElement).value
												)}
											disabled={!step2Complete || !selectedBottleIds.includes(bottle.id)}
										>
											{#if storageAreasList.length === 0}
												<option value="">No storage areas</option>
											{:else}
												{#each storageAreasList as area}
													<option value={area.id}>{area.name} ({area.type})</option>
												{/each}
											{/if}
										</select>
										{#if form?.fieldErrors?.[`storageArea_${bottle.id}`]}
											<p class="field-error">{form.fieldErrors[`storageArea_${bottle.id}`]}</p>
										{/if}
									</td>
									<td data-label="Current">
										<input
											name={`current_${bottle.id}`}
											type="number"
											min="0"
											step="0.25"
											value={valueForBottle(bottle.id, 'current')}
											oninput={(event) =>
												updateBottleValue(
													bottle.id,
													'current',
													(event.currentTarget as HTMLInputElement).value
												)}
											disabled={!step2Complete || !selectedBottleIds.includes(bottle.id)}
										/>
										{#if form?.fieldErrors?.[`current_${bottle.id}`]}
											<p class="field-error">{form.fieldErrors[`current_${bottle.id}`]}</p>
										{/if}
									</td>
									<td data-label="Par">
										<input
											name={`par_${bottle.id}`}
											type="number"
											min="0"
											step="0.25"
											value={valueForBottle(bottle.id, 'par')}
											oninput={(event) =>
												updateBottleValue(
													bottle.id,
													'par',
													(event.currentTarget as HTMLInputElement).value
												)}
											disabled={!step2Complete || !selectedBottleIds.includes(bottle.id)}
										/>
										{#if form?.fieldErrors?.[`par_${bottle.id}`]}
											<p class="field-error">{form.fieldErrors[`par_${bottle.id}`]}</p>
										{/if}
									</td>
									<td data-label="Reorder">
										<input
											name={`reorder_${bottle.id}`}
											type="number"
											min="0"
											step="0.25"
											value={valueForBottle(bottle.id, 'reorder')}
											oninput={(event) =>
												updateBottleValue(
													bottle.id,
													'reorder',
													(event.currentTarget as HTMLInputElement).value
												)}
											disabled={!step2Complete || !selectedBottleIds.includes(bottle.id)}
										/>
										{#if form?.fieldErrors?.[`reorder_${bottle.id}`]}
											<p class="field-error">{form.fieldErrors[`reorder_${bottle.id}`]}</p>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

			</section>
			{/if}

			<div class="paginator paginator-bottom" aria-label="Form navigation bottom">
				<button type="button" class="secondary" onclick={goBack} disabled={step === 1}>Back</button>
				<p class="step-progress">Step {step} of {TOTAL_STEPS}</p>
				{#if step < TOTAL_STEPS}
					<button type="button" onclick={goNext} disabled={!canGoNext}>Next</button>
				{:else}
					<button type="submit" disabled={!step3Complete}>Create bar and stock it</button>
				{/if}
			</div>
		</form>

		<section class="records-panel">
			<h2>Existing Bars</h2>
			<p class="panel-copy">Review each bar setup and jump into bottle-level adjustments.</p>

			<div class="table-wrap">
				<table class="bar-table">
					<thead>
						<tr>
							<th scope="col">Bar</th>
							<th scope="col">Type</th>
							<th scope="col">Inventory mode</th>
							<th scope="col">Profile</th>
							<th scope="col">Stocked bottles</th>
							<th scope="col">Manage</th>
						</tr>
					</thead>
					<tbody>
						{#if data.bars.length === 0}
							<tr>
								<td colspan="6">No bars created yet.</td>
							</tr>
						{:else}
							{#each data.bars as bar}
								<tr>
									<th scope="row" data-label="Bar">{bar.name}</th>
									<td data-label="Type">{bar.barType}</td>
									<td data-label="Inventory mode">{bar.defaultInventoryMode}</td>
									<td data-label="Profile">{bar.stockingProfile || 'custom'}</td>
									<td data-label="Stocked bottles">{bar.stockedCount}</td>
									<td data-label="Manage">
										<a class="table-link" href={`/dashboard/bars?bar=${bar.id}`}>Manage</a>
									</td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
		</section>

		{#if data.selectedBarId}
			<section class="records-panel">
				<h2>Adjust Bottles For Selected Bar</h2>
				<p class="panel-copy">Filter by storage type, then update counts and placement per bottle.</p>

				<div class="filter-row">
					<a
						class="table-link"
						href={`/dashboard/bars?bar=${data.selectedBarId}`}
						aria-current={data.selectedStorageFilter ? undefined : 'page'}
					>
						All storage types
					</a>
					{#each data.selectedBarStorageTypes as type}
						<a
							class="table-link"
							href={`/dashboard/bars?bar=${data.selectedBarId}&storage=${type}`}
							aria-current={data.selectedStorageFilter === type ? 'page' : undefined}
						>
							{type}
						</a>
					{/each}
				</div>

				<div class="table-wrap">
					<table class="bar-table">
						<thead>
							<tr>
								<th scope="col">Bottle</th>
								<th scope="col">Storage</th>
								<th scope="col">Current</th>
								<th scope="col">Par</th>
								<th scope="col">Reorder</th>
								<th scope="col">Mode</th>
								<th scope="col">Visible</th>
								<th scope="col">Save</th>
							</tr>
						</thead>
						<tbody>
							{#if data.selectedBarBottles.length === 0}
								<tr>
									<td colspan="8">No stocked bottles for this selection.</td>
								</tr>
							{:else}
								{#each data.selectedBarBottles as bottle}
									<tr>
										<td data-label="Bottle">
											<div class="bottle-name">{bottle.displayName}</div>
											<div class="bottle-meta">{bottle.brand} • {bottle.category}</div>
										</td>
										<td colspan="7">
											<form method="POST" action="?/updateStock" class="inline-edit-form">
												<input type="hidden" name="barBottleId" value={bottle.id} />
												<input type="hidden" name="selectedBarId" value={data.selectedBarId} />
												<div class="inline-edit-grid">
													<input name="location" value={bottle.location} aria-label="Storage area name" />
													<select name="locationType" aria-label="Storage area type">
														{#each LOCATION_TYPE_OPTIONS as option}
															<option value={option.value} selected={bottle.locationType === option.value}
																>{option.label}</option
															>
														{/each}
													</select>
													<input name="currentCount" type="number" min="0" step="0.25" value={bottle.currentCount} aria-label="Current count" />
													<input name="parLevel" type="number" min="0" step="0.25" value={bottle.parLevel} aria-label="Par level" />
													<input name="reorderLevel" type="number" min="0" step="0.25" value={bottle.reorderLevel} aria-label="Reorder level" />
													<select name="inventoryMode" aria-label="Inventory mode">
														<option value="disabled" selected={bottle.inventoryMode === 'disabled'}>Disabled</option>
														<option value="simple-counts" selected={bottle.inventoryMode === 'simple-counts'}>Simple</option>
														<option value="detailed-tracking" selected={bottle.inventoryMode === 'detailed-tracking'}>Detailed</option>
													</select>
													<select name="isVisible" aria-label="Visible">
														<option value="true" selected={bottle.isVisible}>Visible</option>
														<option value="false" selected={!bottle.isVisible}>Hidden</option>
													</select>
													<button type="submit">Save</button>
												</div>
											</form>
										</td>
									</tr>
								{/each}
							{/if}
						</tbody>
					</table>
				</div>
			</section>
		{/if}

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
		width: min(78rem, 100%);
		margin: 0 auto;
		padding: clamp(1rem, 3vw, 2rem);
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
	h2,
	p {
		margin: 0;
	}

	h1 {
		margin-top: 0.25rem;
		font-size: clamp(1.85rem, 4vw, 2.85rem);
		line-height: 1.08;
	}

	.hero p {
		margin-top: 0.6rem;
		line-height: 1.6;
		max-width: 68ch;
	}

	.notice {
		margin-top: 1rem;
		padding: 0.85rem 1rem;
		border-radius: 0.9rem;
		background: rgba(155, 52, 30, 0.1);
		color: color-mix(in srgb, var(--bb-ink) 88%, var(--bb-accent) 12%);
	}

	.notice-error {
		background: rgba(155, 52, 30, 0.16);
		color: var(--bb-accent);
	}

	.wizard {
		margin-top: 1rem;
		display: grid;
		gap: 1rem;
	}

	.step,
	.records-panel {
		padding: 1rem;
		border-radius: 1rem;
		background: rgba(255, 255, 255, 0.64);
		border: 1px solid rgba(73, 41, 18, 0.1);
	}

	.step {
		box-shadow: 0 0 0 2px rgba(155, 52, 30, 0.2) inset;
	}

	.step-heading {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
	}

	.step-heading span {
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.11em;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--bb-ink) 65%, var(--bb-accent) 35%);
	}

	.step-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.8rem;
		margin-top: 0.8rem;
	}

	label {
		display: grid;
		gap: 0.35rem;
		font-size: 0.9rem;
		font-weight: 600;
	}

	.field-error {
		margin: 0.2rem 0 0;
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--bb-accent);
	}

	.full-width {
		grid-column: 1 / -1;
	}

	input,
	select,
	button {
		font: inherit;
	}

	input,
	select {
		width: 100%;
		padding: 0.72rem 0.8rem;
		border-radius: 0.8rem;
		border: 1px solid rgba(73, 41, 18, 0.14);
		background: rgba(255, 255, 255, 0.9);
		color: inherit;
	}

	.step-tools {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.7rem;
		margin-top: 0.9rem;
	}

	.paginator {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 0.9rem;
		border-radius: 0.9rem;
		border: 1px solid rgba(73, 41, 18, 0.1);
		background: rgba(255, 255, 255, 0.55);
	}

	.paginator-bottom {
		margin-top: 0.8rem;
	}

	.step-progress {
		font-weight: 700;
		color: color-mix(in srgb, var(--bb-ink) 78%, var(--bb-accent) 22%);
	}

	button {
		border: 0;
		border-radius: 999px;
		padding: 0.72rem 1.15rem;
		font-weight: 700;
		background: var(--bb-accent);
		color: white;
		cursor: pointer;
	}

	button.secondary {
		background: color-mix(in srgb, var(--bb-ink) 72%, #5f4732 28%);
	}

	button.tiny {
		padding: 0.4rem 0.75rem;
		font-size: 0.82rem;
	}

	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.panel-copy {
		margin-top: 0.4rem;
		line-height: 1.5;
	}

	.storage-areas-block {
		display: grid;
		gap: 0.55rem;
	}

	.storage-areas-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.7rem;
		font-size: 0.9rem;
		font-weight: 600;
	}

	.storage-areas-grid {
		display: grid;
		gap: 0.5rem;
	}

	.storage-row {
		display: grid;
		grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr) auto;
		gap: 0.45rem;
		align-items: center;
	}

	.table-wrap {
		margin-top: 0.8rem;
		overflow-x: auto;
		border-radius: 0.9rem;
		border: 1px solid rgba(73, 41, 18, 0.08);
		background: rgba(255, 255, 255, 0.55);
	}

	.filter-row {
		display: flex;
		gap: 0.6rem;
		flex-wrap: wrap;
		margin-top: 0.8rem;
	}

	.filter-row .table-link[aria-current='page'] {
		text-decoration: underline;
	}

	.inline-edit-form {
		width: 100%;
	}

	.inline-edit-grid {
		display: grid;
		grid-template-columns: repeat(8, minmax(0, 1fr));
		gap: 0.45rem;
		align-items: center;
	}

	.bottle-table,
	.bar-table {
		width: 100%;
		border-collapse: collapse;
		min-width: 46rem;
	}

	.bottle-table th,
	.bottle-table td,
	.bar-table th,
	.bar-table td {
		padding: 0.82rem;
		text-align: left;
		vertical-align: top;
		border-bottom: 1px solid rgba(73, 41, 18, 0.08);
	}

	.bottle-table thead th,
	.bar-table thead th {
		font-size: 0.76rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		background: rgba(255, 255, 255, 0.45);
		color: color-mix(in srgb, var(--bb-ink) 65%, var(--bb-accent) 35%);
	}

	.bottle-table tbody tr:last-child td,
	.bar-table tbody tr:last-child td {
		border-bottom: none;
	}

	.bottle-name {
		font-weight: 700;
	}

	.bottle-meta {
		margin-top: 0.2rem;
		font-size: 0.84rem;
		color: color-mix(in srgb, var(--bb-ink) 74%, var(--bb-accent) 26%);
	}

	.is-disabled {
		opacity: 0.7;
	}

	.back-link {
		display: inline-block;
		margin-top: 1rem;
		font-weight: 700;
		color: var(--bb-accent);
		text-decoration: none;
	}

	@media (max-width: 920px) {
		.step-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 720px) {
		.workspace-shell {
			padding: 0.75rem;
		}

		.workspace-card {
			padding: 0.95rem;
		}

		.step-grid {
			grid-template-columns: 1fr;
		}

		.step-tools,
		.paginator {
			flex-direction: column;
			align-items: stretch;
		}

		.step-progress {
			text-align: center;
		}

		.storage-row {
			grid-template-columns: 1fr;
		}

		.bottle-table,
		.bar-table {
			min-width: 0;
		}

		.bottle-table thead,
		.bar-table thead {
			display: none;
		}

		.bottle-table,
		.bottle-table tbody,
		.bottle-table tr,
		.bottle-table th,
		.bottle-table td,
		.bar-table,
		.bar-table tbody,
		.bar-table tr,
		.bar-table th,
		.bar-table td {
			display: block;
			width: 100%;
		}

		.bottle-table tbody tr,
		.bar-table tbody tr {
			padding: 0.8rem;
			border-bottom: 1px solid rgba(73, 41, 18, 0.08);
		}

		.bottle-table tbody td,
		.bar-table tbody td {
			padding: 0.25rem 0;
			border: 0;
		}

		.bottle-table tbody td,
		.bar-table tbody td {
			display: grid;
			grid-template-columns: 6rem minmax(0, 1fr);
			gap: 0.7rem;
		}

		.bottle-table tbody td::before,
		.bar-table tbody td::before {
			content: attr(data-label);
			font-size: 0.74rem;
			font-weight: 700;
			letter-spacing: 0.08em;
			text-transform: uppercase;
			color: color-mix(in srgb, var(--bb-ink) 58%, var(--bb-accent) 42%);
		}
	}
</style>
