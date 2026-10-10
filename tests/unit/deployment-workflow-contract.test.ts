import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('deployment workflow contract', () => {
	it('leaves Preview and Production deployment ownership to the Vercel Git integration', () => {
		expect(existsSync(resolve('.github/workflows/deploy-preview.yml'))).toBe(false);
		const smoke = readFileSync(resolve('.github/workflows/post-deploy-smoke.yml'), 'utf8');
		expect(smoke).not.toMatch(/vercel(?:@\S+)?\s+(?:build|deploy|promote)/u);
	});

	it('smokes only ready develop Preview deployments, read-only and SHA-correlated', () => {
		const smoke = readFileSync(resolve('.github/workflows/post-deploy-smoke.yml'), 'utf8');
		const preview = smoke.slice(smoke.indexOf('preview-smoke:'), smoke.indexOf('\n    smoke:'));
		expect(preview).toContain("github.event.action == 'vercel.deployment.ready'");
		expect(preview).toContain("github.event.client_payload.environment == 'preview'");
		expect(preview).toContain("github.event.client_payload.git.ref == 'develop'");
		expect(preview).toContain("PLAYWRIGHT_ALLOW_PREVIEW_FIXTURE_PROVISIONING: 'false'");
		expect(preview).toContain("PLAYWRIGHT_ALLOW_PREVIEW_PUBLICATION: 'false'");
		expect(preview).toContain('pnpm ops:post-deploy -- validate');
		expect(preview).toContain('.build.commitSha');
		expect(preview).toContain('pnpm test:e2e:preview:public');
		expect(preview).not.toMatch(/preview:provision|preview:publish|db:preview:sync/u);
	});
});
