export const InventoryMode = {
	Disabled: 'disabled',
	SimpleCounts: 'simple-counts',
	DetailedTracking: 'detailed-tracking'
} as const;

export type InventoryMode = (typeof InventoryMode)[keyof typeof InventoryMode];
