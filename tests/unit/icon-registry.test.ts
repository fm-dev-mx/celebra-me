import { hasIconName } from '@/components/common/icons/registry';

describe('icon registry contract', () => {
	it('includes icon names used by active routes and invitation surfaces', () => {
		expect(hasIconName('Search')).toBe(true);
		expect(hasIconName('Sparkles')).toBe(true);
		expect(hasIconName('Play')).toBe(true);
		expect(hasIconName('Pause')).toBe(true);
		expect(hasIconName('WhatsApp')).toBe(true);
		expect(hasIconName('ChevronDown')).toBe(true);
		expect(hasIconName('Copy')).toBe(true);
		expect(hasIconName('Map')).toBe(true);
	});
});
