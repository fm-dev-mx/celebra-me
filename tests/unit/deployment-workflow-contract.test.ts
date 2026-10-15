import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	CLOUDFLARE_PRODUCTION_CANDIDATE_SMOKE,
	CLOUDFLARE_PRODUCTION_DEPLOYMENT_SMOKE,
	PRODUCTION_DEPLOYMENT_SMOKES,
} from '../../scripts/ops/release-readiness.ts';

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

describe('Cloudflare Production upload workflow contract', () => {
	const workflow = readFileSync(resolve('.github/workflows/deploy-production.yml'), 'utf8');

	it('runs only by hand, from main', () => {
		expect(workflow).toMatch(/^on:\n {4}workflow_dispatch:\n\n/mu);
		expect(workflow).toContain("if: github.ref == 'refs/heads/main'");
	});

	it('never routes traffic, deploys triggers or touches routes', () => {
		expect(workflow).not.toMatch(/versions\s+deploy/u);
		expect(workflow).not.toMatch(/triggers\s+deploy/u);
		expect(workflow).not.toMatch(/--routes?\b|custom_domain/u);
		// `wrangler deploy` runs once, only to create the Worker on the first run.
		expect(workflow.match(/exec wrangler deploy\b/gu)).toHaveLength(1);
	});

	it('publishes a candidate smoke that no release gate accepts', () => {
		expect(workflow).toContain(`SMOKE_CONTEXT: ${CLOUDFLARE_PRODUCTION_CANDIDATE_SMOKE}`);
		expect(PRODUCTION_DEPLOYMENT_SMOKES).not.toContain(CLOUDFLARE_PRODUCTION_CANDIDATE_SMOKE);
		expect(workflow).not.toContain(
			`SMOKE_CONTEXT: ${CLOUDFLARE_PRODUCTION_DEPLOYMENT_SMOKE}\n`,
		);
	});

	it('keeps its evidence apart from the Vercel Production environment', () => {
		expect(workflow).toContain('name: Cloudflare Production\n');
		expect(workflow).toContain('environment: "Cloudflare Production"');
		expect(workflow).not.toMatch(/environment: "?Production"?\n/u);
		expect(workflow).toContain('production_environment: false');
	});

	it('builds with PRODUCTION_* inputs only, never the repository-level Preview names', () => {
		const build = workflow.slice(workflow.indexOf('- name: Build Cloudflare target'));
		const buildEnv = build.slice(0, build.indexOf('run: pnpm build:app'));
		expect(buildEnv).not.toMatch(/(?:secrets|vars)\.PUBLIC_/u);
		expect(buildEnv).toContain('CELEBRA_DEPLOY_ENV: production');
	});
});
