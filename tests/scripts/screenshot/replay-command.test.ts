import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
	collectJobOutputDirsAbsolute,
	formatScreenshotReplayCommand,
	jobUrlToRoute,
	toClickableFileUri,
} from '../../../scripts/screenshot/replay-command';
import { parseCliArgs } from '../../../scripts/screenshot/utils';
import type { ScreenshotJob } from '../../../scripts/screenshot/types';
import { VIEWPORT_PROFILES } from '../../../scripts/screenshot/types';
import type { ResolvedScreenshotPlan } from '../../../scripts/screenshot/scope';

const LANE_BASE = 'http://localhost:4322';

function baseJob(overrides: Partial<ScreenshotJob> = {}): ScreenshotJob {
	return {
		pageType: 'invitation',
		mode: 'audit',
		url: 'http://localhost:4322/boda/daniela-y-martin',
		baseUrl: LANE_BASE,
		viewportProfile: 'invitation',
		viewports: [...VIEWPORT_PROFILES.invitation.viewports],
		target: 'critical-qa',
		includeLayout: false,
		revealHandling: 'auto',
		animationHandling: 'disable',
		sectionCapture: 'known',
		sectionExtent: 'full',
		criticalSelectors: [],
		waitSelectors: [],
		hideSelectors: [],
		authMethod: 'none',
		outputFormat: 'png',
		outputFolderStyle: 'default',
		...overrides,
	};
}

describe('screenshot replay command', () => {
	it('converts absolute job URLs to relative routes', () => {
		expect(jobUrlToRoute('http://localhost:4322/boda/daniela-y-martin')).toBe(
			'/boda/daniela-y-martin',
		);
		expect(jobUrlToRoute('http://localhost:4322/')).toBe('/');
		expect(jobUrlToRoute('/xv/demo')).toBe('/xv/demo');
	});

	it('formats invitation critical-qa with profile and reveal', () => {
		const command = formatScreenshotReplayCommand(baseJob(), { laneBaseUrl: LANE_BASE });
		expect(command).toBe(
			[
				'pnpm screenshot',
				'--url=/boda/daniela-y-martin',
				'--type=invitation',
				'--target=critical-qa',
				'--section-extent=full',
				'--profile=invitation',
				'--reveal=auto',
			].join(' '),
		);
	});

	it('formats single-section viewport crop with an explicit viewport', () => {
		const command = formatScreenshotReplayCommand(
			baseJob({
				target: 'single-section',
				sectionCapture: 'single',
				selectedSection: 'hero',
				sectionExtent: 'viewport',
				viewportProfile: 'single',
				viewports: [VIEWPORT_PROFILES.invitation.viewports[1]],
			}),
			{ laneBaseUrl: LANE_BASE },
		);
		expect(command).toContain('--target=single-section');
		expect(command).toContain('--sections=hero');
		expect(command).toContain('--section-extent=viewport');
		expect(command).toContain('--profile=single');
		expect(command).toContain('--viewport=mobile-standard');
	});

	it('emits include-layout=false only when non-default for non-invitation critical-qa', () => {
		const withoutLayout = formatScreenshotReplayCommand(
			baseJob({
				pageType: 'landing',
				url: 'http://localhost:4322/',
				target: 'critical-qa',
				includeLayout: false,
				viewportProfile: 'site',
				viewports: [...VIEWPORT_PROFILES.site.viewports],
				revealHandling: 'auto',
			}),
			{ laneBaseUrl: LANE_BASE },
		);
		expect(withoutLayout).toContain('--url=/');
		expect(withoutLayout).toContain('--type=landing');
		expect(withoutLayout).toContain('--include-layout=false');
		expect(withoutLayout).not.toContain('--reveal=');

		const withLayout = formatScreenshotReplayCommand(
			baseJob({
				pageType: 'landing',
				url: 'http://localhost:4322/',
				target: 'critical-qa',
				includeLayout: true,
				viewportProfile: 'site',
				viewports: [...VIEWPORT_PROFILES.site.viewports],
				revealHandling: 'auto',
			}),
			{ laneBaseUrl: LANE_BASE },
		);
		expect(withLayout).not.toContain('--include-layout=');
	});

	it('emits --base-url when the job base differs from the lane default', () => {
		const command = formatScreenshotReplayCommand(
			baseJob({ baseUrl: 'http://localhost:9999' }),
			{ laneBaseUrl: LANE_BASE },
		);
		expect(command).toContain('--base-url=http://localhost:9999');
	});

	it('round-trips primary flags through parseCliArgs', () => {
		const command = formatScreenshotReplayCommand(
			baseJob({
				target: 'single-section',
				selectedSection: 'hero',
				sectionExtent: 'viewport',
				viewportProfile: 'single',
				viewports: [VIEWPORT_PROFILES.invitation.viewports[1]],
				mode: 'raw',
				revealHandling: 'force-open',
			}),
			{ laneBaseUrl: LANE_BASE },
		);
		const argv = ['node', 'cli.ts', ...command.split(' ').slice(2)];
		const options = parseCliArgs(argv);
		expect(options.url).toBe('/boda/daniela-y-martin');
		expect(options.pageType).toBe('invitation');
		expect(options.target).toBe('single-section');
		expect(options.sections).toBe('hero');
		expect(options.sectionExtent).toBe('viewport');
		expect(options.profile).toBe('single');
		expect(options.viewport).toEqual(['mobile-standard']);
		expect(options.mode).toBe('raw');
		expect(options.reveal).toBe('force-open');
	});

	it('resolves absolute clickable output directories from the job scope', () => {
		const cwd = path.resolve('/repo-root');
		const job = baseJob({
			scope: {
				invitations: [{ outputDir: 'screenshots/boda-daniela-y-martin' }],
			} as ResolvedScreenshotPlan,
		});
		const dirs = collectJobOutputDirsAbsolute([job], cwd);
		expect(dirs).toEqual([path.resolve(cwd, 'screenshots/boda-daniela-y-martin')]);
		expect(toClickableFileUri(dirs[0])).toBe(pathToFileURL(dirs[0]).href);
	});
});
