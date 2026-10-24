import fs from 'node:fs';
import path from 'node:path';
import { transpileModule, ScriptTarget } from 'typescript';
import { getDemoConversion, hasDemoConversion } from '@/lib/invitation/demo-conversion';
import { DEMO_INVITATIONS } from '@/invitations/demos';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const photoGallery = read('src/components/invitation/PhotoGallery.astro');
const source = photoGallery.match(/<script>([\s\S]*?)<\/script>/i)?.[1];

it('replaces the last photo only through an explicitly provided slot', () => {
	const gallery = read('src/components/invitation/Gallery.astro');
	expect(gallery).toContain("Astro.slots.has('last-item')");
	expect(gallery).toContain('hasLastItem ? items.slice(0, -1) : items');
	expect(gallery).toContain('<slot name="last-item" />');
	expect(hasDemoConversion('demo-xv-celestial-blue', true)).toBe(true);
	expect(hasDemoConversion('demo-xv-celestial-blue', false)).toBe(false);
	expect(hasDemoConversion('demo-xv-enchanted-rose', true)).toBe(true);
	expect(hasDemoConversion('olivia-y-antonio', true)).toBe(false);
});

it('preserves all Brisa gallery photos and supplies independent commercial images', () => {
	const demo = getDemoConversion('demo-brisa');
	expect(demo?.galleryImage?.image).toBeDefined();
	expect(demo?.closingImage).toBeDefined();
	const metadata = DEMO_INVITATIONS.find((item) => item.slug === 'demo-brisa');
	expect(metadata?.conversionPhotos?.gallery.key).not.toBe(
		metadata?.conversionPhotos?.closing.key,
	);
	expect(getDemoConversion('demo-xv-celestial-blue')?.galleryImage).toBeUndefined();
	expect(read('src/components/invitation/Gallery.astro')).toContain(
		'<slot name="after-gallery" />',
	);
});

it('keeps commercial closing after the invitation farewell and retains tracking contracts', () => {
	const route = read('src/pages/[eventType]/[slug].astro');
	expect(route.indexOf('<DemoConversion placement="closing"')).toBeGreaterThan(
		route.indexOf('<Footer'),
	);
	const component = read('src/components/invitation/DemoConversion.astro');
	expect(component).toContain('data-preserve-message="true"');
	expect(component).toContain('data-track-cta={`demo_quote_${placement}`}');
	expect(component).toContain('data-track-cta="demo_next"');
	expect(component).toContain('data-track-cta="demo_back_home"');
	expect(component).toContain('href={demo.quoteLinks[placement]}');
	expect(component).toContain('aria-describedby={channelId}');
	expect(component).not.toMatch(/onclick|preventDefault|trackEvent/);
});

it('gives every demo its own sales message, label and closing photo', () => {
	for (const { slug, eventType, showroom } of DEMO_INVITATIONS) {
		const demo = getDemoConversion(slug);
		if ('showConversion' in showroom && showroom.showConversion === false) {
			expect(demo).toBeUndefined();
			expect(hasDemoConversion(slug, true)).toBe(false);
			continue;
		}
		expect(demo).toMatchObject({ slug, eventType });
		for (const link of Object.values(demo!.quoteLinks)) expect(link).toMatch(/Ref\.%20/);
		expect(demo?.celebrationLabel).toMatch(/^sus? /);
		expect(demo?.closingImage).toBeDefined();
	}
	expect(getDemoConversion('olivia-y-antonio')).toBeUndefined();
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
			origin: null,
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

it('quotes each demo position with its own reference and a distinct tracked cta', () => {
	const demo = getDemoConversion('demo-xv-celestial-blue')!;
	const text = (link: string) => new URL(link).searchParams.get('text');
	expect(text(demo.quoteLinks.floating)).toMatch(/Ref\. XV-CELESTIAL-FLOTANTE$/);
	expect(text(demo.quoteLinks.gallery)).toMatch(/Ref\. XV-CELESTIAL-GALERIA$/);
	expect(text(demo.quoteLinks.closing)).toMatch(/Ref\. XV-CELESTIAL-CIERRE$/);
	const floating = read('src/components/invitation/DemoFloatingQuote.astro');
	expect(floating).toContain('href={demo.quoteLinks.floating}');
	expect(floating).toContain('data-track-cta="demo_quote_floating"');
	expect(floating).toContain('data-preserve-message="true"');
	expect(read('src/pages/[eventType]/[slug].astro')).toContain(
		'<DemoFloatingQuote demo={demoConversion} />',
	);
});

it('links every demo to the next one of its event, wrapping to the first, and back home', () => {
	const xv = ['demo-xv-celestial-blue', 'demo-xv-enchanted-rose', 'demo-xv-editorial'].map(
		(slug) => getDemoConversion(slug)!,
	);
	const hrefs = xv.map((demo) => demo.nextDemo?.href);
	expect(new Set(hrefs).size).toBe(xv.length);
	for (const demo of xv) expect(demo.homeHref).toBe('/#xv');
	expect(getDemoConversion('demo-xv-editorial')?.nextDemo).toEqual({
		href: '/serenata',
		name: 'Serenata',
	});
	// The only demo of its event has nowhere next to go.
	expect(getDemoConversion('demo-brisa')?.nextDemo).toBeUndefined();
	expect(getDemoConversion('demo-brisa')?.homeHref).toBe('/#boda');
});
