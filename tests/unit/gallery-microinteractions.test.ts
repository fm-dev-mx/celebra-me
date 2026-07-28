import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '../..');

describe('Gallery microinteractions', () => {
	it('keeps gallery open flow free of section-owned reveal observers', () => {
		const component = fs.readFileSync(
			path.join(projectRoot, 'src/components/invitation/PhotoGallery.astro'),
			'utf8',
		);

		expect(component).toContain('data-reveal-item');
		expect(component).toContain("new CustomEvent('gallery:open'");
		expect(component).not.toContain('initSectionReveal');
		expect(component).not.toContain('IntersectionObserver');
		expect(component).not.toContain('galleryReveal');
	});
});
