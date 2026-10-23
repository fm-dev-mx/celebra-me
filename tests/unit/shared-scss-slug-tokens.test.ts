import fs from 'node:fs';
import path from 'node:path';

import { listInvitationDefinitions } from '../../scripts/provision/invitations/registry.ts';
import { listDemoInvitationFiles } from '../../scripts/shared/demo-invitation-files.ts';

/**
 * Shared SCSS never reads a token named after one invitation (`--america-night`): a value that
 * scenes or variants share uses `--scene-*` or the variant's own prefix, and the profile sets it
 * (docs/core/invitation-creation-contract.md, "Experimental variants").
 */
const STYLES_DIR = path.join(process.cwd(), 'src/styles');
const PROFILES_DIR = path.join(STYLES_DIR, 'invitation-profiles');

/** Every slug and visual profile id an invitation or demo can be known by. */
function invitationIdentities(): string[] {
	const identities = new Set<string>();
	for (const definition of listInvitationDefinitions()) {
		identities.add(definition.slug);
		if (typeof definition.visualProfileId === 'string') {
			identities.add(definition.visualProfileId);
		}
	}
	for (const { slug, content } of listDemoInvitationFiles()) {
		identities.add(slug);
		if (typeof content.visualProfileId === 'string') identities.add(content.visualProfileId);
	}
	for (const name of fs.readdirSync(PROFILES_DIR)) {
		if (name.endsWith('.scss') && !name.startsWith('_')) {
			identities.add(name.replace(/\.scss$/u, ''));
		}
	}
	return [...identities].sort();
}

function sharedScssFiles(dir: string): string[] {
	const files: string[] = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (full !== PROFILES_DIR) files.push(...sharedScssFiles(full));
		} else if (entry.name.endsWith('.scss')) {
			files.push(full);
		}
	}
	return files;
}

/** `--<identity>-*` tokens in a stylesheet, ignoring comments. */
function slugTokens(source: string, identities: readonly string[]): string[] {
	const stripped = source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/gu, '');
	const findings = new Set<string>();
	for (const match of stripped.matchAll(/--([a-z0-9]+(?:-[a-z0-9]+)*)/gu)) {
		const token = match[1];
		if (identities.some((identity) => token.startsWith(`${identity}-`))) {
			findings.add(`--${token}`);
		}
	}
	return [...findings];
}

describe('shared SCSS slug tokens', () => {
	const identities = invitationIdentities();

	it('knows the invitations it guards', () => {
		expect(identities).toEqual(expect.arrayContaining(['america', 'olivia-y-antonio']));
	});

	it('keeps --<slug>-* tokens out of shared stylesheets', () => {
		const offenders = sharedScssFiles(STYLES_DIR).flatMap((file) =>
			slugTokens(fs.readFileSync(file, 'utf8'), identities).map(
				(token) =>
					`${path.relative(process.cwd(), file).split(path.sep).join('/')}: ${token}`,
			),
		);
		expect(offenders).toEqual([]);
	});

	it('flags slug tokens and ignores scene tokens and comments', () => {
		const source = [
			'.scene { --route-night: var(--america-night, rgb(28 21 48)); }',
			'.scene { color: var(--scene-night, var(--olivia-y-antonio-ink)); }',
			'// --america-lantern is mentioned in a comment only',
			'/* --america-glow */',
		].join('\n');
		expect(slugTokens(source, ['america', 'olivia-y-antonio']).sort()).toEqual([
			'--america-night',
			'--olivia-y-antonio-ink',
		]);
	});
});
