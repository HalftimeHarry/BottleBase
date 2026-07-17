import type { ImportResult, ImportService } from '$lib/application/imports/import-service';

export class CsvImportService implements ImportService {
	public async import(source: string): Promise<ImportResult> {
		const rows = source.split(/\r?\n/).filter((line) => line.trim().length > 0);
		if (rows.length <= 1) {
			return { imported: 0, failed: 0, errors: [] };
		}

		return {
			imported: rows.length - 1,
			failed: 0,
			errors: []
		};
	}
}
