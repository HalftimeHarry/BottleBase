import { env } from '$env/dynamic/private';
import { fail, redirect } from '@sveltejs/kit';
import PocketBase from 'pocketbase';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';

type BottleRecord = {
	id: string;
	name: string;
	brand: string;
	category: string;
	image?: string;
};

type ImageRecord = {
	id: string;
	name: string;
	slug: string;
	image?: string;
};

type BarRecord = {
	id: string;
	name: string;
	slug: string;
	barType: string;
	defaultInventoryMode: string;
	stockingProfile: string;
	created: string;
};

type BarBottleRecord = {
	id: string;
	bar?: string;
	bottle?: string;
	barId?: string;
	bottleId?: string;
	displayName?: string;
	location?: string;
	locationType?: string;
	location_type?: string;
	currentCount?: number | string;
	current_count?: number | string;
	parLevel?: number | string;
	par_level?: number | string;
	reorderLevel?: number | string;
	reorder_level?: number | string;
	inventoryMode?: string;
	inventory_mode?: string;
	notes?: string | null;
};

type StorageAreaType = 'well' | 'backbar' | 'cold-storage' | 'overflow';
type StorageAreaInput = { id: string; name: string; type: StorageAreaType };
type FieldErrors = Record<string, string>;

const STORAGE_AREA_TYPES = new Set<StorageAreaType>(['well', 'backbar', 'cold-storage', 'overflow']);
const BAR_TYPES = ['permanent', 'temporary', 'satellite', 'seasonal'] as const;
const INVENTORY_MODES = ['disabled', 'simple-counts', 'detailed-tracking'] as const;
const SORT_KEYS = new Set(['bottle', 'area', 'current', 'par', 'reorder', 'mode', 'save'] as const);
type SortKey = 'bottle' | 'area' | 'current' | 'par' | 'reorder' | 'mode' | 'save';
type SortDirection = 'asc' | 'desc';

const storageAreaSchema = z.object({
	id: z.string().trim().min(1, 'Storage area ID is required.'),
	name: z.string().trim().min(1, 'Storage area name is required.'),
	type: z.enum(['well', 'backbar', 'cold-storage', 'overflow'])
});

const createAndStockSchema = z.object({
	name: z.string().trim().min(2, 'Bar name must be at least 2 characters.'),
	barType: z.enum(BAR_TYPES, { error: 'Choose a valid bar type.' }),
	defaultInventoryMode: z.enum(INVENTORY_MODES, {
		error: 'Choose a valid inventory mode.'
	}),
	stockingProfile: z.string().trim().min(1, 'Stocking profile is required.'),
	storageAreas: z.array(storageAreaSchema).min(1, 'Add at least one storage area.'),
	selectedBottleIds: z.array(z.string().trim().min(1)).min(1, 'Select at least one bottle to stock.')
});

const stockNumbersSchema = z.object({
	current: z.coerce.number().min(0, 'Current count must be a non-negative number.'),
	par: z.coerce.number().min(0, 'Par level must be a non-negative number.'),
	reorder: z.coerce.number().min(0, 'Reorder level must be a non-negative number.')
});

const updateStockSchema = z.object({
	barBottleId: z.string().trim().min(1, 'Bar bottle ID is required.'),
	selectedBarId: z.string().trim().min(1, 'Bar ID is required.'),
	selectedStorageFilter: z.string().trim().optional(),
	location: z.string().trim().min(1, 'Storage area name is required.'),
	locationType: z.enum(['well', 'backbar', 'cold-storage', 'overflow']),
	inventoryMode: z.enum(INVENTORY_MODES)
});

const deleteBarSchema = z.object({
	barId: z.string().trim().min(1, 'Bar ID is required.')
});

const deleteBarBottleSchema = z.object({
	barBottleId: z.string().trim().min(1, 'Bar bottle ID is required.'),
	selectedBarId: z.string().trim().min(1, 'Bar ID is required.'),
	selectedStorageFilter: z.string().trim().optional()
});

const generateStockSchema = z.object({
	selectedBarId: z.string().trim().min(1, 'Bar ID is required.'),
	selectedStorageFilter: z.string().trim().optional()
});

const addBottleAreaSchema = z.object({
	barBottleId: z.string().trim().min(1, 'Bar bottle ID is required.'),
	selectedBarId: z.string().trim().min(1, 'Bar ID is required.'),
	selectedStorageFilter: z.string().trim().optional(),
	location: z.string().trim().min(1, 'Area name is required.'),
	locationType: z.enum(['well', 'backbar', 'cold-storage', 'overflow'])
});

const addBottleToStorageSchema = z.object({
	barBottleId: z.string().trim().min(1, 'Bar bottle ID is required.'),
	selectedBarId: z.string().trim().min(1, 'Bar ID is required.'),
	selectedStorageFilter: z.string().trim().optional()
});

const addBottleToBarSchema = z.object({
	selectedBarId: z.string().trim().min(1, 'Bar ID is required.'),
	selectedStorageFilter: z.string().trim().optional(),
	bottleId: z.string().trim().min(1, 'Bottle ID is required.'),
	location: z.string().trim().min(1, 'Area name is required.'),
	locationType: z.enum(['well', 'backbar', 'cold-storage', 'overflow']),
	inventoryMode: z.enum(INVENTORY_MODES)
});

const createBottleAndAddToBarSchema = z.object({
	selectedBarId: z.string().trim().min(1, 'Bar ID is required.'),
	selectedStorageFilter: z.string().trim().optional(),
	name: z.string().trim().min(1, 'Bottle name is required.'),
	brand: z.string().trim().min(1, 'Brand is required.'),
	category: z.string().trim().min(1, 'Category is required.'),
	image: z.string().trim().min(1, 'Image is required.'),
	location: z.string().trim().min(1, 'Area name is required.'),
	locationType: z.enum(['well', 'backbar', 'cold-storage', 'overflow']),
	inventoryMode: z.enum(INVENTORY_MODES)
});

function createValidationFailure(fieldErrors: FieldErrors) {
	return fail(400, {
		error: 'Please correct the highlighted fields and try again.',
		fieldErrors
	});
}

function addIssueError(fieldErrors: FieldErrors, key: string, message: string) {
	if (!fieldErrors[key]) {
		fieldErrors[key] = message;
	}
}

function parseStorageAreas(storageAreasJson: string): StorageAreaInput[] {
	let parsed: unknown = [];
	try {
		parsed = JSON.parse(storageAreasJson);
	} catch {
		return [];
	}

	const result = z.array(storageAreaSchema).safeParse(parsed);
	if (!result.success) {
		return [];
	}

	return result.data;
}

const BOTTLE_COLLECTION = env.POCKETBASE_BOTTLE_COLLECTION ?? 'bottles';
const BAR_COLLECTION = env.POCKETBASE_BAR_COLLECTION ?? 'bars';
const BAR_BOTTLE_COLLECTION = env.POCKETBASE_BAR_BOTTLE_COLLECTION ?? 'bar_bottles';
const IMAGE_COLLECTION = env.POCKETBASE_IMAGE_COLLECTION ?? 'bottle_images';

function slugify(value: string) {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

function textField(name: string, required = true, max = 255) {
	return {
		name,
		type: 'text',
		required,
		presentable: true,
		max
	};
}

function numberField(name: string, required = false) {
	return {
		name,
		type: 'number',
		required,
		presentable: true
	};
}

function relationField(name: string, collectionId: string, required = true) {
	return {
		name,
		type: 'relation',
		required,
		presentable: true,
		collectionId,
		cascadeDelete: true,
		minSelect: required ? 1 : 0,
		maxSelect: 1,
		displayFields: ['name']
	};
}

async function createAdminClient() {
	if (!env.POCKETBASE_URL || !env.POCKETBASE_ADMIN_EMAIL || !env.POCKETBASE_ADMIN_PASSWORD) {
		return null;
	}

	const pb = new PocketBase(env.POCKETBASE_URL.replace(/\/$/, ''));
	await pb.collection('_superusers').authWithPassword(
		env.POCKETBASE_ADMIN_EMAIL,
		env.POCKETBASE_ADMIN_PASSWORD
	);
	return pb;
}

async function ensureCollection(pb: PocketBase, name: string, fields: Array<Record<string, unknown>>) {
	try {
		return await pb.collections.getOne(name);
	} catch (error) {
		const status =
			typeof error === 'object' && error !== null && 'status' in error
				? Number(error.status)
				: 0;
		if (status !== 404) {
			throw error;
		}

		await pb.collections.create({
			name,
			type: 'base',
			fields
		});
		return await pb.collections.getOne(name);
	}
}

async function ensureCollectionFields(
	pb: PocketBase,
	collectionName: string,
	requiredFields: Array<Record<string, unknown>>
) {
	const collection = await pb.collections.getOne(collectionName);
	const existingNames = new Set((collection.fields ?? []).map((field) => field.name));
	const missingFields = requiredFields.filter((field) => {
		const fieldName = String(field.name ?? '');
		return fieldName.length > 0 && !existingNames.has(fieldName);
	});

	if (missingFields.length === 0) {
		return collection;
	}

	const nextFields = [...(collection.fields ?? []), ...missingFields];

	await pb.collections.update(collection.id, {
		name: collection.name,
		type: collection.type,
		fields: nextFields
	});

	return pb.collections.getOne(collectionName);
}

async function ensureBarCollections(pb: PocketBase) {
	const bottleCollection = await pb.collections.getOne(BOTTLE_COLLECTION);
	const barCollectionFields = [
		textField('name', true),
		textField('slug', true),
		textField('barType', true),
		textField('defaultInventoryMode', true),
		textField('stockingProfile', false)
	];

	const barCollection = await ensureCollection(pb, BAR_COLLECTION, barCollectionFields);
	await ensureCollectionFields(pb, BAR_COLLECTION, barCollectionFields);

	const barBottleFields = [
		relationField('bar', barCollection.id, true),
		relationField('bottle', bottleCollection.id, true),
		textField('displayName', true),
		textField('inventoryMode', true),
		numberField('currentCount', false),
		numberField('parLevel', false),
		numberField('reorderLevel', false),
		textField('location', false),
		textField('locationType', false),
		textField('notes', false, 2000)
	];

	await ensureCollection(pb, BAR_BOTTLE_COLLECTION, barBottleFields);
	await ensureCollectionFields(pb, BAR_BOTTLE_COLLECTION, barBottleFields);
}

function withLegacyVisibilityField(
	payload: Record<string, unknown>,
	fieldNames: Set<string>
): Record<string, unknown> {
	const next = { ...payload };
	if (fieldNames.has('isVisible')) {
		next.isVisible = true;
	}
	if (fieldNames.has('is_visible')) {
		next.is_visible = true;
	}
	return next;
}

function withoutLocationType(payload: Record<string, unknown>): Record<string, unknown> {
	const next = { ...payload };
	delete next.locationType;
	delete next.location_type;
	return next;
}

async function createBarBottleWithCompatibility(
	pb: PocketBase,
	payload: Record<string, unknown>
): Promise<{ id: string }> {
	const barBottleCollection = await pb.collections.getOne(BAR_BOTTLE_COLLECTION);
	const fieldNames = new Set((barBottleCollection.fields ?? []).map((field) => field.name));
	const candidates: Record<string, unknown>[] = [payload];

	const withVisibility = withLegacyVisibilityField(payload, fieldNames);
	const baseWithoutLocationType = withoutLocationType(payload);
	const withoutLocationTypeWithVisibility = withLegacyVisibilityField(baseWithoutLocationType, fieldNames);

	for (const candidate of [withVisibility, baseWithoutLocationType, withoutLocationTypeWithVisibility]) {
		const key = JSON.stringify(candidate);
		const exists = candidates.some((item) => JSON.stringify(item) === key);
		if (!exists) {
			candidates.push(candidate);
		}
	}

	let lastError: unknown = null;
	for (const candidate of candidates) {
		try {
			return await pb.collection(BAR_BOTTLE_COLLECTION).create(candidate);
		} catch (error) {
			const status =
				typeof error === 'object' && error !== null && 'status' in error
					? Number(error.status)
					: 0;
			if (status !== 400) {
				throw error;
			}
			lastError = error;
		}
	}

	throw lastError;
}

async function fetchBarsSafe(pb: PocketBase): Promise<{
	bars: Partial<BarRecord>[];
	barLoadWarning: string | null;
}> {
	try {
		const bars = await pb.collection(BAR_COLLECTION).getFullList<Partial<BarRecord>>({ sort: '-created' });
		return { bars, barLoadWarning: null };
	} catch {
		try {
			const bars = await pb.collection(BAR_COLLECTION).getFullList<Partial<BarRecord>>();
			return { bars, barLoadWarning: null };
		} catch {
			return {
				bars: [],
				barLoadWarning:
					'Bars collection exists but could not be listed. Open setup and save a new bar to refresh the schema.'
			};
		}
	}
}

function toNumber(value: string | number | undefined): number {
	if (typeof value === 'number') {
		return value;
	}
	if (!value) {
		return 0;
	}
	const parsed = Number(value);
	return Number.isNaN(parsed) ? 0 : parsed;
}

function stripFileExtension(value: string): string {
	return value.replace(/\.[a-z0-9]{2,5}$/i, '');
}

function resolveBarBottleName(params: { bottleName?: string; displayName?: string }): string {
	const bottleName = stripFileExtension(params.bottleName?.trim() ?? '');
	if (bottleName) {
		return bottleName;
	}

	const displayName = stripFileExtension(params.displayName?.trim() ?? '');
	if (displayName) {
		return displayName;
	}

	return 'Unknown bottle';
}

function readBarBottleCounts(item: BarBottleRecord) {
	return {
		currentCount: toNumber(item.currentCount ?? item.current_count),
		parLevel: toNumber(item.parLevel ?? item.par_level),
		reorderLevel: toNumber(item.reorderLevel ?? item.reorder_level)
	};
}

function readBarBottleMeta(item: BarBottleRecord) {
	return {
		location: item.location ?? '',
		locationType: item.locationType ?? item.location_type ?? 'backbar',
		inventoryMode: item.inventoryMode ?? item.inventory_mode ?? 'simple-counts'
	};
}

function normalizeStorageValue(value: string): string {
	return value.trim().toLowerCase();
}

function isTrackableInventoryCategory(value: string): boolean {
	const normalized = value.trim().toLowerCase();
	return normalized !== 'cocktail' && normalized !== 'cocktails';
}

function isStorageOverflowRow(item: BarBottleRecord): boolean {
	const meta = readBarBottleMeta(item);
	return (
		normalizeStorageValue(meta.location) === 'storage' &&
		normalizeStorageValue(meta.locationType) === 'overflow'
	);
}

function normalizeSortKey(value: string): SortKey {
	const candidate = value.trim().toLowerCase();
	if (SORT_KEYS.has(candidate as SortKey)) {
		return candidate as SortKey;
	}
	return 'bottle';
}

function normalizeSortDirection(value: string): SortDirection {
	return value.trim().toLowerCase() === 'desc' ? 'desc' : 'asc';
}

function addSortToRedirectParams(
	params: URLSearchParams,
	sortKey: SortKey,
	sortDirection: SortDirection
) {
	params.set('sort', sortKey);
	params.set('dir', sortDirection);
}

export const load = (async ({ url }) => {
	const pb = await createAdminClient();

	if (!pb) {
		return {
			bottles: [] satisfies BottleRecord[],
			images: [] satisfies ImageRecord[],
			bars: [] satisfies Array<BarRecord & { stockedCount: number }>,
			setupError: 'PocketBase admin credentials are required to create and stock bars.'
		};
	}

	await ensureBarCollections(pb);

	const [bottles, images, stockedBottles, barsResult] = await Promise.all([
		pb.collection(BOTTLE_COLLECTION).getFullList<BottleRecord>({
			fields: 'id,name,brand,category,image',
			sort: 'name'
		}),
		pb.collection(IMAGE_COLLECTION).getFullList<ImageRecord>({
			fields: 'id,name,slug,image',
			sort: 'name'
		}),
		pb.collection(BAR_BOTTLE_COLLECTION).getFullList<BarBottleRecord>(),
		fetchBarsSafe(pb)
	]);

	const bars = barsResult.bars;
	const pocketBaseUrl = env.POCKETBASE_URL?.replace(/\/$/, '') ?? '';
	const selectedBarId = url.searchParams.get('bar')?.trim() ?? '';
	const selectedStorageFilter = url.searchParams.get('storage')?.trim() ?? '';
	const selectedCategoryFilter = url.searchParams.get('category')?.trim() ?? '';
	const selectedSortKey = normalizeSortKey(url.searchParams.get('sort') ?? '');
	const selectedSortDirection = normalizeSortDirection(url.searchParams.get('dir') ?? '');
	const stockUpdated = url.searchParams.get('updated') === '1';
	const generatedCount = Number(url.searchParams.get('generated') ?? '0');
	const updatedBarBottleId = url.searchParams.get('updatedBarBottleId')?.trim() ?? '';
	const rowStatus = url.searchParams.get('rowStatus')?.trim() ?? '';
	const addedCount = Number(url.searchParams.get('added') ?? '0');
	const storageAddedCount = Number(url.searchParams.get('storageAdded') ?? '0');
	const bottleAddedCount = Number(url.searchParams.get('bottleAdded') ?? '0');

	const stockedCountByBar = new Map<string, number>();
	for (const item of stockedBottles) {
		const barRef = item.bar ?? item.barId ?? null;
		if (!barRef) {
			continue;
		}
		stockedCountByBar.set(barRef, (stockedCountByBar.get(barRef) ?? 0) + 1);
	}

	const selectedBarBottles = stockedBottles
		.filter((item) => {
			const itemBarId = item.bar ?? item.barId ?? '';
			return selectedBarId ? itemBarId === selectedBarId : false;
		})
		.map((item) => {
			const bottleRef = item.bottle ?? item.bottleId ?? '';
			const bottle = bottles.find((candidate) => candidate.id === bottleRef);
			const linkedImage = bottle?.image
				? images.find((candidate) => candidate.id === bottle.image)
				: undefined;
			const imageUrl =
				pocketBaseUrl && linkedImage?.image
					? `${pocketBaseUrl}/api/files/${IMAGE_COLLECTION}/${linkedImage.id}/${linkedImage.image}`
					: null;
			const counts = readBarBottleCounts(item);
			const meta = readBarBottleMeta(item);
			return {
				id: item.id,
				barId: item.bar ?? item.barId ?? '',
				bottleId: bottleRef,
				displayName: resolveBarBottleName({
					bottleName: bottle?.name,
					displayName: item.displayName
				}),
				brand: bottle?.brand ?? 'Unknown brand',
				category: bottle?.category ?? 'Unknown category',
				location: meta.location,
				locationType: meta.locationType,
				currentCount: counts.currentCount,
				parLevel: counts.parLevel,
				reorderLevel: counts.reorderLevel,
				inventoryMode: meta.inventoryMode,
				imageUrl
			};
		})
		.filter((item) => isTrackableInventoryCategory(item.category))
		.sort((left, right) => {
			const bottleCompare = left.displayName.localeCompare(right.displayName, undefined, {
				sensitivity: 'base',
				numeric: true
			});
			if (bottleCompare !== 0) {
				return bottleCompare;
			}

			const brandCompare = left.brand.localeCompare(right.brand, undefined, {
				sensitivity: 'base',
				numeric: true
			});
			if (brandCompare !== 0) {
				return brandCompare;
			}

			const areaCompare = left.location.localeCompare(right.location, undefined, {
				sensitivity: 'base',
				numeric: true
			});
			if (areaCompare !== 0) {
				return areaCompare;
			}

			return left.locationType.localeCompare(right.locationType, undefined, {
				sensitivity: 'base',
				numeric: true
			});
		});

	const filteredByStorage = selectedStorageFilter
		? selectedBarBottles.filter((item) => item.locationType === selectedStorageFilter)
		: selectedBarBottles;

	const filteredBarBottles = selectedCategoryFilter
		? filteredByStorage.filter(
				(item) => item.category.toLowerCase() === selectedCategoryFilter.toLowerCase()
			)
		: filteredByStorage;

	const selectedBarStorageTypes = [...new Set(selectedBarBottles.map((item) => item.locationType))].filter(
		(value): value is StorageAreaType => STORAGE_AREA_TYPES.has(value as StorageAreaType)
	);
	const selectedBarCategories = [...new Set(selectedBarBottles.map((item) => item.category))].sort(
		(left, right) => left.localeCompare(right, undefined, { sensitivity: 'base', numeric: true })
	);
	const selectedBarBottleAreaKeys = [
		...new Set(
			selectedBarBottles.map((item) => {
				const normalizedLocation = item.location.trim().toLowerCase();
				const normalizedType = item.locationType.trim().toLowerCase();
				return `${item.bottleId}::${normalizedLocation}::${normalizedType}`;
			})
		)
	];

	return {
		bottles: bottles.filter((item) => isTrackableInventoryCategory(item.category)),
		images,
		bars: bars.map((bar) => ({
			id: bar.id ?? '',
			name: bar.name ?? 'Untitled bar',
			slug: bar.slug ?? '',
			barType: bar.barType ?? 'permanent',
			defaultInventoryMode: bar.defaultInventoryMode ?? 'simple-counts',
			stockingProfile: bar.stockingProfile ?? 'custom',
			created: bar.created ?? '',
			stockedCount: stockedCountByBar.get(bar.id ?? '') ?? 0
		})),
		selectedBarId,
		selectedStorageFilter,
		selectedCategoryFilter,
		selectedSortKey,
		selectedSortDirection,
		selectedBarBottles: filteredBarBottles,
		selectedBarStorageTypes,
		selectedBarCategories,
		selectedBarBottleAreaKeys,
		stockUpdated,
		generatedCount: Number.isFinite(generatedCount) ? generatedCount : 0,
		addedCount: Number.isFinite(addedCount) ? addedCount : 0,
		storageAddedCount: Number.isFinite(storageAddedCount) ? storageAddedCount : 0,
		bottleAddedCount: Number.isFinite(bottleAddedCount) ? bottleAddedCount : 0,
		updatedBarBottleId,
		rowStatus,
		setupError: barsResult.barLoadWarning
	};
}) satisfies PageServerLoad;

export const actions: Actions = {
	createAndStock: async ({ request }) => {
		const pb = await createAdminClient();

		if (!pb) {
			return fail(500, {
				error: 'PocketBase admin credentials are required to create and stock bars.'
			});
		}

		await ensureBarCollections(pb);
		const barPageBeforeCreate = await pb.collection(BAR_COLLECTION).getList(1, 1, {
			fields: 'id'
		});

		const formData = await request.formData();
		const name = String(formData.get('name') ?? '').trim();
		const barType = String(formData.get('barType') ?? '').trim();
		const defaultInventoryMode = String(formData.get('defaultInventoryMode') ?? '').trim();
		const stockingProfile = String(formData.get('stockingProfile') ?? '').trim();
		const storageAreasJson = String(formData.get('storageAreasJson') ?? '[]');
		const selectedSortKey = normalizeSortKey(String(formData.get('sort') ?? ''));
		const selectedSortDirection = normalizeSortDirection(String(formData.get('dir') ?? ''));
		const storageAreas = parseStorageAreas(storageAreasJson);
		const selectedBottleIds = formData
			.getAll('selectedBottle')
			.map((value) => String(value))
			.filter(Boolean);
		const fieldErrors: FieldErrors = {};

		const setupValidation = createAndStockSchema.safeParse({
			name,
			barType,
			defaultInventoryMode,
			stockingProfile,
			storageAreas,
			selectedBottleIds
		});

		if (!setupValidation.success) {
			for (const issue of setupValidation.error.issues) {
				const pathKey = issue.path[0];
				if (pathKey === 'selectedBottleIds') {
					addIssueError(fieldErrors, 'selectedBottle', issue.message);
					continue;
				}
				if (pathKey === 'storageAreas') {
					addIssueError(fieldErrors, 'storageAreas', issue.message);
					continue;
				}
				addIssueError(fieldErrors, String(pathKey), issue.message);
			}
			return createValidationFailure(fieldErrors);
		}

		const uniqueBottleIds = [...new Set(selectedBottleIds)];
		const allBottles = await pb.collection(BOTTLE_COLLECTION).getFullList<BottleRecord>({
			fields: 'id,name,brand,category'
		});
		const selectedBottles = allBottles.filter((bottle) => uniqueBottleIds.includes(bottle.id));

		if (selectedBottles.length !== uniqueBottleIds.length) {
			return createValidationFailure({
				selectedBottle: 'One or more selected bottles no longer exist. Refresh and try again.'
			});
		}

		const storageAreaIds = new Set(storageAreas.map((area) => area.id));

		for (const bottle of selectedBottles) {
			const currentInput = String(formData.get(`current_${bottle.id}`) ?? '').trim();
			const parInput = String(formData.get(`par_${bottle.id}`) ?? '').trim();
			const reorderInput = String(formData.get(`reorder_${bottle.id}`) ?? '').trim();
			const storageAreaInput = String(formData.get(`storageArea_${bottle.id}`) ?? '').trim();

			const stockValidation = stockNumbersSchema.safeParse({
				current: currentInput,
				par: parInput,
				reorder: reorderInput
			});

			if (!stockValidation.success) {
				for (const issue of stockValidation.error.issues) {
					const metric = String(issue.path[0]);
					addIssueError(fieldErrors, `${metric}_${bottle.id}`, issue.message);
				}
			}

			if (!storageAreaInput || !storageAreaIds.has(storageAreaInput)) {
				addIssueError(fieldErrors, `storageArea_${bottle.id}`, 'Choose a valid storage area.');
			}
		}

		if (Object.keys(fieldErrors).length > 0) {
			return createValidationFailure(fieldErrors);
		}

		const createdBar = await pb.collection(BAR_COLLECTION).create({
			name,
			slug: `${slugify(name)}-${Date.now().toString().slice(-6)}`,
			barType,
			defaultInventoryMode,
			stockingProfile
		});

		for (const bottle of selectedBottles) {
			const currentInput = String(formData.get(`current_${bottle.id}`) ?? '').trim();
			const parInput = String(formData.get(`par_${bottle.id}`) ?? '').trim();
			const reorderInput = String(formData.get(`reorder_${bottle.id}`) ?? '').trim();
			const storageAreaInput = String(formData.get(`storageArea_${bottle.id}`) ?? '').trim();
			const stockValues = stockNumbersSchema.parse({
				current: currentInput,
				par: parInput,
				reorder: reorderInput
			});
			const currentCount = stockValues.current;
			const parLevel = stockValues.par;
			const reorderLevel = stockValues.reorder;
			const storageArea =
				storageAreas.find((area) => area.id === storageAreaInput) ?? storageAreas[0];
			const location = storageArea.name;
			const locationType = storageArea.type;

			const payload = {
				bar: createdBar.id,
				bottle: bottle.id,
				displayName: bottle.name,
				inventoryMode: defaultInventoryMode,
				currentCount,
				parLevel,
				reorderLevel,
				location,
				locationType,
				notes: null
			};

			await createBarBottleWithCompatibility(pb, payload);
		}

		const redirectTarget = barPageBeforeCreate.totalItems === 0 ? '/dashboard' : '/dashboard/bars';
		if (redirectTarget === '/dashboard/bars') {
			const redirectParams = new URLSearchParams();
			addSortToRedirectParams(redirectParams, selectedSortKey, selectedSortDirection);
			throw redirect(303, `/dashboard/bars?${redirectParams.toString()}`);
		}
		throw redirect(303, redirectTarget);
	},
	updateStock: async ({ request }) => {
		const pb = await createAdminClient();

		if (!pb) {
			return fail(500, {
				error: 'PocketBase admin credentials are required to update bar inventory.'
			});
		}

		await ensureBarCollections(pb);

		const formData = await request.formData();
		const barBottleId = String(formData.get('barBottleId') ?? '').trim();
		const selectedBarId = String(formData.get('selectedBarId') ?? '').trim();
		const selectedStorageFilter = String(formData.get('selectedStorageFilter') ?? '').trim();
		const selectedSortKey = normalizeSortKey(String(formData.get('sort') ?? ''));
		const selectedSortDirection = normalizeSortDirection(String(formData.get('dir') ?? ''));
		const location = String(formData.get('location') ?? '').trim();
		const locationType = String(formData.get('locationType') ?? '').trim();
		const inventoryMode = String(formData.get('inventoryMode') ?? '').trim();
		const currentInput = String(formData.get('currentCount') ?? '').trim();
		const parInput = String(formData.get('parLevel') ?? '').trim();
		const reorderInput = String(formData.get('reorderLevel') ?? '').trim();

		const validation = updateStockSchema.safeParse({
			barBottleId,
			selectedBarId,
			selectedStorageFilter,
			location,
			locationType,
			inventoryMode
		});

		const stockValidation = stockNumbersSchema.safeParse({
			current: currentInput,
			par: parInput,
			reorder: reorderInput
		});

		if (!validation.success || !stockValidation.success) {
			return fail(400, {
				error: 'Unable to update stock. Check values and try again.'
			});
		}

		const barBottleCollection = await pb.collections.getOne(BAR_BOTTLE_COLLECTION);
		const fieldNames = new Set((barBottleCollection.fields ?? []).map((field) => field.name));
		const payload: Record<string, unknown> = {};

		const setPreferredField = (primary: string, legacy: string, value: unknown) => {
			if (fieldNames.has(primary)) {
				payload[primary] = value;
				return;
			}
			if (fieldNames.has(legacy)) {
				payload[legacy] = value;
			}
		};

		if (fieldNames.has('location')) {
			payload.location = location;
		}
		setPreferredField('locationType', 'location_type', locationType);
		setPreferredField('inventoryMode', 'inventory_mode', inventoryMode);
		setPreferredField('currentCount', 'current_count', stockValidation.data.current);
		setPreferredField('parLevel', 'par_level', stockValidation.data.par);
		setPreferredField('reorderLevel', 'reorder_level', stockValidation.data.reorder);

		if (Object.keys(payload).length === 0) {
			return fail(500, {
				error: 'Bar bottle schema does not expose editable fields. Refresh schema setup and try again.',
				updatedBarBottleId: barBottleId,
				rowStatus: 'error'
			});
		}

		await pb.collection(BAR_BOTTLE_COLLECTION).update(barBottleId, payload);

		const updatedRecord = await pb.collection(BAR_BOTTLE_COLLECTION).getOne<BarBottleRecord>(barBottleId);
		const updatedCounts = readBarBottleCounts(updatedRecord);
		const updatedMeta = readBarBottleMeta(updatedRecord);
		const expectedCurrent = stockValidation.data.current;
		const expectedPar = stockValidation.data.par;
		const expectedReorder = stockValidation.data.reorder;

		if (fieldNames.has('location') && updatedMeta.location !== location) {
			return fail(500, {
				error: 'Save did not persist for this row. Please try again or refresh schema setup.',
				updatedBarBottleId: barBottleId,
				rowStatus: 'error'
			});
		}

		const hasLocationType = fieldNames.has('locationType') || fieldNames.has('location_type');
		if (hasLocationType && updatedMeta.locationType !== locationType) {
			return fail(500, {
				error: 'Save did not persist for this row. Please try again or refresh schema setup.',
				updatedBarBottleId: barBottleId,
				rowStatus: 'error'
			});
		}

		const hasInventoryMode = fieldNames.has('inventoryMode') || fieldNames.has('inventory_mode');
		if (hasInventoryMode && updatedMeta.inventoryMode !== inventoryMode) {
			return fail(500, {
				error: 'Save did not persist for this row. Please try again or refresh schema setup.',
				updatedBarBottleId: barBottleId,
				rowStatus: 'error'
			});
		}

		const hasCurrent = fieldNames.has('currentCount') || fieldNames.has('current_count');
		if (hasCurrent && updatedCounts.currentCount !== expectedCurrent) {
			return fail(500, {
				error: 'Save did not persist for this row. Please try again or refresh schema setup.',
				updatedBarBottleId: barBottleId,
				rowStatus: 'error'
			});
		}

		const hasPar = fieldNames.has('parLevel') || fieldNames.has('par_level');
		if (hasPar && updatedCounts.parLevel !== expectedPar) {
			return fail(500, {
				error: 'Save did not persist for this row. Please try again or refresh schema setup.',
				updatedBarBottleId: barBottleId,
				rowStatus: 'error'
			});
		}

		const hasReorder = fieldNames.has('reorderLevel') || fieldNames.has('reorder_level');
		if (hasReorder && updatedCounts.reorderLevel !== expectedReorder) {
			return fail(500, {
				error: 'Save did not persist for this row. Please try again or refresh schema setup.',
				updatedBarBottleId: barBottleId,
				rowStatus: 'error'
			});
		}

		if (
			(hasCurrent || hasPar || hasReorder) &&
			(updatedCounts.currentCount === expectedCurrent ||
				updatedCounts.parLevel === expectedPar ||
				updatedCounts.reorderLevel === expectedReorder)
		) {
			// At least one numeric stock field persisted as expected.
		}

		const redirectParams = new URLSearchParams({
			bar: selectedBarId,
			updated: '1',
			updatedBarBottleId: barBottleId,
			rowStatus: 'saved'
		});
		if (selectedStorageFilter) {
			redirectParams.set('storage', selectedStorageFilter);
		}
		addSortToRedirectParams(redirectParams, selectedSortKey, selectedSortDirection);

		throw redirect(303, `/dashboard/bars?${redirectParams.toString()}`);
	},
	addBottleArea: async ({ request }) => {
		const pb = await createAdminClient();

		if (!pb) {
			return fail(500, {
				error: 'PocketBase admin credentials are required to add bottle areas.'
			});
		}

		await ensureBarCollections(pb);

		const formData = await request.formData();
		const barBottleId = String(formData.get('barBottleId') ?? '').trim();
		const selectedBarId = String(formData.get('selectedBarId') ?? '').trim();
		const selectedStorageFilter = String(formData.get('selectedStorageFilter') ?? '').trim();
		const selectedSortKey = normalizeSortKey(String(formData.get('sort') ?? ''));
		const selectedSortDirection = normalizeSortDirection(String(formData.get('dir') ?? ''));
		const location = String(formData.get('location') ?? '').trim();
		const locationType = String(formData.get('locationType') ?? '').trim();

		const validation = addBottleAreaSchema.safeParse({
			barBottleId,
			selectedBarId,
			selectedStorageFilter,
			location,
			locationType
		});

		if (!validation.success) {
			return fail(400, {
				error: 'Unable to add another area row. Refresh and try again.'
			});
		}

		const source = await pb.collection(BAR_BOTTLE_COLLECTION).getOne<BarBottleRecord>(barBottleId);
		const sourceBarId = source.bar ?? source.barId ?? '';
		const sourceBottleId = source.bottle ?? source.bottleId ?? '';

		if (!sourceBarId || !sourceBottleId) {
			return fail(400, {
				error: 'Unable to duplicate this bottle row because source references are missing.',
				updatedBarBottleId: barBottleId,
				rowStatus: 'error'
			});
		}

		const meta = readBarBottleMeta(source);
		const counts = readBarBottleCounts(source);
		const targetLocation = location;
		const targetLocationType = locationType;
		const existingAreaRows = await pb.collection(BAR_BOTTLE_COLLECTION).getFullList<BarBottleRecord>({
			filter: `bar = \"${sourceBarId}\" && bottle = \"${sourceBottleId}\"`
		});
		const duplicateExists = existingAreaRows.some((item) => {
			if (item.id === source.id) {
				return false;
			}
			const itemMeta = readBarBottleMeta(item);
			return itemMeta.location === targetLocation && itemMeta.locationType === targetLocationType;
		});

		if (duplicateExists) {
			return fail(409, {
				error: 'This bottle already exists in that area. Change area and save the existing row instead.',
				updatedBarBottleId: barBottleId,
				rowStatus: 'error'
			});
		}

		const createPayload = {
			bar: sourceBarId,
			bottle: sourceBottleId,
			displayName: source.displayName ?? '',
			inventoryMode: meta.inventoryMode,
			currentCount: counts.currentCount,
			parLevel: counts.parLevel,
			reorderLevel: counts.reorderLevel,
			location: targetLocation,
			locationType: targetLocationType,
			notes: source.notes ?? null
		};

		const created = await createBarBottleWithCompatibility(pb, createPayload);

		const redirectParams = new URLSearchParams({
			bar: selectedBarId,
			added: '1',
			updatedBarBottleId: created.id,
			rowStatus: 'added'
		});
		redirectParams.set('storage', targetLocationType);
		addSortToRedirectParams(redirectParams, selectedSortKey, selectedSortDirection);

		throw redirect(303, `/dashboard/bars?${redirectParams.toString()}`);
	},
	addBottleToStorage: async ({ request }) => {
		const pb = await createAdminClient();

		if (!pb) {
			return fail(500, {
				error: 'PocketBase admin credentials are required to add bottles to storage.'
			});
		}

		await ensureBarCollections(pb);

		const formData = await request.formData();
		const barBottleId = String(formData.get('barBottleId') ?? '').trim();
		const selectedBarId = String(formData.get('selectedBarId') ?? '').trim();
		const selectedStorageFilter = String(formData.get('selectedStorageFilter') ?? '').trim();
		const selectedSortKey = normalizeSortKey(String(formData.get('sort') ?? ''));
		const selectedSortDirection = normalizeSortDirection(String(formData.get('dir') ?? ''));

		const validation = addBottleToStorageSchema.safeParse({
			barBottleId,
			selectedBarId,
			selectedStorageFilter
		});

		if (!validation.success) {
			return fail(400, {
				error: 'Unable to add this bottle to storage. Refresh and try again.'
			});
		}

		const source = await pb.collection(BAR_BOTTLE_COLLECTION).getOne<BarBottleRecord>(barBottleId);
		const sourceBarId = source.bar ?? source.barId ?? '';
		const sourceBottleId = source.bottle ?? source.bottleId ?? '';

		if (!sourceBarId || !sourceBottleId) {
			return fail(400, {
				error: 'Unable to duplicate this bottle row because source references are missing.',
				updatedBarBottleId: barBottleId,
				rowStatus: 'error'
			});
		}

		const targetLocation = 'Storage';
		const targetLocationType = 'overflow';
		const existingStorageRows = await pb.collection(BAR_BOTTLE_COLLECTION).getFullList<BarBottleRecord>({
			filter: `bar = \"${sourceBarId}\" && bottle = \"${sourceBottleId}\"`
		});
		const existingStorageRow = existingStorageRows.find((item) => isStorageOverflowRow(item));

		if (existingStorageRow) {
			const redirectParams = new URLSearchParams({
				bar: selectedBarId,
				updatedBarBottleId: existingStorageRow.id,
				rowStatus: 'stored'
			});
			redirectParams.set('storage', targetLocationType);
			addSortToRedirectParams(redirectParams, selectedSortKey, selectedSortDirection);

			throw redirect(303, `/dashboard/bars?${redirectParams.toString()}`);
		}

		const meta = readBarBottleMeta(source);
		const counts = readBarBottleCounts(source);
		const createPayload = {
			bar: sourceBarId,
			bottle: sourceBottleId,
			displayName: source.displayName ?? '',
			inventoryMode: meta.inventoryMode,
			currentCount: counts.currentCount,
			parLevel: counts.parLevel,
			reorderLevel: counts.reorderLevel,
			location: targetLocation,
			locationType: targetLocationType,
			notes: source.notes ?? null
		};

		const created = await createBarBottleWithCompatibility(pb, createPayload);

		const redirectParams = new URLSearchParams({
			bar: selectedBarId,
			storageAdded: '1',
			updatedBarBottleId: created.id,
			rowStatus: 'stored'
		});
		redirectParams.set('storage', targetLocationType);
		addSortToRedirectParams(redirectParams, selectedSortKey, selectedSortDirection);

		throw redirect(303, `/dashboard/bars?${redirectParams.toString()}`);
	},
	addBottleToBar: async ({ request }) => {
		const pb = await createAdminClient();

		if (!pb) {
			return fail(500, {
				error: 'PocketBase admin credentials are required to add bottles.'
			});
		}

		await ensureBarCollections(pb);

		const formData = await request.formData();
		const selectedBarId = String(formData.get('selectedBarId') ?? '').trim();
		const selectedStorageFilter = String(formData.get('selectedStorageFilter') ?? '').trim();
		const selectedSortKey = normalizeSortKey(String(formData.get('sort') ?? ''));
		const selectedSortDirection = normalizeSortDirection(String(formData.get('dir') ?? ''));
		const bottleId = String(formData.get('bottleId') ?? '').trim();
		const location = String(formData.get('location') ?? '').trim();
		const locationType = String(formData.get('locationType') ?? '').trim();
		const inventoryMode = String(formData.get('inventoryMode') ?? '').trim();
		const currentInput = String(formData.get('currentCount') ?? '').trim();
		const parInput = String(formData.get('parLevel') ?? '').trim();
		const reorderInput = String(formData.get('reorderLevel') ?? '').trim();

		const validation = addBottleToBarSchema.safeParse({
			selectedBarId,
			selectedStorageFilter,
			bottleId,
			location,
			locationType,
			inventoryMode
		});

		const stockValidation = stockNumbersSchema.safeParse({
			current: currentInput,
			par: parInput,
			reorder: reorderInput
		});

		if (!validation.success || !stockValidation.success) {
			return fail(400, {
				error: 'Unable to add bottle. Check values and try again.'
			});
		}

		const bottle = await pb.collection(BOTTLE_COLLECTION).getOne<BottleRecord>(bottleId, {
			fields: 'id,name'
		});

		const existingRows = await pb.collection(BAR_BOTTLE_COLLECTION).getFullList<BarBottleRecord>({
			filter: `bar = \"${selectedBarId}\" && bottle = \"${bottleId}\"`
		});

		const duplicateExists = existingRows.some((item) => {
			const meta = readBarBottleMeta(item);
			return meta.location === location && meta.locationType === locationType;
		});

		if (duplicateExists) {
			return fail(409, {
				error: 'This bottle already exists in that area/type.'
			});
		}

		const payload = {
			bar: selectedBarId,
			bottle: bottle.id,
			displayName: bottle.name,
			inventoryMode,
			currentCount: stockValidation.data.current,
			parLevel: stockValidation.data.par,
			reorderLevel: stockValidation.data.reorder,
			location,
			locationType,
			notes: null
		};

		const created = await createBarBottleWithCompatibility(pb, payload);

		const redirectParams = new URLSearchParams({
			bar: selectedBarId,
			bottleAdded: '1',
			updatedBarBottleId: created.id,
			rowStatus: 'added'
		});

		if (selectedStorageFilter) {
			redirectParams.set('storage', selectedStorageFilter);
		}
		addSortToRedirectParams(redirectParams, selectedSortKey, selectedSortDirection);

		throw redirect(303, `/dashboard/bars?${redirectParams.toString()}`);
	},
	createBottleAndAddToBar: async ({ request }) => {
		const pb = await createAdminClient();

		if (!pb) {
			return fail(500, {
				error: 'PocketBase admin credentials are required to create bottles.'
			});
		}

		await ensureBarCollections(pb);

		const formData = await request.formData();
		const selectedBarId = String(formData.get('selectedBarId') ?? '').trim();
		const selectedStorageFilter = String(formData.get('selectedStorageFilter') ?? '').trim();
		const selectedSortKey = normalizeSortKey(String(formData.get('sort') ?? ''));
		const selectedSortDirection = normalizeSortDirection(String(formData.get('dir') ?? ''));
		const name = String(formData.get('name') ?? '').trim();
		const brand = String(formData.get('brand') ?? '').trim();
		const category = String(formData.get('category') ?? '').trim();
		const image = String(formData.get('image') ?? '').trim();
		const location = String(formData.get('location') ?? '').trim();
		const locationType = String(formData.get('locationType') ?? '').trim();
		const inventoryMode = String(formData.get('inventoryMode') ?? '').trim();
		const currentInput = String(formData.get('currentCount') ?? '').trim();
		const parInput = String(formData.get('parLevel') ?? '').trim();
		const reorderInput = String(formData.get('reorderLevel') ?? '').trim();

		const validation = createBottleAndAddToBarSchema.safeParse({
			selectedBarId,
			selectedStorageFilter,
			name,
			brand,
			category,
			image,
			location,
			locationType,
			inventoryMode
		});

		const stockValidation = stockNumbersSchema.safeParse({
			current: currentInput,
			par: parInput,
			reorder: reorderInput
		});

		if (!validation.success || !stockValidation.success) {
			return fail(400, {
				error: 'Unable to create bottle. Check values and try again.'
			});
		}

		const slugBase = slugify(name) || 'bottle';
		const createdBottle = await pb.collection(BOTTLE_COLLECTION).create({
			name,
			slug: `${slugBase}-${Date.now().toString().slice(-6)}`,
			brand,
			category,
			section: null,
			subcategory: null,
			origin: null,
			abv: null,
			description: '',
			image
		});

		const payload = {
			bar: selectedBarId,
			bottle: createdBottle.id,
			displayName: name,
			inventoryMode,
			currentCount: stockValidation.data.current,
			parLevel: stockValidation.data.par,
			reorderLevel: stockValidation.data.reorder,
			location,
			locationType,
			notes: null
		};

		const createdBarBottle = await createBarBottleWithCompatibility(pb, payload);

		const redirectParams = new URLSearchParams({
			bar: selectedBarId,
			bottleAdded: '1',
			updatedBarBottleId: createdBarBottle.id,
			rowStatus: 'added'
		});

		if (selectedStorageFilter) {
			redirectParams.set('storage', selectedStorageFilter);
		}
		addSortToRedirectParams(redirectParams, selectedSortKey, selectedSortDirection);

		throw redirect(303, `/dashboard/bars?${redirectParams.toString()}`);
	},
	generateStock: async ({ request }) => {
		const pb = await createAdminClient();

		if (!pb) {
			return fail(500, {
				error: 'PocketBase admin credentials are required to generate stock.'
			});
		}

		await ensureBarCollections(pb);

		const formData = await request.formData();
		const selectedBarId = String(formData.get('selectedBarId') ?? '').trim();
		const selectedStorageFilter = String(formData.get('selectedStorageFilter') ?? '').trim();
		const selectedSortKey = normalizeSortKey(String(formData.get('sort') ?? ''));
		const selectedSortDirection = normalizeSortDirection(String(formData.get('dir') ?? ''));

		const validation = generateStockSchema.safeParse({
			selectedBarId,
			selectedStorageFilter
		});

		if (!validation.success) {
			return fail(400, {
				error: 'Unable to generate stock values. Refresh and try again.'
			});
		}

		const barBottleCollection = await pb.collections.getOne(BAR_BOTTLE_COLLECTION);
		const fieldNames = new Set((barBottleCollection.fields ?? []).map((field) => field.name));

		const barBottles = await pb.collection(BAR_BOTTLE_COLLECTION).getFullList<BarBottleRecord>({
			filter: `bar = \"${selectedBarId}\"`
		});

		const targetBottles = selectedStorageFilter
			? barBottles.filter((item) => readBarBottleMeta(item).locationType === selectedStorageFilter)
			: barBottles;

		for (const item of targetBottles) {
			const parLevel = toNumber(item.parLevel ?? item.par_level);
			const generatedCurrent = parLevel > 0 ? parLevel : 1;
			const generatedReorder = parLevel > 0 ? Number((parLevel * 0.5).toFixed(2)) : 0.5;

			const payload: Record<string, unknown> = {};
			if (fieldNames.has('currentCount')) {
				payload.currentCount = generatedCurrent;
			} else if (fieldNames.has('current_count')) {
				payload.current_count = generatedCurrent;
			}

			if (fieldNames.has('reorderLevel')) {
				payload.reorderLevel = generatedReorder;
			} else if (fieldNames.has('reorder_level')) {
				payload.reorder_level = generatedReorder;
			}

			if (Object.keys(payload).length === 0) {
				continue;
			}

			await pb.collection(BAR_BOTTLE_COLLECTION).update(item.id, payload);
		}

		const redirectParams = new URLSearchParams({
			bar: selectedBarId,
			generated: String(targetBottles.length)
		});
		if (selectedStorageFilter) {
			redirectParams.set('storage', selectedStorageFilter);
		}
		addSortToRedirectParams(redirectParams, selectedSortKey, selectedSortDirection);

		throw redirect(303, `/dashboard/bars?${redirectParams.toString()}`);
	},
	deleteBar: async ({ request }) => {
		const pb = await createAdminClient();

		if (!pb) {
			return fail(500, {
				error: 'PocketBase admin credentials are required to delete bars.'
			});
		}

		await ensureBarCollections(pb);

		const formData = await request.formData();
		const barId = String(formData.get('barId') ?? '').trim();

		const validation = deleteBarSchema.safeParse({ barId });
		if (!validation.success) {
			return fail(400, {
				error: 'Unable to delete bar. Refresh and try again.'
			});
		}

		await pb.collection(BAR_COLLECTION).delete(barId);

		throw redirect(303, '/dashboard/bars');
	},
	deleteBarBottle: async ({ request }) => {
		const pb = await createAdminClient();

		if (!pb) {
			return fail(500, {
				error: 'PocketBase admin credentials are required to delete bottle rows.'
			});
		}

		await ensureBarCollections(pb);

		const formData = await request.formData();
		const barBottleId = String(formData.get('barBottleId') ?? '').trim();
		const selectedBarId = String(formData.get('selectedBarId') ?? '').trim();
		const selectedStorageFilter = String(formData.get('selectedStorageFilter') ?? '').trim();
		const selectedSortKey = normalizeSortKey(String(formData.get('sort') ?? ''));
		const selectedSortDirection = normalizeSortDirection(String(formData.get('dir') ?? ''));

		const validation = deleteBarBottleSchema.safeParse({
			barBottleId,
			selectedBarId,
			selectedStorageFilter
		});
		if (!validation.success) {
			return fail(400, {
				error: 'Unable to delete bottle row. Refresh and try again.'
			});
		}

		await pb.collection(BAR_BOTTLE_COLLECTION).delete(barBottleId);

		const redirectParams = new URLSearchParams({ bar: selectedBarId });
		if (selectedStorageFilter) {
			redirectParams.set('storage', selectedStorageFilter);
		}
		addSortToRedirectParams(redirectParams, selectedSortKey, selectedSortDirection);

		throw redirect(303, `/dashboard/bars?${redirectParams.toString()}`);
	}
};
