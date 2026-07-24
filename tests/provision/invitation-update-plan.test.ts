import { buildSemanticFunctionalChanges } from '../../scripts/provision/invitation-update-plan.ts';
import {
	buildRominaPublishedContent,
	ROMINA_ASSET_SPECS,
	type RominaAssetMap,
} from '../../scripts/provision/invitations/romina-rios-chaparro.ts';

function buildRominaTestAssets(): RominaAssetMap {
	return Object.fromEntries(
		ROMINA_ASSET_SPECS.map((spec, index) => [
			spec.key,
			{
				type: 'uploaded' as const,
				assetId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
				src: `http://127.0.0.1:54321/storage/v1/object/public/invitation-assets/${spec.key}.webp`,
			},
		]),
	) as RominaAssetMap;
}

describe('buildSemanticFunctionalChanges regression test suite', () => {
	it('handles arrays compared against undefined targets without stack overflow', () => {
		const sourceContent = {
			itinerary: {
				title: 'Programa',
				items: [
					{ time: '3:00 p. m.', label: 'Misa', iconName: 'Church' },
					{ time: '5:00 p. m.', label: 'Recepción', iconName: 'Reception' },
				],
			},
			family: {
				godparents: [
					{ name: 'María del Carmen Becerra Ornelas' },
					{ name: 'Ramiro Contreras Bermejo' },
				],
			},
		};

		expect(() => {
			const changes = buildSemanticFunctionalChanges({
				sourceContent,
				targetContent: undefined,
			});
			expect(changes).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						field: 'itinerary.items',
						operation: 'insert',
					}),
					expect.objectContaining({
						field: 'family.godparents',
						operation: 'insert',
					}),
				]),
			);
		}).not.toThrow();
	});

	it('terminates recursion correctly for nested arrays and objects', () => {
		const sourceContent = {
			gallery: {
				eyebrow: 'Galería',
				items: [
					{ image: { type: 'uploaded', src: 'http://test/1.webp' }, alt: 'Foto 1' },
					{ image: { type: 'uploaded', src: 'http://test/2.webp' }, alt: 'Foto 2' },
				],
			},
		};
		const targetContent = {
			gallery: {
				eyebrow: 'Galería',
				items: [
					{ image: { type: 'uploaded', src: 'http://test/1.webp' }, alt: 'Foto 1' },
				],
			},
		};

		const changes = buildSemanticFunctionalChanges({ sourceContent, targetContent });
		expect(changes).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					field: 'gallery.items[1]',
					operation: 'insert',
				}),
			]),
		);
	});

	it('does not silently discard valid scalar or string array differences', () => {
		const sourceContent = {
			sectionOrder: ['quote', 'family', 'location', 'itinerary', 'gallery', 'rsvp'],
		};
		const targetContent = {
			sectionOrder: ['quote', 'location', 'family', 'itinerary', 'gallery', 'rsvp'],
		};

		const changes = buildSemanticFunctionalChanges({ sourceContent, targetContent });
		expect(changes.some((c) => c.field === 'sectionOrder.$order')).toBe(true);
	});

	it('retains exact plan behavior for pre-existing managed invitations (Romina)', () => {
		const rominaContent = buildRominaPublishedContent(buildRominaTestAssets());
		const changesNew = buildSemanticFunctionalChanges({
			sourceContent: rominaContent,
			targetContent: null,
		});
		expect(changesNew.length).toBeGreaterThan(10);
		expect(changesNew.every((c) => c.operation === 'insert')).toBe(true);

		const changesIdentical = buildSemanticFunctionalChanges({
			sourceContent: rominaContent,
			targetContent: rominaContent,
		});
		expect(changesIdentical).toHaveLength(0);
	});
});
