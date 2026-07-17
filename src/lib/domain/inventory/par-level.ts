import { DomainError } from '../shared/domain-error';

export type CountUnit = 'bottle' | 'case' | '6-pack' | '12-pack' | '24-pack' | 'keg';

export interface ParLevelProps {
	countUnit: CountUnit;
	packageSize: number;
	decimalIncrements: number;
	parLevel: number;
	reorderLevel: number;
}

export class ParLevel {
	public readonly countUnit: CountUnit;
	public readonly packageSize: number;
	public readonly decimalIncrements: number;
	public readonly parLevel: number;
	public readonly reorderLevel: number;

	public constructor(props: ParLevelProps) {
		if (props.packageSize <= 0) {
			throw new DomainError('Package size must be positive');
		}
		if (props.decimalIncrements <= 0) {
			throw new DomainError('Decimal increment must be positive');
		}
		if (props.parLevel < 0 || props.reorderLevel < 0) {
			throw new DomainError('Par and reorder levels cannot be negative');
		}

		this.countUnit = props.countUnit;
		this.packageSize = props.packageSize;
		this.decimalIncrements = props.decimalIncrements;
		this.parLevel = props.parLevel;
		this.reorderLevel = props.reorderLevel;
	}

	public needsReorder(current: number): boolean {
		return current <= this.reorderLevel;
	}

	public isBelowPar(current: number): boolean {
		return current < this.parLevel;
	}

	public normalize(value: number): number {
		const steps = Math.round(value / this.decimalIncrements);
		return steps * this.decimalIncrements;
	}
}
