import PocketBase from 'pocketbase';

const pocketbaseUrl = process.env.POCKETBASE_URL;
const adminEmail = process.env.POCKETBASE_ADMIN_EMAIL;
const adminPassword = process.env.POCKETBASE_ADMIN_PASSWORD;
const collection = process.env.POCKETBASE_SECTION_COLLECTION ?? 'catalog_sections';

if (!pocketbaseUrl) throw new Error('POCKETBASE_URL is required');
if (!adminEmail) throw new Error('POCKETBASE_ADMIN_EMAIL is required');
if (!adminPassword) throw new Error('POCKETBASE_ADMIN_PASSWORD is required');

const sections = [
	{ name: 'Dry Martini', kind: 'cocktail', sortOrder: 10 },
	{ name: 'Old Fashioned Whiskey Cocktail', kind: 'cocktail', sortOrder: 20 },
	{ name: 'Manhattan Cocktail', kind: 'cocktail', sortOrder: 30 },
	{ name: 'Bijou', kind: 'cocktail', sortOrder: 40 },
	{ name: 'Negroni', kind: 'cocktail', sortOrder: 50 },
	{ name: 'French 75', kind: 'cocktail', sortOrder: 60 },
	{ name: 'Vesper', kind: 'cocktail', sortOrder: 70 },
	{ name: 'Gin Fizz', kind: 'cocktail', sortOrder: 80 },
	{ name: 'Sazerac', kind: 'cocktail', sortOrder: 90 },
	{ name: 'Margarita Cocktail', kind: 'cocktail', sortOrder: 100 },
	{ name: 'Double Take', kind: 'cocktail', sortOrder: 110 },
	{ name: 'Revelation', kind: 'cocktail', sortOrder: 120 },
	{ name: 'Paloma Brava', kind: 'cocktail', sortOrder: 130 },
	{ name: 'The Guild Daiquiri', kind: 'cocktail', sortOrder: 140 },
	{ name: 'Billionaire Cocktail', kind: 'cocktail', sortOrder: 150 },
	{ name: 'Havana Style Mojito', kind: 'cocktail', sortOrder: 160 },
	{ name: 'Solana Beach', kind: 'cocktail', sortOrder: 170 },
	{ name: 'Bloody Bull', kind: 'cocktail', sortOrder: 180 },
	{ name: 'Espresso Martini', kind: 'cocktail', sortOrder: 190 },
	{ name: 'Clean Sheet', kind: 'cocktail', sortOrder: 200 },
	{ name: 'False Promise', kind: 'cocktail', sortOrder: 210 },
	{ name: 'Sparkling and Rosé', kind: 'beverage', sortOrder: 300 },
	{ name: 'Bottled Beer', kind: 'beverage', sortOrder: 310 },
	{ name: 'Gin', kind: 'spirits', sortOrder: 400 },
	{ name: 'Vodka', kind: 'spirits', sortOrder: 410 },
	{ name: 'Tequila', kind: 'spirits', sortOrder: 420 },
	{ name: 'Mezcal', kind: 'spirits', sortOrder: 430 },
	{ name: 'Rum', kind: 'spirits', sortOrder: 440 },
	{ name: 'Whiskey', kind: 'spirits', sortOrder: 450 },
	{ name: 'Bourbon Whiskey', kind: 'spirits', sortOrder: 460 },
	{ name: 'Rye Whiskey', kind: 'spirits', sortOrder: 470 },
	{ name: 'Japanese Whiskey', kind: 'spirits', sortOrder: 480 }
];

function slugify(value) {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

async function main() {
	const pb = new PocketBase(pocketbaseUrl);
	await pb.collection('_superusers').authWithPassword(adminEmail, adminPassword);

	let created = 0;
	let updated = 0;

	for (const section of sections) {
		const slug = slugify(section.name);
		const existing = await pb.collection(collection).getFullList({
			filter: pb.filter('slug = {:slug}', { slug })
		});

		if (existing.length > 0) {
			await pb.collection(collection).update(existing[0].id, {
				name: section.name,
				slug,
				kind: section.kind,
				sortOrder: section.sortOrder,
				description: section.name
			});
			updated += 1;
			continue;
		}

		await pb.collection(collection).create({
			name: section.name,
			slug,
			kind: section.kind,
			sortOrder: section.sortOrder,
			description: section.name
		});
		created += 1;
	}

	console.log(JSON.stringify({ collection, created, updated, total: sections.length }, null, 2));
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
