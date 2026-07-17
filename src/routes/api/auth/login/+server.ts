import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

interface LoginPayload {
	email?: string;
	password?: string;
}

const AUTH_COLLECTION = env.POCKETBASE_AUTH_COLLECTION ?? 'users';

export const POST: RequestHandler = async ({ request, fetch, cookies }) => {
	const body = (await request.json()) as LoginPayload;
	const email = body.email?.trim().toLowerCase() ?? '';
	const password = body.password ?? '';

	if (!email || !password) {
		return json({ message: 'Email and password are required.' }, { status: 400 });
	}
	if (!env.POCKETBASE_URL) {
		return json({ message: 'PocketBase is not configured.' }, { status: 500 });
	}

	const baseUrl = env.POCKETBASE_URL.replace(/\/$/, '');
	const response = await fetch(`${baseUrl}/api/collections/${AUTH_COLLECTION}/auth-with-password`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ identity: email, password })
	});

	if (!response.ok) {
		const errorData = (await response.json().catch(() => null)) as { message?: string } | null;
		return json(
			{ message: errorData?.message ?? 'Invalid email or password.' },
			{ status: response.status }
		);
	}

	const authData = (await response.json()) as {
		token: string;
		record: { id: string; email?: string; name?: string };
	};

	cookies.set('pb_auth', authData.token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: true,
		maxAge: 60 * 60 * 24 * 7
	});

	return json({
		message: 'Signed in.',
		user: {
			id: authData.record.id,
			email: authData.record.email ?? email,
			name: authData.record.name ?? ''
		}
	});
};
