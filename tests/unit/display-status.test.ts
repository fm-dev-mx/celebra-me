import { resolveDisplayInfo } from '@/lib/intake/display-status';
import type { InvitationDTO } from '@/lib/dashboard/dto/intake';
import type { InvitationStatus } from '@/lib/intake/types';
import { INVITATION_STATUSES } from '@/lib/intake/types';

function makeProject(overrides: Partial<InvitationDTO>): InvitationDTO {
	return {
		id: 'test-id',
		kind: 'client',
		sourceInvitationId: null,
		slug: null,
		title: 'Test Project',
		eventType: 'boda',
		status: 'draft',
		baseDemoId: 'demo-1',
		themeId: 'theme-1',
		clientName: 'Test Client',
		clientEmail: '',
		clientWhatsapp: '',
		photosReceived: false,
		archivedAt: null,
		createdBy: 'user-1',
		createdAt: '2025-01-01T00:00:00Z',
		updatedAt: '2025-01-01T00:00:00Z',
		published: false,
		rsvpEventStatus: null,
		rsvpEventId: null,
		rsvpSectionHasContent: false,
		internalEditUrl: '/dashboard/invitaciones/test-id/editar',
		...overrides,
	};
}

describe('resolveDisplayInfo', () => {
	it('does not require RSVP for a published demo', () => {
		expect(
			resolveDisplayInfo(
				makeProject({
					kind: 'demo',
					status: 'published',
					published: true,
					rsvpEventStatus: null,
				}),
			),
		).toEqual({
			label: 'Publicada',
			variant: 'published',
			warning: null,
		});
	});

	describe('normal statuses without inconsistencies', () => {
		const expectations: Array<{
			status: InvitationStatus;
			expectedLabel: string;
			expectedVariant: string;
		}> = [
			{ status: 'draft', expectedLabel: 'Borrador', expectedVariant: 'draft' },
			{
				status: 'in_production',
				expectedLabel: 'En producción',
				expectedVariant: 'production',
			},
			{
				status: 'preview_sent',
				expectedLabel: 'Vista previa enviada',
				expectedVariant: 'preview',
			},
			{ status: 'approved', expectedLabel: 'Aprobada', expectedVariant: 'approved' },
			{
				status: 'published',
				expectedLabel: 'Publicada',
				expectedVariant: 'published',
			},
			{ status: 'archived', expectedLabel: 'Archivada', expectedVariant: 'archived' },
		];

		it.each(expectations)(
			'returns label "$expectedLabel" and variant "$expectedVariant" for status "$status"',
			({ status, expectedLabel, expectedVariant }) => {
				const invitation = makeProject({
					status,
					published: status === 'published',
					rsvpEventStatus: status === 'published' ? 'published' : null,
				});
				const result = resolveDisplayInfo(invitation);
				expect(result.label).toBe(expectedLabel);
				expect(result.variant).toBe(expectedVariant);
				expect(result.warning).toBeNull();
			},
		);
	});

	describe('inconsistency: published status without published content', () => {
		it('returns warning when status is published but published flag is false', () => {
			const invitation = makeProject({ status: 'published', published: false });
			const result = resolveDisplayInfo(invitation);
			expect(result.label).toBe('Publicada');
			expect(result.variant).toBe('inconsistent');
			expect(result.warning).toMatch(/no tiene contenido público/i);
		});
	});

	describe('inconsistency: published status without RSVP event', () => {
		it('returns warning when published with RSVP content but no RSVP event', () => {
			const invitation = makeProject({
				status: 'published',
				published: true,
				rsvpEventStatus: null,
				rsvpSectionHasContent: true,
			});
			const result = resolveDisplayInfo(invitation);
			expect(result.label).toBe('Publicada');
			expect(result.variant).toBe('published');
			expect(result.warning).toMatch(/rsvp.*configurado.*no se encontró.*evento/i);
		});
	});

	describe('inconsistency: published content exists without published status', () => {
		it.each(INVITATION_STATUSES.filter((s) => s !== 'published' && s !== 'archived'))(
			'returns warning when published is true but status is %s',
			(status) => {
				const invitation = makeProject({ status, published: true });
				const result = resolveDisplayInfo(invitation);
				expect(result.variant).toBe('inconsistent');
				expect(result.warning).toMatch(/el contenido público existe/i);
			},
		);
	});

	describe('archived overrides inconsistency checks', () => {
		it('uses archivedAt without overwriting the workflow status', () => {
			const invitation = makeProject({
				status: 'published',
				archivedAt: '2026-05-31T12:00:00Z',
				published: true,
				rsvpEventStatus: null,
			});

			expect(resolveDisplayInfo(invitation)).toEqual({
				label: 'Archivada',
				variant: 'archived',
				warning: null,
			});
		});

		it('returns archived even if published content exists', () => {
			const invitation = makeProject({
				status: 'archived',
				published: true,
				rsvpEventStatus: 'published',
			});
			const result = resolveDisplayInfo(invitation);
			expect(result.label).toBe('Archivada');
			expect(result.variant).toBe('archived');
			expect(result.warning).toBeNull();
		});
	});

	describe('default case for unknown status', () => {
		it('passes through unknown status as label with generic variant', () => {
			const invitation = makeProject({ status: 'unknown' as InvitationStatus });
			const result = resolveDisplayInfo(invitation);
			expect(result.label).toBe('unknown');
			expect(result.variant).toBe('generic');
			expect(result.warning).toBeNull();
		});
	});
});
