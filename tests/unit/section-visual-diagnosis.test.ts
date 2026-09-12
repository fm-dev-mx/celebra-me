import {
	hashDeliveredImage,
	parseDiagnosisArgs,
} from '../../scripts/screenshot/section-visual-diagnosis';

test('SVG identity normalizes only XML line endings and keeps byte integrity', () => {
	const svg = '<svg xmlns="http://www.w3.org/2000/svg">\n<path fill="red"/>\n</svg>';
	const original = hashDeliveredImage(Buffer.from(svg), 'image/svg+xml');
	const windows = hashDeliveredImage(Buffer.from(svg.replace(/\n/g, '\r\n')), 'image/svg+xml');
	expect(windows.deliveredSha256).not.toBe(original.deliveredSha256);
	expect(windows.normalizedSvgSha256).toBe(original.normalizedSvgSha256);
	expect(
		hashDeliveredImage(Buffer.from(svg.replace('red', 'blue')), 'image/svg+xml')
			.normalizedSvgSha256,
	).not.toBe(original.normalizedSvgSha256);
	expect(hashDeliveredImage(Buffer.from(svg), 'image/png').normalizedSvgSha256).toBeUndefined();
});

test('full-page diagnosis rejects an ambiguous capture option', () => {
	const args = [
		'--production-url',
		'https://production.test',
		'--preview-url',
		'https://preview.test',
		'--production-sha',
		'a'.repeat(40),
		'--preview-sha',
		'b'.repeat(40),
	];
	expect(parseDiagnosisArgs([...args, '--full-pages', 'true'])['full-pages']).toBe('true');
	expect(() => parseDiagnosisArgs([...args, '--full-pages', 'yes'])).toThrow(
		'full-pages must be true or false',
	);
});
