import { env } from '$env/dynamic/private';
import PocketBase from 'pocketbase';
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

const BAR_COLLECTION = env.POCKETBASE_BAR_COLLECTION ?? 'bars';

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

async function getBarCount(pb: PocketBase): Promise<number> {
	try {
		const barPage = await pb.collection(BAR_COLLECTION).getList(1, 1, {
			fields: 'id'
		});
		return barPage.totalItems;
	} catch (error) {
		const status =
			typeof error === 'object' && error !== null && 'status' in error
				? Number(error.status)
				: 0;
		if (status === 404) {
			return 0;
		}
		throw error;
	}
}

export const load = (async ({ cookies, url }) => {
	const token = cookies.get('pb_auth');

	if (!token) {
		throw redirect(303, '/');
	}

	const pb = await createAdminClient();
	const allowedWithoutBars = url.pathname === '/dashboard/setup-bar' || url.pathname === '/dashboard/bars';

	if (pb) {
		const barCount = await getBarCount(pb);

		if (barCount === 0 && !allowedWithoutBars) {
			throw redirect(303, '/dashboard/setup-bar');
		}

		if (barCount > 0 && url.pathname === '/dashboard/setup-bar') {
			throw redirect(303, '/dashboard');
		}
	}

	return {
		hasSession: true
	};
}) satisfies LayoutServerLoad;
