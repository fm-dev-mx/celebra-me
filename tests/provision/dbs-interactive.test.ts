import { describe, expect, it } from '@jest/globals';
import {
	buildInvitationChoices,
	dbsEnvironmentFacts,
	dbsNextStep,
	dbsRootMenu,
	invitationEnvironmentStatus,
	shouldOpenDbsMenu,
} from '../../scripts/provision/dbs-interactive-model.ts';
import type { MediaReferencesStatus } from '../../src/lib/status/media-reference-types.ts';
import { buildCanonicalStatusViewFixture } from '../helpers/canonical-status-fixture.ts';

const healthy: MediaReferencesStatus = {
	preview: { status: 'MATCH', invitations: 1, references: 1, findings: [] },
	production: { status: 'MATCH', invitations: 1, references: 1, findings: [] },
};

const drift: MediaReferencesStatus = {
	...healthy,
	production: {
		status: 'REFERENCE_DRIFT',
		invitations: 1,
		references: 1,
		findings: [
			{
				route: 'boda/victoria-y-roberto',
				slug: 'victoria-y-roberto',
				path: 'hero.backgroundImage',
				assetKey: 'hero',
				issue: 'REFERENCE_DRIFT',
			},
		],
	},
};

describe('dbs interactive navigation', () => {
	it('opens only for an argument-free TTY invocation', () => {
		expect(shouldOpenDbsMenu([], true)).toBe(true);
		expect(shouldOpenDbsMenu([], false)).toBe(false);
		for (const args of [['--json'], ['--compact'], ['victoria-y-roberto'], ['--verbose']])
			expect(shouldOpenDbsMenu(args, true)).toBe(false);
	});

	it('lists a publication pending once, with its affected environment', () => {
		const view = buildCanonicalStatusViewFixture();
		const choices = buildInvitationChoices(view, healthy);
		expect(choices.map((choice) => choice.label)).toEqual(['victoria-y-roberto']);
		expect(invitationEnvironmentStatus(choices[0]!, 'local', view, healthy)).toBe('CURRENT');
		expect(invitationEnvironmentStatus(choices[0]!, 'preview', view, healthy)).toBe('CURRENT');
		expect(invitationEnvironmentStatus(choices[0]!, 'production', view, healthy)).toBe(
			'UPDATE_PENDING',
		);
	});

	it('recognizes confirmed Local and Preview publication differences', () => {
		const base = buildCanonicalStatusViewFixture();
		const row = {
			...base.promotions[0]!,
			environments: {
				local: 'behind' as const,
				preview: 'absent' as const,
				production: 'match' as const,
			},
		};
		const view = { ...base, promotions: [row] };
		const choice = buildInvitationChoices(view, healthy)[0]!;
		expect(invitationEnvironmentStatus(choice, 'local', view, healthy)).toBe('UPDATE_PENDING');
		expect(invitationEnvironmentStatus(choice, 'preview', view, healthy)).toBe(
			'UPDATE_PENDING',
		);
		expect(invitationEnvironmentStatus(choice, 'production', view, healthy)).toBe('CURRENT');
	});

	it('includes media drift in or outside the registry and combines it with publication', () => {
		const view = buildCanonicalStatusViewFixture();
		const both = buildInvitationChoices(view, drift);
		expect(both).toHaveLength(1);
		expect(invitationEnvironmentStatus(both[0]!, 'production', view, drift)).toBe('BOTH');
		const unregistered: MediaReferencesStatus = {
			...drift,
			production: {
				...drift.production!,
				findings: [
					{
						...drift.production!.findings[0]!,
						route: 'xv/unregistered-client',
						slug: 'unregistered-client',
					},
				],
			},
		};
		const choices = buildInvitationChoices(
			buildCanonicalStatusViewFixture({ promotions: [] }),
			unregistered,
		);
		expect(choices.map((choice) => choice.label)).toEqual(['unregistered-client']);
		expect(invitationEnvironmentStatus(choices[0]!, 'production', view, unregistered)).toBe(
			'MEDIA_REVIEW',
		);
	});

	it('excludes fully current, authoring-only, and unverified-only invitations', () => {
		const base = buildCanonicalStatusViewFixture();
		const current = {
			...base.promotions[0]!,
			environments: {
				local: 'match' as const,
				preview: 'match' as const,
				production: 'match' as const,
			},
		};
		const authoring = { ...base.promotions[0]!, lifecycle: 'in_progress' as const };
		const uncertain = {
			...base.promotions[0]!,
			envEvidence: {
				local: 'UNVERIFIED' as const,
				preview: 'UNVERIFIED' as const,
				production: 'UNVERIFIED' as const,
			},
		};
		expect(buildInvitationChoices({ ...base, promotions: [current] }, healthy)).toHaveLength(0);
		expect(buildInvitationChoices({ ...base, promotions: [authoring] }, healthy)).toHaveLength(
			0,
		);
		expect(buildInvitationChoices({ ...base, promotions: [uncertain] }, healthy)).toHaveLength(
			0,
		);
	});

	it('does not show an unreachable environment as current', () => {
		const view = buildCanonicalStatusViewFixture();
		const media: MediaReferencesStatus = {
			...healthy,
			preview: { status: 'UNVERIFIED', invitations: 0, references: 0, findings: [] },
		};
		const choice = buildInvitationChoices(view, media)[0]!;
		expect(invitationEnvironmentStatus(choice, 'preview', view, media)).toBe('UNVERIFIED');
	});

	it('shows only slugs, disambiguating event-type collisions', () => {
		const view = buildCanonicalStatusViewFixture({ promotions: [] });
		const media: MediaReferencesStatus = {
			preview: healthy.preview,
			production: {
				status: 'REFERENCE_DRIFT',
				invitations: 2,
				references: 2,
				findings: [
					{
						route: 'boda/shared-slug',
						slug: 'shared-slug',
						path: 'hero.image',
						assetKey: 'hero',
						issue: 'REFERENCE_DRIFT',
					},
					{
						route: 'xv/shared-slug',
						slug: 'shared-slug',
						path: 'hero.image',
						assetKey: 'hero',
						issue: 'REFERENCE_DRIFT',
					},
				],
			},
		};
		expect(buildInvitationChoices(view, media).map((choice) => choice.label)).toEqual([
			'shared-slug (boda)',
			'shared-slug (xv)',
		]);
	});
});

describe('dbs menu model', () => {
	it('starts on the overview and moves to invitations once pending work is known', () => {
		const fresh = dbsRootMenu({ loaded: false, pendingCount: 0, lastAction: null });
		expect(fresh.initial).toBe('overview');
		expect(fresh.items[0]?.value).toBe('overview');
		expect(fresh.items.at(-1)?.value).toBe('exit');
		expect(fresh.items.some((item) => item.value === 'refresh')).toBe(false);
		const loaded = dbsRootMenu({ loaded: true, pendingCount: 2, lastAction: 'overview' });
		expect(loaded.initial).toBe('invitation');
		expect(loaded.items.some((item) => item.value === 'refresh')).toBe(true);
	});

	it('suggests the next logical step after each action', () => {
		expect(dbsNextStep({ loaded: true, pendingCount: 1, lastAction: 'overview' }).initial).toBe(
			'invitation',
		);
		expect(dbsNextStep({ loaded: true, pendingCount: 0, lastAction: 'overview' }).initial).toBe(
			'exit',
		);
		expect(
			dbsNextStep({ loaded: true, pendingCount: 1, lastAction: 'invitation' }).initial,
		).toBe('invitation');
		expect(dbsNextStep({ loaded: true, pendingCount: 0, lastAction: 'compact' }).initial).toBe(
			'overview',
		);
		expect(dbsNextStep({ loaded: true, pendingCount: 0, lastAction: 'json' }).initial).toBe(
			'menu',
		);
	});

	it('derives header facts from the canonical view without probing', () => {
		const facts = dbsEnvironmentFacts(buildCanonicalStatusViewFixture());
		expect(facts.map((fact) => fact.env)).toEqual(['local', 'preview', 'production']);
		for (const fact of facts) {
			expect(typeof fact.schema).toBe('string');
			expect(typeof fact.attention).toBe('number');
		}
	});
});
