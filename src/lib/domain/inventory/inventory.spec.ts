import { describe, expect, it } from 'vitest';
import { Inventory } from './inventory';
import { InventoryMode } from './inventory-mode';
import { ParLevel } from './par-level';

describe('Inventory', () => {
	it('normalizes current counts to the configured increment', () => {
		const parLevel = new ParLevel({
			countUnit: 'bottle',
			packageSize: 1,
			decimalIncrements: 0.5,
			parLevel: 4.5,
			reorderLevel: 2
		});

		const inventory = new Inventory({
			barBottleId: 'bb-1',
			mode: InventoryMode.SimpleCounts,
			current: 2.26,
			parLevel
		});

		expect(inventory.current).toBe(2.5);
	});

	it('marks inventory as below par and reorder level when current is low', () => {
		const parLevel = new ParLevel({
			countUnit: 'case',
			packageSize: 12,
			decimalIncrements: 0.5,
			parLevel: 3,
			reorderLevel: 1.5
		});

		const inventory = new Inventory({
			barBottleId: 'bb-2',
			mode: InventoryMode.SimpleCounts,
			current: 1,
			parLevel
		});

		expect(inventory.isBelowPar()).toBe(true);
		expect(inventory.needsReorder()).toBe(true);
	});
});
