export class BottleAlias {
	public readonly value: string;

	public constructor(value: string) {
		this.value = value.trim();
	}

	public matches(query: string): boolean {
		return this.value.toLowerCase().includes(query.trim().toLowerCase());
	}
}
