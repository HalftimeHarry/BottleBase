import { InventoryMode } from './inventory-mode';

export class InventoryPolicy {
	public readonly mode: InventoryMode;
	public readonly allowDecimals: boolean;

	public constructor(mode: InventoryMode) {
		this.mode = mode;
		this.allowDecimals = mode !== InventoryMode.Disabled;
	}

	public isEnabled(): boolean {
		return this.mode !== InventoryMode.Disabled;
	}

	public supportsDetailedTracking(): boolean {
		return this.mode === InventoryMode.DetailedTracking;
	}
}
