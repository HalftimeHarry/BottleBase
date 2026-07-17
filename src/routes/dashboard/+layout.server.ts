import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load = (async ({ cookies }) => {
	const token = cookies.get('pb_auth');

	if (!token) {
		throw redirect(303, '/');
	}

	return {
		hasSession: true
	};
}) satisfies LayoutServerLoad;
