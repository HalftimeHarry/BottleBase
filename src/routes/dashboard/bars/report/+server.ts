import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import PocketBase from 'pocketbase';
import type { RequestHandler } from './$types';

type BottleRecord = {
	id: string;
	name: string;
	brand: string;
	category: string;
};

type BarRecord = {
	id: string;
	name: string;
};

type BarBottleRecord = {
	id: string;
	bar?: string;
	barId?: string;
	bottle?: string;
	bottleId?: string;
	displayName?: string;
	location?: string;
	locationType?: string;
	location_type?: string;
	currentCount?: number | string;
	current_count?: number | string;
	parLevel?: number | string;
	par_level?: number | string;
	reorderLevel?: number | string;
	reorder_level?: number | string;
};

type ReportRow = {
	displayName: string;
	location: string;
	locationType: string;
	currentCount: number;
	parLevel: number;
	reorderLevel: number;
};

type RowTone = 'main' | 'storage' | 'neutral';

type PrintableRow = {
	cells: [string, string, string];
	tone: RowTone;
};

function stripFileExtension(value: string): string {
	return value.replace(/\.[a-z0-9]{2,5}$/i, '');
}

function resolveReportBottleName(params: { bottleName?: string; displayName?: string }): string {
	const bottleName = stripFileExtension(params.bottleName?.trim() ?? '');
	if (bottleName) {
		return bottleName;
	}

	const displayName = stripFileExtension(params.displayName?.trim() ?? '');
	if (displayName) {
		return displayName;
	}

	return 'Unknown bottle';
}

const BOTTLE_COLLECTION = env.POCKETBASE_BOTTLE_COLLECTION ?? 'bottles';
const BAR_COLLECTION = env.POCKETBASE_BAR_COLLECTION ?? 'bars';
const BAR_BOTTLE_COLLECTION = env.POCKETBASE_BAR_BOTTLE_COLLECTION ?? 'bar_bottles';

function toNumber(value: string | number | undefined): number {
	if (typeof value === 'number') {
		return value;
	}
	if (!value) {
		return 0;
	}
	const parsed = Number(value);
	return Number.isNaN(parsed) ? 0 : parsed;
}

function readBarBottleCounts(item: BarBottleRecord) {
	return {
		currentCount: toNumber(item.currentCount ?? item.current_count),
		parLevel: toNumber(item.parLevel ?? item.par_level),
		reorderLevel: toNumber(item.reorderLevel ?? item.reorder_level)
	};
}

function readBarBottleMeta(item: BarBottleRecord) {
	return {
		location: item.location ?? '',
		locationType: item.locationType ?? item.location_type ?? 'backbar'
	};
}

function locationTypeLabel(type: string): string {
	switch (type) {
		case 'well':
			return 'Main Area';
		case 'backbar':
			return 'Main Area';
		case 'cold-storage':
			return 'Main Area';
		case 'overflow':
			return 'Storage Area';
		default:
			return type ? `${type} Area` : 'Unknown Area';
	}
}

function rowToneForLocationType(type: string): RowTone {
	if (type === 'overflow') {
		return 'storage';
	}
	if (type === 'well' || type === 'backbar' || type === 'cold-storage') {
		return 'main';
	}
	return 'neutral';
}

function textColorForTone(tone: RowTone): string {
	if (tone === 'storage') {
		return '0.106 0.369 0.125 rg';
	}
	if (tone === 'main') {
		return '0.051 0.278 0.631 rg';
	}
	return '0 g';
}

function escapePdfText(value: string): string {
	return value
		.replace(/\\/g, '\\\\')
		.replace(/\(/g, '\\(')
		.replace(/\)/g, '\\)')
		.replace(/\r|\n/g, ' ')
		.replace(/[^\x20-\x7E]/g, '');
}

function formatCount(value: number): string {
	if (Number.isInteger(value)) {
		return String(value);
	}
	return value.toFixed(2).replace(/\.00$/, '');
}

function fitText(value: string, maxChars: number): string {
	if (value.length <= maxChars) {
		return value;
	}
	if (maxChars <= 1) {
		return value.slice(0, 1);
	}
	return `${value.slice(0, maxChars - 1)}...`;
}

function buildPageContent(params: {
	title: string;
	subtitle: string;
	headers: string[];
	rows: PrintableRow[];
	pageNumber: number;
	totalPages: number;
}): string {
	const marginLeft = 36;
	const topY = 770;
	const tableTopY = 710;
	const rowHeight = 18;
	const colWidths = [170, 280, 92];
	const tableWidth = colWidths.reduce((total, current) => total + current, 0);
	const xPositions = [marginLeft];
	for (const width of colWidths) {
		xPositions.push(xPositions[xPositions.length - 1] + width);
	}

	const commands: string[] = [];
	commands.push('0 G');
	commands.push('0.5 w');

	commands.push(
		`BT /F1 14 Tf 1 0 0 1 ${marginLeft} ${topY} Tm (${escapePdfText(params.title)}) Tj ET`
	);
	commands.push(
		`BT /F1 10 Tf 1 0 0 1 ${marginLeft} ${topY - 18} Tm (${escapePdfText(params.subtitle)}) Tj ET`
	);
	commands.push(
		`BT /F1 9 Tf 1 0 0 1 ${marginLeft} ${topY - 34} Tm (Page ${params.pageNumber} of ${params.totalPages}) Tj ET`
	);

	const headerTop = tableTopY;
	const headerBottom = tableTopY - rowHeight;
	const tableBottom = headerBottom - rowHeight * params.rows.length;

	for (let i = 0; i <= params.rows.length + 1; i += 1) {
		const y = tableTopY - rowHeight * i;
		commands.push(`${marginLeft} ${y} m ${marginLeft + tableWidth} ${y} l S`);
	}
	for (const x of xPositions) {
		commands.push(`${x} ${headerTop} m ${x} ${tableBottom} l S`);
	}

	for (let i = 0; i < params.headers.length; i += 1) {
		const textX = xPositions[i] + 3;
		const textY = headerBottom + 5;
		commands.push(
			`BT /F1 9 Tf 1 0 0 1 ${textX} ${textY} Tm (${escapePdfText(params.headers[i])}) Tj ET`
		);
	}

	for (let rowIndex = 0; rowIndex < params.rows.length; rowIndex += 1) {
		const row = params.rows[rowIndex];
		const baselineY = headerBottom - rowHeight * rowIndex - 13;
		for (let col = 0; col < row.cells.length; col += 1) {
			const textX = xPositions[col] + 3;
			if (col === 0 || col === 2) {
				commands.push(textColorForTone(row.tone));
			} else {
				commands.push('0 g');
			}
			commands.push(
				`BT /F1 9 Tf 1 0 0 1 ${textX} ${baselineY} Tm (${escapePdfText(row.cells[col])}) Tj ET`
			);
		}
		commands.push('0 g');
	}

	return commands.join('\n');
}

function buildPdfDocument(pages: string[]): Uint8Array {
	const objects: string[] = [];
	const addObject = (body: string) => {
		objects.push(body);
		return objects.length;
	};

	const fontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
	const pagesId = addObject('');
	const catalogId = addObject('');
	const pageObjectIds: number[] = [];

	for (const content of pages) {
		const contentId = addObject(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
		const pageId = addObject(
			`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`
		);
		pageObjectIds.push(pageId);
	}

	objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageObjectIds
		.map((id) => `${id} 0 R`)
		.join(' ')}] /Count ${pageObjectIds.length} >>`;
	objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;

	let pdf = '%PDF-1.4\n';
	const offsets: number[] = [0];

	for (let i = 0; i < objects.length; i += 1) {
		offsets.push(pdf.length);
		pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
	}

	const xrefStart = pdf.length;
	pdf += `xref\n0 ${objects.length + 1}\n`;
	pdf += '0000000000 65535 f \n';
	for (let i = 1; i < offsets.length; i += 1) {
		pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
	}

	pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\n`;
	pdf += `startxref\n${xrefStart}\n%%EOF`;

	return new TextEncoder().encode(pdf);
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

export const GET: RequestHandler = async ({ url }) => {
	const selectedBarId = url.searchParams.get('bar')?.trim() ?? '';
	const selectedStorageFilter = url.searchParams.get('storage')?.trim() ?? '';

	if (!selectedBarId) {
		throw error(400, 'Bar ID is required to generate a report.');
	}

	const pb = await createAdminClient();
	if (!pb) {
		throw error(500, 'PocketBase admin credentials are required to generate reports.');
	}

	const [bar, bottles, barBottles] = await Promise.all([
		pb.collection(BAR_COLLECTION).getOne<BarRecord>(selectedBarId, { fields: 'id,name' }),
		pb.collection(BOTTLE_COLLECTION).getFullList<BottleRecord>({
			fields: 'id,name,brand,category',
			sort: 'name'
		}),
		pb.collection(BAR_BOTTLE_COLLECTION).getFullList<BarBottleRecord>({
			filter: `bar = "${selectedBarId}"`
		})
	]);

	const rows: ReportRow[] = barBottles
		.map((item) => {
			const bottleRef = item.bottle ?? item.bottleId ?? '';
			const bottle = bottles.find((candidate) => candidate.id === bottleRef);
			const counts = readBarBottleCounts(item);
			const meta = readBarBottleMeta(item);

			return {
				displayName: resolveReportBottleName({
					bottleName: bottle?.name,
					displayName: item.displayName
				}),
				location: meta.location || 'Unknown area',
				locationType: meta.locationType,
				currentCount: counts.currentCount,
				parLevel: counts.parLevel,
				reorderLevel: counts.reorderLevel
			};
		})
		.filter((item) => (selectedStorageFilter ? item.locationType === selectedStorageFilter : true))
		.sort((left, right) => {
			const areaCompare = left.location.localeCompare(right.location, undefined, {
				sensitivity: 'base',
				numeric: true
			});
			if (areaCompare !== 0) {
				return areaCompare;
			}

			const typeCompare = left.locationType.localeCompare(right.locationType, undefined, {
				sensitivity: 'base',
				numeric: true
			});
			if (typeCompare !== 0) {
				return typeCompare;
			}

			return left.displayName.localeCompare(right.displayName, undefined, {
				sensitivity: 'base',
				numeric: true
			});
		});

	const headers = ['Area', 'Bottle', 'Type'];
	const printableRows: PrintableRow[] = [];
	let currentAreaKey = '';
	let areaSubtotal = 0;
	let currentAreaTone: RowTone = 'neutral';

	for (const row of rows) {
		const areaTypeLabel = locationTypeLabel(row.locationType);
		const areaKey = `${row.location}::${areaTypeLabel}`;
		if (currentAreaKey && currentAreaKey !== areaKey) {
			const [lastArea, lastType] = currentAreaKey.split('::');
			printableRows.push({
				cells: [
					fitText(`${lastArea} (${lastType})`, 25),
					'Area subtotal',
					fitText(formatCount(areaSubtotal), 14)
				],
				tone: currentAreaTone
			});
			areaSubtotal = 0;
		}

		const tone = rowToneForLocationType(row.locationType);
		printableRows.push({
			cells: [
				fitText(`${row.location} (${formatCount(row.currentCount)})`, 25),
				fitText(row.displayName, 40),
				fitText(`${areaTypeLabel} (${formatCount(row.currentCount)})`, 14)
			],
			tone
		});
		areaSubtotal += row.currentCount;
		currentAreaKey = areaKey;
		currentAreaTone = tone;
	}

	if (currentAreaKey) {
		const [lastArea, lastType] = currentAreaKey.split('::');
		printableRows.push({
			cells: [
				fitText(`${lastArea} (${lastType})`, 25),
				'Area subtotal',
				fitText(formatCount(areaSubtotal), 14)
			],
			tone: currentAreaTone
		});
	}

	const rowsPerPage = 30;
	const pagedRows: PrintableRow[][] = [];
	for (let i = 0; i < printableRows.length; i += rowsPerPage) {
		pagedRows.push(printableRows.slice(i, i + rowsPerPage));
	}
	if (pagedRows.length === 0) {
		pagedRows.push([
			{ cells: ['No bottles found for this selection.', '', ''], tone: 'neutral' }
		]);
	}

	const filterLabel = selectedStorageFilter ? locationTypeLabel(selectedStorageFilter) : 'All areas';
	const title = `${bar.name} - Bottle Inventory Report`;
	const subtitle = `Filter: ${filterLabel} | Generated: ${new Date().toISOString().slice(0, 10)}`;

	const pageContents = pagedRows.map((pageRows, index) =>
		buildPageContent({
			title,
			subtitle,
			headers,
			rows: pageRows,
			pageNumber: index + 1,
			totalPages: pagedRows.length
		})
	);

	const pdfBytes = buildPdfDocument(pageContents);
	const pdfBuffer = new ArrayBuffer(pdfBytes.byteLength);
	new Uint8Array(pdfBuffer).set(pdfBytes);
	const filename = `${bar.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'bar'}-inventory-report.pdf`;

	return new Response(pdfBuffer, {
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': `attachment; filename="${filename}"`,
			'Cache-Control': 'no-store'
		}
	});
};
