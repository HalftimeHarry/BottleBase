import type { ImportResult, ImportService } from '$lib/application/imports/import-service';

export class LegacyImportService implements ImportService {
	public async import(source: string): Promise<ImportResult> {
		if (!source.trim()) {
			return { imported: 0, failed: 0, errors: ['Legacy source was empty'] };
		}

		return {
			imported: 1,
			failed: 0,
			errors: []
		};
	}
}
