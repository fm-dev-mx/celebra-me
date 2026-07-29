#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REQUIRED_SKILL_FIELDS = [
	'name',
	'description',
	'domain',
	'version',
	'when_to_use',
	'preconditions',
	'related_skills',
	'related_docs',
];
const PERMITTED_SKILL_DOMAINS = new Set([
	'frontend',
	'backend',
	'content',
	'workflow',
	'quality',
	'meta',
	'growth',
	'qa',
]);
const RECOGNIZED_PLAN_STATUSES = new Set([
	'draft',
	'active',
	'blocked',
	'implemented',
	'validated',
	'accepted',
	'deferred',
	'superseded',
	'archived',
	'final',
]);
const FORBIDDEN_TRACKED_DIRECTORIES = [
	'.astro',
	'.vercel',
	'coverage',
	'dist',
	'logs',
	'scratch',
	'screenshots',
	'temp',
	'test-results',
];

function normalizePath(file) {
	return file.replaceAll('\\', '/').replace(/^\.\//u, '');
}

function unquote(value) {
	const trimmed = value.trim();
	if (
		(trimmed.startsWith('"') && trimmed.endsWith('"')) ||
		(trimmed.startsWith("'") && trimmed.endsWith("'"))
	) {
		return trimmed.slice(1, -1);
	}
	return trimmed;
}

function parseTopLevelYaml(text) {
	const data = {};
	let currentKey = null;

	for (const line of text.split(/\r?\n/u)) {
		if (!line.trim() || line.trimStart().startsWith('#')) continue;

		const field = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):(?:\s*(.*))?$/u);
		if (field) {
			const [, key, rawValue = ''] = field;
			currentKey = key;
			const value = rawValue.trim();
			if (value === '[]') {
				data[key] = [];
			} else if (value === '|' || value === '>') {
				data[key] = '(block)';
			} else if (value) {
				data[key] = unquote(value);
			} else {
				data[key] = undefined;
			}
			continue;
		}

		const listItem = line.match(/^\s+-\s+(.+)$/u);
		if (listItem && currentKey) {
			if (!Array.isArray(data[currentKey])) data[currentKey] = [];
			data[currentKey].push(unquote(listItem[1]));
			continue;
		}

		if (currentKey && data[currentKey] === undefined && /^\s+\S/u.test(line)) {
			data[currentKey] = line.trim();
		}
	}

	return data;
}

function parseFrontmatter(content) {
	const lines = content.replace(/^\uFEFF/u, '').split(/\r?\n/u);
	if (lines[0] !== '---') return null;
	const closingIndex = lines.indexOf('---', 1);
	if (closingIndex === -1) return null;
	return parseTopLevelYaml(lines.slice(1, closingIndex).join('\n'));
}

function listFiles(directory, predicate = () => true) {
	if (!existsSync(directory)) return [];
	return readdirSync(directory, { withFileTypes: true })
		.filter((entry) => entry.isFile() && predicate(entry.name))
		.map((entry) => path.join(directory, entry.name))
		.sort();
}

function listSkillFiles(root) {
	const skillsRoot = path.join(root, '.agent', 'skills');
	if (!existsSync(skillsRoot)) return [];
	return readdirSync(skillsRoot, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => path.join(skillsRoot, entry.name, 'SKILL.md'))
		.filter((file) => existsSync(file))
		.sort();
}

function collectIndexSkillReferences(content) {
	const section = content.match(/## Available Skills\s+([\s\S]*?)(?=\n## |\s*$)/u)?.[1] ?? '';
	return [...section.matchAll(/^\|\s*`([^`]+)`\s*\|/gmu)].map((match) => match[1]);
}

function collectIndexMarkdownPaths(content) {
	const references = new Set();
	for (const match of content.matchAll(/\[[^\]]+\]\(([^)]+\.md(?:#[^)]*)?)\)/gu)) {
		references.add(match[1]);
	}
	for (const match of content.matchAll(/`((?:\.\.?\/)?(?:\.agent\/|docs\/)?[^`\s|+]*\.md)`/gu)) {
		references.add(match[1]);
	}
	return [...references];
}

function resolveIndexPath(root, indexFile, reference) {
	const cleanReference = reference.split('#', 1)[0];
	if (cleanReference.startsWith('../') || cleanReference.startsWith('./')) {
		return path.resolve(path.dirname(indexFile), cleanReference);
	}
	return path.resolve(root, cleanReference);
}

function getTrackedFiles(root) {
	const result = spawnSync('git', ['ls-files', '-z'], {
		cwd: root,
		encoding: 'utf8',
		maxBuffer: 10 * 1024 * 1024,
	});
	if (result.error) throw result.error;
	if ((result.status ?? 1) !== 0) {
		throw new Error(`git ls-files failed: ${result.stderr || result.stdout}`);
	}
	return String(result.stdout || '')
		.split('\0')
		.filter(Boolean)
		.map(normalizePath);
}

export function isForbiddenTrackedPath(file) {
	const normalized = normalizePath(file).toLowerCase();
	const segments = normalized.split('/');
	const basename = segments.at(-1) ?? '';

	if (FORBIDDEN_TRACKED_DIRECTORIES.includes(segments[0])) return true;
	if (basename === 'diff.txt' || basename === 'staged.diff') return true;
	return basename.endsWith('.log') || basename.endsWith('.tmp');
}

function validateSkills(root) {
	const errors = [];
	const skillFiles = listSkillFiles(root);
	const skillNames = new Set();
	const relatedSkillReferences = [];

	if (skillFiles.length === 0) {
		errors.push('No skills found under .agent/skills.');
	}

	for (const skillFile of skillFiles) {
		const relativeFile = normalizePath(path.relative(root, skillFile));
		const frontmatter = parseFrontmatter(readFileSync(skillFile, 'utf8'));
		if (!frontmatter) {
			errors.push(`${relativeFile}: missing YAML frontmatter.`);
			continue;
		}

		for (const field of REQUIRED_SKILL_FIELDS) {
			if (!(field in frontmatter) || frontmatter[field] === undefined) {
				errors.push(`${relativeFile}: missing required frontmatter field "${field}".`);
			}
		}

		const directoryName = path.basename(path.dirname(skillFile));
		if (frontmatter.name !== directoryName) {
			errors.push(`${relativeFile}: name must match directory "${directoryName}".`);
		}
		if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(String(frontmatter.name ?? ''))) {
			errors.push(`${relativeFile}: name must be kebab-case.`);
		}
		if (!PERMITTED_SKILL_DOMAINS.has(frontmatter.domain)) {
			errors.push(`${relativeFile}: domain "${frontmatter.domain ?? ''}" is not permitted.`);
		}

		skillNames.add(directoryName);
		for (const reference of frontmatter.related_skills ?? []) {
			relatedSkillReferences.push({ source: relativeFile, reference });
		}
	}

	for (const { source, reference } of relatedSkillReferences) {
		if (!skillNames.has(reference)) {
			errors.push(
				`${source}: related skill "${reference}" does not resolve under .agent/skills.`,
			);
		}
	}

	return { errors, skillNames };
}

function validateRoles(root, skillNames) {
	const errors = [];
	const roleFiles = listFiles(path.join(root, '.agent', 'agents'), (name) =>
		/\.ya?ml$/u.test(name),
	);
	for (const roleFile of roleFiles) {
		const relativeFile = normalizePath(path.relative(root, roleFile));
		const content = readFileSync(roleFile, 'utf8');
		const yamlStart = content.split(/\r?\n/u).findIndex((line) => line === '---');
		const role = parseTopLevelYaml(
			yamlStart === -1
				? content
				: content
						.split(/\r?\n/u)
						.slice(yamlStart + 1)
						.join('\n'),
		);
		for (const reference of role.skills ?? []) {
			if (!skillNames.has(reference)) {
				errors.push(
					`${relativeFile}: skill "${reference}" does not resolve under .agent/skills.`,
				);
			}
		}
	}

	return errors;
}

function validateIndex(root, skillNames) {
	const errors = [];
	const indexFile = path.join(root, '.agent', 'index.md');
	if (!existsSync(indexFile)) {
		errors.push('.agent/index.md: file is missing.');
	} else {
		const indexContent = readFileSync(indexFile, 'utf8');
		for (const reference of collectIndexSkillReferences(indexContent)) {
			if (!skillNames.has(reference)) {
				errors.push(
					`.agent/index.md: skill "${reference}" does not resolve under .agent/skills.`,
				);
			}
		}
		for (const reference of collectIndexMarkdownPaths(indexContent)) {
			const resolved = resolveIndexPath(root, indexFile, reference);
			if (!existsSync(resolved) || !statSync(resolved).isFile()) {
				errors.push(`.agent/index.md: Markdown path "${reference}" does not resolve.`);
			}
		}
	}

	return errors;
}

function validateActivePlans(root) {
	const errors = [];
	const activePlans = listFiles(path.join(root, '.agent', 'plans', 'active'), (name) =>
		name.endsWith('.md'),
	);
	for (const planFile of activePlans) {
		const relativeFile = normalizePath(path.relative(root, planFile));
		const frontmatter = parseFrontmatter(readFileSync(planFile, 'utf8'));
		if (!frontmatter) {
			errors.push(`${relativeFile}: active plan is missing YAML frontmatter.`);
			continue;
		}
		if (!RECOGNIZED_PLAN_STATUSES.has(frontmatter.status)) {
			errors.push(
				`${relativeFile}: plan status "${frontmatter.status ?? ''}" is not recognized.`,
			);
		}
	}

	return errors;
}

function validateTrackedFiles(root, trackedFiles) {
	const errors = [];
	for (const trackedFile of trackedFiles) {
		if (
			isForbiddenTrackedPath(trackedFile) &&
			existsSync(path.join(root, ...normalizePath(trackedFile).split('/')))
		) {
			errors.push(
				`${normalizePath(trackedFile)}: forbidden tracked artifact or scratch file.`,
			);
		}
	}
	return errors;
}

function listMarkdownFilesRecursively(directory) {
	if (!existsSync(directory)) return [];
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const target = path.join(directory, entry.name);
		if (entry.isDirectory()) return listMarkdownFilesRecursively(target);
		return entry.isFile() && entry.name.endsWith('.md') ? [target] : [];
	});
}

function validateCanonicalCiInvocation(root) {
	const errors = [];
	const files = [
		...['AGENTS.md', 'README.md']
			.map((file) => path.join(root, file))
			.filter((file) => existsSync(file)),
		...['.agent/rules', '.agent/workflows', '.agent/skills', 'docs/core', 'docs/domains'].flatMap(
			(directory) => listMarkdownFilesRecursively(path.join(root, directory)),
		),
	];
	for (const file of files) {
		if (/\bpnpm ci\b(?!:)/u.test(readFileSync(file, 'utf8'))) {
			errors.push(
				`${normalizePath(path.relative(root, file))}: use "pnpm run ci"; bare "pnpm ci" invokes pnpm's install command.`,
			);
		}
	}
	return errors;
}

export function validateStructure({ root = process.cwd(), trackedFiles } = {}) {
	const skills = validateSkills(root);
	return [
		...skills.errors,
		...validateRoles(root, skills.skillNames),
		...validateIndex(root, skills.skillNames),
		...validateActivePlans(root),
		...validateCanonicalCiInvocation(root),
		...validateTrackedFiles(root, trackedFiles ?? getTrackedFiles(root)),
	].sort();
}

function parseRootArgument(argv) {
	const rootIndex = argv.indexOf('--root');
	if (rootIndex === -1) return process.cwd();
	if (!argv[rootIndex + 1]) throw new Error('--root requires a directory path.');
	return path.resolve(argv[rootIndex + 1]);
}

function main() {
	const root = parseRootArgument(process.argv.slice(2));
	const errors = validateStructure({ root });
	if (errors.length > 0) {
		console.error(`Structural validation failed with ${errors.length} error(s):`);
		for (const error of errors) console.error(`  - ${error}`);
		process.exit(1);
	}
	console.log('Structural validation passed.');
}

const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedFile === path.resolve(fileURLToPath(import.meta.url))) {
	main();
}
