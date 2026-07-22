<script lang="ts">
	import { tick } from 'svelte';

	let { data, form } = $props<{
		data: {
			bottles: Array<{ id: string; name: string; brand: string; category: string }>;
			images: Array<{ id: string; name: string; slug: string }>;
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
			selectedCategoryFilter: string;
			selectedSortKey: SortKey;
			selectedSortDirection: 'asc' | 'desc';
			selectedBarStorageTypes: string[];
			selectedBarCategories: string[];
			stockUpdated: boolean;
			generatedCount: number;
			addedCount: number;
			storageAddedCount: number;
			bottleAddedCount: number;
			updatedBarBottleId: string;
			rowStatus: string;
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
				imageUrl: string | null;
			}>;
			setupError: string | null;
		};
		form?: {
			error?: string;
			fieldErrors?: Record<string, string>;
			updatedBarBottleId?: string;
			rowStatus?: string;
		};
	}>();

	type StorageAreaType = 'well' | 'backbar' | 'cold-storage' | 'overflow';
	type StorageArea = { id: string; name: string; type: StorageAreaType };
	type StockValues = { current: string; par: string; reorder: string; storageAreaId: string };
	type SortKey = 'bottle' | 'area' | 'current' | 'par' | 'reorder' | 'mode' | 'save';

	const AREA_TYPE_OPTIONS: Array<{ value: StorageAreaType; label: string }> = [
		{ value: 'well', label: 'Main' },
		{ value: 'overflow', label: 'Storage' }
	];

	const LOCATION_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
		{ value: 'well', label: 'Main' },
		{ value: 'overflow', label: 'Storage' }
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
				{ name: 'Main Back Bar', type: 'well' },
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
				{ name: 'Prep Shelf', type: 'well' },
				{ name: 'Cold Storage', type: 'overflow' }
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
	let editingRows = $state<Record<string, boolean>>({});
	let sortKey = $state<SortKey>('bottle');
	let sortDirection = $state<'asc' | 'desc'>('asc');
	let bottleSearchQuery = $state('');
	let sortInitialized = $state(false);
	let step1Expanded = $state(data.bars.length === 0);
	let isSubmittingCreate = $state(false);
	let createProgress = $state(0);
	let createProgressTimer: ReturnType<typeof setInterval> | null = null;
	let wizardForm = $state<HTMLFormElement | null>(null);
	let showAddBottleModal = $state(false);
	let duplicateFromBarBottleId = $state('');
	let duplicateFromBottleLabel = $state('');
	let addBottleLocation = $state('Bar');
	let addBottleLocationType = $state<StorageAreaType>('well');
	let showEditBottleModal = $state(false);
	let editBarBottleId = $state('');
	let editBottleLabel = $state('');
	let editLocation = $state('');
	let editLocationType = $state('well');
	let editInventoryMode = $state('simple-counts');
	let editCurrentCount = $state('0');
	let editParLevel = $state('0');
	let editReorderLevel = $state('0');
	let showBottleImageModal = $state(false);
	let activeBottleImageUrl = $state('');
	let activeBottleImageLabel = $state('');

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
			if (step === 1) {
				step1Expanded = true;
			}
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

	function clearCreateProgressTimer(): void {
		if (createProgressTimer) {
			clearInterval(createProgressTimer);
			createProgressTimer = null;
		}
	}

	function startCreateProgress(): void {
		clearCreateProgressTimer();
		isSubmittingCreate = true;
		createProgress = 6;

		createProgressTimer = setInterval(() => {
			if (createProgress >= 92) {
				return;
			}

			const remaining = 92 - createProgress;
			const delta = Math.max(1, Math.ceil(remaining * 0.08));
			createProgress = Math.min(92, createProgress + delta);
		}, 180);
	}

	function onCreateAndStockSubmit(): void {
		if (step !== 3 || !step3Complete || isSubmittingCreate) {
			return;
		}

		startCreateProgress();
	}

	function openAddBottleModal(source: {
		barBottleId: string;
		bottleId: string;
		label: string;
		location: string;
		locationType: StorageAreaType;
	}): void {
		const normalizedType = source.locationType.toLowerCase();
		type SelectedBarBottle = (typeof data.selectedBarBottles)[number];
		const siblingLocations = data.selectedBarBottles
			.filter(
				(item: SelectedBarBottle) =>
					item.bottleId === source.bottleId && item.locationType.toLowerCase() === normalizedType
			)
			.map((item: SelectedBarBottle) => item.location.trim())
			.filter((value: string) => value.length > 0);

		const parseBaseAndIndex = (value: string): { base: string; index: number } => {
			const trimmed = value.trim();
			const match = trimmed.match(/^(.*?)(?:\s+(\d+))?$/);
			if (!match) {
				return { base: trimmed || 'Area', index: 1 };
			}

			const candidateBase = (match[1] ?? '').trim() || trimmed || 'Area';
			const parsedIndex = Number(match[2] ?? '1');
			return {
				base: candidateBase,
				index: Number.isFinite(parsedIndex) && parsedIndex > 0 ? parsedIndex : 1
			};
		};

		const sourceParts = parseBaseAndIndex(source.location || '');
		const baseLocation = sourceParts.base || 'Area';
		let highestIndex = 1;

		for (const locationName of siblingLocations) {
			const candidate = parseBaseAndIndex(locationName);
			if (candidate.base.toLowerCase() === baseLocation.toLowerCase()) {
				highestIndex = Math.max(highestIndex, candidate.index);
			}
		}

		const suggestedLocation = `${baseLocation} ${highestIndex + 1}`;

		duplicateFromBarBottleId = source.barBottleId;
		duplicateFromBottleLabel = source.label;
		addBottleLocation = suggestedLocation;
		addBottleLocationType = source.locationType;
		showAddBottleModal = true;
	}

	function closeAddBottleModal(): void {
		duplicateFromBarBottleId = '';
		duplicateFromBottleLabel = '';
		addBottleLocation = 'Bar';
		addBottleLocationType = 'well';
		showAddBottleModal = false;
	}

	function openEditBottleModal(bottle: (typeof data.selectedBarBottles)[number]): void {
		editBarBottleId = bottle.id;
		editBottleLabel = `${bottle.displayName} (${bottle.brand})`;
		editLocation = bottle.location;
		editLocationType = bottle.locationType;
		editInventoryMode = bottle.inventoryMode;
		editCurrentCount = String(bottle.currentCount);
		editParLevel = String(bottle.parLevel);
		editReorderLevel = String(bottle.reorderLevel);
		showEditBottleModal = true;
	}

	function closeEditBottleModal(): void {
		showEditBottleModal = false;
		editBarBottleId = '';
		editBottleLabel = '';
	}

	function openBottleImageModal(imageUrl: string, bottleLabel: string): void {
		activeBottleImageUrl = imageUrl;
		activeBottleImageLabel = bottleLabel;
		showBottleImageModal = true;
	}

	function closeBottleImageModal(): void {
		showBottleImageModal = false;
		activeBottleImageUrl = '';
		activeBottleImageLabel = '';
	}

	function isEditingRow(rowId: string): boolean {
		return Boolean(editingRows[rowId]);
	}

	function startEditingRow(rowId: string): void {
		editingRows = { ...editingRows, [rowId]: true };
	}

	function stopEditingRow(rowId: string): void {
		const next = { ...editingRows };
		delete next[rowId];
		editingRows = next;
	}

	function locationTypeLabel(value: string): string {
		if (value === 'overflow') {
			return 'Storage';
		}
		if (value === 'well' || value === 'backbar' || value === 'cold-storage') {
			return 'Main';
		}

		const option = LOCATION_TYPE_OPTIONS.find((candidate) => candidate.value === value);
		return option?.label ?? value;
	}

	function isStorageType(value: string): boolean {
		return value === 'overflow';
	}

	function isMainType(value: string): boolean {
		return value === 'well' || value === 'backbar' || value === 'cold-storage';
	}

	function isStorageAreaName(value: string): boolean {
		const normalized = value.trim().toLowerCase();
		return normalized.includes('storage') || normalized.includes('overflow');
	}

	function inventoryModeLabel(value: string): string {
		if (value === 'detailed-tracking') {
			return 'Detailed';
		}
		return 'Full';
	}

	function formatBottleAmount(value: number): string {
		if (Number.isInteger(value)) {
			return String(value);
		}

		return value.toFixed(2).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
	}

	function barsUrl(params: { bar?: string; storage?: string; category?: string } = {}): string {
		const query = new URLSearchParams();
		if (params.bar) {
			query.set('bar', params.bar);
		}
		if (params.storage) {
			query.set('storage', params.storage);
		}
		if (params.category) {
			query.set('category', params.category);
		}
		query.set('sort', sortKey);
		query.set('dir', sortDirection);
		return `/dashboard/bars?${query.toString()}`;
	}

	function updateSortInUrl(): void {
		if (typeof window === 'undefined') {
			return;
		}

		const nextUrl = new URL(window.location.href);
		nextUrl.searchParams.set('sort', sortKey);
		nextUrl.searchParams.set('dir', sortDirection);
		window.history.replaceState(window.history.state, '', `${nextUrl.pathname}?${nextUrl.searchParams.toString()}`);
	}

	function toggleSort(nextKey: SortKey): void {
		if (sortKey === nextKey) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
			updateSortInUrl();
			return;
		}

		sortKey = nextKey;
		sortDirection = 'asc';
		updateSortInUrl();
	}

	function activeSortDirection(key: SortKey): 'asc' | 'desc' | null {
		return sortKey === key ? sortDirection : null;
	}

	function rowStatusLabel(rowId: string): string {
		const updatedRowId = (form?.updatedBarBottleId ?? data.updatedBarBottleId ?? '').trim();
		if (updatedRowId !== rowId) {
			return '';
		}

		const status = (form?.rowStatus ?? data.rowStatus ?? '').trim();
		if (status === 'saved') {
			return 'Saved';
		}
		if (status === 'added') {
			return 'Duplicated';
		}
		if (status === 'stored') {
			return 'Storage';
		}
		if (status === 'error') {
			return 'Could not save';
		}

		return '';
	}

	function compareText(left: string, right: string): number {
		return left.localeCompare(right, undefined, { sensitivity: 'base', numeric: true });
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
	const focusRowId = $derived((form?.updatedBarBottleId ?? data.updatedBarBottleId ?? '').trim());
	const focusRowStatus = $derived((form?.rowStatus ?? data.rowStatus ?? '').trim());
	const selectedSortKeyFromData = $derived(data.selectedSortKey);
	const selectedSortDirectionFromData = $derived(data.selectedSortDirection);
	const sortedSelectedBarBottles = $derived.by(() => {
		const query = bottleSearchQuery.trim().toLowerCase();
		const rows = data.selectedBarBottles.filter((item) => {
			if (!query) {
				return true;
			}

			return [item.displayName, item.brand, item.category].some((value) =>
				value.toLowerCase().includes(query)
			);
		});
		const direction = sortDirection === 'asc' ? 1 : -1;

		rows.sort((left, right) => {
			let comparison = 0;
			if (sortKey === 'bottle') {
				comparison = compareText(left.displayName, right.displayName) || compareText(left.brand, right.brand);
			} else if (sortKey === 'area') {
				comparison = compareText(left.location, right.location) || compareText(locationTypeLabel(left.locationType), locationTypeLabel(right.locationType));
			} else if (sortKey === 'current') {
				comparison = left.currentCount - right.currentCount;
			} else if (sortKey === 'par') {
				comparison = left.parLevel - right.parLevel;
			} else if (sortKey === 'reorder') {
				comparison = left.reorderLevel - right.reorderLevel;
			} else if (sortKey === 'mode') {
				comparison = compareText(inventoryModeLabel(left.inventoryMode), inventoryModeLabel(right.inventoryMode));
			} else {
				comparison = compareText(rowStatusLabel(left.id), rowStatusLabel(right.id));
			}

			if (comparison === 0) {
				comparison = compareText(left.displayName, right.displayName) || compareText(left.location, right.location);
			}

			return comparison * direction;
		});

		return [...rows];
	});

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

		if (targetStep === 1) {
			step1Expanded = true;
		}

		void focusFirstInvalidField(firstKey);
	});

	$effect(() => {
		if (sortInitialized) {
			return;
		}

		sortKey = selectedSortKeyFromData;
		sortDirection = selectedSortDirectionFromData;
		sortInitialized = true;
	});

	$effect(() => {
		if (typeof window === 'undefined') {
			return;
		}

		if (!focusRowId) {
			return;
		}

		if (focusRowStatus !== 'added' && focusRowStatus !== 'stored' && focusRowStatus !== 'saved') {
			return;
		}

		void tick().then(() => {
			const row = document.getElementById(`bar-bottle-row-${focusRowId}`);
			if (!row) {
				return;
			}

			row.scrollIntoView({ behavior: 'smooth', block: 'center' });
			row.classList.remove('row-flash');
			void row.clientWidth;
			row.classList.add('row-flash');
		});
	});

	$effect(() => {
		return () => {
			clearCreateProgressTimer();
		};
	});
</script>

<svelte:head>
	<title>BottleBase Bars</title>
</svelte:head>

<main class="workspace-shell">
	<section class="workspace-card">
		<div class="hero">
			<img class="hero-logo" src="/logos/bb_logo_primary.png" alt="BottleBase" />
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

		{#if data.stockUpdated}
			<p class="notice">Saved changes to bottle counts and area settings.</p>
		{/if}

		{#if data.generatedCount > 0}
			<p class="notice">Generated counts for {data.generatedCount} bottle(s).</p>
		{/if}

		{#if data.addedCount > 0}
			<p class="notice">Duplicated bottle into the selected Area and Type.</p>
		{/if}

		{#if data.storageAddedCount > 0}
			<p class="notice">Added bottle to Storage / Overflow.</p>
		{/if}

		{#if data.bottleAddedCount > 0}
			<p class="notice">Added bottle to this bar.</p>
		{/if}

		<form
			method="POST"
			action="?/createAndStock"
			class="wizard"
			onsubmit={onCreateAndStockSubmit}
			bind:this={wizardForm}
		>
			<input type="hidden" name="storageAreasJson" value={storageAreasPayload} />
			<input type="hidden" name="sort" value={sortKey} />
			<input type="hidden" name="dir" value={sortDirection} />
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
				<div class="step-heading step-heading-collapsible">
					<span>Step 1</span>
					<h2>Create Bar</h2>
					<button
						type="button"
						class="step-toggle"
						onclick={() => {
							step1Expanded = !step1Expanded;
						}}
						aria-expanded={step1Expanded}
						aria-controls="step-1-panel"
						aria-label={step1Expanded ? 'Collapse Create Bar section' : 'Expand Create Bar section'}
					>
						<span aria-hidden="true">{step1Expanded ? '−' : '+'}</span>
					</button>
				</div>
				{#if step1Expanded}
				<div class="step-grid" id="step-1-panel">
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
							<option value="simple-counts">Full</option>
							<option value="detailed-tracking">Detailed</option>
						</select>
						{#if form?.fieldErrors?.defaultInventoryMode}
							<p class="field-error">{form.fieldErrors.defaultInventoryMode}</p>
						{/if}
					</label>
				</div>
				{:else}
					<div id="step-1-panel" class="collapsed-step-content">
						<p class="collapsed-hint">Tap + to set bar name, type, and default inventory mode.</p>
					</div>
				{/if}

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
									<td data-label="Storage area" class="justify-between">
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

			{#if step !== 1 || step1Expanded}
				<div class="paginator paginator-bottom" aria-label="Form navigation bottom">
					<button type="button" class="secondary" onclick={goBack} disabled={step === 1}>Back</button>
					<p class="step-progress">Step {step} of {TOTAL_STEPS}</p>
					{#if step < TOTAL_STEPS}
						<button type="button" onclick={goNext} disabled={!canGoNext}>Next</button>
					{:else}
						<button type="submit" disabled={!step3Complete || isSubmittingCreate}>
							{isSubmittingCreate ? 'Creating...' : 'Create bar and stock it'}
						</button>
					{/if}
				</div>
			{/if}

			{#if isSubmittingCreate}
				<div class="create-progress" role="status" aria-live="polite">
					<p>Creating bar and stocking bottles. This can take a moment.</p>
					<div class="create-progress-track" aria-hidden="true">
						<div class="create-progress-fill" style={`width: ${createProgress}%`}></div>
					</div>
				</div>
			{/if}
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
										<div class="manage-actions">
											<a class="table-link manage-link-button" href={barsUrl({ bar: bar.id })}>Manage</a>
											<form
												method="POST"
												action="?/deleteBar"
												onsubmit={(event) => {
													if (
														!confirm(
															`Delete ${bar.name}? This cannot be undone and removes stocked bottle records.`
														)
													) {
														event.preventDefault();
													}
												}}
											>
												<input type="hidden" name="barId" value={bar.id} />
												<button type="submit" class="danger tiny">
													Delete
												</button>
											</form>
										</div>
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

				<div class="search-row">
					<label for="bar-bottle-search" class="search-label">Search bottles</label>
					<input
						id="bar-bottle-search"
						type="search"
						bind:value={bottleSearchQuery}
						placeholder="Search by bottle, brand, or category"
						autocomplete="off"
					/>
				</div>

				<div class="filter-row">
					<a
						class="table-link"
						href={barsUrl({ bar: data.selectedBarId, category: data.selectedCategoryFilter })}
						aria-current={data.selectedStorageFilter ? undefined : 'page'}
					>
						All areas
					</a>
					{#each data.selectedBarStorageTypes as type}
						<a
							class="table-link"
							href={barsUrl({ bar: data.selectedBarId, storage: type, category: data.selectedCategoryFilter })}
							aria-current={data.selectedStorageFilter === type ? 'page' : undefined}
						>
							{locationTypeLabel(type)}
						</a>
					{/each}
					<div class="filter-actions">
						<form method="POST" action="?/generateStock" class="generate-form">
							<input type="hidden" name="selectedBarId" value={data.selectedBarId} />
							<input type="hidden" name="selectedStorageFilter" value={data.selectedStorageFilter} />
							<input type="hidden" name="sort" value={sortKey} />
							<input type="hidden" name="dir" value={sortDirection} />
							<button type="submit" class="secondary tiny">Generate counts</button>
						</form>
						<form method="GET" action="/dashboard/bars/report" class="report-form">
							<input type="hidden" name="bar" value={data.selectedBarId} />
							<input type="hidden" name="storage" value={data.selectedStorageFilter} />
							<input type="hidden" name="sort" value={sortKey} />
							<input type="hidden" name="dir" value={sortDirection} />
							<button type="submit" class="secondary tiny">PDF report</button>
						</form>
					</div>
				</div>

				<div class="filter-row filter-row-categories">
					<a
						class="table-link filter-badge"
						href={barsUrl({ bar: data.selectedBarId, storage: data.selectedStorageFilter })}
						aria-current={data.selectedCategoryFilter ? undefined : 'page'}
					>
						All
					</a>
					{#each data.selectedBarCategories as category}
						<a
							class="table-link filter-badge"
							href={barsUrl({ bar: data.selectedBarId, storage: data.selectedStorageFilter, category })}
							aria-current={data.selectedCategoryFilter.toLowerCase() === category.toLowerCase() ? 'page' : undefined}
						>
							{category}
						</a>
					{/each}
				</div>

				<div class="table-wrap">
					<table class="bar-table">
						<thead>
							<tr>
								<th scope="col">
									<button type="button" class="sort-button" onclick={() => toggleSort('bottle')}>
										Bottle
										<span class="sort-icon" aria-hidden="true">
											<svg viewBox="0 0 12 12" class:active={activeSortDirection('bottle') === 'asc'}><path fill="currentColor" d="M6 2 3.5 5h5L6 2z"/></svg>
											<svg viewBox="0 0 12 12" class:active={activeSortDirection('bottle') === 'desc'}><path fill="currentColor" d="M6 10 8.5 7h-5L6 10z"/></svg>
										</span>
									</button>
								</th>
								<th scope="col">
									<button type="button" class="sort-button" onclick={() => toggleSort('area')}>
										Area
										<span class="sort-icon" aria-hidden="true">
											<svg viewBox="0 0 12 12" class:active={activeSortDirection('area') === 'asc'}><path fill="currentColor" d="M6 2 3.5 5h5L6 2z"/></svg>
											<svg viewBox="0 0 12 12" class:active={activeSortDirection('area') === 'desc'}><path fill="currentColor" d="M6 10 8.5 7h-5L6 10z"/></svg>
										</span>
									</button>
								</th>
								<th scope="col">
									<button type="button" class="sort-button" onclick={() => toggleSort('current')}>
										Current
										<span class="sort-icon" aria-hidden="true">
											<svg viewBox="0 0 12 12" class:active={activeSortDirection('current') === 'asc'}><path fill="currentColor" d="M6 2 3.5 5h5L6 2z"/></svg>
											<svg viewBox="0 0 12 12" class:active={activeSortDirection('current') === 'desc'}><path fill="currentColor" d="M6 10 8.5 7h-5L6 10z"/></svg>
										</span>
									</button>
								</th>
								<th scope="col">
									<button type="button" class="sort-button" onclick={() => toggleSort('par')}>
										Par
										<span class="sort-icon" aria-hidden="true">
											<svg viewBox="0 0 12 12" class:active={activeSortDirection('par') === 'asc'}><path fill="currentColor" d="M6 2 3.5 5h5L6 2z"/></svg>
											<svg viewBox="0 0 12 12" class:active={activeSortDirection('par') === 'desc'}><path fill="currentColor" d="M6 10 8.5 7h-5L6 10z"/></svg>
										</span>
									</button>
								</th>
								<th scope="col">
									<button type="button" class="sort-button" onclick={() => toggleSort('reorder')}>
										Reorder
										<span class="sort-icon" aria-hidden="true">
											<svg viewBox="0 0 12 12" class:active={activeSortDirection('reorder') === 'asc'}><path fill="currentColor" d="M6 2 3.5 5h5L6 2z"/></svg>
											<svg viewBox="0 0 12 12" class:active={activeSortDirection('reorder') === 'desc'}><path fill="currentColor" d="M6 10 8.5 7h-5L6 10z"/></svg>
										</span>
									</button>
								</th>
								<th scope="col">
									<button type="button" class="sort-button" onclick={() => toggleSort('mode')}>
										Count
										<span class="sort-icon" aria-hidden="true">
											<svg viewBox="0 0 12 12" class:active={activeSortDirection('mode') === 'asc'}><path fill="currentColor" d="M6 2 3.5 5h5L6 2z"/></svg>
											<svg viewBox="0 0 12 12" class:active={activeSortDirection('mode') === 'desc'}><path fill="currentColor" d="M6 10 8.5 7h-5L6 10z"/></svg>
										</span>
									</button>
								</th>
								<th scope="col">
									<button type="button" class="sort-button" onclick={() => toggleSort('save')}>
										Save
										<span class="sort-icon" aria-hidden="true">
											<svg viewBox="0 0 12 12" class:active={activeSortDirection('save') === 'asc'}><path fill="currentColor" d="M6 2 3.5 5h5L6 2z"/></svg>
											<svg viewBox="0 0 12 12" class:active={activeSortDirection('save') === 'desc'}><path fill="currentColor" d="M6 10 8.5 7h-5L6 10z"/></svg>
										</span>
									</button>
								</th>
							</tr>
						</thead>
						<tbody>
							{#if sortedSelectedBarBottles.length === 0}
								<tr>
									<td colspan="8">No stocked bottles for this selection.</td>
								</tr>
							{:else}
								{#each sortedSelectedBarBottles as bottle}
									<tr id={`bar-bottle-row-${bottle.id}`} class="bar-bottle-row">
										<td data-label="Bottle">
											<div class="bottle-name">{bottle.displayName}</div>
											<div class="bottle-meta-row">
												<div class="bottle-meta">{bottle.brand} • {bottle.category}</div>
												<div class="bottle-quick-stats" aria-label="Bottle summary stats">
													<span>Par {formatBottleAmount(bottle.parLevel)}</span>
													<span>Count {inventoryModeLabel(bottle.inventoryMode)}</span>
												</div>
											</div>
											{#if bottle.imageUrl}
												<button
													type="button"
													class="bottle-thumb-button"
													onclick={() => openBottleImageModal(bottle.imageUrl, bottle.displayName)}
													aria-label={`Preview ${bottle.displayName} image`}
												>
													<img class="bottle-thumb" src={bottle.imageUrl} alt={`${bottle.displayName} bottle`} loading="lazy" />
												</button>
											{/if}
										</td>
										<td colspan="7" class="bar-bottle-controls">
											<form method="POST" action="?/updateStock" class="inline-edit-form">
												<input type="hidden" name="barBottleId" value={bottle.id} />
												<input type="hidden" name="selectedBarId" value={data.selectedBarId} />
												<input type="hidden" name="selectedStorageFilter" value={data.selectedStorageFilter} />
														<input type="hidden" name="sort" value={sortKey} />
														<input type="hidden" name="dir" value={sortDirection} />
												<div class="inline-edit-grid">
													<div class="inline-cell inline-cell-area">
														<div class="area-badge-group" aria-label="Area summary">
															<span
																class="value-badge"
																class:value-badge-main={!isStorageAreaName(bottle.location) && isMainType(bottle.locationType)}
																class:value-badge-storage={isStorageAreaName(bottle.location) || isStorageType(bottle.locationType)}
															>
																{bottle.location} ({formatBottleAmount(bottle.currentCount)})
															</span>
															<span
																class="value-badge"
																class:value-badge-main={isMainType(bottle.locationType)}
																class:value-badge-storage={isStorageType(bottle.locationType)}
															>
																{locationTypeLabel(bottle.locationType)} ({formatBottleAmount(bottle.currentCount)})
															</span>
														</div>
													</div>

													<div class="inline-cell inline-cell-actions">
														<div class="row-action">
																<button type="button" class="tiny edit-button" onclick={() => openEditBottleModal(bottle)}>
																	Edit
																</button>
																<button
																type="button"
																class="tiny icon-button add-button"
																aria-label="Duplicate to new area"
																title="Duplicate to new area"
																onclick={() =>
																	openAddBottleModal({
																		barBottleId: bottle.id,
																		bottleId: bottle.bottleId,
																		label: `${bottle.displayName} (${bottle.brand})`,
																		location: bottle.location,
																		locationType: bottle.locationType as StorageAreaType
																	})}
															>
																<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
																	<path
																		fill="currentColor"
																		d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5z"
																	/>
																</svg>
															</button>
															<button
																type="submit"
																formaction="?/deleteBarBottle"
																formmethod="POST"
																class="tiny icon-button delete-button"
																aria-label="Delete bottle from bar"
																title="Delete bottle from bar"
																onclick={(event) => {
																	if (!confirm(`Delete ${bottle.displayName} from this bar?`)) {
																		event.preventDefault();
																	}
																}}
															>
																<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
																	<path
																		fill="currentColor"
																		d="M3 7h18l-1.2 13.2A2 2 0 0 1 17.81 22H6.19a2 2 0 0 1-1.99-1.8L3 7zm4 3v8h2v-8H7zm4 0v8h2v-8h-2zm4 0v8h2v-8h-2zM8 3h8v2H8V3z"
																	/>
																</svg>
															</button>
														</div>
													</div>
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

		{#if showEditBottleModal && data.selectedBarId && editBarBottleId}
			<div
				class="modal-backdrop"
				role="presentation"
				onmousedown={(event) => {
					if (event.target === event.currentTarget) {
						closeEditBottleModal();
					}
				}}
			>
				<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="edit-bottle-title" tabindex="-1">
					<h3 id="edit-bottle-title">Edit Bottle</h3>
					<form method="POST" action="?/updateStock" class="modal-form">
						<input type="hidden" name="barBottleId" value={editBarBottleId} />
						<input type="hidden" name="selectedBarId" value={data.selectedBarId} />
						<input type="hidden" name="selectedStorageFilter" value={data.selectedStorageFilter} />
						<input type="hidden" name="sort" value={sortKey} />
						<input type="hidden" name="dir" value={sortDirection} />

						<label>
							<span>Bottle</span>
							<input value={editBottleLabel} readonly />
						</label>

						<div class="modal-grid">
							<label>
								<span>Area name</span>
								<input name="location" bind:value={editLocation} required />
							</label>
							<label>
								<span>Area type</span>
								<select name="locationType" bind:value={editLocationType}>
									{#each LOCATION_TYPE_OPTIONS as option}
										<option value={option.value}>{option.label}</option>
									{/each}
								</select>
							</label>
							<label>
								<span>Current</span>
								<input name="currentCount" type="number" min="0" step="0.25" bind:value={editCurrentCount} required />
							</label>
							<label>
								<span>Par</span>
								<input name="parLevel" type="number" min="0" step="0.25" bind:value={editParLevel} required />
							</label>
							<label>
								<span>Reorder</span>
								<input name="reorderLevel" type="number" min="0" step="0.25" bind:value={editReorderLevel} required />
							</label>
							<label>
								<span>Count mode</span>
								<select name="inventoryMode" bind:value={editInventoryMode}>
									<option value="simple-counts">Full</option>
									<option value="detailed-tracking">Detailed</option>
								</select>
							</label>
						</div>

						<div class="modal-actions">
							<button
								type="submit"
								class="danger"
								formaction="?/deleteBarBottle"
								formmethod="POST"
								onclick={(event) => {
									if (!confirm(`Delete ${editBottleLabel} from this bar?`)) {
										event.preventDefault();
									}
								}}
							>
								Delete
							</button>
							<button type="button" class="secondary" onclick={closeEditBottleModal}>Cancel</button>
							<button type="submit">Save</button>
						</div>
					</form>
				</div>
			</div>
		{/if}

		{#if showAddBottleModal && data.selectedBarId && duplicateFromBarBottleId}
			<div
				class="modal-backdrop"
				role="presentation"
				onmousedown={(event) => {
					if (event.target === event.currentTarget) {
						closeAddBottleModal();
					}
				}}
			>
				<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="add-bottle-title" tabindex="-1">
					<h3 id="add-bottle-title">Duplicate Bottle To New Area</h3>
					<form method="POST" action="?/addBottleArea" class="modal-form">
						<input type="hidden" name="barBottleId" value={duplicateFromBarBottleId} />
						<input type="hidden" name="selectedBarId" value={data.selectedBarId} />
						<input type="hidden" name="selectedStorageFilter" value={data.selectedStorageFilter} />
						<input type="hidden" name="sort" value={sortKey} />
						<input type="hidden" name="dir" value={sortDirection} />

						<label>
							<span>Bottle</span>
							<input value={duplicateFromBottleLabel} readonly />
						</label>

						<div class="modal-grid">
							<label>
								<span>Area name</span>
								<input name="location" bind:value={addBottleLocation} required />
							</label>
							<label>
								<span>Area type</span>
								<select name="locationType" bind:value={addBottleLocationType}>
									{#each LOCATION_TYPE_OPTIONS as option}
										<option value={option.value}>{option.label}</option>
									{/each}
								</select>
							</label>
						</div>

						<div class="modal-actions">
							<button type="button" class="secondary" onclick={closeAddBottleModal}>Cancel</button>
							<button type="submit" disabled={!addBottleLocation.trim()}>Duplicate</button>
						</div>
					</form>
				</div>
			</div>
		{/if}

		{#if showBottleImageModal && activeBottleImageUrl}
			<div
				class="modal-backdrop"
				role="presentation"
				tabindex="-1"
				onmousedown={(event) => {
					if (event.target === event.currentTarget) {
						closeBottleImageModal();
					}
				}}
				onkeydown={(event) => {
					if (event.key === 'Escape') {
						closeBottleImageModal();
					}
				}}
			>
				<div class="image-modal-card" role="dialog" aria-modal="true" aria-labelledby="bottle-image-title">
					<div class="image-modal-head">
						<h3 id="bottle-image-title">{activeBottleImageLabel}</h3>
						<button type="button" class="secondary tiny" onclick={closeBottleImageModal}>Close</button>
					</div>
					<img class="bottle-preview-image" src={activeBottleImageUrl} alt={`${activeBottleImageLabel} bottle`} />
				</div>
			</div>
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

	.hero-logo {
		display: block;
		width: min(13rem, 72vw);
		height: auto;
		margin-bottom: 0.7rem;
	}
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

	.step-heading-collapsible {
		align-items: center;
	}

	.step-heading-collapsible h2 {
		margin-right: auto;
	}

	.step-heading span {
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.11em;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--bb-ink) 65%, var(--bb-accent) 35%);
	}

	.step-toggle {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		padding: 0;
		border-radius: 999px;
		background: color-mix(in srgb, var(--bb-accent) 88%, #3d1208 12%);
		line-height: 1;
		font-size: 1.3rem;
		font-weight: 700;
	}

	.step-toggle span {
		color: #fff;
		letter-spacing: 0;
	}

	.collapsed-hint {
		margin-top: 0.8rem;
		font-size: 0.92rem;
		line-height: 1.5;
		color: color-mix(in srgb, var(--bb-ink) 78%, var(--bb-accent) 22%);
	}

	.collapsed-step-content {
		margin-top: 0.2rem;
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

	.create-progress {
		margin-top: 0.75rem;
		padding: 0.8rem 0.9rem;
		border-radius: 0.9rem;
		border: 1px solid rgba(73, 41, 18, 0.12);
		background: rgba(255, 255, 255, 0.58);
		display: grid;
		gap: 0.5rem;
	}

	.create-progress p {
		font-size: 0.9rem;
		line-height: 1.4;
		color: color-mix(in srgb, var(--bb-ink) 82%, var(--bb-accent) 18%);
	}

	.create-progress-track {
		height: 0.58rem;
		border-radius: 999px;
		overflow: hidden;
		background: rgba(73, 41, 18, 0.16);
	}

	.create-progress-fill {
		height: 100%;
		min-width: 0.8rem;
		border-radius: 999px;
		background: linear-gradient(90deg, #9b341e 0%, #d97706 100%);
		transition: width 180ms ease-out;
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

	button.danger {
		background: color-mix(in srgb, var(--bb-accent) 86%, #3d1208 14%);
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

	.search-row {
		display: grid;
		gap: 0.35rem;
		margin-top: 0.8rem;
		max-width: 24rem;
	}

	.search-label {
		font-size: 0.82rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--bb-ink) 68%, var(--bb-accent) 32%);
	}

	.generate-form {
		margin-left: auto;
	}

	.filter-actions {
		margin-left: auto;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}

	.manage-actions {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		flex-wrap: wrap;
	}

	.manage-actions form {
		margin: 0;
	}

	.manage-link-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.4rem 0.75rem;
		border-radius: 999px;
		font-size: 0.82rem;
		font-weight: 700;
		line-height: 1;
		text-decoration: none;
		color: #ffffff;
		background: #166534;
	}

	.manage-link-button:hover {
		background: #14532d;
	}

	.filter-row .table-link[aria-current='page'] {
		text-decoration: underline;
	}

	.filter-row-categories .filter-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.3rem 0.7rem;
		border-radius: 999px;
		border: 1px solid rgba(73, 41, 18, 0.2);
		background: rgba(255, 255, 255, 0.8);
		text-decoration: none;
		font-size: 0.82rem;
		font-weight: 700;
		line-height: 1.1;
		text-transform: lowercase;
	}

	.filter-row-categories .filter-badge:first-child {
		text-transform: none;
	}

	.filter-row-categories .filter-badge:hover {
		background: rgba(255, 255, 255, 0.92);
	}

	.filter-row-categories .filter-badge[aria-current='page'] {
		background: #166534;
		border-color: #166534;
		color: #ffffff;
		text-decoration: none;
	}

	.inline-edit-form {
		width: 100%;
	}

	.inline-edit-grid {
		display: grid;
		grid-template-columns:
			minmax(9rem, 1.35fr)
			minmax(7rem, 1fr)
			repeat(3, minmax(4.25rem, 0.55fr))
			minmax(7rem, 0.95fr)
			auto;
		gap: 0.45rem;
		align-items: center;
	}

	.inline-cell {
		min-width: 0;
	}

	.area-badge-group {
		display: inline-flex;
		gap: 0.45rem;
		flex-wrap: nowrap;
		align-items: center;
	}

	.inline-cell::before {
		content: none;
	}

	.inline-edit-grid input[type='number'] {
		max-width: 5.25rem;
		text-align: center;
	}

	.row-action {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
	}

	.icon-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.2rem;
		height: 2.2rem;
		padding: 0;
	}

	.icon-button svg {
		width: 1rem;
		height: 1rem;
	}

	.save-button {
		background: #15803d;
	}

	.edit-button {
		background: #1d4ed8;
		color: #ffffff;
	}

	.edit-button:hover {
		background: #1e40af;
	}

	.add-button {
		background: #15803d;
	}

	.add-button:hover {
		background: #166534;
	}

	.delete-button {
		background: #b91c1c;
		color: #ffffff;
	}

	.delete-button:hover {
		background: #991b1b;
	}

	.modal-actions .danger {
		background: #b91c1c;
		color: #ffffff;
	}

	.modal-actions .danger:hover {
		background: #991b1b;
	}

	.justify-between {
		justify-content: space-between;
	}

	.row-feedback {
		margin: 0;
		font-size: 0.76rem;
		font-weight: 700;
		line-height: 1;
		white-space: nowrap;
	}

	.row-feedback-success {
		color: #166534;
	}

	.row-feedback-error {
		color: color-mix(in srgb, var(--bb-accent) 85%, #3d1208 15%);
	}

	:global(tr.row-flash) td {
		animation: rowFlashPulse 1.2s ease-out;
	}

	@keyframes rowFlashPulse {
		0% {
			background: rgba(21, 128, 61, 0.24);
		}
		100% {
			background: transparent;
		}
	}

	.value-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 2.2rem;
		padding: 0.2rem 0.55rem;
		border-radius: 999px;
		background: rgba(73, 41, 18, 0.08);
		border: 1px solid rgba(73, 41, 18, 0.14);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
		max-width: 100%;
	}

	.inline-edit-grid .value-badge:nth-child(1),
	.inline-edit-grid .value-badge:nth-child(2) {
		justify-content: flex-start;
		padding-inline: 0.65rem;
	}

	.bar-table tbody tr.bar-bottle-row .value-badge {
		display: block;
		min-height: 0;
		padding: 0;
		border: 0;
		border-radius: 0;
		background: transparent;
		font-weight: 600;
		white-space: normal;
	}

	.bar-table tbody tr.bar-bottle-row .value-badge.value-badge-main {
		color: #1e3a8a;
		font-weight: 700;
	}

	.bar-table tbody tr.bar-bottle-row .value-badge.value-badge-storage {
		color: #166534;
		font-weight: 700;
	}

	.modal-backdrop {
		position: fixed;
		inset: 0;
		display: grid;
		place-items: center;
		background: rgba(10, 10, 10, 0.45);
		padding: 1rem;
		z-index: 50;
	}

	.modal-card {
		width: min(42rem, 100%);
		padding: 1rem;
		border-radius: 1rem;
		background: #fff;
		box-shadow: 0 18px 40px rgba(15, 15, 20, 0.35);
		display: grid;
		gap: 0.8rem;
	}

	.modal-form {
		display: grid;
		gap: 0.75rem;
	}

	.modal-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.6rem;
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.6rem;
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

	.sort-button {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0;
		border: 0;
		border-radius: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		font-size: inherit;
		font-weight: inherit;
		text-transform: inherit;
		letter-spacing: inherit;
		cursor: pointer;
	}

	.sort-icon {
		display: inline-flex;
		flex-direction: column;
		line-height: 1;
		color: rgba(73, 41, 18, 0.42);
	}

	.sort-icon svg {
		width: 0.7rem;
		height: 0.7rem;
	}

	.sort-icon svg.active {
		color: color-mix(in srgb, var(--bb-accent) 85%, #3d1208 15%);
	}

	.bottle-table tbody tr:last-child td,
	.bar-table tbody tr:last-child td {
		border-bottom: none;
	}

	.bar-table tbody tr.bar-bottle-row:nth-child(odd) {
		background: rgba(255, 255, 255, 0.72);
	}

	.bar-table tbody tr.bar-bottle-row:nth-child(even) {
		background: rgba(239, 226, 207, 0.55);
	}

	.bottle-name {
		font-weight: 700;
	}

	.bottle-meta {
		margin-top: 0.2rem;
		font-size: 0.84rem;
		color: color-mix(in srgb, var(--bb-ink) 74%, var(--bb-accent) 26%);
	}

	.bottle-meta-row {
		margin-top: 0.2rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.bottle-quick-stats {
		display: inline-flex;
		gap: 0.45rem;
		flex-wrap: wrap;
		justify-content: flex-end;
		font-size: 0.74rem;
		font-weight: 700;
		color: color-mix(in srgb, var(--bb-ink) 78%, var(--bb-accent) 22%);
	}

	.bottle-quick-stats span {
		padding: 0.15rem 0.45rem;
		border-radius: 999px;
		background: rgba(73, 41, 18, 0.08);
		border: 1px solid rgba(73, 41, 18, 0.12);
	}

	.bottle-thumb {
		display: block;
		margin-top: 0.5rem;
		width: 4.5rem;
		height: 4.5rem;
		object-fit: cover;
		border-radius: 0.65rem;
		border: 1px solid rgba(73, 41, 18, 0.16);
		background: rgba(255, 255, 255, 0.55);
	}

	.bottle-thumb-button {
		padding: 0;
		margin-top: 0.5rem;
		border: 0;
		border-radius: 0.65rem;
		background: transparent;
		cursor: zoom-in;
	}

	.bottle-thumb-button .bottle-thumb {
		margin-top: 0;
	}

	.image-modal-card {
		width: min(46rem, 92vw);
		padding: 1rem;
		border-radius: 1rem;
		background: #fff;
		box-shadow: 0 18px 40px rgba(15, 15, 20, 0.35);
		display: grid;
		gap: 0.8rem;
	}

	.image-modal-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.image-modal-head h3 {
		margin: 0;
		font-size: 1.05rem;
	}

	.bottle-preview-image {
		display: block;
		width: 100%;
		max-height: min(76vh, 42rem);
		object-fit: contain;
		border-radius: 0.8rem;
		border: 1px solid rgba(73, 41, 18, 0.16);
		background: rgba(250, 248, 244, 0.95);
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

		.inline-edit-grid {
			grid-template-columns: repeat(4, minmax(0, 1fr));
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

		.modal-grid {
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

		.bottle-table tbody td.justify-between[data-label='Storage area'] {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 1.35rem;
		}

		.bottle-meta-row {
			flex-direction: column;
			align-items: flex-start;
		}

		.bottle-quick-stats {
			justify-content: flex-start;
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

		.bar-table tbody tr.bar-bottle-row {
			padding: 0.9rem;
			border-radius: 0.9rem;
			margin-bottom: 0.55rem;
		}

		.bar-table tbody tr.bar-bottle-row td[data-label='Bottle'] {
			display: block;
			padding-bottom: 0.45rem;
		}

		.bar-table tbody tr.bar-bottle-row td[data-label='Bottle']::before {
			display: none;
		}

		.bar-table tbody tr.bar-bottle-row td.bar-bottle-controls {
			display: block;
			padding-top: 0;
		}

		.bar-table tbody tr.bar-bottle-row td.bar-bottle-controls::before {
			display: none;
		}

		.bar-table tbody tr.bar-bottle-row .inline-edit-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 0.5rem 0.6rem;
		}

		.bar-table tbody tr.bar-bottle-row .inline-cell {
			display: grid;
			grid-template-columns: 5.4rem minmax(0, 1fr);
			gap: 0.5rem;
			align-items: center;
		}

		.bar-table tbody tr.bar-bottle-row .inline-cell::before {
			content: attr(data-mobile-label);
			font-size: 0.72rem;
			font-weight: 700;
			letter-spacing: 0.08em;
			text-transform: uppercase;
			color: color-mix(in srgb, var(--bb-ink) 58%, var(--bb-accent) 42%);
		}

		.bar-table tbody tr.bar-bottle-row .inline-cell-type::before {
			color: #fff;
		}

		.bar-table tbody tr.bar-bottle-row .inline-cell-area,
		.bar-table tbody tr.bar-bottle-row .inline-cell-actions {
			grid-template-columns: 1fr;
		}

		.bar-table tbody tr.bar-bottle-row .inline-cell-area::before,
		.bar-table tbody tr.bar-bottle-row .inline-cell-actions::before {
			display: none;
		}

		.bar-table tbody tr.bar-bottle-row .inline-cell-actions {
			grid-column: 1 / -1;
			grid-template-columns: 1fr;
			justify-items: end;
			padding-top: 0.2rem;
		}

		.bar-table tbody tr.bar-bottle-row .inline-cell-actions::before {
			justify-self: start;
		}

		.bar-table tbody tr.bar-bottle-row .row-action {
			width: 100%;
			justify-content: flex-end;
			flex-wrap: wrap;
		}

		.bar-table tbody tr.bar-bottle-row .inline-edit-grid input[type='number'] {
			max-width: none;
		}
	}
</style>
