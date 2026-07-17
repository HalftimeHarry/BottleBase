import type { Bottle } from './bottle';

export interface BottleRepository {
	findById(id: string): Promise<Bottle | null>;
	findBySlug(slug: string): Promise<Bottle | null>;
	search(query: string, limit: number): Promise<readonly Bottle[]>;
}
