/**
 * Compatibility path for validate:changed routing.
 * Full suite lives in local-render-corpus-regression.test.ts — re-declare via shared import.
 */
import { describe, expect, it } from '@jest/globals';
import {
	EXPECTED_LOCAL_RENDER_CORPUS_SIZE,
	listLocalRenderCorpus,
} from '../../scripts/provision/local-render-corpus/registry.ts';

describe('managed invitation regression compatibility', () => {
	it('delegates to the Local Render Corpus SSOT (14 supported Production clients)', () => {
		expect(listLocalRenderCorpus()).toHaveLength(EXPECTED_LOCAL_RENDER_CORPUS_SIZE);
	});
});
