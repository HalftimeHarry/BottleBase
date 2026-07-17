import type { SearchDocument } from '$lib/domain/search/search-document';
import type { SearchService } from '$lib/domain/search/search-service';

export class InMemorySearchService implements SearchService {
	private readonly documents: SearchDocument[];

	public constructor(documents: SearchDocument[]) {
		this.documents = documents;
	}

	public async search(query: string, limit = 30): Promise<readonly SearchDocument[]> {
		const normalized = query.toLowerCase();
		const results = this.documents.filter((doc) => {
			if (doc.title.toLowerCase().includes(normalized)) {
				return true;
			}
			return doc.keywords.some((keyword) => keyword.toLowerCase().includes(normalized));
		});
		return results.slice(0, limit);
	}
}
