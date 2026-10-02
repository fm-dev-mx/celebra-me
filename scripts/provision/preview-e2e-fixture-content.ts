/**
 * Versioned published content of the Preview E2E publication fixture.
 *
 * The fixture is self-sufficient: its content comes from this versioned file, never from another
 * invitation or demo row in the database.
 */

import { readFileSync } from 'node:fs';
import { eventContentSchema } from '../../src/lib/schemas/content/base-event.schema.ts';

export const PREVIEW_FIXTURE_CONTENT_PATH = 'tests/fixtures/content/xv-jewelry-box.json';

export function buildPreviewFixtureContent(): Record<string, unknown> {
	const source = JSON.parse(readFileSync(PREVIEW_FIXTURE_CONTENT_PATH, 'utf8')) as Record<
		string,
		unknown
	>;
	return eventContentSchema.parse({ ...source, isDemo: false }) as Record<string, unknown>;
}
