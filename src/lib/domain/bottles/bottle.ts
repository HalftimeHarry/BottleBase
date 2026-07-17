import { DomainError } from '../shared/domain-error';
import { BottleAlias } from './bottle-alias';
import { BottleVariant } from './bottle-variant';

export interface BottleProps {
	id: string;
	name: string;
	slug: string;
	brand: string;
	category: string;
	subcategory: string | null;
	origin: string | null;
	abv: number | null;
	description: string | null;
	image: string;
	aliases?: BottleAlias[];
	variants?: BottleVariant[];
}

export class Bottle {
	public readonly id: string;
	public readonly slug: string;
	public readonly brand: string;
	public readonly category: string;
	public readonly subcategory: string | null;
	public readonly origin: string | null;
	public readonly abv: number | null;
	public readonly description: string | null;
	public readonly image: string;
	private readonly aliases: BottleAlias[];
	private readonly variants: BottleVariant[];
	private _name: string;

	public constructor(props: BottleProps) {
		if (props.name.trim().length < 2) {
			throw new DomainError('Bottle name is too short');
		}
		if (!props.slug.trim()) {
			throw new DomainError('Bottle slug is required');
		}
		if (!props.image.trim()) {
			throw new DomainError('Bottle image reference is required');
		}

		this.id = props.id;
		this._name = props.name.trim();
		this.slug = props.slug.trim();
		this.brand = props.brand.trim();
		this.category = props.category.trim();
		this.subcategory = props.subcategory;
		this.origin = props.origin;
		this.abv = props.abv;
		this.description = props.description;
		this.image = props.image.trim();
		this.aliases = props.aliases ?? [];
		this.variants = props.variants ?? [];
	}

	public get name(): string {
		return this._name;
	}

	public rename(nextName: string): void {
		const trimmed = nextName.trim();
		if (trimmed.length < 2) {
			throw new DomainError('Bottle name is too short');
		}
		this._name = trimmed;
	}

	public getAliases(): readonly BottleAlias[] {
		return this.aliases;
	}

	public getVariants(): readonly BottleVariant[] {
		return this.variants;
	}

	public addAlias(alias: BottleAlias): void {
		this.aliases.push(alias);
	}

	public addVariant(variant: BottleVariant): void {
		this.variants.push(variant);
	}

	public matches(query: string): boolean {
		const normalized = query.trim().toLowerCase();
		if (!normalized) {
			return true;
		}

		return (
			this._name.toLowerCase().includes(normalized) ||
			this.brand.toLowerCase().includes(normalized) ||
			this.category.toLowerCase().includes(normalized) ||
			this.aliases.some((alias) => alias.matches(normalized))
		);
	}
}
