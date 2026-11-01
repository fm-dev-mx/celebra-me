import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { listInvitationDefinitions } from '../../scripts/provision/invitations/registry.ts';
import {
	CLIENT_INVITATIONS_DIR,
	listClientInvitationSlugs,
} from '../../scripts/shared/invitation-definition-files.ts';
import { resolveInvitationValidityWindow } from '../../src/lib/invitation/access/invitation-validity-window.ts';
import {
	DEMO_INVITATIONS_DIR,
	listDemoInvitationFiles,
} from '../../scripts/shared/demo-invitation-files.ts';

const PROFILES_DIR = path.join(process.cwd(), 'src/styles/invitation-profiles');

/**
 * Delivered profiles that predate the token-only rule. Each is a closed deliverable: it is not
 * edited, reused or extended, and it is deleted together with its invitation. Changing a digest
 * is a deliberate, reviewed exception. Never add an entry; new profiles must be token-only.
 */
const FROZEN_PROFILE_SHA256: Record<string, string> = {
	'abril-michelle-becerra-rea':
		'0d9b1d89193c3ac696604d98b7300ffe0c4785a87c66e3036d47a24f70ba8fdc',
	'alba-rosa-quinonez': '3ac7a0b5bc7bb3ea4d2f4b53c8f3db4478f38be7561fb009988e02aa73d61bcc',
	'allison-scarlett': '6d7212a2b87605534c3b11d5901f000f1c1492998edec25d6fdcebd236beda9a',
	'america-johana': '996031dc4049d002ba8d3957111f1a67cccb4bab215e1df85bd08f4cd5e297e5',
	'daniela-y-martin': '05642fcef87c9784e93dc617ba93293a12f9efbb55fa015094c25e8f174ab51a',
	'destenid-sofia': 'b52467805f54e12cad36aef31930d8b060cf7616f029f6af68cc0910d1fa7157',
	'leah-lexa': '111de6c9850ae7bad10045e42cdbf6e17faa42864f22e2f28765fae0e3080ffb',
	'leslie-perez': 'e215524f1f8f3a8c65b7382f90c2f51056b746843c8ecd1cb1d6f462160164c3',
	'luna-y-estrella': 'b20b5b032d972f15c07427a1d8d4746d2e3ffce3b27433e121ddd061e13799a4',
	'melissa-y-luis-osmar': '9e1a61418abf15a876f31326d73274dce270078b84f62a0453b563a323cf87ff',
	'naydelin-paredes': '0ec34ca3c58f968fc4ade0374ae66c3f21eb4f2d2cfa8d95fa9bc228a51ff446',
	'norma-hernandez': '53b57ed8ffbc94cd334d7a0118fb7fdb143c8c557687b3fa18a9e2ef4623dc19',
	renata: '78d653fbc45edaf22a37433a2a9c35f7fffc6e123b3f9acc094872c5afa5b1dd',
	'romina-rios-chaparro': '017e52614e9ca5f4111ef13d018e1466a2cff33258a61dded61d20c62a9d290f',
	'valentina-hernandez': '22d31e5071b86a5ecddeac75073d98ffbd0c0c768285d956d3597f1a6f4763bc',
	'victoria-y-roberto': 'c136bf2a53fe6e50871f8f4a0a6a269c362cff10c09f4c8dc72c14f8e43d1364',
	'xareni-iyarit': 'af48b689a3d9a0a488fe12c08a3908980264e8ed2052ad1087a27159387341c5',
};

/**
 * Published invitations whose definitions left the repository while they are still public. Their
 * profile stays (frozen above) until the validity window closes (event date + 1 year, end of day in
 * the event time zone; docs/core/invitation-creation-contract.md). Never add an entry: a definition
 * may only be retired after its invitation expires. Once an entry expires, delete it, its profile
 * and its frozen digest.
 */
const RETAINED_UNTIL_EXPIRY: Record<string, { eventDate: string; timeZone: string }> = {
	'america-johana': { eventDate: '2026-08-29', timeZone: 'America/Mexico_City' },
	'leah-lexa': { eventDate: '2026-06-21', timeZone: 'America/Mexico_City' },
	'luna-y-estrella': { eventDate: '2026-08-01', timeZone: 'America/Mexico_City' },
	'xareni-iyarit': { eventDate: '2026-09-12', timeZone: 'America/Mexico_City' },
};

/** Profile stylesheets by id: legacy client profiles in PROFILES_DIR, others in their folder. */
function profilePaths(): Map<string, string> {
	const paths = new Map<string, string>();
	for (const name of fs.readdirSync(PROFILES_DIR)) {
		if (name.endsWith('.scss') && !name.startsWith('_'))
			paths.set(name.replace(/\.scss$/u, ''), path.join(PROFILES_DIR, name));
	}
	for (const { slug, contentPath } of listDemoInvitationFiles()) {
		const profile = path.join(path.dirname(contentPath), 'profile.scss');
		if (fs.existsSync(profile)) paths.set(slug, profile);
	}
	for (const slug of listClientInvitationSlugs()) {
		const profile = path.join(CLIENT_INVITATIONS_DIR, slug, 'profile.scss');
		if (fs.existsSync(profile)) paths.set(slug, path.resolve(profile));
	}
	return new Map([...paths].sort(([a], [b]) => a.localeCompare(b)));
}

const PROFILE_PATHS = profilePaths();

function profileIds(): string[] {
	return [...PROFILE_PATHS.keys()];
}

function readProfile(id: string): string {
	const file = PROFILE_PATHS.get(id) ?? path.join(PROFILES_DIR, `${id}.scss`);
	return fs.readFileSync(file, 'utf8').replace(/\r\n/gu, '\n');
}

/** Visual profile id declared by each demo, keyed by demo slug. */
function demoProfilesBySlug(): Map<string, string> {
	return new Map(
		listDemoInvitationFiles().flatMap(({ slug, content }): [string, string][] =>
			typeof content.visualProfileId === 'string' ? [[slug, content.visualProfileId]] : [],
		),
	);
}

function demoProfileIds(): Set<string> {
	return new Set(demoProfilesBySlug().values());
}

const FONTS_DIR = path.join(process.cwd(), 'src/styles/fonts');

/** Wrapping at-rules a token-only profile may use; they scope tokens and emit no rules of their own. */
const ALLOWED_WRAPPING_AT_RULES = new Set(['media', 'supports', 'container']);

/** `@use` targets allowed in a token-only profile: shared modules that emit only `@font-face`. */
const ALLOWED_USE_TARGET = /^(?:\.\.\/fonts\/|\.\.\/\.\.\/\.\.\/styles\/fonts\/)([a-z0-9-]+)$/u;

const COMMENT_OR_STRING = /\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/gu;

/** Drop comments; blank string contents unless `keepStrings` (so `//` in URLs is not a comment). */
function sanitize(source: string, keepStrings = false): string {
	return source.replace(COMMENT_OR_STRING, (token) => {
		if (token.startsWith('/')) return '';
		return keepStrings ? token : '""';
	});
}

/** True when a font module emits nothing but `@font-face` blocks. */
function isFontFaceOnlyModule(name: string): boolean {
	const file = path.join(FONTS_DIR, `_${name}.scss`);
	if (!fs.existsSync(file)) return false;
	const rest = sanitize(fs.readFileSync(file, 'utf8'))
		.replace(/@font-face\s*\{[^{}]*\}/gu, '')
		.trim();
	return rest === '';
}

/**
 * Everything in a profile that is not a custom-property declaration: plain or interpolated
 * properties, `@include` (with or without a body), `@extend`, `@forward`, `@use` of anything but a
 * font-face-only module, and any other emitting or control at-rule. SCSS `$variables`, selectors
 * and the wrapping at-rules above are structure, not output, and stay allowed.
 */
function nonTokenDeclarations(source: string): string[] {
	const stripped = sanitize(source);
	const findings: string[] = [];

	for (const match of stripped.matchAll(/(?:^|[;{}])\s*([a-z-]+)\s*:(?!:)/gimu)) {
		if (!match[1].startsWith('--')) findings.push(match[1]);
	}
	for (const match of stripped.matchAll(
		/(?:^|[;{}])\s*([a-z-]*#\{[^}]*\}[\w-]*(?:#\{[^}]*\}[\w-]*)*)\s*:(?!:)/gimu,
	)) {
		findings.push(`interpolated property ${match[1]}`);
	}

	const useTargets = [...sanitize(source, true).matchAll(/@use\s+(['"])([^'"]+)\1/gu)].map(
		(match) => match[2],
	);
	for (const target of useTargets) {
		const font = target.match(ALLOWED_USE_TARGET);
		if (!font || !isFontFaceOnlyModule(font[1])) findings.push(`@use ${target}`);
	}

	for (const match of stripped.matchAll(/@([a-z-]+)/giu)) {
		const name = match[1].toLowerCase();
		if (name === 'use' || ALLOWED_WRAPPING_AT_RULES.has(name)) continue;
		findings.push(`@${name}`);
	}
	return findings;
}

/**
 * Positional selection in a profile: structural pseudo-classes and sibling combinators. A profile
 * that needs one item or one section treated apart sets an indexed token the owner exposes
 * (e.g. `--itinerary-paper-num-mask-<n>`, `--interlude-focal-point-<n>`) instead.
 */
function positionalSelectors(source: string): string[] {
	const stripped = sanitize(source);
	const findings: string[] = [];
	const pseudo = /:(nth-[a-z-]+|(?:first|last|only)-(?:child|of-type))\b/gu;
	for (const match of stripped.matchAll(pseudo)) {
		findings.push(`:${match[1]}`);
	}
	// Selector preludes: the text between a statement boundary and an opening brace.
	for (const match of stripped.matchAll(/(?<=^|[;{}])([^;{}]*)\{/gu)) {
		let selector = match[1];
		// `+`/`~` inside parentheses (`calc()`, `:not()`, media queries) are not combinators.
		for (let previous = ''; previous !== selector;) {
			previous = selector;
			selector = selector.replace(/\([^()]*\)/gu, '');
		}
		if (/(?:^|[^\s])\s*[+~]\s*[.#[:a-z*]/iu.test(selector)) {
			findings.push(`sibling combinator in ${match[1].trim()}`);
		}
	}
	return findings;
}

const STYLES_DIR = path.join(process.cwd(), 'src/styles');

/** A client profile loads its optional slug composition with exactly this first statement. */
const COMPOSITION_USE = /^\s*@use\s+(['"])\.\/composition\1\s*;/u;
const COMPOSITION_MAX_LINES = 600;
/** `@use` targets a slug composition may load: shared tools and font-face modules. */
const COMPOSITION_USE_TARGET =
	/^(?:\.\.\/){3}styles\/(?:tools\/[a-z0-9_/-]+|fonts\/[a-z0-9-]+)$|^sass:[a-z]+$/u;

/** Client profiles that load their composition, keyed by slug. */
function clientCompositions(): Map<string, string> {
	const compositions = new Map<string, string>();
	for (const slug of listClientInvitationSlugs()) {
		const file = path.resolve(CLIENT_INVITATIONS_DIR, slug, 'composition.scss');
		if (fs.existsSync(file)) compositions.set(slug, file);
	}
	return compositions;
}

/** Selector preludes of the outermost style rules; wrapping at-rules (`@media`, …) are transparent. */
function topLevelSelectors(source: string): string[] {
	const stripped = sanitize(source);
	const selectors: string[] = [];
	const openBlocks: boolean[] = [];
	let prelude = '';
	for (const char of stripped) {
		if (char === '{') {
			const head = prelude.trim();
			const atRule = head.startsWith('@');
			if (!atRule && openBlocks.every(Boolean)) selectors.push(head);
			openBlocks.push(atRule);
			prelude = '';
		} else if (char === '}') {
			openBlocks.pop();
			prelude = '';
		} else if (char === ';') {
			prelude = '';
		} else {
			prelude += char;
		}
	}
	return selectors;
}

/** Violations of the slug-composition limits (docs/core/invitation-creation-contract.md). */
function compositionViolations(slug: string, source: string): string[] {
	const findings: string[] = [];
	const lines = source.replace(/\r\n/gu, '\n').replace(/\n$/u, '').split('\n').length;
	if (lines > COMPOSITION_MAX_LINES) {
		findings.push(`${lines} lines (max ${COMPOSITION_MAX_LINES})`);
	}
	const withStrings = sanitize(source, true);
	if (withStrings.includes('invitation/scenes')) findings.push('reads invitation/scenes');
	for (const match of withStrings.matchAll(/@(use|forward|import)\s+(['"])([^'"]+)\2/gu)) {
		if (match[1] !== 'use' || !COMPOSITION_USE_TARGET.test(match[3])) {
			findings.push(`@${match[1]} ${match[3]}`);
		}
	}
	const scope = `.event--${slug}`;
	for (const selector of topLevelSelectors(source)) {
		for (const part of selector.split(',')) {
			const head = part.trim();
			const scoped = head.startsWith(scope) && !/^[a-z0-9-]/u.test(head.slice(scope.length));
			if (!scoped) findings.push(`unscoped selector ${head}`);
		}
	}
	return findings;
}

function scssFilesOutsideProfiles(dir: string): string[] {
	const files: string[] = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (full !== PROFILES_DIR) files.push(...scssFilesOutsideProfiles(full));
		} else if (entry.name.endsWith('.scss')) {
			files.push(full);
		}
	}
	return files;
}

describe('invitation profile boundary', () => {
	const ids = profileIds();
	const managedProfiles = new Set(
		listInvitationDefinitions()
			.map((definition) => definition.visualProfileId)
			.filter((id): id is string => typeof id === 'string'),
	);
	const demoProfiles = demoProfileIds();
	const retainedProfiles = new Set(Object.keys(RETAINED_UNTIL_EXPIRY));

	it('keeps retained profiles of retired definitions only until their invitation expires', () => {
		const now = new Date();
		for (const [id, { eventDate, timeZone }] of Object.entries(RETAINED_UNTIL_EXPIRY)) {
			const { expiresAt, expired } = resolveInvitationValidityWindow(
				eventDate,
				timeZone,
				now,
			);
			expect({ id, hasWindow: expiresAt !== null, expired }).toEqual({
				id,
				hasWindow: true,
				expired: false,
			});
			expect({ id, managed: managedProfiles.has(id), exists: ids.includes(id) }).toEqual({
				id,
				managed: false,
				exists: true,
			});
			expect({ id, frozen: id in FROZEN_PROFILE_SHA256 }).toEqual({ id, frozen: true });
		}
	});

	it('keeps every frozen profile byte-identical', () => {
		for (const [id, digest] of Object.entries(FROZEN_PROFILE_SHA256)) {
			const actual = createHash('sha256').update(readProfile(id)).digest('hex');
			expect({ id, digest: actual }).toEqual({ id, digest });
		}
	});

	it('restricts every other profile to token declarations', () => {
		const compositions = clientCompositions();
		for (const id of ids.filter((candidate) => !(candidate in FROZEN_PROFILE_SHA256))) {
			const source = compositions.has(id)
				? readProfile(id).replace(COMPOSITION_USE, '')
				: readProfile(id);
			expect({ id, nonToken: nonTokenDeclarations(source) }).toEqual({
				id,
				nonToken: [],
			});
		}
	});

	it('loads each slug composition from its profile and keeps it scoped and bounded', () => {
		for (const [slug, file] of clientCompositions()) {
			const profile = readProfile(slug);
			expect({ slug, loaded: COMPOSITION_USE.test(profile) }).toEqual({ slug, loaded: true });
			expect({
				slug,
				violations: compositionViolations(slug, fs.readFileSync(file, 'utf8')),
			}).toEqual({ slug, violations: [] });
		}
	});

	it('rejects out-of-bounds constructs in the composition detector', () => {
		const rule = (body: string) => `${body}\n.event--ana-lopez .hero { color: red; }\n`;
		const cases: Record<string, string> = {
			unscoped: '.hero { color: red; }',
			unscopedInMedia: '@media (width >= 40rem) { .hero { color: red; } }',
			otherInvitation: '.event--ana-lopez-2 .hero { color: red; }',
			sceneUse: "@use '../../../styles/invitation/scenes/lantern-route';",
			sharedUse: "@use '../../../styles/themes/sections/rsvp/base';",
			forward: "@forward '../../../styles/tools/functions';",
			tooLong: Array.from({ length: COMPOSITION_MAX_LINES }, () => '// line').join('\n'),
		};
		for (const [name, body] of Object.entries(cases)) {
			expect({
				name,
				rejected: compositionViolations('ana-lopez', rule(body)).length > 0,
			}).toEqual({ name, rejected: true });
		}
		expect(
			compositionViolations(
				'ana-lopez',
				[
					"@use 'sass:math';",
					"@use '../../../styles/tools/breakpoints' as bp;",
					'.event--ana-lopez .hero, .event--ana-lopez[data-variant] { color: red; }',
					'.event--ana-lopez { @media (width >= 40rem) { .hero { inset: 0; } } }',
					'@media (width >= 40rem) { .event--ana-lopez .hero { inset: 1rem; } }',
				].join('\n'),
			),
		).toEqual([]);
	});

	it('rejects every non-token construct in the token-only detector', () => {
		const wrap = (body: string) => `.event--x.theme-preset--y {\n\t--ok: 1px;\n${body}\n}\n`;
		const cases: Record<string, string> = {
			plainProperty: '\tcolor: red;',
			bodylessInclude: '\t@include hide-scrollbar;',
			includeWithBody: '\t@include respond-to(md) { --ok: 2px; }',
			extend: '\t@extend %card;',
			interpolatedProperty: '\t#{$prop}: red;',
			interpolatedCustomProperty: '\t--#{$name}: red;',
			partialUse: "@use './shared-profile';",
			forward: "@forward './shared-profile';",
			mixinDefinition: '@mixin skin { color: red; }',
		};
		for (const [name, body] of Object.entries(cases)) {
			expect({ name, rejected: nonTokenDeclarations(wrap(body)).length > 0 }).toEqual({
				name,
				rejected: true,
			});
		}

		const allowed = [
			"@use '../fonts/montserrat-italic-display' as display;",
			"@use '../../../styles/fonts/cinzel' as labels;",
			'$mask: url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\'/%3E");',
			wrap(
				'\t--mask: #{$mask};\n\t@media (width < 992px) { --ok: 2px; }\n\t.child { --ok: 3px; }',
			),
		].join('\n');
		expect(nonTokenDeclarations(allowed)).toEqual([]);
	});

	it('keeps positional selectors out of every non-frozen profile', () => {
		for (const id of ids.filter((candidate) => !(candidate in FROZEN_PROFILE_SHA256))) {
			expect({ id, positional: positionalSelectors(readProfile(id)) }).toEqual({
				id,
				positional: [],
			});
		}
	});

	it('rejects positional constructs in the positional detector', () => {
		const wrap = (body: string) => `.event--x.theme-preset--y {\n${body}\n}\n`;
		const cases = [
			'\t.row:nth-child(2) { --a: 1; }',
			'\t.row:nth-of-type(odd) { --a: 1; }',
			'\t.row:last-child { --a: 1; }',
			"\t.wrapper[data-kind='a'] + .wrapper[data-kind='b'] { --a: 1; }",
			"\t.wrapper[data-kind='a']\n\t\t~ .wrapper { --a: 1; }",
		];
		for (const body of cases) {
			expect({ body, rejected: positionalSelectors(wrap(body)).length > 0 }).toEqual({
				body,
				rejected: true,
			});
		}
		expect(
			positionalSelectors(
				wrap(
					"\t--a: calc(1rem + 2px);\n\t.wrapper[data-intersection-source='quote'] { --b: calc(100% - 1rem); }\n\t@media (width >= 40rem) { --c: calc(var(--d) + 1px); }",
				),
			),
		).toEqual([]);
	});

	it('keeps invitation identity selectors inside invitation profiles', () => {
		const offenders = scssFilesOutsideProfiles(STYLES_DIR).flatMap((file) =>
			[...sanitize(fs.readFileSync(file, 'utf8')).matchAll(/\.event--[a-z0-9-]+/gu)].map(
				(match) =>
					`${path.relative(process.cwd(), file).split(path.sep).join('/')}: ${match[0]}`,
			),
		);
		expect(offenders).toEqual([]);
	});

	it('restricts profile-directory partials to frozen or token-only content', () => {
		const partials = fs
			.readdirSync(PROFILES_DIR)
			.filter((name) => name.startsWith('_') && name.endsWith('.scss'));
		for (const name of partials) {
			const source = fs.readFileSync(path.join(PROFILES_DIR, name), 'utf8');
			const id = name.replace(/\.scss$/u, '');
			if (id in FROZEN_PROFILE_SHA256) continue;
			expect({ name, nonToken: nonTokenDeclarations(source) }).toEqual({
				name,
				nonToken: [],
			});
		}
	});

	it('gives every declared visual profile a stylesheet', () => {
		const dangling = [...managedProfiles].filter((id) => !ids.includes(id)).sort();

		expect(dangling).toEqual([]);
		for (const id of demoProfiles) {
			expect({ id, exists: ids.includes(id) }).toEqual({ id, exists: true });
		}
	});

	it('keeps no profile without a consumer', () => {
		for (const id of ids) {
			expect({
				id,
				consumed:
					managedProfiles.has(id) || demoProfiles.has(id) || retainedProfiles.has(id),
			}).toEqual({
				id,
				consumed: true,
			});
		}
	});

	it('styles demos only with demo-owned profiles', () => {
		for (const id of demoProfiles) {
			expect(id.startsWith('demo-')).toBe(true);
			expect(managedProfiles.has(id)).toBe(false);
		}
	});

	it('keeps each demo profile in the folder of the demo that declares it', () => {
		for (const [slug, id] of demoProfilesBySlug()) {
			expect({ slug, id }).toEqual({ slug, id: slug });
			expect(PROFILE_PATHS.get(id)).toBe(
				path.join(process.cwd(), DEMO_INVITATIONS_DIR, slug, 'profile.scss'),
			);
		}
	});
});
