import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

interface RegisterPayload {
	email?: string;
	password?: string;
	name?: string;
}

const AUTH_COLLECTION = env.POCKETBASE_AUTH_COLLECTION ?? 'users';

export const POST: RequestHandler = async ({ request, fetch, cookies }) => {
	const body = (await request.json()) as RegisterPayload;
	const email = body.email?.trim().toLowerCase() ?? '';
	const password = body.password ?? '';
	const name = body.name?.trim() ?? '';

	if (!email || !password || !name) {
		return json({ message: 'Name, email, and password are required.' }, { status: 400 });
	}
	if (password.length < 8) {
		return json({ message: 'Password must be at least 8 characters.' }, { status: 400 });
	}
	if (!env.POCKETBASE_URL) {
		return json({ message: 'PocketBase is not configured.' }, { status: 500 });
	}

	const baseUrl = env.POCKETBASE_URL.replace(/\/$/, '');

	const createResponse = await fetch(`${baseUrl}/api/collections/${AUTH_COLLECTION}/records`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			email,
			password,
			passwordConfirm: password,
			name
		})
	});

	if (!createResponse.ok) {
		const errorData = (await createResponse.json().catch(() => null)) as
			| { message?: string }
			| null;
		return json(
			{ message: errorData?.message ?? 'Unable to create account.' },
			{ status: createResponse.status }
		);
	}

	const authResponse = await fetch(
		`${baseUrl}/api/collections/${AUTH_COLLECTION}/auth-with-password`,
		{
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ identity: email, password })
		}
	);

	if (!authResponse.ok) {
		return json({ message: 'Account created, but sign-in failed.' }, { status: 201 });
	}

	const authData = (await authResponse.json()) as {
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
		message: 'Account created.',
		user: {
			id: authData.record.id,
			email: authData.record.email ?? email,
			name: authData.record.name ?? name
		}
	});
};
