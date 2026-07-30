import {
	buildManagedHostEmail,
	isCanonicalHostLoginAlias,
	isManagedHostEmail,
	isValidHostLoginAliasInput,
	normalizeHostLoginAlias,
	parseHostLoginAlias,
} from '@/lib/auth/login-alias';

describe('canonical managed host alias', () => {
	it('normalizes case, accents, spaces, and punctuation once', () => {
		expect(normalizeHostLoginAlias('  Ábril Michelle--Becerra Réa  ')).toBe(
			'abril_michelle_becerra_rea',
		);
	});

	it('enforces canonical characters and length boundaries', () => {
		expect(isCanonicalHostLoginAlias('ab')).toBe(false);
		expect(isCanonicalHostLoginAlias('abc')).toBe(true);
		expect(isCanonicalHostLoginAlias('a'.repeat(60))).toBe(true);
		expect(isCanonicalHostLoginAlias('a'.repeat(61))).toBe(false);
		expect(isCanonicalHostLoginAlias('abril__becerra')).toBe(false);
		expect(isCanonicalHostLoginAlias('Abril-Becerra')).toBe(false);
	});

	it('accepts normalizeable alias input but rejects real emails', () => {
		expect(isValidHostLoginAliasInput('Abril Becerra')).toBe(true);
		expect(isValidHostLoginAliasInput('abril@example.com')).toBe(false);
		expect(() => parseHostLoginAlias('ab')).toThrow('Invalid managed host login alias');
	});

	it('builds and recognizes only the technical managed domain', () => {
		expect(buildManagedHostEmail('Álba Quiñónez')).toBe(
			'alba_quinonez@clientes.celebra.invalid',
		);
		expect(isManagedHostEmail('ALBA_QUINONES@clientes.celebra.invalid')).toBe(true);
		expect(isManagedHostEmail('alba@example.com')).toBe(false);
	});
});
