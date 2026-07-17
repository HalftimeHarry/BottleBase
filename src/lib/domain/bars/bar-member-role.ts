export const BarMemberRole = {
	Owner: 'owner',
	Manager: 'manager',
	Bartender: 'bartender'
} as const;

export type BarMemberRole = (typeof BarMemberRole)[keyof typeof BarMemberRole];
