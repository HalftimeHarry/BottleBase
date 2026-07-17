import { BarMemberRole } from './bar-member-role';

export class Bar {
	public readonly id: string;
	public readonly name: string;
	private readonly userRoles: Map<string, BarMemberRole>;

	public constructor(params: { id: string; name: string; userRoles?: Map<string, BarMemberRole> }) {
		this.id = params.id;
		this.name = params.name;
		this.userRoles = params.userRoles ?? new Map<string, BarMemberRole>();
	}

	public assignRole(userId: string, role: BarMemberRole): void {
		this.userRoles.set(userId, role);
	}

	public getRole(userId: string): BarMemberRole | null {
		return this.userRoles.get(userId) ?? null;
	}

	public canManageInventory(userId: string): boolean {
		const role = this.getRole(userId);
		return role === BarMemberRole.Owner || role === BarMemberRole.Manager;
	}
}
