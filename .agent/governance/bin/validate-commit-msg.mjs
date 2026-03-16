#!/usr/bin/env node

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

const STRONG_VERBS = new Set([
	'add',
	'align',
	'allow',
	'archive',
	'clarify',
	'configure',
	'consolidate',
	'deprecate',
	'document',
	'drop',
	'expand',
	'extract',
	'extend',
	'finalize',
	'fix',
	'formalize',
	'harden',
	'implement',
	'improve',
	'include',
	'introduce',
	'migrate',
	'modularize',
	'move',
	'narrow',
	'refactor',
	'refine',
	'register',
	'remove',
	'rename',
	'replace',
	'restore',
	'split',
	'standardize',
	'sync',
	'synchronize',
	'update',
]);

const GENERIC_TARGETS = new Set([
	'change',
	'changes',
	'file',
	'files',
	'message',
	'messages',
	'scope',
	'scopes',
	'stuff',
	'things',
	'work',
]);

const MAX_BODY_LINE_LENGTH = 100;
const MIN_BODY_LENGTH = 30;

function getSubjectVerb(subject) {
	if (!subject) return '';
	const match = subject.match(/^\w+/);
	return match ? match[0].toLowerCase() : '';
}

function parseCommitMessage(msg) {
	const lines = msg.split('\n').filter((l) => l.trim());
	const header = lines[0] || '';
	const body = lines.slice(2).join('\n').trim();

	const headerMatch = header.match(/^(\w+)(?:\(([^)]+)\))?: (.+)/);

	return {
		type: headerMatch ? headerMatch[1] : '',
		scope: headerMatch ? headerMatch[2] || '' : '',
		subject: headerMatch ? headerMatch[3] : header,
		body,
		raw: msg,
	};
}

function validateSubject(parsed) {
	const verb = getSubjectVerb(parsed.subject);

	if (!verb) {
		return { valid: false, error: 'Subject must include a verb' };
	}

	if (!STRONG_VERBS.has(verb)) {
		return {
			valid: false,
			error: `Verb "${verb}" not in STRONG_VERBS. Use: ${[...STRONG_VERBS].join(', ')}`,
		};
	}

	const words = parsed.subject.toLowerCase().split(/\s+/).filter(Boolean);
	const targetWords = words.slice(1);
	const meaningfulTargets = targetWords.filter((w) => !GENERIC_TARGETS.has(w));

	if (meaningfulTargets.length === 0) {
		return {
			valid: false,
			error: 'Subject target is too generic. Add concrete target after verb.',
		};
	}

	return { valid: true };
}

function validateBody(parsed) {
	const errors = [];

	if (parsed.body.length < MIN_BODY_LENGTH && parsed.body.length > 0) {
		errors.push(`Body too short (min ${MIN_BODY_LENGTH} chars)`);
	}

	const bodyLines = parsed.body.split('\n');
	for (let i = 0; i < bodyLines.length; i++) {
		const line = bodyLines[i];
		if (line.length > MAX_BODY_LINE_LENGTH) {
			errors.push(
				`Body line ${i + 1} exceeds ${MAX_BODY_LINE_LENGTH} chars (${line.length})`,
			);
		}

		if (line.includes('...')) {
			errors.push(
				`Body line ${i + 1}: Use full paths, not ellipsis (...): ${line.substring(0, 50)}...`,
			);
		}

		const bulletMatch = line.match(/^- (.+):/);
		if (bulletMatch) {
			const bulletContent = bulletMatch[1];
			if (bulletContent.includes('*') || bulletContent.includes('?')) {
				errors.push(
					`Body line ${i + 1}: Use specific paths, not wildcards: ${bulletContent}`,
				);
			}
		}
	}

	return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

function validate(message) {
	const parsed = parseCommitMessage(message);
	const subjectResult = validateSubject(parsed);

	if (!subjectResult.valid) {
		return { valid: false, errors: [subjectResult.error], phase: 'subject' };
	}

	const bodyResult = validateBody(parsed);

	if (!bodyResult.valid) {
		return { valid: false, errors: bodyResult.errors, phase: 'body' };
	}

	return { valid: true, parsed };
}

function main() {
	const args = process.argv.slice(2);
	const msgFile = args[0] || '.git/COMMIT_EDITMSG';
	const msgPath = resolve(ROOT, msgFile);

	let message;
	try {
		message = readFileSync(msgPath, 'utf8');
	} catch {
		console.error(`Error: Could not read ${msgFile}`);
		console.error('Usage: node validate-commit-msg.mjs [.git/COMMIT_EDITMSG]');
		process.exit(1);
	}

	const result = validate(message);

	if (result.valid) {
		console.log('✅ Commit message validation passed');
		process.exit(0);
	} else {
		console.error('❌ Commit message validation failed');
		console.error(`Phase: ${result.phase}`);
		result.errors.forEach((e) => console.error(`  - ${e}`));
		process.exit(1);
	}
}

main();
