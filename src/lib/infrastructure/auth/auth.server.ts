import { env } from '$env/dynamic/private';
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';

type AuthInstance = ReturnType<typeof betterAuth>;

async function createAuth(): Promise<AuthInstance | null> {
	if (!env.DATABASE_URL || !env.BETTER_AUTH_SECRET || !env.ORIGIN) {
		return null;
	}

	const { db } = await import('$lib/infrastructure/db/client');
	if (!db) {
		return null;
	}

	return betterAuth({
		baseURL: env.ORIGIN,
		secret: env.BETTER_AUTH_SECRET,
		database: drizzleAdapter(db, { provider: 'pg' }),
		emailAndPassword: { enabled: true },
		plugins: [
			sveltekitCookies(getRequestEvent) // keep this plugin last as required by better-auth
		]
	});
}

export const auth = await createAuth();
