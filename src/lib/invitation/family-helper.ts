/**
 * Visual rendering rule helper for family roles.
 *
 * Prevents redundant rendering of individual role labels (e.g. "Madre", "Padre",
 * "Madrina", "Padrino") when the group title already expresses the category (e.g.
 * "Mis padres", "Padrinos").
 */
export function shouldHideRoleVisually(groupTitle: string, role?: string): boolean {
	if (!role) return false;

	const normalizedTitle = groupTitle.trim().toLowerCase();
	const normalizedRole = role.trim().toLowerCase();

	const parentsTitles = ['mis padres', 'nuestros padres', 'padres'];
	const godparentsTitles = ['padrinos', 'mis padrinos', 'nuestros padrinos'];

	const parentsRoles = ['madre', 'padre'];
	const godparentsRoles = ['madrina', 'padrino'];

	if (parentsTitles.includes(normalizedTitle) && parentsRoles.includes(normalizedRole)) {
		return true;
	}

	if (godparentsTitles.includes(normalizedTitle) && godparentsRoles.includes(normalizedRole)) {
		return true;
	}

	return false;
}
