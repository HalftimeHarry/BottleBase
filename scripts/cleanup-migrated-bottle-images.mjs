import fs from 'node:fs/promises';
import path from 'node:path';

const PROJECT_ROOT = process.cwd();
const SOURCE_DIR = path.resolve(PROJECT_ROOT, 'static/temp');
const REPORT_PATH = path.resolve(PROJECT_ROOT, 'tmp/bottle-image-migration-report.json');
const dryRun = process.argv.includes('--dry-run');

async function main() {
	const reportText = await fs.readFile(REPORT_PATH, 'utf8');
	const report = JSON.parse(reportText);
	const uploaded = Array.isArray(report.uploaded) ? report.uploaded : [];

	if (uploaded.length === 0) {
		console.log('No uploaded files found in report. Nothing to delete.');
		return;
	}

	console.log(`Found ${uploaded.length} uploaded files in report.`);
	if (dryRun) {
		console.log('Dry run enabled, no files deleted.');
		return;
	}

	let deleted = 0;
	for (const filename of uploaded) {
		const target = path.join(SOURCE_DIR, filename);
		try {
			await fs.unlink(target);
			deleted += 1;
		} catch {
			// ignore missing files
		}
	}

	console.log(`Deleted ${deleted} files from static/temp.`);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
