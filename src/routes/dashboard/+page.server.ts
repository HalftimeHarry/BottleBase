import { env } from '$env/dynamic/private';
import PocketBase from 'pocketbase';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

type BarRecord = {
	id: string;
	name?: string;
	barType?: string;
	defaultInventoryMode?: string;
};

type BarBottleRecord = {
	id: string;
	bar?: string;
	barId?: string;
	location?: string;
	locationType?: string;
};

const BAR_COLLECTION = env.POCKETBASE_BAR_COLLECTION ?? 'bars';
const BAR_BOTTLE_COLLECTION = env.POCKETBASE_BAR_BOTTLE_COLLECTION ?? 'bar_bottles';

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

async function fetchBarsSummary(pb: PocketBase): Promise<{
	bars: Array<{
		id: string;
		name: string;
		barType: string;
		defaultInventoryMode: string;
		stockedCount: number;
		storageAreas: string[];
	}>;
	loadWarning: string | null;
}> {
	try {
		const [bars, barBottles] = await Promise.all([
			pb.collection(BAR_COLLECTION).getFullList<BarRecord>({ sort: 'name' }),
			pb.collection(BAR_BOTTLE_COLLECTION).getFullList<BarBottleRecord>()
		]);

		const countByBar = new Map<string, number>();
		const storageByBar = new Map<string, Set<string>>();

		for (const item of barBottles) {
			const barRef = item.bar ?? item.barId ?? '';
			if (!barRef) {
				continue;
			}

			countByBar.set(barRef, (countByBar.get(barRef) ?? 0) + 1);

			const location = item.location?.trim();
			if (!location) {
				continue;
			}

			const locationLabel = item.locationType?.trim()
				? `${location} (${item.locationType.trim()})`
				: location;

			if (!storageByBar.has(barRef)) {
				storageByBar.set(barRef, new Set<string>());
			}
			storageByBar.get(barRef)?.add(locationLabel);
		}

		return {
			bars: bars.map((bar) => ({
				id: bar.id,
				name: bar.name?.trim() || 'Untitled bar',
				barType: bar.barType?.trim() || 'permanent',
				defaultInventoryMode: bar.defaultInventoryMode?.trim() || 'simple-counts',
				stockedCount: countByBar.get(bar.id) ?? 0,
				storageAreas: [...(storageByBar.get(bar.id) ?? new Set<string>())].sort()
			})),
			loadWarning: null
		};
	} catch {
		return {
			bars: [],
			loadWarning: 'Bar summary is temporarily unavailable. Open Bar Inventory to refresh setup data.'
		};
	}
}

export const load = (async ({ cookies }) => {
	const token = cookies.get('pb_auth');

	if (!token) {
		throw redirect(303, '/');
	}

	const pb = await createAdminClient();

	if (!pb) {
		return {
			hasSession: true,
			bars: [] satisfies Array<{
				id: string;
				name: string;
				barType: string;
				defaultInventoryMode: string;
				stockedCount: number;
				storageAreas: string[];
			}>,
			barSummaryWarning: 'PocketBase admin credentials are required to load bar and storage summaries.'
		};
	}

	const summary = await fetchBarsSummary(pb);

	return {
		hasSession: true,
		bars: summary.bars,
		barSummaryWarning: summary.loadWarning
	};
}) satisfies PageServerLoad;
