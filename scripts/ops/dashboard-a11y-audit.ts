/**
 * Dashboard accessibility audit.
 *
 * Runs axe-core (WCAG 2.x A/AA) against the dashboard routes at the audit
 * viewports, measures horizontal overflow and small touch targets, and saves
 * one full-page screenshot per route and viewport.
 *
 *   pnpm audit:dashboard-a11y --login            # headed: sign in once, save storage state
 *   pnpm audit:dashboard-a11y --label=before     # headless run using the saved storage state
 *   pnpm audit:dashboard-a11y --routes=/dashboard/invitados --viewports=320,1366
 *
 * Output: .agent/tmp/dashboard-a11y/<label>/{report.json,report.md,*.png}
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, type BrowserContext, type Page } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const DEFAULT_BASE_URL = 'http://localhost:4322';
const DEFAULT_STORAGE_STATE = 'playwright/.auth/user.json';
const DEFAULT_OUTPUT_ROOT = '.agent/tmp/dashboard-a11y';
const MIN_TOUCH_TARGET_PX = 44;
const INTERACTIVE_SELECTOR =
	'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [role="tab"], [role="checkbox"]';

const DEFAULT_ROUTES = [
	'/dashboard/invitados',
	'/dashboard/memories',
	'/dashboard/admin',
	'/dashboard/admin/recuerdos',
	'/dashboard/admin/plataforma',
	'/dashboard/estado',
	'/dashboard/claimcodes',
	'/dashboard/invitaciones',
	'/dashboard/commercial',
	'/dashboard/usuarios',
];

interface ViewportSpec {
	name: string;
	width: number;
	height: number;
	/** Root font-size multiplier emulating the OS "large text" setting. */
	fontScale: number;
	mobile: boolean;
}

const VIEWPORTS: ViewportSpec[] = [
	{ name: '320', width: 320, height: 568, fontScale: 1, mobile: true },
	{ name: '375', width: 375, height: 667, fontScale: 1, mobile: true },
	{ name: '412x150', width: 412, height: 915, fontScale: 1.5, mobile: true },
	{ name: '768', width: 768, height: 1024, fontScale: 1, mobile: false },
	{ name: '1366', width: 1366, height: 768, fontScale: 1, mobile: false },
];

interface AxeViolationSummary {
	id: string;
	impact: string;
	help: string;
	nodes: number;
	targets: string[];
}

interface SmallTarget {
	element: string;
	width: number;
	height: number;
}

interface PageMeasurements {
	horizontalOverflow: boolean;
	overflowingElements: string[];
	smallTargets: SmallTarget[];
}

interface RouteViewportResult extends PageMeasurements {
	route: string;
	viewport: string;
	status: number | null;
	finalUrl: string;
	violations: AxeViolationSummary[];
	screenshot: string;
	error?: string;
}

interface CliOptions {
	baseUrl: string;
	storageState: string;
	label: string;
	login: boolean;
	routes: string[];
	viewports: ViewportSpec[];
}

function parseArgs(argv: string[]): CliOptions {
	const flags = new Map<string, string>();
	for (const arg of argv) {
		if (!arg.startsWith('--')) continue;
		const eq = arg.indexOf('=');
		if (eq === -1) flags.set(arg.slice(2), 'true');
		else flags.set(arg.slice(2, eq), arg.slice(eq + 1));
	}
	const viewportNames = flags.get('viewports');
	const viewports = viewportNames
		? VIEWPORTS.filter((vp) => viewportNames.split(',').includes(vp.name))
		: VIEWPORTS;
	if (viewports.length === 0) throw new Error(`Unknown viewports: ${viewportNames}`);
	return {
		baseUrl: (flags.get('base-url') ?? DEFAULT_BASE_URL).replace(/\/+$/, ''),
		storageState: flags.get('storage-state') ?? DEFAULT_STORAGE_STATE,
		label: flags.get('label') ?? new Date().toISOString().replace(/[:.]/g, '-'),
		login: flags.get('login') === 'true',
		routes: flags.get('routes')?.split(',').filter(Boolean) ?? DEFAULT_ROUTES,
		viewports,
	};
}

async function saveLoginState(options: CliOptions): Promise<void> {
	const browser = await chromium.launch({ headless: false });
	const context = await browser.newContext({ locale: 'es-MX' });
	const page = await context.newPage();
	await page.goto(`${options.baseUrl}/login`);
	console.log(
		'Sign in in the browser window; the storage state is saved once the dashboard loads.',
	);
	await page.waitForURL((url) => url.pathname.startsWith('/dashboard'), {
		timeout: 10 * 60 * 1000,
	});
	mkdirSync(resolve(options.storageState, '..'), { recursive: true });
	await context.storageState({ path: options.storageState });
	await browser.close();
	console.log(`Storage state saved to ${options.storageState}`);
}

function measurePage(page: Page): Promise<PageMeasurements> {
	return page.evaluate(
		({ selector, minSize }) => {
			const root = document.documentElement;
			const viewportWidth = root.clientWidth;
			const horizontalOverflow = root.scrollWidth > viewportWidth;
			const describe = (el: Element) => {
				const text = (el.getAttribute('aria-label') ?? el.textContent ?? '')
					.trim()
					.slice(0, 40);
				const firstClass =
					typeof el.className === 'string' ? el.className.split(/\s+/)[0] : '';
				const cls = firstClass ? `.${firstClass}` : '';
				return `${el.tagName.toLowerCase()}${cls}${text ? ` "${text}"` : ''}`;
			};
			const overflowingElements: string[] = [];
			if (horizontalOverflow) {
				for (const el of Array.from(document.body.querySelectorAll('*'))) {
					const rect = el.getBoundingClientRect();
					if (rect.width > 0 && rect.right > viewportWidth + 1) {
						overflowingElements.push(describe(el));
						if (overflowingElements.length >= 12) break;
					}
				}
			}
			const smallTargets: { element: string; width: number; height: number }[] = [];
			for (const el of Array.from(document.querySelectorAll(selector))) {
				const rect = el.getBoundingClientRect();
				const style = getComputedStyle(el);
				if (rect.width === 0 || rect.height === 0 || style.visibility === 'hidden')
					continue;
				if (rect.width < minSize || rect.height < minSize) {
					smallTargets.push({
						element: describe(el),
						width: Math.round(rect.width),
						height: Math.round(rect.height),
					});
				}
			}
			return { horizontalOverflow, overflowingElements, smallTargets };
		},
		{ selector: INTERACTIVE_SELECTOR, minSize: MIN_TOUCH_TARGET_PX },
	);
}

async function auditRoute(
	context: BrowserContext,
	options: CliOptions,
	route: string,
	viewport: ViewportSpec,
	outDir: string,
): Promise<RouteViewportResult> {
	const page = await context.newPage();
	const slug = `${route.replace(/^\//, '').replace(/\//g, '_') || 'root'}--${viewport.name}`;
	const screenshot = resolve(outDir, `${slug}.png`);
	const result: RouteViewportResult = {
		route,
		viewport: viewport.name,
		status: null,
		finalUrl: '',
		violations: [],
		horizontalOverflow: false,
		overflowingElements: [],
		smallTargets: [],
		screenshot,
	};
	try {
		const response = await page.goto(`${options.baseUrl}${route}`, {
			waitUntil: 'networkidle',
		});
		result.status = response?.status() ?? null;
		result.finalUrl = page.url();
		if (viewport.fontScale !== 1) {
			await page.evaluate((scale) => {
				document.documentElement.style.fontSize = `${scale * 100}%`;
			}, viewport.fontScale);
			await page.waitForTimeout(300);
		}
		const axe = await new AxeBuilder({ page })
			.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
			.analyze();
		result.violations = axe.violations.map((violation) => ({
			id: violation.id,
			impact: violation.impact ?? 'unknown',
			help: violation.help,
			nodes: violation.nodes.length,
			targets: violation.nodes.slice(0, 5).map((node) => node.target.join(' ')),
		}));
		Object.assign(result, await measurePage(page));
		await page.screenshot({ path: screenshot, fullPage: true });
	} catch (error) {
		result.error = error instanceof Error ? error.message : String(error);
	} finally {
		await page.close();
	}
	return result;
}

const IMPACT_ORDER: Record<string, number> = {
	critical: 0,
	serious: 1,
	moderate: 2,
	minor: 3,
	unknown: 4,
};

function renderMarkdown(results: RouteViewportResult[]): string {
	const lines: string[] = ['# Dashboard a11y audit', ''];
	lines.push(
		'| Route | Viewport | Status | Axe (crit/ser/mod/min) | Overflow | Targets < 44px |',
	);
	lines.push('| --- | --- | --- | --- | --- | --- |');
	for (const r of results) {
		const count = (impact: string) =>
			r.violations.filter((v) => v.impact === impact).reduce((n, v) => n + v.nodes, 0);
		const axe = `${count('critical')}/${count('serious')}/${count('moderate')}/${count('minor')}`;
		const status = r.error ? `error: ${r.error.slice(0, 60)}` : String(r.status);
		lines.push(
			`| ${r.route} | ${r.viewport} | ${status} | ${axe} | ${r.horizontalOverflow ? 'yes' : 'no'} | ${r.smallTargets.length} |`,
		);
	}
	lines.push('', '## Violations by rule', '');
	const byRule = new Map<string, { impact: string; help: string; where: string[] }>();
	for (const r of results) {
		for (const v of r.violations) {
			const entry = byRule.get(v.id) ?? { impact: v.impact, help: v.help, where: [] };
			entry.where.push(`${r.route}@${r.viewport} (${v.nodes}: ${v.targets.join('; ')})`);
			byRule.set(v.id, entry);
		}
	}
	const sortedRules = [...byRule.entries()].sort(
		(a, b) => (IMPACT_ORDER[a[1].impact] ?? 9) - (IMPACT_ORDER[b[1].impact] ?? 9),
	);
	for (const [id, entry] of sortedRules) {
		lines.push(`### ${id} — ${entry.impact}`, '', entry.help, '');
		for (const where of entry.where) lines.push(`- ${where}`);
		lines.push('');
	}
	lines.push('## Overflow and touch targets', '');
	for (const r of results) {
		if (!r.horizontalOverflow && r.smallTargets.length === 0) continue;
		lines.push(`### ${r.route} @ ${r.viewport}`, '');
		for (const el of r.overflowingElements) lines.push(`- overflow: ${el}`);
		for (const t of r.smallTargets) lines.push(`- ${t.width}×${t.height}: ${t.element}`);
		lines.push('');
	}
	return lines.join('\n');
}

async function main(): Promise<void> {
	const options = parseArgs(process.argv.slice(2));
	if (options.login) {
		await saveLoginState(options);
		return;
	}
	if (!existsSync(options.storageState)) {
		throw new Error(
			`Storage state not found at ${options.storageState}. Run with --login first.`,
		);
	}
	const outDir = resolve(DEFAULT_OUTPUT_ROOT, options.label);
	mkdirSync(outDir, { recursive: true });
	const browser = await chromium.launch();
	const results: RouteViewportResult[] = [];
	for (const viewport of options.viewports) {
		const context = await browser.newContext({
			storageState: options.storageState,
			locale: 'es-MX',
			timezoneId: 'America/Mexico_City',
			isMobile: viewport.mobile,
			hasTouch: viewport.mobile,
			deviceScaleFactor: viewport.mobile ? 2 : 1,
			viewport: { width: viewport.width, height: viewport.height },
		});
		for (const route of options.routes) {
			const result = await auditRoute(context, options, route, viewport, outDir);
			results.push(result);
			const summary = result.error
				? result.error
				: `status ${result.status}, ${result.violations.length} rules, overflow=${result.horizontalOverflow}, small=${result.smallTargets.length}`;
			console.log(`${route} @ ${viewport.name}: ${summary}`);
		}
		await context.close();
	}
	await browser.close();
	writeFileSync(resolve(outDir, 'report.json'), JSON.stringify(results, null, 2));
	writeFileSync(resolve(outDir, 'report.md'), renderMarkdown(results));
	console.log(`Report written to ${outDir}`);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
