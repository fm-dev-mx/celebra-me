import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import ts from 'typescript';
import {
	parseCreativeAcceptanceFromMarkdown,
	parsePreparationReadinessFromMarkdown,
	type CreativeAcceptanceOutcome,
	type PreparationReadiness,
} from '../../src/lib/invitation-preparation/index.ts';

export type PublicationTransitionReasonCode =
	| 'READY'
	| 'NOT_A_TRANSITION'
	| 'DOCUMENT_MISSING'
	| 'PREPARATION_UNVERIFIED'
	| 'PREPARATION_NOT_READY'
	| 'CREATIVE_ACCEPTANCE_UNVERIFIED'
	| 'CREATIVE_ACCEPTANCE_REQUIRED'
	| 'MANAGED_IDENTITY_INVALID';

export interface CanonicalLifecycleSnapshot {
	slug: string;
	lifecycle: 'in_progress' | 'published';
	managedIdentityId: string | null;
	managedIdentityProvenance: 'persisted' | 'owner-approved' | null;
}

export interface PublicationTransitionAssessment {
	slug: string;
	previousLifecycle: CanonicalLifecycleSnapshot['lifecycle'] | null;
	currentLifecycle: CanonicalLifecycleSnapshot['lifecycle'];
	preparationReadiness: PreparationReadiness | null;
	creativeAcceptance: CreativeAcceptanceOutcome | null;
	status: 'VERIFIED' | 'BLOCKED' | 'WARNING';
	reasonCode: PublicationTransitionReasonCode;
	nextAction: string;
}

function stringProperty(node: ts.ObjectLiteralExpression, name: string): string | null {
	for (const property of node.properties) {
		if (!ts.isPropertyAssignment(property)) continue;
		const key = property.name.getText().replace(/^['"]|['"]$/g, '');
		if (key !== name || !ts.isStringLiteralLike(property.initializer)) continue;
		return property.initializer.text;
	}
	return null;
}

export function parseCanonicalLifecycleSource(
	source: string,
	fileName = 'invitation.ts',
): CanonicalLifecycleSnapshot[] {
	const file = ts.createSourceFile(
		fileName,
		source,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS,
	);
	const snapshots: CanonicalLifecycleSnapshot[] = [];
	const visit = (node: ts.Node): void => {
		if (
			ts.isCallExpression(node) &&
			ts.isIdentifier(node.expression) &&
			node.expression.text === 'defineCanonicalInvitation' &&
			node.arguments[0] &&
			ts.isObjectLiteralExpression(node.arguments[0])
		) {
			const object = node.arguments[0];
			const slug = stringProperty(object, 'slug');
			const lifecycle = stringProperty(object, 'lifecycle');
			if (slug && (lifecycle === 'in_progress' || lifecycle === 'published')) {
				snapshots.push({
					slug,
					lifecycle,
					managedIdentityId: stringProperty(object, 'managedIdentityId'),
					managedIdentityProvenance: stringProperty(
						object,
						'managedIdentityProvenance',
					) as CanonicalLifecycleSnapshot['managedIdentityProvenance'],
				});
			}
		}
		ts.forEachChild(node, visit);
	};
	visit(file);
	return snapshots;
}

export function assessPublicationTransition(input: {
	previous: CanonicalLifecycleSnapshot | null;
	current: CanonicalLifecycleSnapshot;
	markdown: string | null;
	transitionOnly?: boolean;
}): PublicationTransitionAssessment {
	const { previous, current, markdown } = input;
	const transition = previous?.lifecycle === 'in_progress' && current.lifecycle === 'published';
	const preparationReadiness = markdown ? parsePreparationReadinessFromMarkdown(markdown) : null;
	const creativeAcceptance = markdown ? parseCreativeAcceptanceFromMarkdown(markdown) : null;
	const base = {
		slug: current.slug,
		previousLifecycle: previous?.lifecycle ?? null,
		currentLifecycle: current.lifecycle,
		preparationReadiness,
		creativeAcceptance,
	};
	if (!transition && input.transitionOnly !== false)
		return {
			...base,
			status: 'VERIFIED',
			reasonCode: 'NOT_A_TRANSITION',
			nextAction: 'No publication transition gate applies.',
		};
	const blockedStatus = transition ? 'BLOCKED' : 'WARNING';
	if (!markdown)
		return {
			...base,
			status: blockedStatus,
			reasonCode: 'DOCUMENT_MISSING',
			nextAction: `Create docs/invitations/${current.slug}.md from the canonical preparation template.`,
		};
	if (!preparationReadiness)
		return {
			...base,
			status: blockedStatus,
			reasonCode: 'PREPARATION_UNVERIFIED',
			nextAction:
				'Record helper-derived Preparation Readiness in the canonical invitation document.',
		};
	if (preparationReadiness === 'NOT_READY')
		return {
			...base,
			status: blockedStatus,
			reasonCode: 'PREPARATION_NOT_READY',
			nextAction:
				'Resolve the documented preparation blockers before changing lifecycle to published.',
		};
	if (!creativeAcceptance)
		return {
			...base,
			status: blockedStatus,
			reasonCode: 'CREATIVE_ACCEPTANCE_UNVERIFIED',
			nextAction: 'Record a canonical Human creative outcome in the invitation document.',
		};
	if (creativeAcceptance !== 'ACCEPTED')
		return {
			...base,
			status: blockedStatus,
			reasonCode: 'CREATIVE_ACCEPTANCE_REQUIRED',
			nextAction:
				'Obtain exact human creative acceptance before publishing the lifecycle transition.',
		};
	if (
		!current.managedIdentityId ||
		!['persisted', 'owner-approved'].includes(current.managedIdentityProvenance ?? '')
	)
		return {
			...base,
			status: blockedStatus,
			reasonCode: 'MANAGED_IDENTITY_INVALID',
			nextAction: 'Resolve managed identity and provenance before publishing.',
		};
	return {
		...base,
		status: 'VERIFIED',
		reasonCode: 'READY',
		nextAction: 'Continue with the existing CI, Preview approval, and Production owner gates.',
	};
}

export interface PublicationTransitionReport {
	baseSha: string;
	headSha: string;
	gateEstablishedAtBase: boolean;
	transitions: PublicationTransitionAssessment[];
	legacyWarnings: PublicationTransitionAssessment[];
}

function git(args: string[]): string {
	return execFileSync('git', args, {
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'ignore'],
	}).trim();
}

function sourceAt(sha: string, path: string): string | null {
	try {
		return git(['show', `${sha}:${path}`]);
	} catch {
		return null;
	}
}

export function buildPublicationTransitionReport(input: {
	baseSha: string;
	headSha: string;
	root?: string;
}): PublicationTransitionReport {
	const root = input.root ?? process.cwd();
	for (const sha of [input.baseSha, input.headSha]) {
		if (!/^[a-f0-9]{40}$/iu.test(sha))
			throw new Error('Both base and head must be exact 40-character SHAs.');
	}
	for (const sha of [input.baseSha, input.headSha]) git(['cat-file', '-e', `${sha}^{commit}`]);
	const changed = git([
		'diff',
		'--name-only',
		input.baseSha,
		input.headSha,
		'--',
		'scripts/provision/invitations',
	])
		.split(/\r?\n/u)
		.filter((path) => path.endsWith('.ts'));
	const gateEstablishedAtBase =
		sourceAt(input.baseSha, 'scripts/validate-invitation-publication-transitions.ts') !== null;
	const transitions: PublicationTransitionAssessment[] = [];
	const bootstrapWarnings: PublicationTransitionAssessment[] = [];
	for (const path of changed) {
		const before = sourceAt(input.baseSha, path);
		const after = sourceAt(input.headSha, path);
		if (!after) continue;
		const previousBySlug = new Map(
			(before ? parseCanonicalLifecycleSource(before, path) : []).map((item) => [
				item.slug,
				item,
			]),
		);
		for (const current of parseCanonicalLifecycleSource(after, path)) {
			const previous = previousBySlug.get(current.slug) ?? null;
			if (previous?.lifecycle !== 'in_progress' || current.lifecycle !== 'published')
				continue;
			const docPath = join(root, 'docs', 'invitations', `${current.slug}.md`);
			const markdown =
				sourceAt(input.headSha, `docs/invitations/${current.slug}.md`) ??
				(existsSync(docPath) ? readFileSync(docPath, 'utf8') : null);
			const assessment = assessPublicationTransition({
				previous,
				current,
				markdown,
			});
			if (gateEstablishedAtBase) transitions.push(assessment);
			else if (assessment.status === 'BLOCKED')
				bootstrapWarnings.push({ ...assessment, status: 'WARNING' });
		}
	}
	const currentDir = join(root, 'scripts', 'provision', 'invitations');
	const legacyWarnings = readdirSync(currentDir)
		.filter((name) => name.endsWith('.ts'))
		.flatMap((name) => {
			const path = join(currentDir, name);
			return parseCanonicalLifecycleSource(readFileSync(path, 'utf8'), basename(path));
		})
		.filter((item) => item.lifecycle === 'published')
		.map((current) => {
			const docPath = join(root, 'docs', 'invitations', `${current.slug}.md`);
			const markdown =
				sourceAt(input.headSha, `docs/invitations/${current.slug}.md`) ??
				(existsSync(docPath) ? readFileSync(docPath, 'utf8') : null);
			return assessPublicationTransition({
				previous: null,
				current,
				markdown,
				transitionOnly: false,
			});
		})
		.filter((item) => item.status === 'WARNING');
	const uniqueWarnings = [...bootstrapWarnings, ...legacyWarnings].filter(
		(item, index, all) =>
			all.findIndex(
				(candidate) =>
					candidate.slug === item.slug && candidate.reasonCode === item.reasonCode,
			) === index,
	);
	return {
		baseSha: input.baseSha,
		headSha: input.headSha,
		gateEstablishedAtBase,
		transitions,
		legacyWarnings: uniqueWarnings,
	};
}
