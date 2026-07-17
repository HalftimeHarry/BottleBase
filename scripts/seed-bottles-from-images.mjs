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

const CATEGORY_SECTION_MAP = [
	['cocktail', /martini|old fashioned|manhattan|bijou|negroni|french 75|vesper|gin fizz|sazerac|margarita|daiquiri|billionaire|mojito|paloma|bloody bull|espresso martini|clean sheet|false promise|double take|revelation|solana beach/i, 'cocktails'],
	['beer', /brewing|beer|lager|ipa|stout|pilsner|hefeweizen|amber ale|na|ro?se|sparkling|prosecco|cuvee|chardonnay|merlot|sauvignon blanc|pinot noir|pinot grigio|riesling/i, 'beverages'],
	['vodka', /vodka/i, 'vodka'],
	['gin', /gin|botanist|beefeater|bombay|hendricks|hendricks|condesa|junipero|roku|monkey 47|empress/i, 'gin'],
	['tequila', /arette|cascahuin|don fulano|fortaleza|g4|lalo|patron|siembra|mijenta|mero mero|vago|ocho|cimarron/i, 'tequila'],
	['mezcal', /dixeebe|agua del sol|siete misterios|derrumbes|machetazo|vago|vida mezcal|mezcal/i, 'mezcal'],
	['rum', /rum|plantation|planterey|planteray|bacardi|smith & cross|worthy park|diplomatico|ron del barrilito|carta blanca/i, 'rum'],
	['whiskey', /whiskey|whisky|bourbon|rye|michter|mitcher|weller|angel.?s envy|blanton|buffalo trace|eagle rare|stagg|four roses|woodford|horse soldier|high west|pinhook|tincup|makers mark|maker's mark|rowan|noah|rittenhouse|lagavulin|laphroaig|macallan|oban|talisker|hakushu|nikka|suntory|kaiyo|shibui|johnny drum|germain|arran|dalmore|highland park|argonaut|bourbon/i, 'whiskey']
];

const BRAND_HINTS = [
	['Belvedere', 'Belvedere'],
	['Chopin', 'Chopin'],
	['Grey Goose', 'Grey Goose'],
	['Beefeater', 'Beefeater'],
	['Bombay', 'Bombay'],
	['Botanist', 'The Botanist'],
	['Empress', 'Empress 1908'],
	['Haku', 'Haku'],
	['Ketel One', 'Ketel One'],
	['Titos', 'Tito\'s'],
	['Junipero', 'Junipero'],
	['Monkey 47', 'Monkey 47'],
	['Rittenhouse', 'Rittenhouse'],
	['Makers Mark', 'Maker\'s Mark'],
	['Mitchers', 'Michter\'s'],
	['Mitcher\'s', 'Michter\'s'],
	['W.L. Weller', 'W.L. Weller'],
	['Whistlepig', 'WhistlePig'],
	['Fierce & Kind', 'Fierce & Kind'],
	['Horse Soldier', 'Horse Soldier'],
	['Four Roses', 'Four Roses'],
	['High West', 'High West'],
	['Woodford', 'Woodford Reserve'],
	['Buffalo Trace', 'Buffalo Trace'],
	['Eagle Rare', 'Eagle Rare'],
	['Blanton', 'Blanton\'s'],
	['Angel', 'Angel\'s Envy'],
	['Dalmore', 'The Dalmore'],
	['Macallan', 'The Macallan'],
	['Hennessy', 'Hennessy'],
	['Remy Martin', 'Rémy Martin']
];

const ALIAS_EXTRAS = [
	['Mitcher’s', 'Michter\'s'],
	['Mitchers', 'Michter\'s'],
	['Makers', 'Maker\'s'],
	['Johnny Walker', 'Johnnie Walker'],
	['Belvenie', 'Balvenie'],
	['Cimarron', 'Cimarrón'],
	['Planteray', 'Plantation'],
	['Planterey', 'Plantation'],
	['Fortaleza Winter Blend', 'Fortaleza Winter Blend'],
	['Fortaleza Reposado Winter Blend Tequila', 'Fortaleza Winter Blend']
];

function slugify(value) {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

function normalizeName(value) {
	return value
		.replace(/\s+/g, ' ')
		.replace(/\bTHE GUILD\b/gi, 'The Guild')
		.replace(/\bP I C K M E U P S\b/gi, 'Pick Me Ups')
		.replace(/\s+__\s+/g, ' ')
		.replace(/\s{2,}/g, ' ')
		.trim();
}

function stripEditionMarkers(name) {
	return name
		.replace(/\s+\d{4}$/g, '')
		.replace(/\s+\d+y(?:r)?$/i, '')
		.replace(/\s+\d+\s*\/?\s*\d*$/g, '')
		.replace(/\s+__.*$/g, '')
		.trim();
}

function inferSection(name) {
	for (const [category, pattern, sectionSlug] of CATEGORY_SECTION_MAP) {
		if (pattern.test(name)) {
			return { category, sectionSlug };
		}
	}
	return { category: 'other', sectionSlug: 'other' };
}

function inferBrand(name) {
	for (const [pattern, brand] of BRAND_HINTS) {
		if (name.toLowerCase().includes(pattern.toLowerCase())) {
			return brand;
		}
	}

	return name.split(' ')[0];
}

function buildAliases(name) {
	const aliases = new Set([name]);
	const stripped = stripEditionMarkers(name);
	aliases.add(stripped);

	for (const [pattern, alias] of ALIAS_EXTRAS) {
		if (name.toLowerCase().includes(pattern.toLowerCase())) {
			aliases.add(alias);
		}
	}

	return [...aliases].filter(Boolean);
}

function inferAbv(name) {
	const match = name.match(/(\d{1,3}(?:\.\d+)?)\s*%/);
	return match ? Number(match[1]) : null;
}

function inferDescription(name) {
	const short = stripEditionMarkers(name);
	return `${short} is part of the BottleBase bottle catalog.`;
}

async function main() {
	const pb = new PocketBase(pocketbaseUrl);
	await pb.collection('_superusers').authWithPassword(adminEmail, adminPassword);

	const sectionList = await pb.collection(SECTION_COLLECTION).getFullList({
		fields: 'id,name,slug,kind',
		sort: 'sortOrder,name'
	});
	const sectionBySlug = new Map(sectionList.map((section) => [section.slug, section]));

	const imageList = await pb.collection(IMAGE_COLLECTION).getFullList({
		fields: 'id,name,slug,image',
		sort: 'name'
	});

	let created = 0;
	let updated = 0;
	let aliasesCreated = 0;

	for (const image of imageList) {
		const normalized = normalizeName(image.name);
		const baseName = stripEditionMarkers(normalized);
		const { category, sectionSlug } = inferSection(baseName);
		const section = sectionBySlug.get(sectionSlug);
		const bottleSlug = slugify(baseName || normalized);
		const brand = inferBrand(baseName || normalized);
		const description = inferDescription(baseName || normalized);
		const abv = inferAbv(image.name);
		const aliases = buildAliases(normalized);

		const existing = await pb.collection(BOTTLE_COLLECTION).getFullList({
			filter: pb.filter('slug = {:slug}', { slug: bottleSlug }),
			fields: 'id,name,slug'
		});

		const payload = {
			name: baseName || normalized,
			slug: bottleSlug,
			brand,
			category,
			section: section ? section.id : null,
			subcategory: null,
			origin: null,
			abv,
			description,
			image: image.id
		};

		let bottleId;
		if (existing.length > 0) {
			await pb.collection(BOTTLE_COLLECTION).update(existing[0].id, payload);
			bottleId = existing[0].id;
			updated += 1;
		} else {
			const record = await pb.collection(BOTTLE_COLLECTION).create(payload);
			bottleId = record.id;
			created += 1;
		}

		const existingAliases = await pb.collection(ALIAS_COLLECTION).getFullList({
			filter: pb.filter('bottle = {:bottleId}', { bottleId }),
			fields: 'id,alias'
		});
		const existingAliasSet = new Set(existingAliases.map((alias) => alias.alias.toLowerCase()));

		for (const alias of aliases) {
			const normalizedAlias = alias.trim();
			if (!normalizedAlias || existingAliasSet.has(normalizedAlias.toLowerCase())) {
				continue;
			}
			await pb.collection(ALIAS_COLLECTION).create({ bottle: bottleId, alias: normalizedAlias });
			existingAliasSet.add(normalizedAlias.toLowerCase());
			aliasesCreated += 1;
		}
	}

	console.log(
		JSON.stringify(
			{
				imageCount: imageList.length,
				created,
				updated,
				aliasesCreated
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
