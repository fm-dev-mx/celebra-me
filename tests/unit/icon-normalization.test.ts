import { describe, it, expect } from '@jest/globals';
import * as path from 'path';
import * as fs from 'fs';
import { ICON_CATALOG, isIconName } from '@/lib/icons/icon-catalog';
import { resolveIconComponent } from '@/components/common/icons/registry';
import { findInvalidItineraryIconIssues } from '../../scripts/verify-icon-migration';

function collectDemoIconNames(): string[] {
	const demosDir = path.resolve(__dirname, '../../src/content/event-demos');
	const names = new Set<string>();
	const walk = (dir: string) => {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) walk(full);
			else if (entry.name.endsWith('.json')) {
				const content = JSON.parse(fs.readFileSync(full, 'utf-8'));
				const collect = (obj: unknown) => {
					if (!obj || typeof obj !== 'object') return;
					if (Array.isArray(obj)) {
						obj.forEach(collect);
						return;
					}
					const record = obj as Record<string, unknown>;
					if (typeof record.iconName === 'string') names.add(record.iconName);
					for (const val of Object.values(record)) collect(val);
				};
				collect(content);
			}
		}
	};
	walk(demosDir);
	return Array.from(names);
}

describe('icon name contract', () => {
	describe('registry resolution', () => {
		it('all catalog icons resolve through the registry', () => {
			for (const icon of ICON_CATALOG) {
				const component = resolveIconComponent(icon.name);
				expect(component).not.toBeNull();
			}
		});

		it('canonical PascalCase names resolve correctly', () => {
			const canonicalNames = [
				'Waltz',
				'Dinner',
				'Church',
				'Reception',
				'Cake',
				'Party',
				'Toast',
				'DressCode',
				'Calendar',
				'Gift',
				'Photo',
				'Rings',
				'Dove',
				'Crown',
			];

			for (const name of canonicalNames) {
				expect(resolveIconComponent(name)).not.toBeNull();
			}
		});

		it('legacy lowercase names do NOT resolve', () => {
			const legacyNames = [
				'waltz',
				'dinner',
				'church',
				'reception',
				'cake',
				'party',
				'toast',
				'dresscode',
				'calendar',
				'gift',
				'photo',
				'rings',
				'dove',
				'crown',
			];

			for (const name of legacyNames) {
				expect(resolveIconComponent(name)).toBeNull();
			}
		});
	});

	describe('icon name validation', () => {
		it('all demo JSON icon names are valid IconName values', () => {
			const demoIconNames = collectDemoIconNames();
			expect(demoIconNames.length).toBeGreaterThan(0);
			for (const name of demoIconNames) {
				expect(isIconName(name)).toBe(true);
				expect(resolveIconComponent(name)).not.toBeNull();
			}
		});

		it('no demo uses legacy lowercase icon names', () => {
			const demoIconNames = collectDemoIconNames();
			for (const name of demoIconNames) {
				expect(isIconName(name)).toBe(true);
			}
		});
	});
});

describe('persisted itinerary icon verification', () => {
	it('detects legacy icon fields without iconName', () => {
		const issues = findInvalidItineraryIconIssues({
			table: 'published_invitation_content',
			id: 'pub-1',
			slug: 'demo-xv',
			content: {
				itinerary: {
					items: [{ icon: 'church', label: 'Misa', time: '18:00' }],
				},
			},
		});

		expect(issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					field: 'itinerary.items[0].icon',
					iconValue: 'church',
					reason: 'legacy_icon_present',
				}),
				expect.objectContaining({
					field: 'itinerary.items[0].iconName',
					iconValue: 'church',
					reason: 'missing_iconName',
				}),
			]),
		);
	});

	it('detects legacy icon fields even when iconName exists', () => {
		const issues = findInvalidItineraryIconIssues({
			table: 'published_invitation_content',
			id: 'pub-1',
			slug: 'demo-xv',
			content: {
				itinerary: {
					items: [{ icon: 'church', iconName: 'Church', label: 'Misa', time: '18:00' }],
				},
			},
		});

		expect(issues).toEqual([
			expect.objectContaining({
				field: 'itinerary.items[0].icon',
				iconValue: 'church',
				reason: 'legacy_icon_present',
			}),
		]);
	});

	it('detects unknown legacy icon fields', () => {
		const issues = findInvalidItineraryIconIssues({
			table: 'invitation_content_drafts',
			id: 'draft-1',
			slug: 'proj-1',
			content: {
				itinerary: {
					items: [{ icon: 'mystery', label: 'Sorpresa', time: '18:00' }],
				},
			},
		});

		expect(issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					field: 'itinerary.items[0].icon',
					iconValue: 'mystery',
					reason: 'legacy_icon_present',
				}),
				expect.objectContaining({
					field: 'itinerary.items[0].iconName',
					iconValue: 'mystery',
					reason: 'unknown_legacy_icon',
				}),
			]),
		);
	});

	it('detects non-canonical iconName values', () => {
		const issues = findInvalidItineraryIconIssues({
			table: 'published_invitation_content',
			id: 'pub-1',
			slug: 'demo-xv',
			content: {
				itinerary: {
					items: [{ iconName: 'church', label: 'Misa', time: '18:00' }],
				},
			},
		});

		expect(issues).toEqual([
			expect.objectContaining({
				field: 'itinerary.items[0].iconName',
				iconValue: 'church',
				reason: 'non_canonical_iconName',
			}),
		]);
	});

	it('detects missing iconName without legacy icon', () => {
		const issues = findInvalidItineraryIconIssues({
			table: 'published_invitation_content',
			id: 'pub-1',
			slug: 'demo-xv',
			content: {
				itinerary: {
					items: [{ label: 'Misa', time: '18:00' }],
				},
			},
		});

		expect(issues).toEqual([
			expect.objectContaining({
				field: 'itinerary.items[0].iconName',
				iconValue: '',
				reason: 'missing_iconName',
			}),
		]);
	});

	it('passes clean canonical itinerary iconName values', () => {
		const issues = findInvalidItineraryIconIssues({
			table: 'published_invitation_content',
			id: 'pub-1',
			slug: 'demo-xv',
			content: {
				itinerary: {
					items: [
						{ iconName: 'Church', label: 'Misa', time: '18:00' },
						{ iconName: 'Reception', label: 'Recepción', time: '20:00' },
					],
				},
			},
		});

		expect(issues).toEqual([]);
	});
});
