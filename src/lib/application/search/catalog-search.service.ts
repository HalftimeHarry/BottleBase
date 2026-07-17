import type { SearchDocument } from '$lib/domain/search/search-document';
import type { SearchService } from '$lib/domain/search/search-service';

export class CatalogSearchService {
	private readonly searchService: SearchService;

	public constructor(searchService: SearchService) {
		this.searchService = searchService;
	}

	public async search(query: string): Promise<readonly SearchDocument[]> {
		const cleaned = query.trim();
		if (!cleaned) {
			return [];
		}
		return this.searchService.search(cleaned, 30);
	}
}
