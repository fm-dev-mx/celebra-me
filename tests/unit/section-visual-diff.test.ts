import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeSectionDiagnosisReport } from '../../scripts/screenshot/section-visual-report';
import sharp from 'sharp';
import {
	assertDiagnosisCoverage,
	normalizeCaptureImageSource,
	sectionImageSignature,
	sectionSemanticSignature,
	classifySectionDifference,
	compareSectionImages,
} from '../../scripts/screenshot/section-visual-diff';

const png = (width: number, height: number, background: string) =>
	sharp({ create: { width, height, channels: 4, background } })
		.png()
		.toBuffer();

describe('section visual diagnostics', () => {
	it('does not flag identical sections', async () => {
		const image = await png(3, 2, '#ffffff');
		expect((await compareSectionImages(image, image)).ratio).toBe(0);
	});
	it('retains dimensional differences instead of resizing them away', async () => {
		const result = await compareSectionImages(
			await png(2, 2, '#ffffff'),
			await png(3, 2, '#ffffff'),
		);
		expect(result.sizeChanged).toBe(true);
		expect(result.changedPixels).toBe(2);
		expect(result.ratio).toBeCloseTo(1 / 3);
	});
	it('detects a stable photographic or color difference and emits both visual artifacts', async () => {
		const result = await compareSectionImages(
			await png(2, 2, '#ffffff'),
			await png(2, 2, '#000000'),
		);
		expect(result.ratio).toBe(1);
		expect((await sharp(result.diff).metadata()).width).toBe(2);
		expect((await sharp(result.overlay).metadata()).height).toBe(2);
		expect(classifySectionDifference({ first: 1, repeat: 1 })).toBe('DIFFERENT');
	});
	it('does not certify a difference that disappears on recapture', () => {
		expect(classifySectionDifference({ first: 0.2, repeat: 0 })).toBe('UNSTABLE');
		expect(classifySectionDifference({ first: 0.2 })).toBe('UNSTABLE');
	});
	it('reports capture noise even when both environments look different', () => {
		expect(classifySectionDifference({ first: 0.2, repeat: 0.2, productionNoise: 0.1 })).toBe(
			'UNSTABLE',
		);
	});
	it('does not hide missing sections or order changes behind matching pixels', () => {
		expect(classifySectionDifference({ first: 0, missing: true })).toBe('MISSING');
		expect(classifySectionDifference({ first: 0, repeat: 0, orderChanged: true })).toBe(
			'DIFFERENT',
		);
	});
});

describe('diagnosis inventory coverage', () => {
	it('rejects missing route viewports', () => {
		expect(() =>
			assertDiagnosisCoverage(['/xv/a@mobile', '/xv/a@desktop'], ['/xv/a@mobile']),
		).toThrow('Incomplete');
	});
	it('rejects duplicate or unexpected cases', () => {
		expect(() => assertDiagnosisCoverage(['a', 'b'], ['a', 'a'])).toThrow('Duplicate');
		expect(() => assertDiagnosisCoverage(['a'], ['b'])).toThrow('unexpected');
	});
	it('accepts complete reordered results', () => {
		expect(() => assertDiagnosisCoverage(['a', 'b'], ['b', 'a'])).not.toThrow();
	});
});

describe('section diagnosis report', () => {
	it('renders every filter and escapes embedded untrusted data', () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'section-report-'));
		try {
			writeSectionDiagnosisReport(root, [], { marker: '</script><img id="injected">' });
			const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
			const doc = new DOMParser().parseFromString(html, 'text/html');
			expect(doc.querySelectorAll('#state option')).toHaveLength(7);
			expect(doc.querySelector('#state option[value="all"]')?.textContent).toBe('Todos');
			expect(doc.querySelector('#injected')).toBeNull();
		} finally {
			fs.rmSync(root, { recursive: true, force: true });
		}
	});
});

describe('semantic visual contract', () => {
	it('blocks matching pixels with differing semantic content', () => {
		expect(
			classifySectionDifference({ first: 0.00001, repeat: 0, semanticChanged: true }),
		).toBe('DIFFERENT');
		expect(
			classifySectionDifference({
				first: 0,
				repeat: 0,
				semanticChanged: true,
				semanticUnstable: true,
			}),
		).toBe('UNSTABLE');
	});
	it('normalizes only equivalent deployment origins', () => {
		expect(
			normalizeCaptureImageSource(
				'https://preview.example/_image?w=390&q=80',
				'https://preview.example',
			),
		).toBe(
			normalizeCaptureImageSource(
				'https://production.example/_image?q=80&w=390',
				'https://production.example',
			),
		);
	});
	it.each(['w=391&q=80', 'w=390&q=90', 'w=390&q=80&crop=face'])(
		'preserves transformation %s',
		(query) => {
			expect(
				normalizeCaptureImageSource('/_image?' + query, 'https://preview.example'),
			).not.toBe(
				normalizeCaptureImageSource('/_image?w=390&q=80', 'https://preview.example'),
			);
		},
	);
	it('preserves external hosts and nested image sources', () => {
		expect(
			normalizeCaptureImageSource(
				'https://assets.example/photo.jpg',
				'https://preview.example',
			),
		).toBe('https://assets.example/photo.jpg');
		expect(
			normalizeCaptureImageSource(
				'/_image?url=https%3A%2F%2Fa.example%2Fx',
				'https://preview.example',
			),
		).not.toBe(
			normalizeCaptureImageSource(
				'/_image?url=https%3A%2F%2Fb.example%2Fx',
				'https://preview.example',
			),
		);
	});
	it('retains text, fonts, and crop in the semantic signature', () => {
		const section = {
			textHash: 'one',
			fonts: ['serif'],
			images: [{ src: '/a', objectFit: 'cover', objectPosition: '50% 40%' }],
		};
		for (const changed of [
			{ ...section, textHash: 'two' },
			{ ...section, fonts: ['sans-serif'] },
			{ ...section, images: [{ ...section.images[0], objectPosition: '50% 50%' }] },
		])
			expect(sectionSemanticSignature(changed)).not.toBe(sectionSemanticSignature(section));
	});
});

describe('verified delivered image identity', () => {
	const image = {
		src: 'https://a.example/photo.webp',
		objectFit: 'cover',
		objectPosition: '50% 50%',
		deliveredSha256: 'a'.repeat(64),
		naturalWidth: 800,
		naturalHeight: 600,
	};
	it('recognizes identical delivered bytes across storage origins', () =>
		expect(sectionImageSignature([image])).toBe(
			sectionImageSignature([{ ...image, src: 'https://b.example/renamed.webp' }]),
		));
	it('never equates different bytes or transformation contracts', () => {
		expect(sectionImageSignature([image])).not.toBe(
			sectionImageSignature([{ ...image, deliveredSha256: 'b'.repeat(64) }]),
		);
		expect(sectionImageSignature([image])).not.toBe(
			sectionImageSignature([
				{ ...image, src: 'https://a.example/_vercel/image?url=source&w=800&q=90' },
			]),
		);
	});
});
