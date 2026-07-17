import { DomainError } from '../shared/domain-error';

export class BottleVariant {
	public readonly sizeMl: number;
	public readonly upc: string | null;

	public constructor(params: { sizeMl: number; upc?: string | null }) {
		if (params.sizeMl <= 0) {
			throw new DomainError('Bottle variant size must be positive');
		}

		this.sizeMl = params.sizeMl;
		this.upc = params.upc ?? null;
	}
}
