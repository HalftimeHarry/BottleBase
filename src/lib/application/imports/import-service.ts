export interface ImportResult {
	readonly imported: number;
	readonly failed: number;
	readonly errors: readonly string[];
}

export interface ImportService {
	import(source: string): Promise<ImportResult>;
}
