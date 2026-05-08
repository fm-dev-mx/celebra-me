import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

function read(relativePath: string): string {
	return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

function getRunnableGalleryScript(): string {
	const component = read('src/components/invitation/PhotoGallery.astro');
	const script = component.match(/<script>([\s\S]*?)<\/script>/)?.[1];

	if (!script) {
		throw new Error('PhotoGallery script block was not found');
	}

	return script
		.replaceAll(' as HTMLElement', '')
		.replaceAll(': HTMLElement', '')
		.replaceAll(': KeyboardEvent', '');
}

class MockIntersectionObserver {
	static instances: MockIntersectionObserver[] = [];

	readonly observed = new Set<Element>();
	private readonly callback: IntersectionObserverCallback;

	constructor(callback: IntersectionObserverCallback) {
		this.callback = callback;
		MockIntersectionObserver.instances.push(this);
	}

	observe = (element: Element) => {
		this.observed.add(element);
	};

	unobserve = (element: Element) => {
		this.observed.delete(element);
	};

	disconnect = () => {
		this.observed.clear();
	};

	trigger(element: Element) {
		this.callback(
			[{ target: element, isIntersecting: true } as IntersectionObserverEntry],
			this as unknown as IntersectionObserver,
		);
	}
}

function renderGallery() {
	document.body.innerHTML = `
		<div data-gallery>
			<button data-gallery-item data-gallery-src="one.webp"></button>
			<button data-gallery-item data-gallery-src="two.webp"></button>
		</div>
	`;
}

function mockReducedMotion(matches: boolean) {
	window.matchMedia = jest.fn().mockReturnValue({
		matches,
		media: '(prefers-reduced-motion: reduce)',
		addEventListener: jest.fn(),
		removeEventListener: jest.fn(),
	});
}

describe('Gallery microinteractions', () => {
	beforeEach(() => {
		MockIntersectionObserver.instances = [];
		Reflect.set(window, 'IntersectionObserver', MockIntersectionObserver);
		Reflect.set(globalThis, 'IntersectionObserver', MockIntersectionObserver);
	});

	it('marks gallery items visible immediately when reduced motion is requested', () => {
		renderGallery();
		mockReducedMotion(true);

		new Function(getRunnableGalleryScript())();

		const items = Array.from(document.querySelectorAll<HTMLElement>('[data-gallery-item]'));
		expect(items.map((item) => item.dataset.inView)).toEqual(['true', 'true']);
		expect(MockIntersectionObserver.instances).toHaveLength(0);
	});

	it('marks gallery items visible after they intersect in normal motion', () => {
		renderGallery();
		mockReducedMotion(false);

		new Function(getRunnableGalleryScript())();

		const items = Array.from(document.querySelectorAll<HTMLElement>('[data-gallery-item]'));
		expect(items.map((item) => item.dataset.inView)).toEqual([undefined, undefined]);

		const observer = MockIntersectionObserver.instances[0];
		expect(observer.observed.size).toBe(2);

		observer.trigger(items[0]);

		expect(items.map((item) => item.dataset.inView)).toEqual(['true', undefined]);
		expect(observer.observed.has(items[0])).toBe(false);
	});

	it('does not use a separate reveal state or reveal-only transition layer', () => {
		const component = read('src/components/invitation/PhotoGallery.astro');
		const theme = read('src/styles/themes/sections/_gallery-theme.scss');

		expect(component).not.toContain('galleryReveal');
		expect(component).not.toContain('data-gallery-reveal');
		expect(theme).not.toContain('data-gallery-reveal');
		expect(theme).not.toContain('--gallery-reveal-delay');
	});
});
