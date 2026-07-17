export interface SearchDocument {
	readonly id: string;
	readonly title: string;
	readonly type: 'bottle' | 'cocktail';
	readonly keywords: readonly string[];
}
