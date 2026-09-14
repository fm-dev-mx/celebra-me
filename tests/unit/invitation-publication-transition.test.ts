import {
	assessPublicationTransition,
	parseCanonicalLifecycleSource,
} from '../../scripts/provision/invitation-publication-transition.ts';

const snapshot = (lifecycle: 'in_progress' | 'published') => ({
	slug: 'example',
	lifecycle,
	managedIdentityId: '11111111-1111-4111-8111-111111111111',
	managedIdentityProvenance: 'persisted' as const,
});
const markdown = (readiness: string, outcome: string) =>
	`**Preparation Readiness (prepReadiness):** \`${readiness}\`\n**Human creative outcome:** \`${outcome}\``;

describe('invitation publication transitions', () => {
	it('extracts multiple canonical definitions through the TypeScript AST', () => {
		const parsed = parseCanonicalLifecycleSource(`
			export const a = defineCanonicalInvitation({ slug: 'a', lifecycle: 'in_progress', managedIdentityId: 'id-a', managedIdentityProvenance: 'persisted' });
			export const b = defineCanonicalInvitation({ slug: 'b', lifecycle: 'published', managedIdentityId: 'id-b', managedIdentityProvenance: 'owner-approved' });`);
		expect(parsed.map(({ slug, lifecycle }) => ({ slug, lifecycle }))).toEqual([
			{ slug: 'a', lifecycle: 'in_progress' },
			{ slug: 'b', lifecycle: 'published' },
		]);
	});

	it('accepts only a ready document with exact ACCEPTED outcome and managed provenance', () => {
		expect(
			assessPublicationTransition({
				previous: snapshot('in_progress'),
				current: snapshot('published'),
				markdown: markdown('READY_WITH_PLACEHOLDERS', 'ACCEPTED'),
			}).status,
		).toBe('VERIFIED');
	});

	it.each([
		['NOT_READY', 'ACCEPTED', 'PREPARATION_NOT_READY'],
		['READY_FOR_IMPLEMENTATION', 'PENDING', 'CREATIVE_ACCEPTANCE_REQUIRED'],
		['READY_FOR_IMPLEMENTATION', 'ACCEPTED_LOCAL', 'CREATIVE_ACCEPTANCE_UNVERIFIED'],
	])('blocks readiness %s and outcome %s', (readiness, outcome, reasonCode) => {
		const result = assessPublicationTransition({
			previous: snapshot('in_progress'),
			current: snapshot('published'),
			markdown: markdown(readiness, outcome),
		});
		expect(result).toMatchObject({ status: 'BLOCKED', reasonCode });
	});

	it('does not gate files without a publication transition', () => {
		expect(
			assessPublicationTransition({
				previous: snapshot('published'),
				current: snapshot('published'),
				markdown: null,
			}).reasonCode,
		).toBe('NOT_A_TRANSITION');
	});

	it('reports missing documents and invalid managed identity', () => {
		expect(
			assessPublicationTransition({
				previous: snapshot('in_progress'),
				current: snapshot('published'),
				markdown: null,
			}).reasonCode,
		).toBe('DOCUMENT_MISSING');
		expect(
			assessPublicationTransition({
				previous: snapshot('in_progress'),
				current: { ...snapshot('published'), managedIdentityId: null },
				markdown: markdown('READY_FOR_IMPLEMENTATION', 'ACCEPTED'),
			}).reasonCode,
		).toBe('MANAGED_IDENTITY_INVALID');
	});
});
