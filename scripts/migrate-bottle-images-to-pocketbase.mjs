import fs from 'node:fs/promises';
import path from 'node:path';
import PocketBase from 'pocketbase';

const PROJECT_ROOT = process.cwd();
const SOURCE_DIR = path.resolve(PROJECT_ROOT, 'static/temp');
const REPORT_PATH = path.resolve(PROJECT_ROOT, 'tmp/bottle-image-migration-report.json');

const BLOCKED_KEYWORDS = ['food', 'dessert', 'desert'];
const EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

const pocketbaseUrl = process.env.POCKETBASE_URL;
const adminEmail = process.env.POCKETBASE_ADMIN_EMAIL;
const adminPassword = process.env.POCKETBASE_ADMIN_PASSWORD;
const collection = process.env.POCKETBASE_IMAGE_COLLECTION ?? 'bottle_images';
const dryRun = process.argv.includes('--dry-run');

function extensionToMime(filename) {
	const extension = path.extname(filename).toLowerCase();
	if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
	if (extension === '.webp') return 'image/webp';
	return 'image/png';
}

if (!pocketbaseUrl) throw new Error('POCKETBASE_URL is required');
if (!adminEmail) throw new Error('POCKETBASE_ADMIN_EMAIL is required');
if (!adminPassword) throw new Error('POCKETBASE_ADMIN_PASSWORD is required');

function normalizeSlug(input) {
	return input
		.toLowerCase()
		.replace(/\.[^.]+$/, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

function isBottleCandidate(filename) {
	const ext = path.extname(filename).toLowerCase();
	if (!EXTENSIONS.has(ext)) return false;
	const lower = filename.toLowerCase();
	return !BLOCKED_KEYWORDS.some((keyword) => lower.includes(keyword));
}

async function main() {
	const files = await fs.readdir(SOURCE_DIR);
	const candidates = files.filter(isBottleCandidate);

	console.log(`Found ${files.length} total files in static/temp`);
	console.log(`Filtered to ${candidates.length} bottle image candidates`);

	if (dryRun) {
		console.log('Dry run enabled, skipping uploads.');
		return;
	}

	const pb = new PocketBase(pocketbaseUrl);
	await pb.collection('_superusers').authWithPassword(adminEmail, adminPassword);
	await ensureCollection(pb);

	const uploaded = [];
	const failed = [];

	for (const filename of candidates) {
		const filePath = path.join(SOURCE_DIR, filename);
		const data = await fs.readFile(filePath);
		const slug = normalizeSlug(filename);
		const file = new File([data], filename, { type: extensionToMime(filename) });
		const body = {
			name: filename,
			slug,
			image: file
		};

		try {
			await pb.collection(collection).create(body);
			uploaded.push(filename);
			console.log(`Uploaded: ${filename}`);
		} catch (error) {
			failed.push({ filename, error: error instanceof Error ? error.message : String(error) });
			console.error(`Failed: ${filename}`);
		}
	}

	await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true });
	await fs.writeFile(
		REPORT_PATH,
		JSON.stringify(
			{
				createdAt: new Date().toISOString(),
				collection,
				totalFiles: files.length,
				candidateFiles: candidates.length,
				uploaded,
				failed
			},
			null,
			2
		),
		'utf8'
	);

	console.log(`Upload finished. Uploaded=${uploaded.length}, Failed=${failed.length}`);
	console.log(`Report written: ${REPORT_PATH}`);

	if (failed.length > 0) {
		process.exitCode = 1;
	}
}

async function ensureCollection(pb) {
	try {
		await pb.collections.getOne(collection);
		return;
	} catch (error) {
		const status =
			typeof error === 'object' && error !== null && 'status' in error
				? Number(error.status)
				: 0;
		const message = error instanceof Error ? error.message : String(error);
		const missingCollection =
			status === 404 || message.toLowerCase().includes('missing or invalid collection context');
		if (!missingCollection) {
			throw error;
		}
	}

	console.log(`Collection ${collection} not found, creating it...`);

	await pb.collections.create({
		name: collection,
		type: 'base',
		schema: [
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
		]
	});
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
