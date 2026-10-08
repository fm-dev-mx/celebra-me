/**
 * Shared prompt helpers for the operator CLIs (dbs, invitation:release, prod:apply).
 *
 * One prompt library (@inquirer/prompts), one theme, one gating rule for interactivity, one
 * Ctrl+C behavior. Prompts and human lines go to stderr so stdout stays usable for data.
 * These helpers never authorize writes: Production and Preview gates keep their own prompts.
 */
import { checkbox, confirm, input, number, search, select, Separator } from '@inquirer/prompts';
import { isAgentContext } from '../db/production-boundary-policy.ts';
import { createTheme, promptTheme, stripAnsi, type Theme } from './cli-theme.ts';

const MENU_SEPARATOR = 'separator' as const;

export interface MenuItem<T extends string> {
	value: T;
	label: string;
	/** Short dim hint shown under the highlighted item. */
	hint?: string;
	disabled?: boolean | string;
	/** Destructive or hosted-write action: rendered in red, never the default. */
	danger?: boolean;
}

export interface MenuOptions<T extends string> {
	title: string;
	items: ReadonlyArray<MenuItem<T> | typeof MENU_SEPARATOR>;
	/** Preselected item; ignored when it points to a danger item. */
	initial?: T;
	pageSize?: number;
}

type PromptContext = { input?: NodeJS.ReadableStream; output?: NodeJS.WritableStream };

const promptContext: PromptContext = { output: process.stderr };

export function theme(): Theme {
	return createTheme();
}

function writeHumanLine(text = ''): void {
	const out = promptContext.output ?? process.stderr;
	out.write(`${text}\n`);
}

export function printLine(text = ''): void {
	writeHumanLine(text);
}

/** Interactive only on a real terminal (stdin, stdout and stderr) and never in agent context. */
export function isInteractiveSession(
	env: NodeJS.ProcessEnv = process.env,
	streams: {
		stdin?: { isTTY?: boolean };
		stdout?: { isTTY?: boolean };
		stderr?: { isTTY?: boolean };
	} = process,
): boolean {
	if (isAgentContext(env)) return false;
	return Boolean(streams.stdin?.isTTY && streams.stdout?.isTTY && streams.stderr?.isTTY);
}

export class NonInteractiveError extends Error {
	constructor(script: string, usageHint: string) {
		super(`${script} needs a terminal or explicit flags. Try: ${usageHint}`);
		this.name = 'NonInteractiveError';
	}
}

export function isPromptExit(error: unknown): boolean {
	if (!(error instanceof Error)) return false;
	return error.name === 'ExitPromptError' || error.message.includes('User force closed');
}

function firstSelectable<T extends string>(
	items: ReadonlyArray<MenuItem<T> | typeof MENU_SEPARATOR>,
	initial: T | undefined,
): T | undefined {
	const candidate = items.find(
		(item): item is MenuItem<T> =>
			item !== MENU_SEPARATOR && item.value === initial && !item.danger && !item.disabled,
	);
	if (candidate) return candidate.value;
	const fallback = items.find(
		(item): item is MenuItem<T> => item !== MENU_SEPARATOR && !item.danger && !item.disabled,
	);
	return fallback?.value;
}

export async function menu<T extends string>(options: MenuOptions<T>): Promise<T> {
	const t = theme();
	const choices = options.items.map((item) =>
		item === MENU_SEPARATOR
			? new Separator(t.rule(24))
			: {
					value: item.value,
					name: item.danger ? t.red(item.label) : item.label,
					description: item.hint,
					disabled: item.disabled,
				},
	);
	return select<T>(
		{
			message: options.title,
			choices,
			default: firstSelectable(options.items, options.initial),
			pageSize: options.pageSize ?? 12,
			loop: false,
			theme: promptTheme(t),
		},
		promptContext,
	);
}

export interface PickItem<T extends string> {
	value: T;
	label: string;
	checked?: boolean;
	disabled?: boolean | string;
}

export async function pickMany<T extends string>(options: {
	title: string;
	items: ReadonlyArray<PickItem<T>>;
	required?: boolean;
}): Promise<T[]> {
	return checkbox<T>(
		{
			message: options.title,
			choices: options.items.map((item) => ({
				value: item.value,
				name: item.label,
				checked: item.checked ?? false,
				disabled: item.disabled,
			})),
			required: options.required ?? false,
			pageSize: 12,
			loop: false,
			theme: promptTheme(theme()),
		},
		promptContext,
	);
}

export interface SearchItem<T extends string> {
	value: T;
	label: string;
	/** Extra lowercase terms matched besides the label. */
	keywords?: string;
}

/** Searchable list with a trailing escape item (default label "Back"). */
export async function searchOne<T extends string, B extends string = 'back'>(options: {
	title: string;
	items: ReadonlyArray<SearchItem<T>>;
	backValue?: B;
	backLabel?: string;
	limit?: number;
}): Promise<T | B> {
	const backValue = (options.backValue ?? 'back') as B;
	const backLabel = options.backLabel ?? 'Back';
	const limit = options.limit ?? 30;
	return search<T | B>(
		{
			message: options.title,
			source: (term) => {
				const query = (term ?? '').trim().toLocaleLowerCase();
				const matches = options.items.filter((item) => {
					if (!query) return true;
					const haystack = `${item.label} ${item.keywords ?? ''}`.toLocaleLowerCase();
					return haystack.includes(query);
				});
				return [
					...matches.slice(0, limit).map((item) => ({
						name: item.label,
						value: item.value,
					})),
					{ name: `${theme().symbol('arrow')} ${backLabel}`, value: backValue },
				];
			},
			pageSize: 12,
			theme: promptTheme(theme()),
		},
		promptContext,
	);
}

export async function askText(options: {
	title: string;
	initial?: string;
	required?: boolean;
	validate?: (value: string) => true | string;
}): Promise<string> {
	const value = await input(
		{
			message: options.title,
			default: options.initial,
			required: options.required ?? false,
			validate: options.validate
				? (candidate) => options.validate!(candidate.trim())
				: undefined,
			theme: promptTheme(theme()),
		},
		promptContext,
	);
	return value.trim();
}

export async function askNumber(options: {
	title: string;
	initial: number;
	min?: number;
	max?: number;
}): Promise<number> {
	const value = await number(
		{
			message: options.title,
			default: options.initial,
			min: options.min,
			max: options.max,
			required: true,
			theme: promptTheme(theme()),
		},
		promptContext,
	);
	return value;
}

/** Yes/No with the safe answer preselected (defaults to No). */
export async function confirmAction(options: {
	question: string;
	initial?: boolean;
}): Promise<boolean> {
	return confirm(
		{
			message: options.question,
			default: options.initial ?? false,
			theme: promptTheme(theme()),
		},
		promptContext,
	);
}

/**
 * Red banner followed by a No-default confirmation. Used before every hosted write or
 * destructive step; the domain gates (typed YES, owner code) still run afterwards.
 */
export async function confirmDanger(options: {
	title: string;
	facts: ReadonlyArray<string>;
	question: string;
}): Promise<boolean> {
	const t = theme();
	writeHumanLine();
	writeHumanLine(t.banner(options.title, options.facts));
	writeHumanLine();
	return confirmAction({ question: options.question, initial: false });
}

export interface StepOptions<T> {
	/** Result line replacing the spinner on success (defaults to the label). */
	done?: (result: T) => string;
}

/**
 * Run a slow operation behind a spinner (TTY) or a plain "… label" line (non-TTY), then
 * replace it with one result line. Do not wrap steps that prompt the operator.
 */
export async function step<T>(
	label: string,
	run: () => Promise<T>,
	options: StepOptions<T> = {},
): Promise<T> {
	const t = theme();
	const out = promptContext.output ?? process.stderr;
	const animate = Boolean((out as NodeJS.WriteStream).isTTY) && t.enabled && !process.env.CI;
	let frame = 0;
	let timer: NodeJS.Timeout | undefined;
	const render = (): void => {
		const glyph = t.spinnerFrames[frame % t.spinnerFrames.length] ?? '';
		out.write(`\r\x1b[2K${t.cyan(glyph)} ${label}`);
		frame += 1;
	};
	if (animate) {
		render();
		timer = setInterval(render, 80);
	} else {
		out.write(`${t.symbol('ellipsis')} ${label}\n`);
	}
	const finish = (): void => {
		if (timer) clearInterval(timer);
		if (animate) out.write('\r\x1b[2K');
	};
	try {
		const result = await run();
		finish();
		out.write(`${t.mark('ok', options.done ? options.done(result) : label)}\n`);
		return result;
	} catch (error) {
		finish();
		out.write(`${t.mark('fail', label)}\n`);
		throw error;
	}
}

/** One-line error for interactive flows. */
function describeError(error: unknown): string {
	const message = error instanceof Error ? error.message : String(error);
	const firstLine = stripAnsi(message).split(/\r?\n/)[0] ?? message;
	return theme().mark('fail', firstLine);
}

/**
 * Run an interactive main: Ctrl+C ends with a short line and exit code 130 (no stack trace);
 * other errors are rendered as one line and exit code 1.
 */
export async function runInteractive(main: () => Promise<void>): Promise<void> {
	try {
		await main();
	} catch (error) {
		if (isPromptExit(error)) {
			writeHumanLine();
			writeHumanLine(theme().mark('warn', 'Cancelled. Nothing else was run.'));
			process.exitCode = 130;
			return;
		}
		writeHumanLine(describeError(error));
		process.exitCode = 1;
	}
}
