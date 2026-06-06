import { describe, it, expect } from '@jest/globals';
import * as path from 'path';
import * as fs from 'fs';
import { ICON_CATALOG, isIconName } from '@/lib/icons/icon-catalog';
import { resolveIconComponent } from '@/components/common/icons/registry';

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
