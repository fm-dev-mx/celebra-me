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

function validPackage(): InvitationPackageData {
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
			clientEmail: '',
			clientWhatsapp: '',
			photosReceived: true,
			snapshot: {},
		},
		draft: { status: 'draft', content: {} },
		publishedContent: { content: {} },
		event: { title: 'Fixture', eventType: 'xv', status: 'published' },
		assets: [],
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

describe('managed invitation package input integration', () => {
	it('uses an in-memory package exported from the managed definition', async () => {
		const pkg = validPackage();
		const exportPackage = jest.fn(async () => ({
			packageData: pkg,
			stats: { packageHash: pkg.packageHash },
		}));
		const result = await resolveInvitationPackageInput({
			slug: 'fixture',
			sourceDir: 'assets/fixture',
			exportPackage: exportPackage as never,
		});
		expect(result.source).toBe('managed-definition');
		expect(result.packageData.packageHash).toBe(pkg.packageHash);
	});

	it('loads and validates an immutable file package', async () => {
		const pkg = validPackage();
		const path = fixtureFile(JSON.stringify(pkg));
		const result = await resolveInvitationPackageInput({ slug: 'fixture', packagePath: path });
		expect(result.source).toBe('file-package');
		expect(result.packagePath).toBe(path);
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
		const error = await resolveInvitationPackageInput({ slug: 'fixture', packagePath }).catch(
			(caught: unknown) => caught,
		);
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
