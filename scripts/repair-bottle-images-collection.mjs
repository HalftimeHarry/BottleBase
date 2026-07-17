import PocketBase from 'pocketbase';

const pocketbaseUrl = process.env.POCKETBASE_URL;
const adminEmail = process.env.POCKETBASE_ADMIN_EMAIL;
const adminPassword = process.env.POCKETBASE_ADMIN_PASSWORD;
const collection = process.env.POCKETBASE_IMAGE_COLLECTION ?? 'bottle_images';

if (!pocketbaseUrl) throw new Error('POCKETBASE_URL is required');
if (!adminEmail) throw new Error('POCKETBASE_ADMIN_EMAIL is required');
if (!adminPassword) throw new Error('POCKETBASE_ADMIN_PASSWORD is required');

const REQUIRED_FIELDS = [
	{
		name: 'name',
		type: 'text',
		required: true,
		presentable: true,
		max: 255
	},
	{
		name: 'slug',
		type: 'text',
		required: true,
		presentable: true,
		max: 255
	},
	{
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
	}
];

async function main() {
	const pb = new PocketBase(pocketbaseUrl);
	await pb.collection('_superusers').authWithPassword(adminEmail, adminPassword);

	const existing = await pb.collections.getOne(collection);
	await pb.collections.update(existing.id, { fields: REQUIRED_FIELDS });

	const repaired = await pb.collections.getOne(collection);
	console.log(
		JSON.stringify(
			{
				id: repaired.id,
				name: repaired.name,
				fields: (repaired.fields ?? []).map((field) => ({ name: field.name, type: field.type }))
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
