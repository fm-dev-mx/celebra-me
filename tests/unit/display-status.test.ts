import { resolveDisplayInfo, resolvePrimaryAction } from '@/lib/intake/display-status';
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
		hasRequest: false,
		hasSubmission: false,
		published: false,
		rsvpEventStatus: null,
		rsvpEventId: null,
		rsvpSectionHasContent: false,
		internalEditUrl: '/dashboard/invitaciones/test-id/editar',
		captureUrl: null,
		captureLinkStatus: null,
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
				status: 'waiting_for_client',
				expectedLabel: 'Esperando cliente',
				expectedVariant: 'waiting',
			},
			{
				status: 'client_submitted',
				expectedLabel: 'Captura recibida',
				expectedVariant: 'submitted',
			},
			{ status: 'in_review', expectedLabel: 'En revisión', expectedVariant: 'review' },
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

describe('resolvePrimaryAction', () => {
	describe('normal statuses', () => {
		it('returns stable internal edit link for draft', () => {
			const invitation = makeProject({ status: 'draft' });
			const action = resolvePrimaryAction(invitation);
			expect(action).toEqual({
				text: 'Editar datos base',
				href: invitation.internalEditUrl,
			});
		});

		it('returns waiting text for waiting_for_client', () => {
			const invitation = makeProject({ status: 'waiting_for_client' });
			const action = resolvePrimaryAction(invitation);
			expect(action).toEqual({ text: 'Esperando respuesta del cliente' });
		});

		it('returns review link for client_submitted', () => {
			const invitation = makeProject({ status: 'client_submitted' });
			const action = resolvePrimaryAction(invitation);
			expect(action).toEqual({
				text: 'Revisar captura',
				href: `/dashboard/invitaciones/${invitation.id}/review`,
			});
		});

		it('returns muted text for in_review', () => {
			const invitation = makeProject({ status: 'in_review' });
			const action = resolvePrimaryAction(invitation);
			expect(action).toEqual({ text: 'En revisión' });
		});

		it('returns continue production for in_production', () => {
			const invitation = makeProject({ status: 'in_production' });
			const action = resolvePrimaryAction(invitation);
			expect(action).toEqual({
				text: 'Administrar invitación',
				href: `/dashboard/invitaciones/${invitation.id}`,
			});
		});

		it('returns muted text for preview_sent', () => {
			const invitation = makeProject({ status: 'preview_sent' });
			const action = resolvePrimaryAction(invitation);
			expect(action).toEqual({ text: 'Esperando aprobación final' });
		});

		it('returns generate draft for approved', () => {
			const invitation = makeProject({ status: 'approved' });
			const action = resolvePrimaryAction(invitation);
			expect(action).toEqual({
				text: 'Crear contenido',
				href: `/dashboard/invitaciones/${invitation.id}/draft`,
			});
		});

		it('returns public invitation link for published with slug', () => {
			const invitation = makeProject({
				status: 'published',
				published: true,
				rsvpEventStatus: 'published',
				slug: 'mi-boda',
			});
			const action = resolvePrimaryAction(invitation);
			expect(action).toEqual({
				text: 'Ver invitación pública',
				href: '/boda/mi-boda',
			});
		});

		it('uses auto-generated slug for published without invitation slug', () => {
			const invitation = makeProject({
				status: 'published',
				published: true,
				rsvpEventStatus: 'published',
				slug: null,
				id: 'abc123',
			});
			const action = resolvePrimaryAction(invitation);
			expect(action).toEqual({
				text: 'Ver invitación pública',
				href: `/boda/boda-abc123`,
			});
		});

		it('returns archived text for archived', () => {
			const invitation = makeProject({ status: 'archived' });
			const action = resolvePrimaryAction(invitation);
			expect(action).toEqual({ text: 'Archivada' });
		});
	});

	describe('inconsistent states redirect to invitation detail', () => {
		it('returns review invitation for published without content', () => {
			const invitation = makeProject({ status: 'published', published: false });
			const action = resolvePrimaryAction(invitation);
			expect(action).toEqual({
				text: 'Resolver inconsistencia',
				href: `/dashboard/invitaciones/${invitation.id}`,
			});
		});

		it('returns review invitation for published with RSVP content but no RSVP event', () => {
			const invitation = makeProject({
				status: 'published',
				published: true,
				rsvpEventStatus: null,
				rsvpSectionHasContent: true,
			});
			const action = resolvePrimaryAction(invitation);
			expect(action).toEqual({
				text: 'Resolver inconsistencia',
				href: `/dashboard/invitaciones/${invitation.id}`,
			});
		});

		it('returns review invitation when content exists but status is not published', () => {
			const invitation = makeProject({ status: 'approved', published: true });
			const action = resolvePrimaryAction(invitation);
			expect(action).toEqual({
				text: 'Resolver inconsistencia',
				href: `/dashboard/invitaciones/${invitation.id}`,
			});
		});
	});

	describe('default case', () => {
		it('returns null for unknown status', () => {
			const invitation = makeProject({ status: 'unknown' as InvitationStatus });
			const action = resolvePrimaryAction(invitation);
			expect(action).toBeNull();
		});
	});
});
