import { BarMemberRole } from '../bars/bar-member-role';

export class PermissionService {
	public canEditBarSettings(role: BarMemberRole): boolean {
		return role === BarMemberRole.Owner;
	}

	public canManageInventory(role: BarMemberRole): boolean {
		return role === BarMemberRole.Owner || role === BarMemberRole.Manager;
	}

	public canViewInventory(role: BarMemberRole): boolean {
		return (
			role === BarMemberRole.Owner ||
			role === BarMemberRole.Manager ||
			role === BarMemberRole.Bartender
		);
	}
}
