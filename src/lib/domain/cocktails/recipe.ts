import type { Ingredient } from './ingredient';

export class Recipe {
	private readonly ingredients: Ingredient[];

	public constructor(ingredients: Ingredient[]) {
		this.ingredients = ingredients;
	}

	public getIngredients(): readonly Ingredient[] {
		return this.ingredients;
	}

	public usesBottle(bottleId: string): boolean {
		return this.ingredients.some((ingredient) => ingredient.bottleId === bottleId);
	}
}
