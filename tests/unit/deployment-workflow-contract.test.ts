import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('deployment workflow contract', () => {
	it('leaves Preview and Production deployment ownership to the Vercel Git integration', () => {
		expect(existsSync(resolve('.github/workflows/deploy-preview.yml'))).toBe(false);
		const smoke = readFileSync(resolve('.github/workflows/post-deploy-smoke.yml'), 'utf8');
		expect(smoke).not.toMatch(/vercel(?:@\S+)?\s+(?:build|deploy|promote)/u);
	});

	it('retries only first-attempt CI runs classified as infrastructure', () => {
		const workflow = readFileSync(
			resolve('.github/workflows/retry-ci-infrastructure.yml'),
			'utf8',
		);
		expect(workflow).toContain('github.event.workflow_run.run_attempt == 1');
		expect(workflow).toContain('ci-infrastructure-retry.ts');
		expect(workflow).not.toContain('gh run download');
		expect(workflow).toContain("steps.classification.outputs.should_retry == 'true'");
		expect(workflow).toContain('gh run rerun "$RUN_ID"');
	});
});
