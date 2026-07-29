import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	PackageInputError,
	resolveInvitationPackageInput,
} from '../../scripts/provision/invitation-package-input.ts';
import {
	computePackageHash,
	type InvitationPackageData,
} from '../../scripts/provision/invitation-package.ts';

const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

function validPackage(overrides?: Partial<InvitationPackageData>): InvitationPackageData {
	const hash = 'a'.repeat(64);
	const payload: Omit<InvitationPackageData, 'packageHash'> = {
		schemaVersion: '2.0.0',
		sourceHash: hash,
		metadataHash: hash,
		projectionHash: 'b'.repeat(32),
		assetManifestHash: hash,
		definitionCreatedAt: '2026-07-23T00:00:00.000Z',
		sourceSlug: 'fixture',
		invitation: {
			slug: 'fixture',
			title: 'Fixture',
			eventType: 'xv',
			baseDemoId: 'demo',
			themeId: 'theme',
			visualProfileId: 'profile',
			kind: 'client',
			clientName: 'Fixture',
			hostLoginAlias: 'fixture',
			clientEmail: '',
			clientWhatsapp: '',
			photosReceived: true,
			snapshot: {},
		},
		draft: { status: 'draft', content: {} },
		publishedContent: { content: {} },
		event: { title: 'Fixture', eventType: 'xv', status: 'published' },
		assets: [],
		...overrides,
	};
	return { ...payload, packageHash: computePackageHash(payload) };
}

function fixtureFile(contents: string): string {
	const dir = mkdtempSync(join(tmpdir(), 'package-input-'));
	dirs.push(dir);
	const path = join(dir, 'package.json');
	writeFileSync(path, contents);
	return path;
}

function matchingExport(pkg: InvitationPackageData) {
	return jest.fn(async () => ({
		packageData: pkg,
		packagePath: null,
		stats: {
			slug: pkg.sourceSlug,
			assetCount: 0,
			totalBytes: 0,
			hasPublishedContent: true as const,
			packageHash: pkg.packageHash,
		},
	}));
}

describe('managed invitation package input integration', () => {
	it('uses an in-memory package exported from the managed definition', async () => {
		const pkg = validPackage();
		const exportPackage = matchingExport(pkg);
		const result = await resolveInvitationPackageInput({
			slug: 'fixture',
			sourceDir: 'assets/fixture',
			exportPackage: exportPackage as never,
		});
		expect(result.source).toBe('managed-definition');
		expect(result.packageData.packageHash).toBe(pkg.packageHash);
	});

	it('loads and validates an immutable file package when sourceHash matches the definition', async () => {
		const pkg = validPackage();
		const path = fixtureFile(JSON.stringify(pkg));
		const result = await resolveInvitationPackageInput({
			slug: 'fixture',
			packagePath: path,
			exportPackage: matchingExport(pkg) as never,
		});
		expect(result.source).toBe('file-package');
		expect(result.packagePath).toBe(path);
		expect(result.definitionSourceHash).toBe(pkg.sourceHash);
	});

	it('blocks a stale file package whose sourceHash differs from the current definition', async () => {
		const pkg = validPackage();
		const path = fixtureFile(JSON.stringify(pkg));
		const live = validPackage({ sourceHash: 'c'.repeat(64) });
		const error = await resolveInvitationPackageInput({
			slug: 'fixture',
			packagePath: path,
			exportPackage: matchingExport(live) as never,
		}).catch((caught: unknown) => caught);
		expect(error).toBeInstanceOf(PackageInputError);
		expect(error).toMatchObject({ code: 'PACKAGE_STALE' });
	});

	it('allows an intentional stale package with allowStalePackage', async () => {
		const pkg = validPackage();
		const path = fixtureFile(JSON.stringify(pkg));
		const live = validPackage({ sourceHash: 'c'.repeat(64) });
		const result = await resolveInvitationPackageInput({
			slug: 'fixture',
			packagePath: path,
			allowStalePackage: true,
			exportPackage: matchingExport(live) as never,
		});
		expect(result.source).toBe('file-package');
		expect(result.packageData.sourceHash).toBe(pkg.sourceHash);
	});

	it.each([
		['missing package', 'missing', 'PACKAGE_NOT_FOUND'],
		['invalid JSON', 'json', 'PACKAGE_INVALID'],
		['invalid integrity hash', 'hash', 'PACKAGE_INVALID'],
	])('blocks %s with an explicit safe code', async (_name, fixture, code) => {
		const packagePath =
			fixture === 'missing'
				? join(tmpdir(), 'missing-managed-package.json')
				: fixture === 'json'
					? fixtureFile('{invalid')
					: fixtureFile(
							JSON.stringify({ ...validPackage(), packageHash: 'f'.repeat(64) }),
						);
		const error = await resolveInvitationPackageInput({
			slug: 'fixture',
			packagePath,
			exportPackage: matchingExport(validPackage()) as never,
		}).catch((caught: unknown) => caught);
		expect(error).toBeInstanceOf(PackageInputError);
		expect(error).toMatchObject({ code });
	});

	it('rejects simultaneous source and package inputs before reading either', async () => {
		await expect(
			resolveInvitationPackageInput({
				slug: 'fixture',
				sourceDir: 'assets/fixture',
				packagePath: 'fixture.json',
			}),
		).rejects.toMatchObject({ code: 'PACKAGE_SOURCE_CONFLICT' });
	});
});
