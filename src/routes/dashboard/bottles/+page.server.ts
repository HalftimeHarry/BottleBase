import { env } from '$env/dynamic/private';
import { fail, redirect } from '@sveltejs/kit';
import PocketBase from 'pocketbase';
import type { Actions, PageServerLoad } from './$types';

type BottleRecord = {
	id: string;
	name: string;
	slug: string;
	brand: string;
	category: string;
	abv: number | null;
	description: string;
	section?: string;
	image?: string;
	expand?: {
		section?: { name: string; slug: string };
		image?: { name: string; slug: string };
	};
};

type SectionRecord = {
	id: string;
	name: string;
	slug: string;
	kind: string;
};

type ImageRecord = {
	id: string;
	name: string;
	slug: string;
};

const BOTTLE_COLLECTION = env.POCKETBASE_BOTTLE_COLLECTION ?? 'bottles';
const SECTION_COLLECTION = env.POCKETBASE_SECTION_COLLECTION ?? 'catalog_sections';
const IMAGE_COLLECTION = env.POCKETBASE_IMAGE_COLLECTION ?? 'bottle_images';

function slugify(value: string) {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
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

export const load = (async () => {
	const pb = await createAdminClient();

	if (!pb) {
		return {
			bottles: [] satisfies BottleRecord[],
			sections: [] satisfies SectionRecord[],
			images: [] satisfies ImageRecord[],
			totalBottles: 0,
			totalSections: 0,
			totalImages: 0,
			setupError: 'PocketBase admin credentials are required to manage bottle records.'
		};
	}

	const [bottles, sections, images] = await Promise.all([
		pb.collection(BOTTLE_COLLECTION).getFullList<BottleRecord>({
			fields: 'id,name,slug,brand,category,abv,description,section,image,expand',
			expand: 'section,image',
			sort: 'name'
		}),
		pb.collection(SECTION_COLLECTION).getFullList<SectionRecord>({
			fields: 'id,name,slug,kind',
			sort: 'sortOrder,name'
		}),
		pb.collection(IMAGE_COLLECTION).getFullList<ImageRecord>({
			fields: 'id,name,slug',
			sort: 'name'
		})
	]);

	return {
		bottles,
		sections,
		images,
		totalBottles: bottles.length,
		totalSections: sections.length,
		totalImages: images.length,
		setupError: null
	};
}) satisfies PageServerLoad;

export const actions: Actions = {
	create: async ({ request }) => {
		const pb = await createAdminClient();

		if (!pb) {
			return fail(500, {
				error: 'PocketBase admin credentials are required to create bottle records.'
			});
		}

		const formData = await request.formData();
		const name = String(formData.get('name') ?? '').trim();
		const brand = String(formData.get('brand') ?? '').trim();
		const category = String(formData.get('category') ?? '').trim();
		const section = String(formData.get('section') ?? '').trim();
		const image = String(formData.get('image') ?? '').trim();
		const description = String(formData.get('description') ?? '').trim();
		const slugInput = String(formData.get('slug') ?? '').trim();
		const abvInput = String(formData.get('abv') ?? '').trim();

		if (!name || !brand || !category || !image) {
			return fail(400, {
				error: 'Name, brand, category, and image are required.'
			});
		}

		const abv = abvInput ? Number(abvInput) : null;
		if (abvInput && Number.isNaN(abv)) {
			return fail(400, {
				error: 'ABV must be a number if provided.'
			});
		}

		await pb.collection(BOTTLE_COLLECTION).create({
			name,
			slug: slugInput || slugify(name),
			brand,
			category,
			section: section || null,
			subcategory: null,
			origin: null,
			abv,
			description,
			image
		});

		throw redirect(303, '/dashboard/bottles');
	}
};