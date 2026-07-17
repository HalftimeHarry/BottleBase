import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '$env/dynamic/private';
import * as schema from './schema';

export const db = env.DATABASE_URL
	? drizzle(postgres(env.DATABASE_URL), { schema })
	: null;
