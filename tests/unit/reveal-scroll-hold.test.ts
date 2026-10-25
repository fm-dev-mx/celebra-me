import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { holdPageAtTopWhileGated } from '@/lib/invitation/reveal-manager';

const readSource = (relativePath: string) =>
	readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('reveal gate scroll hold', () => {
	let scrollTo: jest.SpyInstance;

	beforeEach(() => {
		history.scrollRestoration = 'auto';
		scrollTo = jest.spyOn(window, 'scrollTo').mockImplementation(() => {});
	});

	afterEach(() => {
		scrollTo.mockRestore();
	});

	it('holds the closed gate at the top with manual restoration', () => {
		holdPageAtTopWhileGated();

		expect(history.scrollRestoration).toBe('manual');
		expect(scrollTo).toHaveBeenCalledWith(0, 0);
	});

	it('puts the previous restoration back once the gate opens', () => {
		const release = holdPageAtTopWhileGated();
		release();

		// Back and Forward inside the opened invitation restore their positions again.
		expect(history.scrollRestoration).toBe('auto');
	});

	it('releases only once', () => {
		const release = holdPageAtTopWhileGated();
		release();
		history.scrollRestoration = 'manual';
		release();

		expect(history.scrollRestoration).toBe('manual');
	});

	it.each([
		'src/components/invitation/EnvelopeReveal.astro',
		'src/components/invitation/EditorialCoverReveal.astro',
	])('%s releases the hold when the reveal completes', (path) => {
		const source = readSource(path);
		const completeReveal =
			source.match(/const completeReveal = \(\) => \{[\s\S]*?\n\t\t\t\};/u)?.[0] ?? '';

		expect(source).toContain('releaseScrollHold = holdPageAtTopWhileGated();');
		expect(completeReveal).toContain('releaseScrollHold();');
	});
});
