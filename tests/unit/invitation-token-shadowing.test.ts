/**
 * invitation-token-shadowing.test.ts — Guards against base section styles silently ignoring
 * invitation profile tokens.
 *
 * A profile sets its tokens on the invitation wrapper (`.event--{slug}.theme-preset--{preset}`)
 * and section elements inherit them. When a base section declares a default for the same token on
 * its own selector (`.gifts-section { --gifts-title-letter-spacing: 0.15em; }`), that declaration
 * wins over the inherited value and the profile token does nothing. Base defaults belong in the
 * `var()` fallback at the point of use (`letter-spacing: var(--gifts-title-letter-spacing, 0.15em)`).
 *
 * The baseline lists the shadowed pairs that existed when the guard was introduced. It may only
 * shrink: a new pair fails, and so does a listed pair that no longer shadows anything.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PROFILES_DIR = path.join(ROOT, 'src/styles/invitation-profiles');
const BASE_DIRS = ['src/styles/invitation', 'src/styles/themes/sections'];
const BASELINE_PATH = path.join(ROOT, 'tests/fixtures/invitation-token-shadowing/baseline.json');

const PROFILE_ROOT_SELECTOR = /^\.event--([\w-]+)(?:\.theme-preset--([\w-]+))?$/u;
// Declarations on these selectors sit on (or above) the wrapper, so a profile token still wins.
const WRAPPER_LEVEL_SELECTOR =
	/^(?::root|html|body)\b|^\.theme-preset--[\w-]+$|event-theme-wrapper/u;

interface Declaration {
	token: string;
	/** Preludes of the enclosing blocks, outermost first. */
	chain: string[];
}

function listScss(dir: string): string[] {
	return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) return listScss(full);
		return entry.name.endsWith('.scss') ? [full] : [];
	});
}

/** Collects custom-property declarations with their block chain from SCSS source. */
function readDeclarations(source: string): Declaration[] {
	const text = source.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:])\/\/.*$/gmu, '$1');
	const declarations: Declaration[] = [];
	const stack: string[] = [];
	let buffer = '';
	let interpolationDepth = 0;
	for (let index = 0; index < text.length; index += 1) {
		const char = text[index];
		if (char === '#' && text[index + 1] === '{') {
			interpolationDepth += 1;
			buffer += '#{';
			index += 1;
		} else if (interpolationDepth > 0) {
			if (char === '}') interpolationDepth -= 1;
			buffer += char;
		} else if (char === '{') {
			stack.push(buffer.trim().replace(/\s+/gu, ' '));
			buffer = '';
		} else if (char === '}') {
			stack.pop();
			buffer = '';
		} else if (char === ';') {
			const match = buffer.trim().match(/^(--[\w-]+)\s*:/u);
			if (match && stack.length > 0)
				declarations.push({ token: match[1], chain: [...stack] });
			buffer = '';
		} else {
			buffer += char;
		}
	}
	return declarations;
}

interface ProfileTokens {
	preset: string | null;
	tokens: Set<string>;
}

function readProfiles(): Map<string, ProfileTokens> {
	const profiles = new Map<string, ProfileTokens>();
	for (const file of listScss(PROFILES_DIR)) {
		const id = path.basename(file, '.scss');
		if (id.startsWith('_')) continue;
		const profile: ProfileTokens = { preset: null, tokens: new Set() };
		for (const { token, chain } of readDeclarations(fs.readFileSync(file, 'utf8'))) {
			if (chain.length !== 1) continue;
			const match = chain[0].match(PROFILE_ROOT_SELECTOR);
			if (!match) continue;
			profile.preset ??= match[2] ?? null;
			profile.tokens.add(token);
		}
		profiles.set(id, profile);
	}
	return profiles;
}

interface BaseDeclaration {
	token: string;
	site: string;
	presets: string[];
}

function readBaseSectionDeclarations(): BaseDeclaration[] {
	return BASE_DIRS.flatMap((dir) => listScss(path.join(ROOT, dir))).flatMap((file) => {
		const relative = path.relative(ROOT, file).split(path.sep).join('/');
		return readDeclarations(fs.readFileSync(file, 'utf8')).flatMap(({ token, chain }) => {
			const selector = chain[0];
			if (selector.startsWith('@') || WRAPPER_LEVEL_SELECTOR.test(selector)) return [];
			const presets = [...selector.matchAll(/theme-preset--([\w-]+)/gu)].map((m) => m[1]);
			return [{ token, site: `${relative} (${selector})`, presets }];
		});
	});
}

/** Shadowed tokens per profile, with one base site per token for the failure message. */
function findShadowedTokens(): Map<string, Map<string, string>> {
	const base = readBaseSectionDeclarations();
	const shadowed = new Map<string, Map<string, string>>();
	for (const [id, profile] of readProfiles()) {
		for (const declaration of base) {
			if (!profile.tokens.has(declaration.token)) continue;
			// A preset-scoped section rule only reaches invitations on that preset.
			if (
				declaration.presets.length > 0 &&
				!declaration.presets.includes(profile.preset ?? '')
			)
				continue;
			const tokens = shadowed.get(id) ?? new Map<string, string>();
			if (!tokens.has(declaration.token)) tokens.set(declaration.token, declaration.site);
			shadowed.set(id, tokens);
		}
	}
	return shadowed;
}

function readBaseline(): Record<string, string[]> {
	return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')) as Record<string, string[]>;
}

describe('invitation profile tokens are not shadowed by base section defaults', () => {
	const shadowed = findShadowedTokens();
	const baseline = readBaseline();

	it('finds the profile wrapper tokens it guards', () => {
		const america = readProfiles().get('america');
		expect(america?.preset).toBe('storybook-lilac');
		expect(america?.tokens.has('--gifts-title-letter-spacing')).toBe(true);
	});

	it('adds no shadowed token beyond the baseline', () => {
		const added: string[] = [];
		for (const [id, tokens] of shadowed) {
			const allowed = new Set(baseline[id] ?? []);
			for (const [token, site] of tokens) {
				if (!allowed.has(token)) added.push(`${id}: ${token} is redeclared by ${site}`);
			}
		}
		expect(added).toEqual([]);
	});

	it('keeps the baseline free of pairs that no longer shadow anything', () => {
		const stale: string[] = [];
		for (const [id, tokens] of Object.entries(baseline)) {
			for (const token of tokens) {
				if (!shadowed.get(id)?.has(token)) stale.push(`${id}: ${token}`);
			}
		}
		expect(stale).toEqual([]);
	});

	it('lets the America gifts title tokens reach the section', () => {
		expect(shadowed.get('america')?.has('--gifts-title-letter-spacing') ?? false).toBe(false);
		expect(shadowed.get('america')?.has('--gifts-title-size') ?? false).toBe(false);
	});
});
