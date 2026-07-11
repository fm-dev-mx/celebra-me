import fs from 'node:fs';
import path from 'node:path';

type PackageManifest = {
	scripts?: Record<string, string>;
};

function readPackageManifest(): PackageManifest {
	const packagePath = path.resolve(process.cwd(), 'package.json');
	return JSON.parse(fs.readFileSync(packagePath, 'utf8')) as PackageManifest;
}

describe('canonical validation contract', () => {
	it('keeps full Stylelint and the production build in the canonical CI command', () => {
		const ci = readPackageManifest().scripts?.['ci'] ?? '';

		expect(ci).toContain('pnpm lint:styles');
		expect(ci).not.toContain('pnpm lint:styles:changed');
		expect(ci).toContain('pnpm build:app');
		expect(ci).toContain('pnpm agent:git-safety:check');
	});

	it("keeps GitHub Actions on the canonical CI command", () => {
		const workflowPath = path.resolve(process.cwd(), ".github/workflows/commit-validation.yml");
		expect(() => fs.readFileSync(workflowPath, "utf8")).not.toThrow();
		const workflow = fs.readFileSync(workflowPath, "utf8");
		expect(workflow).toContain("run: pnpm run ci");
	});
});
