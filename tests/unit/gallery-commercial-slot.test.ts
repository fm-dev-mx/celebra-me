import fs from 'node:fs';
import path from 'node:path';
import { transpileModule, ScriptTarget } from 'typescript';
import { hasDemoConversion } from '@/lib/invitation/demo-conversion';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const photoGallery = read('src/components/invitation/PhotoGallery.astro');
const source = photoGallery.match(/<script>([\s\S]*?)<\/script>/)?.[1];

it('replaces the last photo only through an explicitly provided slot', () => {
	const gallery = read('src/components/invitation/Gallery.astro');
	expect(gallery).toContain("Astro.slots.has('last-item')");
	expect(gallery).toContain('hasLastItem ? items.slice(0, -1) : items');
	expect(gallery).toContain('<slot name="last-item" />');
	expect(hasDemoConversion('demo-xv-celestial-blue', true)).toBe(true);
	expect(hasDemoConversion('demo-xv-celestial-blue', false)).toBe(false);
	expect(hasDemoConversion('demo-xv-enchanted-rose', true)).toBe(false);
});

it('keeps commercial closing after the invitation farewell and retains tracking contracts', () => {
	const route = read('src/pages/[eventType]/[slug].astro');
	expect(route.indexOf('<DemoConversion placement="closing"')).toBeGreaterThan(
		route.indexOf('<Footer'),
	);
	const component = read('src/components/invitation/DemoConversion.astro');
	expect(component).toContain('data-preserve-message="true"');
	expect(component).toContain('data-track-cta={`demo_quote_${placement}`}');
	expect(component).toContain('data-track-cta="demo_browse_styles"');
	expect(component).toContain('href={getCelestialQuoteLink()}');
	expect(component).toContain('aria-describedby={channelId}');
	expect(component).not.toMatch(/onclick|preventDefault|trackEvent/);
});

it('isolates native enlargement and commercial navigation while preserving legacy keyboard handling', () => {
	expect(source).toBeDefined();
	document.body.innerHTML = `<main data-event-slug="demo" data-reveal-state="revealed">
		<section data-gallery>
			<div role="button" tabindex="0" data-gallery-item data-gallery-src="first.webp" aria-label="First photograph"></div>
			<aside><button type="button" data-gallery-item data-gallery-src="last.webp" data-gallery-caption="Caption" data-gallery-alt="Last photograph">Ampliar foto</button>
			<a href="/#contacto">Cotizar este estilo</a></aside>
		</section></main>`;
	const listener = jest.fn();
	document.addEventListener('gallery:open', listener);
	try {
		const { outputText } = transpileModule(source!, {
			compilerOptions: { target: ScriptTarget.ES2022 },
		});
		new Function(outputText)();
		const native = document.querySelector('button')!;
		const legacy = document.querySelector('[role="button"]')!;
		const link = document.querySelector('a')!;
		link.addEventListener('click', (event) => event.preventDefault());
		link.click();
		expect(listener).not.toHaveBeenCalled();
		native.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		native.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
		expect(listener).not.toHaveBeenCalled();
		// Browser-native keyboard activation synthesizes exactly this click.
		native.click();
		expect(listener).toHaveBeenCalledTimes(1);
		expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({
			src: 'last.webp',
			caption: 'Caption',
			alt: 'Last photograph',
		});
		legacy.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		expect(listener).toHaveBeenCalledTimes(2);
		document.querySelector<HTMLElement>('[data-event-slug]')!.dataset.revealState = 'sealed';
		native.click();
		expect(listener).toHaveBeenCalledTimes(2);
	} finally {
		document.removeEventListener('gallery:open', listener);
		document.body.innerHTML = '';
	}
});
