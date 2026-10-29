import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import yaml from 'yaml';

interface WorkspaceConfig {
	overrides?: Record<string, string>;
}

describe('Dependabot Development Dependency Overrides (d326)', () => {
	const workspacePath = resolve(process.cwd(), 'pnpm-workspace.yaml');
	const lockfilePath = resolve(process.cwd(), 'pnpm-lock.yaml');
	const workspaceContent = readFileSync(workspacePath, 'utf-8');
	const lockfileContent = readFileSync(lockfilePath, 'utf-8');
	const workspaceConfig = yaml.parse(workspaceContent) as WorkspaceConfig;
	const overrides = workspaceConfig.overrides ?? {};

	it('declares overrides for all targeted packages in pnpm-workspace.yaml', () => {
		expect(overrides['undici@>=6.0.0 <7.0.0']).toBe('>=6.29.1 <7.0.0');
		expect(overrides['undici@>=7.0.0 <8.0.0']).toBe('>=7.30.1 <8.0.0');
		expect(overrides['undici@>=8.0.0 <9.0.0']).toBe('>=8.12.2 <9.0.0');
		expect(overrides['js-yaml@>=3.0.0 <4.0.0']).toBe('>=3.15.2 <4.0.0');
		expect(overrides['js-yaml@>=4.0.0 <5.0.0']).toBe('>=4.3.2 <5.0.0');
		expect(overrides['markdown-it@>=15.0.0 <16.0.0']).toBe('>=15.0.3 <16.0.0');
		expect(overrides['immutable@>=5.0.0 <6.0.0']).toBe('>=5.1.8 <6.0.0');
		expect(overrides['brace-expansion@>=5.0.0 <6.0.0']).toBe('>=5.0.12 <6.0.0');
		expect(overrides['browserslist@>=4.0.0 <5.0.0']).toBe('>=4.28.7 <5.0.0');
		expect(overrides['smol-toml@>=1.0.0 <2.0.0']).toBe('>=1.9.0 <2.0.0');
		expect(overrides['baseline-browser-mapping@>=2.0.0 <3.0.0']).toBe('>=2.11.0 <3.0.0');
		expect(overrides['katex@<1.0.0']).toBe('>=0.18.2 <1.0.0');
	});

	it('enforces major-version bounds on every patched override (does not cross major)', () => {
		const majorBoundedOverrides = [
			overrides['undici@>=6.0.0 <7.0.0'],
			overrides['undici@>=7.0.0 <8.0.0'],
			overrides['undici@>=8.0.0 <9.0.0'],
			overrides['js-yaml@>=3.0.0 <4.0.0'],
			overrides['js-yaml@>=4.0.0 <5.0.0'],
			overrides['markdown-it@>=15.0.0 <16.0.0'],
			overrides['immutable@>=5.0.0 <6.0.0'],
			overrides['brace-expansion@>=5.0.0 <6.0.0'],
			overrides['browserslist@>=4.0.0 <5.0.0'],
			overrides['smol-toml@>=1.0.0 <2.0.0'],
			overrides['baseline-browser-mapping@>=2.0.0 <3.0.0'],
			overrides['katex@<1.0.0'],
		];

		for (const overrideValue of majorBoundedOverrides) {
			expect(overrideValue).toBeDefined();
			// All values must specify an upper bound preventing major version jump
			expect(overrideValue).toMatch(/<[0-9]+/);
		}
	});

	it('resolves locked versions at or above the minimum patched versions in pnpm-lock.yaml', () => {
		// Parse packages from pnpm-lock.yaml
		const parsedLockfile = yaml.parse(lockfileContent) as {
			packages?: Record<string, unknown>;
		};
		const packages = Object.keys(parsedLockfile.packages ?? {});

		const extractVersions = (pkgName: string): string[] => {
			const prefix = `${pkgName}@`;
			return packages
				.filter(
					(p) =>
						!p.startsWith('@types/') &&
						(p.startsWith(prefix) ||
							p.startsWith(`'${prefix}`) ||
							p.includes(`/${pkgName}@`)),
				)
				.map((p) => {
					const match = p.match(new RegExp(`(?:^|/)${pkgName}@([^()]+)`));
					return match ? match[1] : '';
				})
				.filter(Boolean);
		};

		const compareSemver = (v: string, min: string): boolean => {
			const vParts = v.split('.').map(Number);
			const minParts = min.split('.').map(Number);
			for (let i = 0; i < 3; i++) {
				const a = vParts[i] ?? 0;
				const b = minParts[i] ?? 0;
				if (a > b) return true;
				if (a < b) return false;
			}
			return true;
		};

		// Check undici versions
		const undiciVersions = extractVersions('undici');
		expect(undiciVersions.length).toBeGreaterThan(0);
		for (const v of undiciVersions) {
			if (v.startsWith('6.')) {
				expect(compareSemver(v, '6.29.1')).toBe(true);
			} else if (v.startsWith('7.')) {
				expect(compareSemver(v, '7.30.1')).toBe(true);
			} else if (v.startsWith('8.')) {
				expect(compareSemver(v, '8.12.2')).toBe(true);
			}
		}

		// Check js-yaml versions
		const jsYamlVersions = extractVersions('js-yaml');
		expect(jsYamlVersions.length).toBeGreaterThan(0);
		for (const v of jsYamlVersions) {
			if (v.startsWith('3.')) {
				expect(compareSemver(v, '3.15.2')).toBe(true);
			} else if (v.startsWith('4.')) {
				expect(compareSemver(v, '4.3.2')).toBe(true);
			}
		}

		// Check markdown-it
		const markdownItVersions = extractVersions('markdown-it');
		expect(markdownItVersions.length).toBeGreaterThan(0);
		for (const v of markdownItVersions) {
			if (v.startsWith('15.')) {
				expect(compareSemver(v, '15.0.3')).toBe(true);
			}
		}

		// Check immutable
		const immutableVersions = extractVersions('immutable');
		expect(immutableVersions.length).toBeGreaterThan(0);
		for (const v of immutableVersions) {
			if (v.startsWith('5.')) {
				expect(compareSemver(v, '5.1.8')).toBe(true);
			}
		}

		// Check brace-expansion
		const braceExpansionVersions = extractVersions('brace-expansion');
		expect(braceExpansionVersions.length).toBeGreaterThan(0);
		for (const v of braceExpansionVersions) {
			if (v.startsWith('5.')) {
				expect(compareSemver(v, '5.0.12')).toBe(true);
			}
		}

		// Check browserslist
		const browserslistVersions = extractVersions('browserslist');
		expect(browserslistVersions.length).toBeGreaterThan(0);
		for (const v of browserslistVersions) {
			if (v.startsWith('4.')) {
				expect(compareSemver(v, '4.28.7')).toBe(true);
			}
		}

		// Check smol-toml
		const smolTomlVersions = extractVersions('smol-toml');
		expect(smolTomlVersions.length).toBeGreaterThan(0);
		for (const v of smolTomlVersions) {
			if (v.startsWith('1.')) {
				expect(compareSemver(v, '1.9.0')).toBe(true);
			}
		}

		// Check baseline-browser-mapping
		const baselineVersions = extractVersions('baseline-browser-mapping');
		expect(baselineVersions.length).toBeGreaterThan(0);
		for (const v of baselineVersions) {
			if (v.startsWith('2.')) {
				expect(compareSemver(v, '2.11.0')).toBe(true);
			}
		}

		// Check katex
		const katexVersions = extractVersions('katex');
		expect(katexVersions.length).toBeGreaterThan(0);
		for (const v of katexVersions) {
			if (v.startsWith('0.')) {
				expect(compareSemver(v, '0.18.2')).toBe(true);
			}
		}
	});
});
