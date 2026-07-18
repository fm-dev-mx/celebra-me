import { createPublicationComparison } from '@/lib/intake/services/publication-diff.service';

describe('createPublicationComparison', () => {
	const published = {
		content: {
			envelope: { recipientName: 'Romina' },
			gallery: { items: [] },
			sectionOrder: ['gallery'],
		},
		metadata: { title: 'Romina', slug: 'romina' },
	};

	it('groups an envelope-only change with the canonical registry label', () => {
		const comparison = createPublicationComparison({
			draftProjection: {
				...published,
				content: {
					...published.content,
					envelope: { recipientName: 'Romina Ríos Chaparro' },
				},
			},
			publishedProjection: published,
		});

		expect(comparison.changedPaths).toEqual(['content.envelope.recipientName']);
		expect(comparison.changedSections).toEqual([
			{
				path: 'content.envelope.recipientName',
				sectionId: 'envelope',
				sectionLabel: 'Sobre / apertura',
			},
		]);
	});

	it('ignores equivalent null, empty, whitespace, omitted, and uploaded src values', () => {
		const comparison = createPublicationComparison({
			draftProjection: {
				content: {
					envelope: { recipientName: ' Romina ' },
					optional: null,
					image: { type: 'uploaded', assetId: 'asset-1' },
				},
				metadata: { title: ' Romina ', slug: 'romina' },
			},
			publishedProjection: {
				content: {
					image: {
						src: 'https://cdn.example.test/a.webp',
						assetId: 'asset-1',
						type: 'uploaded',
					},
					envelope: { recipientName: 'Romina' },
				},
				metadata: { slug: 'romina', title: 'Romina' },
			},
		});

		expect(comparison.changedPaths).toEqual([]);
	});

	it('preserves meaningful internal whitespace and line breaks', () => {
		const comparison = createPublicationComparison({
			draftProjection: { content: { quote: { text: ' Romina  Ríos\nChaparro ' } } },
			publishedProjection: { content: { quote: { text: 'Romina Ríos\nChaparro' } } },
		});

		expect(comparison.changedPaths).toEqual(['content.quote.text']);
	});

	it('keeps asset identity meaningful while ignoring only derived upload URLs', () => {
		const comparison = createPublicationComparison({
			draftProjection: {
				content: {
					gallery: { items: [{ image: { type: 'uploaded', assetId: 'asset-new' } }] },
				},
			},
			publishedProjection: {
				content: {
					gallery: {
						items: [
							{
								image: {
									type: 'uploaded',
									assetId: 'asset-old',
									src: 'https://cdn.test/similar.webp',
								},
							},
						],
					},
				},
			},
		});

		expect(comparison.changedPaths).toEqual(['content.gallery.items']);
		expect(comparison.changedSections).toEqual([
			{ path: 'content.gallery.items', sectionId: 'gallery', sectionLabel: 'Galería' },
		]);
	});

	it('reports removed public optional content and excludes internal photo notes', () => {
		const comparison = createPublicationComparison({
			draftProjection: {
				content: { photoNotes: 'nota interna' },
				metadata: { title: 'Romina' },
			},
			publishedProjection: {
				content: { thankYou: { message: 'Gracias' }, photoNotes: 'nota previa' },
				metadata: { title: 'Romina' },
			},
		});

		expect(comparison.changedPaths).toEqual(['content.thankYou']);
		expect(comparison.changedSections).toEqual([
			{ path: 'content.thankYou', sectionId: 'thankYou', sectionLabel: 'Agradecimiento' },
		]);
	});

	it('groups public metadata changes separately from content', () => {
		const comparison = createPublicationComparison({
			draftProjection: { metadata: { title: 'Romina Ríos' } },
			publishedProjection: { metadata: { title: 'Romina' } },
		});

		expect(comparison.changedSections).toEqual([
			{
				path: 'metadata.title',
				sectionId: 'metadata',
				sectionLabel: 'Datos de la invitación',
			},
		]);
	});

	it('reports title, slug, and their combined edit as exactly one metadata section', () => {
		const publishedProjection = { metadata: { title: 'Romina', slug: 'romina' } };

		expect(
			createPublicationComparison({
				draftProjection: { metadata: { title: 'Romina Ríos Chaparro', slug: 'romina' } },
				publishedProjection,
			}).changedSections,
		).toEqual([
			{
				path: 'metadata.title',
				sectionId: 'metadata',
				sectionLabel: 'Datos de la invitación',
			},
		]);
		expect(
			createPublicationComparison({
				draftProjection: { metadata: { title: 'Romina', slug: 'romina-rios' } },
				publishedProjection,
			}).changedSections,
		).toEqual([
			{
				path: 'metadata.slug',
				sectionId: 'metadata',
				sectionLabel: 'Datos de la invitación',
			},
		]);
		expect(
			createPublicationComparison({
				draftProjection: {
					metadata: { title: 'Romina Ríos Chaparro', slug: 'romina-rios' },
				},
				publishedProjection,
			}).changedSections,
		).toEqual([
			{
				path: 'metadata.slug',
				sectionId: 'metadata',
				sectionLabel: 'Datos de la invitación',
			},
		]);
	});

	it('preserves ordered array changes and excludes draft-only photo notes', () => {
		const comparison = createPublicationComparison({
			draftProjection: { content: { sectionOrder: ['gallery', 'rsvp'] } },
			publishedProjection: { content: { sectionOrder: ['rsvp', 'gallery'] } },
		});

		expect(comparison.changedPaths).toEqual(['content.sectionOrder']);
		expect(comparison.changedSections).toEqual([
			{ path: 'content.sectionOrder', sectionId: 'publication', sectionLabel: 'Publicación' },
		]);
	});

	it('keeps a single envelope section for several envelope changes', () => {
		const comparison = createPublicationComparison({
			draftProjection: {
				content: { envelope: { recipientName: 'Romina Ríos Chaparro', sealText: 'XV' } },
			},
			publishedProjection: {
				content: { envelope: { recipientName: 'Romina', sealText: 'Romina' } },
			},
		});

		expect(comparison.changedPaths).toEqual([
			'content.envelope.recipientName',
			'content.envelope.sealText',
		]);
		expect(comparison.changedSections).toEqual([
			{
				path: 'content.envelope.recipientName',
				sectionId: 'envelope',
				sectionLabel: 'Sobre / apertura',
			},
		]);
	});

	it('orders multiple real sections deterministically without duplicates', () => {
		const comparison = createPublicationComparison({
			draftProjection: {
				content: {
					envelope: { recipientName: 'Romina Ríos Chaparro' },
					rsvp: { title: 'Confirma' },
				},
				metadata: { slug: 'romina-rios' },
			},
			publishedProjection: {
				content: { envelope: { recipientName: 'Romina' }, rsvp: { title: 'Anterior' } },
				metadata: { slug: 'romina' },
			},
		});

		expect(comparison.changedSections).toEqual([
			{
				path: 'content.envelope.recipientName',
				sectionId: 'envelope',
				sectionLabel: 'Sobre / apertura',
			},
			{
				path: 'content.rsvp.title',
				sectionId: 'rsvp',
				sectionLabel: 'Confirmación de asistencia',
			},
			{
				path: 'metadata.slug',
				sectionId: 'metadata',
				sectionLabel: 'Datos de la invitación',
			},
		]);
	});

	it('returns no sections for an equivalent legacy draft or a reverted change', () => {
		const equivalent = {
			content: { envelope: { recipientName: 'Romina' } },
			metadata: { title: 'Romina' },
		};
		expect(
			createPublicationComparison({
				draftProjection: equivalent,
				publishedProjection: equivalent,
			}).changedSections,
		).toEqual([]);
	});
});
