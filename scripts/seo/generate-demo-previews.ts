import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DEMO_INVITATIONS } from '../../src/invitations/demos';
import { isPublicDemo } from '../../src/lib/seo/demo-metadata';
import {
	getDemoPreviewComposition,
	renderDemoPreview,
	resolveDemoPreviewSource,
} from './demo-preview';

// Run explicitly after changing demo photos or catalog visibility; never read client content.
const output = path.resolve('public/images/demo-previews');
await mkdir(output, { recursive: true });
for (const demo of DEMO_INVITATIONS.filter(isPublicDemo)) {
	const jpeg = await renderDemoPreview(
		await resolveDemoPreviewSource(demo.slug),
		getDemoPreviewComposition(demo.slug),
	);
	await writeFile(path.join(output, `${demo.routeSlug}.jpg`), jpeg);
	console.info(`${demo.routeSlug}.jpg: ${jpeg.length} bytes`);
}
