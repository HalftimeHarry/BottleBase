import type { Recipe } from './recipe';

export class Cocktail {
	public readonly id: string;
	public readonly name: string;
	public readonly isHouseCocktail: boolean;
	private readonly recipe: Recipe;

	public constructor(params: {
		id: string;
		name: string;
		recipe: Recipe;
		isHouseCocktail?: boolean;
	}) {
		this.id = params.id;
		this.name = params.name;
		this.recipe = params.recipe;
		this.isHouseCocktail = params.isHouseCocktail ?? false;
	}

	public usesBottle(bottleId: string): boolean {
		return this.recipe.usesBottle(bottleId);
	}
}
