import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('deployment workflow contract', () => {
	it('documents that workflow_run listeners must be installed on the default branch', () => {
		for (const path of [
			'.github/workflows/deploy-preview.yml',
			'.github/workflows/retry-ci-infrastructure.yml',
		]) {
			const workflow = readFileSync(resolve(path), 'utf8');
			expect(workflow).toContain('DEFAULT_BRANCH_INSTALL_REQUIRED');
		}
	});
	it('never deploys candidate or pull-request validation runs', () => {
		const workflow = readFileSync(resolve('.github/workflows/deploy-preview.yml'), 'utf8');
		expect(workflow).toContain("github.event.workflow_run.conclusion == 'success'");
		expect(workflow).toContain("github.event.workflow_run.event == 'push'");
		expect(workflow).toContain("github.event.workflow_run.head_branch == 'develop'");
		expect(workflow).toContain('ref: ${{ env.RELEASE_SHA }}');
	});

	it('builds once, deploys prebuilt, and preserves the release-readiness smoke name', () => {
		const workflow = readFileSync(resolve('.github/workflows/deploy-preview.yml'), 'utf8');
		expect(workflow.match(/vercel@59\.25\.4 build/g)).toHaveLength(1);
		expect(workflow.match(/vercel@59\.25\.4 deploy --prebuilt/g)).toHaveLength(1);
		expect(workflow).toContain('name: Vercel - celebra-me preview smoke');
		expect(workflow).toContain('pnpm test:e2e:preview:public');
	});

	it('retries only first-attempt CI runs classified as infrastructure', () => {
		const workflow = readFileSync(
			resolve('.github/workflows/retry-ci-infrastructure.yml'),
			'utf8',
		);
		expect(workflow).toContain('github.event.workflow_run.run_attempt == 1');
		expect(workflow).toContain("e.primaryCause==='INFRASTRUCTURE'");
		expect(workflow).toContain("steps.classification.outputs.should_retry == 'true'");
		expect(workflow).toContain('gh run rerun "$RUN_ID"');
	});
});
