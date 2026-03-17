import { basename } from 'path';

const AREA_WEIGHTS = {
	source: 100,
	test: 60,
	docs: 40,
	config: 35,
	script: 30,
	asset: 25,
	plan: 20,
	style: 20,
};

const VERB_PRIORITY = [
	'implement',
	'refactor',
	'align',
	'clarify',
	'document',
	'remove',
	'rename',
	'harden',
	'update',
];
const SUBJECT_PROCESS_LANGUAGE =
	/\b(record|scope|apply changes|process|misc|tmp|temp|things|stuff)\b/i;
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

function truncateText(value, maxLength) {
	const text = String(value || '')
		.trim()
		.replace(/\s+/g, ' ');
	if (text.length <= maxLength) return text;
	if (maxLength <= 3) return text.slice(0, maxLength);
	return `${text.slice(0, maxLength - 3).trim()}...`;
}

function normalizePath(value) {
	return String(value || '')
		.replace(/\\/g, '/')
		.trim();
}

function stemOf(file) {
	const name = (normalizePath(file).split('/').pop() || file).replace(/\.[^.]+$/, '');
	return name
		.replace(/[^a-zA-Z0-9-]+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');
}

function normalizeStem(value) {
	return String(value || '')
		.replace(/[^a-zA-Z0-9-]+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');
}

function commonPathPrefix(files) {
	if (!files.length) return '';
	const segments = files.map((file) => normalizePath(file).split('/'));
	const prefix = [];
	for (let index = 0; index < segments[0].length; index += 1) {
		const candidate = segments[0][index];
		if (!segments.every((parts) => parts[index] === candidate)) break;
		prefix.push(candidate);
	}
	return prefix.join('/');
}

function scaffoldTarget(files, fallback = 'change') {
	const prefix = commonPathPrefix(files);
	const target = prefix.split('/').filter(Boolean).pop() || fallback;
	return normalizeStem(target).replace(/-/g, ' ');
}

function classifyCommitFileArea(file) {
	const normalized = normalizePath(file).toLowerCase();
	if (!normalized) return 'source';
	if (normalized.startsWith('.agent/plans/')) return 'plan';
	if (normalized.startsWith('src/styles/') || /\.(scss|css)$/i.test(normalized)) return 'style';
	if (
		normalized.startsWith('docs/') ||
		normalized.endsWith('.md') ||
		normalized.endsWith('.mdx')
	) {
		return 'docs';
	}
	if (
		normalized.startsWith('tests/') ||
		normalized.includes('.test.') ||
		normalized.includes('.spec.')
	) {
		return 'test';
	}
	if (
		normalized.startsWith('src/assets/') ||
		/\.(png|jpe?g|webp|gif|svg|ico|avif)$/i.test(normalized)
	) {
		return 'asset';
	}
	if (
		normalized.startsWith('scripts/') ||
		normalized.startsWith('.agent/') ||
		normalized.endsWith('.mjs') ||
		normalized.endsWith('.sh')
	) {
		return 'script';
	}
	if (
		normalized.endsWith('.json') ||
		normalized.endsWith('.yml') ||
		normalized.endsWith('.yaml') ||
		normalized.endsWith('.toml') ||
		normalized.endsWith('.ini') ||
		normalized.endsWith('.cjs')
	) {
		return 'config';
	}
	return 'source';
}

function normalizeChangeKind(status) {
	if (status === 'A') return 'add';
	if (status === 'D') return 'delete';
	if (status === 'R') return 'rename';
	return 'modify';
}

function summarizeDiffEntries(entries) {
	const kindCounts = new Map();
	const areaCounts = new Map();
	for (const entry of entries || []) {
		const kind = normalizeChangeKind(String(entry.status || 'M').toUpperCase());
		const area = entry.area || classifyCommitFileArea(entry.path);
		kindCounts.set(kind, (kindCounts.get(kind) || 0) + 1);
		areaCounts.set(area, (areaCounts.get(area) || 0) + 1);
	}
	const dominantKind =
		kindCounts.size === 1
			? Array.from(kindCounts.keys())[0]
			: Array.from(kindCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'mixed';
	const dominantArea =
		areaCounts.size === 1
			? Array.from(areaCounts.keys())[0]
			: Array.from(areaCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'mixed';
	return {
		dominantKind: kindCounts.size > 1 ? 'mixed' : dominantKind,
		dominantArea,
		kindCounts: Object.fromEntries(kindCounts),
		areaCounts: Object.fromEntries(areaCounts),
		meaningfulAreaCount: areaCounts.size,
	};
}

function pickChangeVerb({ kind, area, clusterKind }) {
	if (kind === 'delete') return 'remove';
	if (kind === 'rename') return 'rename';
	if (clusterKind === 'presenter-route' || clusterKind === 'presenter') return 'implement';
	if (clusterKind === 'invitation-route') return 'refactor';
	if (area === 'plan' || clusterKind === 'plan') {
		if (kind === 'add') return 'add';
		if (kind === 'delete') return 'remove';
		return 'update';
	}
	if (area === 'docs') return 'clarify';
	if (area === 'test') return kind === 'add' ? 'add' : 'refine';
	if (area === 'script' || area === 'config') return 'harden';
	if (area === 'asset') return kind === 'add' ? 'add' : 'update';
	if (kind === 'add') return 'implement';
	return 'align';
}

function rankSpecificClusters(fileFacts, fallbackTarget) {
	const paths = fileFacts.map((fact) => fact.path);
	const allPlans = fileFacts.length > 0 && fileFacts.every((fact) => fact.area === 'plan');
	const allTests = fileFacts.length > 0 && fileFacts.every((fact) => fact.area === 'test');
	const allDocs = fileFacts.length > 0 && fileFacts.every((fact) => fact.area === 'docs');

	if (
		paths.some((file) => file.startsWith('src/lib/presenters/')) &&
		paths.some((file) => file.startsWith('src/pages/'))
	) {
		return {
			kind: 'presenter-route',
			target: 'invitation presenter-driven route',
			score: 140,
			confidence: 0.92,
		};
	}
	if (paths.some((file) => file.startsWith('src/lib/presenters/'))) {
		return {
			kind: 'presenter',
			target: 'invitation page presenter',
			score: 130,
			confidence: 0.86,
		};
	}
	if (
		paths.some((file) => file.startsWith('src/components/invitation/')) &&
		paths.some((file) => file.startsWith('src/pages/[eventType]/'))
	) {
		return {
			kind: 'invitation-route',
			target: 'invitation route rendering',
			score: 125,
			confidence: 0.84,
		};
	}
	if (allPlans) {
		const planRoot = commonPathPrefix(paths).split('/').filter(Boolean).slice(0, 4).join('/');
		const planName = basename(planRoot || fallbackTarget || 'plan').replace(/-/g, ' ');
		return {
			kind: 'plan',
			target: `${planName} plan files`,
			score: 95,
			confidence: 0.76,
		};
	}
	if (allTests) {
		return {
			kind: 'test',
			target: 'workflow coverage',
			score: 75,
			confidence: 0.78,
		};
	}
	if (allDocs) {
		return {
			kind: 'docs',
			target: 'governance guidance',
			score: 65,
			confidence: 0.74,
		};
	}
	return null;
}

function collectFileFacts(files, diffEntries = []) {
	const diffByPath = new Map(
		(diffEntries || []).map((entry) => [normalizePath(entry.path), entry]),
	);
	return (files || []).map((file) => {
		const normalizedPath = normalizePath(file);
		const diffEntry = diffByPath.get(normalizedPath) || {};
		return {
			path: normalizedPath,
			oldPath: normalizePath(diffEntry.oldPath || ''),
			status: String(diffEntry.status || 'M').toUpperCase(),
			area: diffEntry.area || classifyCommitFileArea(normalizedPath),
			additions: Number(diffEntry.additions || 0),
			deletions: Number(diffEntry.deletions || 0),
			stem: stemOf(normalizedPath).toLowerCase(),
			basename: basename(normalizedPath),
		};
	});
}

function rankDominantChange(fileFacts, options = {}) {
	const fallbackTarget = scaffoldTarget(
		fileFacts.map((fact) => fact.path),
		options.fallbackTarget || 'change',
	);
	const specificCluster = rankSpecificClusters(fileFacts, fallbackTarget);
	const summary = summarizeDiffEntries(
		fileFacts.map((fact) => ({
			path: fact.path,
			status: fact.status,
			area: fact.area,
		})),
	);
	if (specificCluster) {
		return {
			...specificCluster,
			dominantArea: summary.dominantArea,
			dominantKind: summary.dominantKind,
			meaningfulAreaCount: summary.meaningfulAreaCount,
			fileScores: fileFacts.map((fact) => ({
				path: fact.path,
				score: AREA_WEIGHTS[fact.area] || AREA_WEIGHTS.source,
				area: fact.area,
			})),
		};
	}

	const hasSource = fileFacts.some((fact) => fact.area === 'source');
	const fileScores = fileFacts.map((fact) => {
		let score = AREA_WEIGHTS[fact.area] || AREA_WEIGHTS.source;
		if (fact.status === 'A' || fact.status === 'R') score += 10;
		if (hasSource && ['docs', 'test', 'plan'].includes(fact.area)) score -= 15;
		return {
			path: fact.path,
			score,
			area: fact.area,
			status: fact.status,
		};
	});
	fileScores.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
	const lead = fileScores[0] || {
		path: '',
		score: 0,
		area: 'source',
		status: 'M',
	};
	const fact = fileFacts.find((entry) => entry.path === lead.path) ||
		fileFacts[0] || {
			path: fallbackTarget,
			area: 'source',
			status: 'M',
		};
	const target = scaffoldTarget([fact.path], fallbackTarget) || fallbackTarget;
	return {
		kind: 'generic',
		target,
		score: lead.score,
		confidence: summary.meaningfulAreaCount > 1 ? 0.58 : 0.72,
		dominantArea: fact.area,
		dominantKind: normalizeChangeKind(fact.status),
		meaningfulAreaCount: summary.meaningfulAreaCount,
		fileScores,
	};
}

function inferCommitType(fileFacts) {
	if (!fileFacts.length) return 'feat';
	const areas = new Set(fileFacts.map((fact) => fact.area));
	if ([...areas].every((area) => area === 'docs' || area === 'plan')) return 'docs';
	if ([...areas].every((area) => area === 'test')) return 'test';
	if ([...areas].every((area) => area === 'style')) return 'style';
	if ([...areas].every((area) => area === 'script' || area === 'config')) return 'chore';
	return 'feat';
}

function statusAwareText(status, addText, modifyText, deleteText) {
	if (status === 'A') return addText;
	if (status === 'D') return deleteText;
	return modifyText;
}

function buildRenameDescription(baseText, oldPath) {
	if (!oldPath) return `rename implementation and ${baseText}`;
	return `rename from ${oldPath} and ${baseText}`;
}

function buildFileBulletDescription(fileFact, options = {}) {
	const fact = fileFact || {};
	const path = normalizePath(fact.path);
	const stem = stemOf(path).toLowerCase();
	const normalizedStem = stem.replace(/-/g, ' ');

	if (fact.status === 'R') {
		const renamedBase = buildFileBulletDescription({ ...fact, status: 'M' }, options);
		return buildRenameDescription(renamedBase, fact.oldPath);
	}

	return statusAwareText(
		fact.status,
		`add ${normalizedStem || 'file'} implementation`,
		`modify ${normalizedStem || 'file'} implementation`,
		`remove ${normalizedStem || 'file'} implementation`,
	);
}

function buildDeterministicSubject({ scope, fileFacts, dominantChange }) {
	const commitType = inferCommitType(fileFacts);
	const dominantArea = dominantChange?.dominantArea || 'source';
	const dominantKind = dominantChange?.dominantKind || 'modify';
	const clusterKind = dominantChange?.kind || 'generic';
	const target = dominantChange?.target || 'change set';
	const verb = pickChangeVerb({
		kind: dominantKind,
		area: dominantArea,
		clusterKind,
	});
	let baseTarget = target;
	const prefixLength = `${commitType}(${scope}): `.length;
	const maxSubjectLength = Math.max(10, 130 - prefixLength);
	if (
		scope === 'gov-plans-archive' &&
		clusterKind === 'plan' &&
		dominantKind !== 'delete' &&
		dominantKind !== 'rename'
	) {
		const subject = truncateText(`archive ${target}`, maxSubjectLength);
		return {
			type: commitType,
			subject,
			header: `${commitType}(${scope}): ${subject}`,
			confidence: 0.9,
		};
	}
	if (dominantKind === 'delete') {
		baseTarget =
			clusterKind === 'plan' ? target : `${target}`.replace(/\bimplementation\b/, '').trim();
	}
	const subject = truncateText(
		`${verb} ${baseTarget}`.replace(/\s+/g, ' ').trim(),
		maxSubjectLength,
	);
	return {
		type: commitType,
		subject,
		header: `${commitType}(${scope}): ${subject}`,
		confidence: dominantChange?.confidence || 0.7,
	};
}

function validateSubjectFragment(subject, options = {}) {
	const normalized = String(subject || '')
		.trim()
		.replace(/\s+/g, ' ');
	if (!normalized) return { ok: false, reason: 'empty_subject' };
	if (SUBJECT_PROCESS_LANGUAGE.test(normalized)) {
		return { ok: false, reason: 'process_language' };
	}
	const [verb, ...targetWords] = normalized.toLowerCase().split(/\s+/).filter(Boolean);
	if (!verb || !VERB_PRIORITY.includes(verb)) {
		return { ok: false, reason: 'invalid_verb' };
	}
	if (targetWords.length < 2) {
		if (options.scope && options.scope.length > 30) {
			/* skip strict length check for long scopes */
		} else {
			return { ok: false, reason: 'target_too_short' };
		}
	}
	if (targetWords.every((word) => GENERIC_TARGETS.has(word))) {
		return { ok: false, reason: 'generic_target' };
	}
	const header = `${options.type || 'feat'}(${options.scope || 'core'}): ${normalized}`;
	if (header.length > Number(options.maxHeaderLength || 72)) {
		return { ok: false, reason: 'header_too_long' };
	}
	return { ok: true, subject: normalized };
}

export {
	normalizePath,
	classifyCommitFileArea,
	summarizeDiffEntries,
	collectFileFacts,
	rankDominantChange,
	buildFileBulletDescription,
	buildDeterministicSubject,
	inferCommitType,
	validateSubjectFragment,
};
