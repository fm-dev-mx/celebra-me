import { resolveDisplayInfo, resolvePrimaryAction } from '@/lib/intake/display-status';
import type { InvitationProjectDTO } from '@/lib/dashboard/dto/intake';
import type { InvitationProjectStatus } from '@/lib/intake/types';
import { INVITATION_PROJECT_STATUSES } from '@/lib/intake/types';

function makeProject(overrides: Partial<InvitationProjectDTO>): InvitationProjectDTO {
	return {
		id: 'test-id',
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
		createdAt: '2025-01-01T00:00:00Z',
		updatedAt: '2025-01-01T00:00:00Z',
		hasRequest: false,
		hasSubmission: false,
		published: false,
		rsvpEventStatus: null,
		rsvpEventId: null,
		...overrides,
	};
}

describe('resolveDisplayInfo', () => {
	describe('normal statuses without inconsistencies', () => {
		const expectations: Array<{
			status: InvitationProjectStatus;
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
			{ status: 'approved', expectedLabel: 'Aprobado', expectedVariant: 'approved' },
			{
				status: 'published',
				expectedLabel: 'Publicado',
				expectedVariant: 'published',
			},
			{ status: 'archived', expectedLabel: 'Archivado', expectedVariant: 'archived' },
		];

		it.each(expectations)(
			'returns label "$expectedLabel" and variant "$expectedVariant" for status "$status"',
			({ status, expectedLabel, expectedVariant }) => {
				const project = makeProject({
					status,
					published: status === 'published',
					rsvpEventStatus: status === 'published' ? 'published' : null,
				});
				const result = resolveDisplayInfo(project);
				expect(result.label).toBe(expectedLabel);
				expect(result.variant).toBe(expectedVariant);
				expect(result.warning).toBeNull();
			},
		);
	});

	describe('inconsistency: published status without published content', () => {
		it('returns warning when status is published but published flag is false', () => {
			const project = makeProject({ status: 'published', published: false });
			const result = resolveDisplayInfo(project);
			expect(result.label).toBe('Publicado');
			expect(result.variant).toBe('inconsistent');
			expect(result.warning).toMatch(/no tiene contenido público/i);
		});
	});

	describe('inconsistency: published status without RSVP event', () => {
		it('returns warning when published but rsvpEventStatus is null', () => {
			const project = makeProject({
				status: 'published',
				published: true,
				rsvpEventStatus: null,
			});
			const result = resolveDisplayInfo(project);
			expect(result.label).toBe('Publicado');
			expect(result.variant).toBe('published');
			expect(result.warning).toMatch(/no se encontró.*evento rsvp/i);
		});
	});

	describe('inconsistency: published content exists without published status', () => {
		it.each(INVITATION_PROJECT_STATUSES.filter((s) => s !== 'published' && s !== 'archived'))(
			'returns warning when published is true but status is %s',
			(status) => {
				const project = makeProject({ status, published: true });
				const result = resolveDisplayInfo(project);
				expect(result.variant).toBe('inconsistent');
				expect(result.warning).toMatch(/el contenido público existe/i);
			},
		);
	});

	describe('archived overrides inconsistency checks', () => {
		it('returns archived even if published content exists', () => {
			const project = makeProject({
				status: 'archived',
				published: true,
				rsvpEventStatus: 'published',
			});
			const result = resolveDisplayInfo(project);
			expect(result.label).toBe('Archivado');
			expect(result.variant).toBe('archived');
			expect(result.warning).toBeNull();
		});
	});

	describe('default case for unknown status', () => {
		it('passes through unknown status as label with generic variant', () => {
			const project = makeProject({ status: 'unknown' as InvitationProjectStatus });
			const result = resolveDisplayInfo(project);
			expect(result.label).toBe('unknown');
			expect(result.variant).toBe('generic');
			expect(result.warning).toBeNull();
		});
	});
});

describe('resolvePrimaryAction', () => {
	describe('normal statuses', () => {
		it('returns generate capture link for draft', () => {
			const project = makeProject({ status: 'draft' });
			const action = resolvePrimaryAction(project);
			expect(action).toEqual({
				text: 'Generar link de captura',
				href: `/dashboard/invitaciones/${project.id}`,
			});
		});

		it('returns waiting text for waiting_for_client', () => {
			const project = makeProject({ status: 'waiting_for_client' });
			const action = resolvePrimaryAction(project);
			expect(action).toEqual({ text: 'Esperando respuesta del cliente' });
		});

		it('returns review link for client_submitted', () => {
			const project = makeProject({ status: 'client_submitted' });
			const action = resolvePrimaryAction(project);
			expect(action).toEqual({
				text: 'Revisar captura',
				href: `/dashboard/invitaciones/${project.id}/review`,
			});
		});

		it('returns muted text for in_review', () => {
			const project = makeProject({ status: 'in_review' });
			const action = resolvePrimaryAction(project);
			expect(action).toEqual({ text: 'En revisión' });
		});

		it('returns continue production for in_production', () => {
			const project = makeProject({ status: 'in_production' });
			const action = resolvePrimaryAction(project);
			expect(action).toEqual({
				text: 'Continuar producción',
				href: `/dashboard/invitaciones/${project.id}`,
			});
		});

		it('returns muted text for preview_sent', () => {
			const project = makeProject({ status: 'preview_sent' });
			const action = resolvePrimaryAction(project);
			expect(action).toEqual({ text: 'Esperando aprobación final' });
		});

		it('returns generate draft for approved', () => {
			const project = makeProject({ status: 'approved' });
			const action = resolvePrimaryAction(project);
			expect(action).toEqual({
				text: 'Generar borrador',
				href: `/dashboard/invitaciones/${project.id}/draft`,
			});
		});

		it('returns public invitation link for published with slug', () => {
			const project = makeProject({
				status: 'published',
				published: true,
				rsvpEventStatus: 'published',
				slug: 'mi-boda',
			});
			const action = resolvePrimaryAction(project);
			expect(action).toEqual({
				text: 'Ver invitación pública',
				href: '/boda/mi-boda',
			});
		});

		it('uses auto-generated slug for published without project slug', () => {
			const project = makeProject({
				status: 'published',
				published: true,
				rsvpEventStatus: 'published',
				slug: null,
				id: 'abc123',
			});
			const action = resolvePrimaryAction(project);
			expect(action).toEqual({
				text: 'Ver invitación pública',
				href: `/boda/boda-abc123`,
			});
		});

		it('returns archived text for archived', () => {
			const project = makeProject({ status: 'archived' });
			const action = resolvePrimaryAction(project);
			expect(action).toEqual({ text: 'Archivada' });
		});
	});

	describe('inconsistent states redirect to project detail', () => {
		it('returns review project for published without content', () => {
			const project = makeProject({ status: 'published', published: false });
			const action = resolvePrimaryAction(project);
			expect(action).toEqual({
				text: 'Revisar proyecto',
				href: `/dashboard/invitaciones/${project.id}`,
			});
		});

		it('returns review project for published without RSVP event', () => {
			const project = makeProject({
				status: 'published',
				published: true,
				rsvpEventStatus: null,
			});
			const action = resolvePrimaryAction(project);
			expect(action).toEqual({
				text: 'Revisar proyecto',
				href: `/dashboard/invitaciones/${project.id}`,
			});
		});

		it('returns review project when content exists but status is not published', () => {
			const project = makeProject({ status: 'approved', published: true });
			const action = resolvePrimaryAction(project);
			expect(action).toEqual({
				text: 'Revisar proyecto',
				href: `/dashboard/invitaciones/${project.id}`,
			});
		});
	});

	describe('default case', () => {
		it('returns null for unknown status', () => {
			const project = makeProject({ status: 'unknown' as InvitationProjectStatus });
			const action = resolvePrimaryAction(project);
			expect(action).toBeNull();
		});
	});
});
