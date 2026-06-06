import { resolveIconComponent } from '@/components/common/icons/registry';
import { ICON_CATALOG } from '@/lib/icons/icon-catalog';

describe('icon registry contract', () => {
	it('includes icon names used by active routes and invitation surfaces', () => {
		expect(resolveIconComponent('Search')).not.toBeNull();
		expect(resolveIconComponent('Sparkles')).not.toBeNull();
		expect(resolveIconComponent('Play')).not.toBeNull();
		expect(resolveIconComponent('Pause')).not.toBeNull();
		expect(resolveIconComponent('WhatsApp')).not.toBeNull();
		expect(resolveIconComponent('ChevronDown')).not.toBeNull();
		expect(resolveIconComponent('Copy')).not.toBeNull();
		expect(resolveIconComponent('MapLocation')).not.toBeNull();
	});

	it('every catalog entry resolves to a real icon component', () => {
		for (const entry of ICON_CATALOG) {
			expect(resolveIconComponent(entry.name)).not.toBeNull();
		}
	});
});
