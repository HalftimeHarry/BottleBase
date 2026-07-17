import { DomainError } from '../shared/domain-error';
import { InventoryMode } from './inventory-mode';
import type { ParLevel } from './par-level';

export interface InventoryProps {
	barBottleId: string;
	mode: InventoryMode;
	current: number;
	parLevel: ParLevel;
}

export class Inventory {
	public readonly barBottleId: string;
	public readonly mode: InventoryMode;
	public readonly parLevel: ParLevel;
	private currentValue: number;

	public constructor(props: InventoryProps) {
		if (props.current < 0) {
			throw new DomainError('Current inventory cannot be negative');
		}

		this.barBottleId = props.barBottleId;
		this.mode = props.mode;
		this.parLevel = props.parLevel;
		this.currentValue = this.parLevel.normalize(props.current);
	}

	public get current(): number {
		return this.currentValue;
	}

	public setCurrent(next: number): void {
		if (next < 0) {
			throw new DomainError('Current inventory cannot be negative');
		}
		this.currentValue = this.parLevel.normalize(next);
	}

	public adjustBy(delta: number): void {
		this.setCurrent(this.currentValue + delta);
	}

	public needsReorder(): boolean {
		return this.parLevel.needsReorder(this.currentValue);
	}

	public isBelowPar(): boolean {
		return this.parLevel.isBelowPar(this.currentValue);
	}
}
