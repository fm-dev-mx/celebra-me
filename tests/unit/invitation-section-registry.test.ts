import {
	PUBLIC_SECTION_IDS,
	PUBLIC_SECTION_DEFINITIONS,
	getConfigEditorSections,
	getEditorSectionById,
	getPreviewAnchorForSection,
	deriveOrderedPublicSections,
	getSectionVisibilityStatus,
} from '@/lib/intake/invitation-section-registry';
import { CONTENT_SECTION_KEYS, INVITATION_RENDER_SECTION_KEYS } from '@/lib/theme/theme-contract';

describe('invitation-section-registry', () => {
	describe('public section ids', () => {
		it('includes hero at the beginning and every render section key', () => {
			expect(PUBLIC_SECTION_IDS[0]).toBe('hero');
			for (const key of INVITATION_RENDER_SECTION_KEYS) {
				expect(PUBLIC_SECTION_IDS).toContain(key);
			}
		});

		it('defines every public section id', () => {
			for (const id of PUBLIC_SECTION_IDS) {
				expect(PUBLIC_SECTION_DEFINITIONS[id]).toBeDefined();
			}
		});
	});

	describe('editor-facing public sections', () => {
		const editorPublicIds = ['hero', ...CONTENT_SECTION_KEYS];

		it('uses the public render contract order with hero first', () => {
			expect(editorPublicIds[0]).toBe('hero');
			for (const key of CONTENT_SECTION_KEYS) {
				expect(editorPublicIds).toContain(key);
			}
		});

		it('uses Spanish user-facing labels', () => {
			expect(
				editorPublicIds.map(
					(id) =>
						PUBLIC_SECTION_DEFINITIONS[id as keyof typeof PUBLIC_SECTION_DEFINITIONS]
							.label,
				),
			).toEqual([
				'Portada',
				'Frase',
				'Familia',
				'Galería',
				'Cuenta regresiva',
				'Fecha y ubicaciones',
				'Programa',
				'Confirmación de asistencia',
				'Mesa de regalos',
				'Agradecimiento',
			]);
		});

		it('does not include config-only render sections', () => {
			expect(editorPublicIds).not.toContain('personalizedAccess');
		});
	});

	describe('editor mappings', () => {
		it('maps public sections to editor cards', () => {
			expect(getEditorSectionById('hero')?.editorCardId).toBe('main');
			expect(getEditorSectionById('quote')?.editorCardId).toBe('quote');
			expect(getEditorSectionById('thankYou')?.editorCardId).toBe('thankYou');
			expect(getEditorSectionById('countdown')?.editorCardId).toBe('countdown');
		});

		it('maps split message sections to the existing save section key', () => {
			expect(getEditorSectionById('quote')?.saveSectionKey).toBe('messages');
			expect(getEditorSectionById('thankYou')?.saveSectionKey).toBe('messages');
		});

		it('maps countdown to its own editable content section', () => {
			expect(getEditorSectionById('countdown')).toMatchObject({
				saveSectionKey: 'countdown',
				draftContentKeys: ['countdown'],
			});
		});

		it('maps config sections to their editor cards and save keys', () => {
			expect(getEditorSectionById('metadata')?.editorCardId).toBe('metadata');
			expect(getEditorSectionById('metadata')?.saveSectionKey).toBe('metadata');
			expect(getEditorSectionById('music')?.sidebarGroup).toBe('config');
			expect(getEditorSectionById('music')?.saveSectionKey).toBe('music');
		});
	});

	describe('preview anchors', () => {
		it('resolves anchors from the registry', () => {
			expect(getPreviewAnchorForSection('hero')).toBe('#hero');
			expect(getPreviewAnchorForSection('quote')).toBe('#quote-section');
			expect(getPreviewAnchorForSection('gallery')).toBe('#galeria');
			expect(getPreviewAnchorForSection('thankYou')).toBe('#thank-you-section');
			expect(getPreviewAnchorForSection('music')).toBe('');
		});
	});

	describe('config sections', () => {
		it('separates admin/config sections from public sections', () => {
			expect(getConfigEditorSections().map((section) => section.label)).toEqual([
				'Datos de la invitación',
				'Publicación',
				'Biblioteca de imágenes',
				'Música',
				'Sobre / apertura',
			]);
		});

		it('includes personalized access only when requested', () => {
			expect(getConfigEditorSections().map((section) => section.id)).not.toContain(
				'personalizedAccess',
			);
			expect(
				getConfigEditorSections({ includePersonalizedAccess: true }).map(
					(section) => section.id,
				),
			).toContain('personalizedAccess');
		});
	});

	describe('deriveOrderedPublicSections', () => {
		it('returns hero first followed by persisted public order', () => {
			const ordered = deriveOrderedPublicSections(['quote', 'location', 'gifts']);
			expect(ordered.map((section) => section.id)).toEqual([
				'hero',
				'quote',
				'location',
				'gifts',
			]);
		});

		it('filters unknown and config section ids from sectionOrder', () => {
			const ordered = deriveOrderedPublicSections([
				'quote',
				'personalizedAccess',
				'nonexistent',
				'gifts',
			]);
			expect(ordered.map((section) => section.id)).toEqual(['hero', 'quote', 'gifts']);
		});
	});

	describe('getSectionVisibilityStatus', () => {
		it('returns Requerida for required sections', () => {
			expect(getSectionVisibilityStatus('hero', ['quote', 'location'], true)).toBe(
				'Requerida',
			);
		});

		it('returns Vacía for sections without content', () => {
			expect(getSectionVisibilityStatus('gifts', ['gifts', 'location'], false)).toBe('Vacía');
		});

		it('returns Visible or Oculta for optional sections with content', () => {
			expect(getSectionVisibilityStatus('gifts', ['quote', 'gifts'], true)).toBe('Visible');
			expect(getSectionVisibilityStatus('gifts', ['quote', 'location'], true)).toBe('Oculta');
		});
	});
});
