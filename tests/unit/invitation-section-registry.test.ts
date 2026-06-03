import {
	PUBLIC_SECTION_IDS,
	PUBLIC_SECTION_DEFINITIONS,
	getPublicSectionDefinitions,
	deriveOrderedPublicSections,
	getSectionVisibilityStatus,
} from '@/lib/intake/invitation-section-registry';
import { INVITATION_RENDER_SECTION_KEYS } from '@/lib/theme/theme-contract';

describe('invitation-section-registry', () => {
	describe('PUBLIC_SECTION_IDS', () => {
		it('includes hero at the beginning', () => {
			expect(PUBLIC_SECTION_IDS[0]).toBe('hero');
		});

		it('includes all INVITATION_RENDER_SECTION_KEYS', () => {
			for (const key of INVITATION_RENDER_SECTION_KEYS) {
				expect(PUBLIC_SECTION_IDS).toContain(key);
			}
		});

		it('every public section id has a definition', () => {
			for (const id of PUBLIC_SECTION_IDS) {
				expect(PUBLIC_SECTION_DEFINITIONS[id]).toBeDefined();
			}
		});
	});

	describe('getPublicSectionDefinitions', () => {
		it('returns all public section definitions', () => {
			const defs = getPublicSectionDefinitions();
			expect(defs).toHaveLength(PUBLIC_SECTION_IDS.length);
			expect(defs.map((d) => d.id)).toEqual([...PUBLIC_SECTION_IDS]);
		});
	});

	describe('deriveOrderedPublicSections', () => {
		it('returns hero first when sectionOrder is empty', () => {
			const ordered = deriveOrderedPublicSections([]);
			expect(ordered[0].id).toBe('hero');
		});

		it('returns hero first followed by sectionOrder sections', () => {
			const order = ['quote', 'location', 'gifts'];
			const ordered = deriveOrderedPublicSections(order);
			expect(ordered).toHaveLength(4);
			expect(ordered[0].id).toBe('hero');
			expect(ordered[1].id).toBe('quote');
			expect(ordered[2].id).toBe('location');
			expect(ordered[3].id).toBe('gifts');
		});

		it('filters out unknown section ids from sectionOrder', () => {
			const order = ['quote', 'nonexistent' as string, 'gifts'];
			const ordered = deriveOrderedPublicSections(order);
			expect(ordered).toHaveLength(3);
			expect(ordered[1].id).toBe('quote');
			expect(ordered[2].id).toBe('gifts');
		});

		it('does not duplicate hero if present in sectionOrder', () => {
			const order = ['quote', 'hero', 'gifts'];
			const ordered = deriveOrderedPublicSections(order);
			expect(ordered).toHaveLength(3);
			expect(ordered.filter((d) => d.id === 'hero')).toHaveLength(1);
			expect(ordered[0].id).toBe('hero');
			expect(ordered[1].id).toBe('quote');
			expect(ordered[2].id).toBe('gifts');
		});
	});

	describe('data integrity', () => {
		it('all public sections have a non-empty label', () => {
			for (const id of PUBLIC_SECTION_IDS) {
				expect(PUBLIC_SECTION_DEFINITIONS[id].label.length).toBeGreaterThan(0);
			}
		});

		it('required sections are not toggleable', () => {
			for (const id of PUBLIC_SECTION_IDS) {
				const def = PUBLIC_SECTION_DEFINITIONS[id];
				if (def.isRequired) {
					expect(def.isToggleable).toBe(false);
				}
			}
		});
	});

	describe('getSectionVisibilityStatus', () => {
		it('returns Requerida for required sections', () => {
			const status = getSectionVisibilityStatus('hero', ['quote', 'location'], true);
			expect(status).toBe('Requerida');
		});

		it('returns Vacía for sections without content', () => {
			const status = getSectionVisibilityStatus('gifts', ['gifts', 'location'], false);
			expect(status).toBe('Vacía');
		});

		it('returns Visible for optional sections with content in sectionOrder', () => {
			const status = getSectionVisibilityStatus(
				'gifts',
				['quote', 'gifts', 'location'],
				true,
			);
			expect(status).toBe('Visible');
		});

		it('returns Oculta for optional sections with content not in sectionOrder', () => {
			const status = getSectionVisibilityStatus('gifts', ['quote', 'location'], true);
			expect(status).toBe('Oculta');
		});

		it('returns Vacía for unknown section ids', () => {
			const status = getSectionVisibilityStatus('nonexistent', [], false);
			expect(status).toBe('Vacía');
		});
	});
});
