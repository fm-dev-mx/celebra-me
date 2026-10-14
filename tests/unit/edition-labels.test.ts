import fs from 'node:fs';
import path from 'node:path';
import {
	listEventTypeStructureContracts,
	resolveEventEdition,
} from '@/lib/invitation/event-type-contract';

function readEditionLabelMap(): Record<string, string> {
	const source = fs.readFileSync(
		path.join(process.cwd(), 'src/styles/invitation/_edition-labels.scss'),
		'utf8',
	);
	const map = source.slice(source.indexOf('$edition-labels:'), source.indexOf(');'));
	return Object.fromEntries(
		[...map.matchAll(/'([a-z-]+)':\s*'([^']+)'/gu)].map((match) => [match[1], match[2]]),
	);
}

describe('event type edition labels', () => {
	it('mirrors the contract edition labels in the shared stylesheet', () => {
		const expected = Object.fromEntries(
			listEventTypeStructureContracts().map((contract) => [
				contract.eventType,
				contract.editionLabel,
			]),
		);
		expect(readEditionLabelMap()).toEqual(expected);
	});

	it('resolves the edition of a known type and keeps the XV edition otherwise', () => {
		expect(resolveEventEdition('cumple')).toEqual({
			label: 'EDICIÓN CUMPLEAÑOS',
			mark: 'CUMPLE',
		});
		expect(resolveEventEdition('xv')).toEqual({ label: 'EDICIÓN XV', mark: 'XV' });
		expect(resolveEventEdition(undefined)).toEqual({ label: 'EDICIÓN XV', mark: 'XV' });
		expect(resolveEventEdition('unknown')).toEqual({ label: 'EDICIÓN XV', mark: 'XV' });
	});

	it('prints no hard-coded XV edition in generic invitation components', () => {
		for (const file of [
			'src/components/invitation/RSVPComponents.tsx',
			'src/components/invitation/Gifts.astro',
			'src/components/invitation/PersonalizedAccess.astro',
		]) {
			const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
			const rendered = source.replace(/=\s*'EDICIÓN XV'|=\s*'XV'/gu, '');
			expect({ file, hardcoded: /EDICIÓN XV|ED-XV/u.test(rendered) }).toEqual({
				file,
				hardcoded: false,
			});
		}
	});
});
