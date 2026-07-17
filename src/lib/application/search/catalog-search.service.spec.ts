import { describe, expect, it } from 'vitest';
import { CatalogSearchService } from './catalog-search.service';
import { InMemorySearchService } from '$lib/infrastructure/search/in-memory-search.service';

describe('CatalogSearchService', () => {
	it('returns bottle and cocktail matches from search documents', async () => {
		const service = new CatalogSearchService(
			new InMemorySearchService([
				{
					id: 'bottle-1',
					title: 'Campari',
					type: 'bottle',
					keywords: ['aperitivo', 'bitter', 'italy']
				},
				{
					id: 'cocktail-1',
					title: 'Negroni',
					type: 'cocktail',
					keywords: ['campari', 'gin', 'vermouth']
				}
			])
		);

		const results = await service.search('campari');
		expect(results).toHaveLength(2);
	});
});
