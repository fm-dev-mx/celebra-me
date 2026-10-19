export const FAMILY_PRESENTATIONS = ['with-photo', 'text-only'] as const;

export type FamilyPresentation = (typeof FAMILY_PRESENTATIONS)[number];

export function shouldRenderFamilyMedia(
	presentation: FamilyPresentation | undefined,
	hasFeaturedImage: boolean,
): boolean {
	return presentation !== 'text-only' && hasFeaturedImage;
}

/** How flat `godparents` render: one row per person (default) or grouped under each role. */
export const FAMILY_GODPARENTS_LAYOUTS = ['by-role'] as const;

export type FamilyGodparentsLayout = (typeof FAMILY_GODPARENTS_LAYOUTS)[number];

export interface GodparentRoleGroup {
	role: string;
	members: Array<{ name: string; deceased?: boolean }>;
}

/**
 * Groups godparents by role in first-appearance order, keeping each person once under their own
 * role. Godparents without a role are grouped under an empty role, rendered without a label.
 */
export function groupGodparentsByRole(
	godparents: ReadonlyArray<{ name: string; role?: string; deceased?: boolean }>,
): GodparentRoleGroup[] {
	const groups = new Map<string, GodparentRoleGroup['members']>();
	for (const { name, role, deceased } of godparents) {
		const key = role?.trim() ?? '';
		const members = groups.get(key) ?? [];
		members.push(deceased ? { name, deceased } : { name });
		groups.set(key, members);
	}
	return Array.from(groups, ([role, members]) => ({ role, members }));
}
