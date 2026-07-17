import type { Bottle } from '$lib/domain/bottles/bottle';
import type { BottleRepository } from '$lib/domain/bottles/bottle.repository';

export class BottleReferenceService {
	private readonly bottles: BottleRepository;

	public constructor(bottles: BottleRepository) {
		this.bottles = bottles;
	}

	public async findBottleBySlug(slug: string): Promise<Bottle | null> {
		return this.bottles.findBySlug(slug);
	}

	public async searchBottles(query: string, limit = 24): Promise<readonly Bottle[]> {
		return this.bottles.search(query, limit);
	}
}
