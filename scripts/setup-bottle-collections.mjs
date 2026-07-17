import PocketBase from 'pocketbase';

const pocketbaseUrl = process.env.POCKETBASE_URL;
const adminEmail = process.env.POCKETBASE_ADMIN_EMAIL;
const adminPassword = process.env.POCKETBASE_ADMIN_PASSWORD;

const IMAGE_COLLECTION = process.env.POCKETBASE_IMAGE_COLLECTION ?? 'bottle_images';
const SECTION_COLLECTION = process.env.POCKETBASE_SECTION_COLLECTION ?? 'catalog_sections';
const BOTTLE_COLLECTION = process.env.POCKETBASE_BOTTLE_COLLECTION ?? 'bottles';
const ALIAS_COLLECTION = process.env.POCKETBASE_ALIAS_COLLECTION ?? 'bottle_aliases';

if (!pocketbaseUrl) throw new Error('POCKETBASE_URL is required');
if (!adminEmail) throw new Error('POCKETBASE_ADMIN_EMAIL is required');
if (!adminPassword) throw new Error('POCKETBASE_ADMIN_PASSWORD is required');

const FILE_FIELD = {
	name: 'image',
	type: 'file',
	required: true,
	presentable: true,
	options: {
		maxSelect: 1,
		maxSize: 52428800,
		mimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
		thumbs: [],
		protected: false
	}
};

const TEXT_REQUIRED = (name, max = 255) => ({
	name,
	type: 'text',
	required: true,
	presentable: true,
	max
});

const TEXT_OPTIONAL = (name, max = 255) => ({
	name,
	type: 'text',
	required: false,
	presentable: true,
	max
});

const NUMBER_OPTIONAL = (name) => ({
	name,
	type: 'number',
	required: false,
	presentable: true
});

function relationField(name, collectionId, maxSelect = 1) {
	return {
		name,
		type: 'relation',
		required: true,
		presentable: true,
		collectionId,
		cascadeDelete: true,
		minSelect: 1,
		maxSelect,
		displayFields: ['name']
	};
}

function optionalRelationField(name, collectionId, maxSelect = 1) {
	return {
		name,
		type: 'relation',
		required: false,
		presentable: true,
		collectionId,
		cascadeDelete: true,
		minSelect: 0,
		maxSelect,
		displayFields: ['name']
	};
}

async function ensureCollection(pb, name, definition) {
	try {
		const existing = await pb.collections.getOne(name);
		await pb.collections.update(existing.id, { fields: definition.fields });
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
			fields: definition.fields
		});
		return await pb.collections.getOne(name);
	}
}

async function main() {
	const pb = new PocketBase(pocketbaseUrl);
	await pb.collection('_superusers').authWithPassword(adminEmail, adminPassword);

	const imageCollection = await ensureCollection(pb, IMAGE_COLLECTION, {
		fields: [TEXT_REQUIRED('name'), TEXT_REQUIRED('slug'), FILE_FIELD]
	});

	const sectionCollection = await ensureCollection(pb, SECTION_COLLECTION, {
		fields: [
			TEXT_REQUIRED('name'),
			TEXT_REQUIRED('slug'),
			TEXT_REQUIRED('kind'),
			NUMBER_OPTIONAL('sortOrder'),
			TEXT_OPTIONAL('description', 2000)
		]
	});

	await ensureCollection(pb, BOTTLE_COLLECTION, {
		fields: [
			TEXT_REQUIRED('name'),
			TEXT_REQUIRED('slug'),
			TEXT_REQUIRED('brand'),
			TEXT_REQUIRED('category'),
			optionalRelationField('section', sectionCollection.id, 1),
			TEXT_OPTIONAL('subcategory'),
			TEXT_OPTIONAL('origin'),
			NUMBER_OPTIONAL('abv'),
			TEXT_OPTIONAL('description', 2000),
			relationField('image', imageCollection.id, 1)
		]
	});

	await ensureCollection(pb, ALIAS_COLLECTION, {
		fields: [
			relationField('bottle', (await pb.collections.getOne(BOTTLE_COLLECTION)).id, 1),
			TEXT_REQUIRED('alias')
		]
	});

	const image = await pb.collections.getOne(IMAGE_COLLECTION);
	const section = await pb.collections.getOne(SECTION_COLLECTION);
	const bottle = await pb.collections.getOne(BOTTLE_COLLECTION);
	const alias = await pb.collections.getOne(ALIAS_COLLECTION);

	console.log(
		JSON.stringify(
			{
				collections: [
					{ id: image.id, name: image.name, fields: image.fields.map((field) => field.name) },
					{
						id: section.id,
						name: section.name,
						fields: section.fields.map((field) => field.name)
					},
					{ id: bottle.id, name: bottle.name, fields: bottle.fields.map((field) => field.name) },
					{ id: alias.id, name: alias.name, fields: alias.fields.map((field) => field.name) }
				]
			},
			null,
			2
		)
	);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
