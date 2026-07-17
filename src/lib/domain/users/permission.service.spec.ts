import { describe, expect, it } from 'vitest';
import { PermissionService } from './permission.service';
import { BarMemberRole } from '../bars/bar-member-role';

describe('PermissionService', () => {
	const service = new PermissionService();

	it('allows only owners to edit bar settings', () => {
		expect(service.canEditBarSettings(BarMemberRole.Owner)).toBe(true);
		expect(service.canEditBarSettings(BarMemberRole.Manager)).toBe(false);
		expect(service.canEditBarSettings(BarMemberRole.Bartender)).toBe(false);
	});

	it('allows owners and managers to manage inventory', () => {
		expect(service.canManageInventory(BarMemberRole.Owner)).toBe(true);
		expect(service.canManageInventory(BarMemberRole.Manager)).toBe(true);
		expect(service.canManageInventory(BarMemberRole.Bartender)).toBe(false);
	});
});
