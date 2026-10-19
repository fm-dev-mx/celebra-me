import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { computeTimeLeft } from '@/lib/invitation/countdown-presentation';

/**
 * Drives the countdown's client script with a fake clock: values tick down, the minute-only
 * variant ticks once per minute, and the status replaces the timer once the event starts.
 */

const COMPONENT = join(process.cwd(), 'src/components/invitation/CountdownTimer.astro');
const TARGET_ISO = '2026-12-12T20:00:00.000Z';
const TARGET_MS = Date.parse(TARGET_ISO);
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const DAY = 24 * 60 * MINUTE;

function compileClientScript(): string {
	const source = readFileSync(COMPONENT, 'utf8');
	const match = /<script>([\s\S]*?)<\/script>/.exec(source);
	if (!match) throw new Error('CountdownTimer.astro has no client script');
	return ts.transpileModule(match[1], {
		compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
	}).outputText;
}

function mountCountdown(visibleUnits: string): void {
	const values = visibleUnits
		.split(',')
		.map((unit) => `<span data-countdown-value="${unit}" data-value="00">00</span>`)
		.join('');
	document.body.innerHTML = `
		<section class="countdown-section">
			<div data-countdown data-target-iso="${TARGET_ISO}" data-visible-units="${visibleUnits}">${values}</div>
			<p data-countdown-status hidden>La celebración ya comenzó</p>
		</section>`;
	const exports = {};
	new Function('require', 'exports', compileClientScript())(require, exports);
}

function shown(unit: string): string | null {
	return document.querySelector(`[data-countdown-value="${unit}"]`)?.textContent ?? null;
}

function timer(): HTMLElement {
	return document.querySelector<HTMLElement>('[data-countdown]')!;
}

function status(): HTMLElement {
	return document.querySelector<HTMLElement>('[data-countdown-status]')!;
}

describe('countdown timer with a fake clock', () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
		document.body.innerHTML = '';
	});

	it('splits the time left into whole units and stops at zero', () => {
		const now = TARGET_MS - (2 * DAY + 3 * 60 * MINUTE + 4 * MINUTE + 5 * SECOND);
		expect(computeTimeLeft(TARGET_MS, now)).toEqual({
			days: 2,
			hours: 3,
			minutes: 4,
			seconds: 5,
		});
		expect(computeTimeLeft(TARGET_MS, TARGET_MS + SECOND)).toEqual({
			days: 0,
			hours: 0,
			minutes: 0,
			seconds: 0,
		});
	});

	it('ticks every second when the seconds segment is visible', () => {
		jest.setSystemTime(TARGET_MS - (DAY + MINUTE + 3 * SECOND));
		mountCountdown('days,hours,minutes,seconds');

		expect([shown('days'), shown('hours'), shown('minutes'), shown('seconds')]).toEqual([
			'01',
			'00',
			'01',
			'03',
		]);
		jest.advanceTimersByTime(SECOND);
		expect(shown('seconds')).toBe('02');
		jest.advanceTimersByTime(3 * SECOND);
		expect([shown('minutes'), shown('seconds')]).toEqual(['00', '59']);
		expect(timer().hidden).toBe(false);
		expect(status().hidden).toBe(true);
	});

	it('ticks once a minute when seconds are hidden', () => {
		jest.setSystemTime(TARGET_MS - (5 * MINUTE + 30 * SECOND));
		mountCountdown('days,hours,minutes');

		expect(shown('minutes')).toBe('05');
		jest.advanceTimersByTime(59 * SECOND);
		expect(shown('minutes')).toBe('05');
		jest.advanceTimersByTime(SECOND);
		expect(shown('minutes')).toBe('04');
	});

	it('hides the timer and shows the status once the event starts', () => {
		jest.setSystemTime(TARGET_MS - 2 * SECOND);
		mountCountdown('days,hours,minutes,seconds');
		expect(status().hidden).toBe(true);

		jest.advanceTimersByTime(2 * SECOND);
		expect(timer().hidden).toBe(true);
		expect(status().hidden).toBe(false);
		expect(shown('seconds')).toBe('00');
	});
});
