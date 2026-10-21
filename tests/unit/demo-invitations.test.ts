import fs from 'node:fs';
import path from 'node:path';
import { DEMO_INVITATIONS } from '@/invitations/demos';
import {
	DEMO_INVITATIONS_DIR,
	listDemoInvitationFiles,
} from '../../scripts/shared/demo-invitation-files.ts';

const DEMOS_ROOT = path.resolve(process.cwd(), DEMO_INVITATIONS_DIR);

describe('demo invitation folders', () => {
	const files = listDemoInvitationFiles();

	it('lists every demo folder in the barrel exactly once', () => {
		const barrelSlugs = DEMO_INVITATIONS.map((demo) => demo.slug);
		expect(new Set(barrelSlugs).size).toBe(barrelSlugs.length);
		expect([...barrelSlugs].sort()).toEqual(files.map((file) => file.slug));
	});

	it('keeps each invitation.ts slug and eventType equal to its folder and content', () => {
		const filesBySlug = new Map(files.map((file) => [file.slug, file]));
		for (const demo of DEMO_INVITATIONS) {
			expect(filesBySlug.get(demo.slug)?.eventType).toBe(demo.eventType);
		}
	});

	it('gives every folder an invitation.ts and an asset manifest', () => {
		for (const { slug } of files) {
			for (const name of ['invitation.ts', 'assets.ts', 'assets']) {
				expect([slug, fs.existsSync(path.join(DEMOS_ROOT, slug, name))]).toEqual([
					slug,
					true,
				]);
			}
		}
	});
});
