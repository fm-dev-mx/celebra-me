import { shouldHideRoleVisually } from '@/lib/invitation/family-helper';

describe('shouldHideRoleVisually', () => {
	it('returns false if role is missing', () => {
		expect(shouldHideRoleVisually('Mis padres')).toBe(false);
		expect(shouldHideRoleVisually('Padrinos', '')).toBe(false);
		expect(shouldHideRoleVisually('Padrinos', undefined)).toBe(false);
	});

	it('returns true for redundant parent roles under parent titles', () => {
		expect(shouldHideRoleVisually('Mis padres', 'Padre')).toBe(true);
		expect(shouldHideRoleVisually('Nuestros padres', 'Madre')).toBe(true);
		expect(shouldHideRoleVisually('Padres', 'Padre')).toBe(true);
		expect(shouldHideRoleVisually('Mis padres', 'madre')).toBe(true);
		expect(shouldHideRoleVisually('  Mis padres  ', '  Padre  ')).toBe(true);
	});

	it('returns true for redundant godparent roles under godparent titles', () => {
		expect(shouldHideRoleVisually('Padrinos', 'Padrino')).toBe(true);
		expect(shouldHideRoleVisually('Mis padrinos', 'Madrina')).toBe(true);
		expect(shouldHideRoleVisually('Nuestros padrinos', 'Padrino')).toBe(true);
		expect(shouldHideRoleVisually('Padrinos', 'madrina')).toBe(true);
		expect(shouldHideRoleVisually('  Padrinos  ', '  Padrino  ')).toBe(true);
	});

	it('returns false for roles that are not redundant under the group title', () => {
		expect(shouldHideRoleVisually('Hermanos', 'Hermano')).toBe(false);
		expect(shouldHideRoleVisually('Padrinos', 'Padre')).toBe(false);
		expect(shouldHideRoleVisually('Mis padres', 'Padrino')).toBe(false);
		expect(shouldHideRoleVisually('Tíos', 'Tío')).toBe(false);
	});
});
