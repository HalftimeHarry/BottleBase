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
	currentCount?: number | string;
	parLevel?: number | string;
	reorderLevel?: number | string;
	inventoryMode?: string;
	isVisible?: boolean;
};

type StorageAreaType = 'well' | 'backbar' | 'cold-storage' | 'overflow';
type StorageAreaInput = { id: string; name: string; type: StorageAreaType };
type FieldErrors = Record<string, string>;

const STORAGE_AREA_TYPES = new Set<StorageAreaType>(['well', 'backbar', 'cold-storage', 'overflow']);
const BAR_TYPES = ['permanent', 'temporary', 'satellite', 'seasonal'] as const;
const INVENTORY_MODES = ['disabled', 'simple-counts', 'detailed-tracking'] as const;

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
	location: z.string().trim().min(1, 'Storage area name is required.'),
	locationType: z.enum(['well', 'backbar', 'cold-storage', 'overflow']),
	inventoryMode: z.enum(INVENTORY_MODES),
	isVisible: z.enum(['true', 'false'])
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

function boolField(name: string, required = true) {
	return {
		name,
		type: 'bool',
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

async function ensureBarCollections(pb: PocketBase) {
	const bottleCollection = await pb.collections.getOne(BOTTLE_COLLECTION);

	const barCollection = await ensureCollection(pb, BAR_COLLECTION, [
		textField('name', true),
		textField('slug', true),
		textField('barType', true),
		textField('defaultInventoryMode', true),
		textField('stockingProfile', false)
	]);

	await ensureCollection(pb, BAR_BOTTLE_COLLECTION, [
		relationField('bar', barCollection.id, true),
		relationField('bottle', bottleCollection.id, true),
		textField('displayName', true),
		textField('inventoryMode', true),
		numberField('currentCount', false),
		numberField('parLevel', false),
		numberField('reorderLevel', false),
		textField('location', false),
		textField('locationType', false),
		textField('notes', false, 2000),
		boolField('isVisible', true)
	]);
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

export const load = (async ({ url }) => {
	const pb = await createAdminClient();

	if (!pb) {
		return {
			bottles: [] satisfies BottleRecord[],
			bars: [] satisfies Array<BarRecord & { stockedCount: number }>,
			setupError: 'PocketBase admin credentials are required to create and stock bars.'
		};
	}

	await ensureBarCollections(pb);

	const [bottles, stockedBottles, barsResult] = await Promise.all([
		pb.collection(BOTTLE_COLLECTION).getFullList<BottleRecord>({
			fields: 'id,name,brand,category',
			sort: 'name'
		}),
		pb.collection(BAR_BOTTLE_COLLECTION).getFullList<BarBottleRecord>(),
		fetchBarsSafe(pb)
	]);

	const bars = barsResult.bars;
	const selectedBarId = url.searchParams.get('bar')?.trim() ?? '';
	const selectedStorageFilter = url.searchParams.get('storage')?.trim() ?? '';

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
			return {
				id: item.id,
				barId: item.bar ?? item.barId ?? '',
				bottleId: bottleRef,
				displayName: item.displayName ?? bottle?.name ?? 'Unknown bottle',
				brand: bottle?.brand ?? 'Unknown brand',
				category: bottle?.category ?? 'Unknown category',
				location: item.location ?? '',
				locationType: item.locationType ?? 'backbar',
				currentCount: toNumber(item.currentCount),
				parLevel: toNumber(item.parLevel),
				reorderLevel: toNumber(item.reorderLevel),
				inventoryMode: item.inventoryMode ?? 'simple-counts',
				isVisible: item.isVisible ?? true
			};
		});

	const visibleBarBottles = selectedStorageFilter
		? selectedBarBottles.filter((item) => item.locationType === selectedStorageFilter)
		: selectedBarBottles;

	const selectedBarStorageTypes = [...new Set(selectedBarBottles.map((item) => item.locationType))].filter(
		(value): value is StorageAreaType => STORAGE_AREA_TYPES.has(value as StorageAreaType)
	);

	return {
		bottles,
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
		selectedBarBottles: visibleBarBottles,
		selectedBarStorageTypes,
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
				notes: null,
				isVisible: true
			};

			try {
				await pb.collection(BAR_BOTTLE_COLLECTION).create(payload);
			} catch (error) {
				const status =
					typeof error === 'object' && error !== null && 'status' in error
						? Number(error.status)
						: 0;
				if (status !== 400) {
					throw error;
				}

				const fallbackPayload = { ...payload };
				delete (fallbackPayload as { locationType?: string }).locationType;
				await pb.collection(BAR_BOTTLE_COLLECTION).create(fallbackPayload);
			}
		}

		const redirectTarget = barPageBeforeCreate.totalItems === 0 ? '/dashboard' : '/dashboard/bars';
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
		const location = String(formData.get('location') ?? '').trim();
		const locationType = String(formData.get('locationType') ?? '').trim();
		const inventoryMode = String(formData.get('inventoryMode') ?? '').trim();
		const isVisible = String(formData.get('isVisible') ?? '').trim();
		const currentInput = String(formData.get('currentCount') ?? '').trim();
		const parInput = String(formData.get('parLevel') ?? '').trim();
		const reorderInput = String(formData.get('reorderLevel') ?? '').trim();

		const validation = updateStockSchema.safeParse({
			barBottleId,
			selectedBarId,
			location,
			locationType,
			inventoryMode,
			isVisible
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

		const payload = {
			location,
			locationType,
			inventoryMode,
			isVisible: isVisible === 'true',
			currentCount: stockValidation.data.current,
			parLevel: stockValidation.data.par,
			reorderLevel: stockValidation.data.reorder
		};

		try {
			await pb.collection(BAR_BOTTLE_COLLECTION).update(barBottleId, payload);
		} catch (error) {
			const status =
				typeof error === 'object' && error !== null && 'status' in error
					? Number(error.status)
					: 0;
			if (status !== 400) {
				throw error;
			}

			const fallbackPayload = { ...payload };
			delete (fallbackPayload as { locationType?: string }).locationType;
			await pb.collection(BAR_BOTTLE_COLLECTION).update(barBottleId, fallbackPayload);
		}

		throw redirect(303, `/dashboard/bars?bar=${selectedBarId}`);
	}
};
