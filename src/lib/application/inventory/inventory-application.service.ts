import type { Inventory } from '$lib/domain/inventory/inventory';

export class InventoryApplicationService {
	public buildInventorySummary(inventory: Inventory): {
		current: number;
		belowPar: boolean;
		needsReorder: boolean;
	} {
		return {
			current: inventory.current,
			belowPar: inventory.isBelowPar(),
			needsReorder: inventory.needsReorder()
		};
	}
}
