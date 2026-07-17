export class Ingredient {
	public readonly bottleId: string;
	public readonly amount: number;
	public readonly unit: 'ml' | 'oz' | 'dash' | 'part';

	public constructor(params: { bottleId: string; amount: number; unit: 'ml' | 'oz' | 'dash' | 'part' }) {
		this.bottleId = params.bottleId;
		this.amount = params.amount;
		this.unit = params.unit;
	}
}
