import { hasIconName } from '@/components/common/icons/registry';
import { ICON_CATALOG } from '@/lib/icons/icon-catalog';

describe('icon registry contract', () => {
	it('includes icon names used by active routes and invitation surfaces', () => {
		expect(hasIconName('Search')).toBe(true);
		expect(hasIconName('Sparkles')).toBe(true);
		expect(hasIconName('Play')).toBe(true);
		expect(hasIconName('Pause')).toBe(true);
		expect(hasIconName('WhatsApp')).toBe(true);
		expect(hasIconName('ChevronDown')).toBe(true);
		expect(hasIconName('Copy')).toBe(true);
		expect(hasIconName('MapLocation')).toBe(true);
	});

	it('every catalog entry resolves to a real icon component', () => {
		for (const entry of ICON_CATALOG) {
			expect(hasIconName(entry.name)).toBe(true);
		}
	});
});
