import type { SearchDocument } from './search-document';

export interface SearchService {
	search(query: string, limit?: number): Promise<readonly SearchDocument[]>;
}
