import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	CLOUDFLARE_PRODUCTION_CANDIDATE_SMOKE,
	CLOUDFLARE_PRODUCTION_DEPLOYMENT_SMOKE,
	PRODUCTION_DEPLOYMENT_SMOKES,
} from '../../scripts/ops/release-readiness.ts';

describe('deployment workflow contract', () => {
	it('has no Vercel-driven or per-deployment smoke workflow left', () => {
		expect(existsSync(resolve('.github/workflows/deploy-preview.yml'))).toBe(false);
		expect(existsSync(resolve('.github/workflows/post-deploy-smoke.yml'))).toBe(false);
	});

	it('verifies Preview invitation images from the Cloudflare Preview deploy, read-only', () => {
		const preview = readFileSync(resolve('.github/workflows/deploy.yml'), 'utf8');
		expect(preview).toContain("PLAYWRIGHT_ALLOW_PREVIEW_FIXTURE_PROVISIONING: 'false'");
		expect(preview).toContain("PLAYWRIGHT_ALLOW_PREVIEW_PUBLICATION: 'false'");
		expect(preview).toContain(
			'pnpm --silent invitation:media:verify -- --target preview --all --json > "$MEDIA_VERIFY_REPORT"',
		);
		expect(preview).toContain('tee -a "$GITHUB_STEP_SUMMARY"');
		expect(preview).toContain('exit "$status"');
		// Content not yet published to Preview is listed, never counted as a failure.
		expect(preview).toContain('.classification == "PENDING_PUBLISH"');
		expect(preview).toContain('.classification != "PENDING_PUBLISH"');
		const upload = preview.slice(preview.indexOf('- name: Upload media verification report'));
		expect(upload).toContain('if: always()');
		expect(upload).toContain('uses: actions/upload-artifact@v7');
		expect(upload).toContain('path: .tmp/media-verify/preview-media-verification.json');
		expect(upload).toMatch(/retention-days: [1-7]\s/u);
		expect(preview).not.toMatch(/preview:provision|preview:publish|db:preview:sync/u);
		// The images are verified after the stable host serves the release, before success is recorded.
		expect(preview.indexOf('Verify the stable host serves the release')).toBeLessThan(
			preview.indexOf('Verify published invitation images'),
		);
		expect(preview.indexOf('Verify published invitation images')).toBeLessThan(
			preview.indexOf('- name: Record success'),
		);
	});
});

describe('Repository CI on release commits', () => {
	it('runs on main pushes so the exact main SHA carries the release checks', () => {
		const ci = readFileSync(resolve('.github/workflows/commit-validation.yml'), 'utf8');
		expect(ci).toMatch(/^ {4}push:\n {8}branches:\n {12}- develop\n {12}- main\n/mu);
	});
});

describe('Cloudflare Production upload workflow contract', () => {
	const workflow = readFileSync(resolve('.github/workflows/deploy-production.yml'), 'utf8');

	it('runs only by hand, from main', () => {
		expect(workflow).toMatch(/^on:\n {4}workflow_dispatch:\n {8}inputs:\n/mu);
		expect(workflow).not.toMatch(/^ {4}(?:push|pull_request|schedule|workflow_run):/mu);
		expect(workflow).toContain(
			"if: github.ref == 'refs/heads/main' && inputs.step == 'upload'",
		);
		expect(workflow).toContain(
			"if: github.ref == 'refs/heads/main' && inputs.step == 'domain-smoke'",
		);
	});

	it('publishes the Production smoke only once the domain serves this exact commit', () => {
		const job = workflow.slice(workflow.indexOf('    domain-smoke:'));
		expect(workflow).toContain(
			`DOMAIN_SMOKE_CONTEXT: ${CLOUDFLARE_PRODUCTION_DEPLOYMENT_SMOKE}\n`,
		);
		expect(PRODUCTION_DEPLOYMENT_SMOKES).toContain(CLOUDFLARE_PRODUCTION_DEPLOYMENT_SMOKE);
		// No secrets: the job reads only the public domain.
		expect(job).not.toMatch(/secrets\.|environment:/u);
		const identity = job.indexOf('- name: Require the domain to serve this commit');
		const smoke = job.indexOf('- name: Smoke the domain');
		const success = job.indexOf('- name: Record success');
		expect(identity).toBeGreaterThan(0);
		expect(identity).toBeLessThan(smoke);
		expect(smoke).toBeLessThan(success);
		expect(job).toContain('"healthy $GITHUB_SHA production"');
		expect(job).toContain('pnpm ops:post-deploy -- check --base-url="$PRODUCTION_BASE_URL"');
		const failure = job.slice(job.indexOf('- name: Record failure'));
		expect(failure).toContain('if: failure() || cancelled()');
		expect(failure).toContain('-f context="$DOMAIN_SMOKE_CONTEXT"');
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
			`    SMOKE_CONTEXT: ${CLOUDFLARE_PRODUCTION_DEPLOYMENT_SMOKE}\n`,
		);
	});

	it('keeps its evidence in its own Cloudflare Production environment', () => {
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
