/**
 * Rollout registry integrity for hosted migration candidates.
 *
 * Policy: every non-synthetic registry migration key must have a matching SQL file.
 * Hosted apply fail-closes on unspecified phase (covered by compatibility unit tests).
 * This suite keeps registry ↔ filesystem synchronized for declared hosted candidates.
 */
import { describe, expect, it } from '@jest/globals';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('migration-rollout-registry integrity', () => {
	const registryPath = resolve(process.cwd(), 'supabase/migration-rollout-registry.json');
	const migrationsDir = resolve(process.cwd(), 'supabase/migrations');

	it('loads a valid registry with phase metadata', () => {
		const registry = JSON.parse(readFileSync(registryPath, 'utf8')) as {
			migrations: Record<
				string,
				{ phase: string; provides?: string[]; requiresDeployedAppCapabilities?: string[] }
			>;
		};
		expect(registry.migrations).toBeTruthy();
		const phases = new Set(['expand', 'neutral', 'contract']);
		for (const [key, entry] of Object.entries(registry.migrations)) {
			expect(phases.has(entry.phase)).toBe(true);
			if (key.startsWith('__')) continue;
			expect(key).toMatch(/^\d{14}$/);
		}
	});

	it('every concrete registry migration has a matching SQL file', () => {
		const registry = JSON.parse(readFileSync(registryPath, 'utf8')) as {
			migrations: Record<string, { phase: string }>;
		};
		const files = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql'));
		for (const version of Object.keys(registry.migrations)) {
			if (version.startsWith('__')) continue;
			const hit = files.some((name) => name.startsWith(`${version}_`));
			expect({ version, hit }).toEqual({ version, hit: true });
			expect(
				existsSync(
					resolve(
						migrationsDir,
						files.find((name) => name.startsWith(`${version}_`))!,
					),
				),
			).toBe(true);
		}
	});

	it('registers preview_approval_artifacts expand migration', () => {
		const registry = JSON.parse(readFileSync(registryPath, 'utf8')) as {
			migrations: Record<string, { phase: string; provides?: string[] }>;
		};
		expect(registry.migrations['20260806120000']).toMatchObject({
			phase: 'expand',
			provides: expect.arrayContaining(['preview_approval_artifacts']),
		});
		expect(
			existsSync(resolve(migrationsDir, '20260806120000_preview_approval_artifacts.sql')),
		).toBe(true);
	});

	it('registers the Valentina Memories contract migrations with explicit revocations', () => {
		const registry = JSON.parse(readFileSync(registryPath, 'utf8')) as {
			migrations: Record<
				string,
				{ phase: string; provides?: string[]; revokes?: string[] }
			>;
		};
		for (const version of [
			'20260828000000',
			'20260829000100',
			'20260829000200',
			'20260829171814',
		]) {
			expect(registry.migrations[version]).toMatchObject({
				phase: 'contract',
				provides: expect.any(Array),
				revokes: expect.any(Array),
			});
			expect(registry.migrations[version]?.provides).not.toHaveLength(0);
			expect(registry.migrations[version]?.revokes).not.toHaveLength(0);
		}
	});
});
