import { DomainError } from '../shared/domain-error';

export class BarBottle {
	public readonly id: string;
	public readonly barId: string;
	public readonly bottleId: string;
	public readonly location: string | null;
	public readonly notes: string | null;
	public readonly price: number | null;
	private displayNameValue: string;
	private visible: boolean;

	public constructor(params: {
		id: string;
		barId: string;
		bottleId: string;
		displayName: string;
		location?: string | null;
		notes?: string | null;
		price?: number | null;
		isVisible?: boolean;
	}) {
		if (!params.displayName.trim()) {
			throw new DomainError('Display name is required');
		}

		this.id = params.id;
		this.barId = params.barId;
		this.bottleId = params.bottleId;
		this.displayNameValue = params.displayName.trim();
		this.location = params.location ?? null;
		this.notes = params.notes ?? null;
		this.price = params.price ?? null;
		this.visible = params.isVisible ?? true;
	}

	public get displayName(): string {
		return this.displayNameValue;
	}

	public isVisible(): boolean {
		return this.visible;
	}

	public rename(displayName: string): void {
		if (!displayName.trim()) {
			throw new DomainError('Display name is required');
		}
		this.displayNameValue = displayName.trim();
	}

	public hide(): void {
		this.visible = false;
	}

	public show(): void {
		this.visible = true;
	}
}
