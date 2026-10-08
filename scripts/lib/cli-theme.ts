/**
 * Shared terminal theme for the operator CLIs (dbs, invitation:release, prod:apply).
 *
 * Pure presentation: capability detection (color, unicode, TTY), a semantic palette with
 * fixed meanings (ok=green, warn=yellow, fail=red, info=cyan), environment tags
 * (Local green, Preview yellow, Production bold red), symbols with ASCII fallback, and
 * small layout helpers (header, summary, rule, banner). No I/O, no prompts.
 */

export type ThemeEnvironment = 'local' | 'preview' | 'production' | 'disposable-test';

export type SymbolKind =
	| 'ok'
	| 'warn'
	| 'fail'
	| 'info'
	| 'pending'
	| 'bullet'
	| 'arrow'
	| 'pointer'
	| 'ellipsis'
	| 'checked'
	| 'unchecked';

export interface ThemeStreams {
	stdout?: { isTTY?: boolean };
	stderr?: { isTTY?: boolean };
}

export interface ThemeInput {
	env?: NodeJS.ProcessEnv;
	streams?: ThemeStreams;
	platform?: NodeJS.Platform;
}

type Painter = (text: string) => string;

const UNICODE_SYMBOLS: Record<SymbolKind, string> = {
	ok: '✔',
	warn: '⚠',
	fail: '✖',
	info: '●',
	pending: '○',
	bullet: '·',
	arrow: '→',
	pointer: '❯',
	ellipsis: '…',
	checked: '◉',
	unchecked: '◯',
};

const ASCII_SYMBOLS: Record<SymbolKind, string> = {
	ok: '+',
	warn: '!',
	fail: 'x',
	info: '*',
	pending: 'o',
	bullet: '-',
	arrow: '->',
	pointer: '>',
	ellipsis: '...',
	checked: '[x]',
	unchecked: '[ ]',
};

const UNICODE_SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const ASCII_SPINNER_FRAMES = ['-', '\\', '|', '/'];

const ENVIRONMENT_NAMES: Record<ThemeEnvironment, string> = {
	local: 'Local',
	preview: 'Preview',
	production: 'Production',
	'disposable-test': 'Disposable-test',
};

/**
 * Color is on when FORCE_COLOR asks for it, off under NO_COLOR, and otherwise only when
 * both stdout and stderr are terminals (a redirected stdout disables color everywhere so
 * captured files stay plain).
 */
export function colorEnabled(
	env: NodeJS.ProcessEnv = process.env,
	streams: ThemeStreams = process,
): boolean {
	if (env.NO_COLOR) return false;
	if (env.FORCE_COLOR === '0' || env.FORCE_COLOR === 'false') return false;
	if (env.FORCE_COLOR !== undefined && env.FORCE_COLOR !== '') return true;
	return Boolean(streams.stdout?.isTTY && streams.stderr?.isTTY);
}

/**
 * Unicode symbols are safe on every non-Windows terminal except the Linux console, and on
 * Windows Terminal, VS Code, Git Bash (mintty / MSYS) and other modern hosts. Legacy conhost
 * falls back to ASCII. CELEBRA_CLI_ASCII=1 forces the ASCII set for testing.
 */
export function unicodeEnabled(
	env: NodeJS.ProcessEnv = process.env,
	platform: NodeJS.Platform = process.platform,
): boolean {
	if (env.CELEBRA_CLI_ASCII === '1') return false;
	if (platform !== 'win32') return env.TERM !== 'linux';
	return Boolean(
		env.WT_SESSION ||
		env.MSYSTEM ||
		env.TERM_PROGRAM === 'vscode' ||
		env.TERM_PROGRAM === 'mintty' ||
		env.TERM === 'xterm-256color' ||
		env.TERM === 'alacritty' ||
		env.ConEmuANSI === 'ON' ||
		env.TERMINAL_EMULATOR === 'JetBrains-JediTerm',
	);
}

// eslint-disable-next-line no-control-regex
const ANSI_PATTERN = /\x1b\[[0-9;?]*[ -/]*[@-~]/g;

export function stripAnsi(value: string): string {
	return value.replace(ANSI_PATTERN, '');
}

export function visibleWidth(value: string): number {
	return [...stripAnsi(value)].length;
}

export function padVisible(value: string, width: number): string {
	const length = visibleWidth(value);
	return length >= width ? value : value + ' '.repeat(width - length);
}

export interface Theme {
	readonly enabled: boolean;
	readonly unicode: boolean;
	readonly spinnerFrames: readonly string[];
	bold: Painter;
	dim: Painter;
	red: Painter;
	green: Painter;
	yellow: Painter;
	cyan: Painter;
	/** Semantic aliases with fixed meanings. */
	ok: Painter;
	warn: Painter;
	fail: Painter;
	info: Painter;
	symbol(kind: SymbolKind): string;
	/** `<colored symbol> <text>`; the text keeps its own color. */
	mark(kind: 'ok' | 'warn' | 'fail' | 'info' | 'pending', text: string): string;
	/** Environment name with its fixed color (Production is bold red). */
	env(environment: ThemeEnvironment): string;
	envName(environment: ThemeEnvironment): string;
	/** One-line header: `script  ·  fact  ·  fact`. */
	header(script: string, facts: ReadonlyArray<string>): string;
	/** Aligned label/value block with an optional title. */
	summary(title: string | null, rows: ReadonlyArray<readonly [string, string]>): string;
	rule(width?: number): string;
	/** Red block used right before a Production or destructive confirmation. */
	banner(title: string, facts: ReadonlyArray<string>): string;
}

function paint(enabled: boolean, open: string, close = '\x1b[0m'): Painter {
	return (text) => (enabled && text ? `${open}${text}${close}` : text);
}

export function createTheme(input: ThemeInput = {}): Theme {
	const env = input.env ?? process.env;
	const enabled = colorEnabled(env, input.streams ?? process);
	const unicode = unicodeEnabled(env, input.platform ?? process.platform);
	const symbols = unicode ? UNICODE_SYMBOLS : ASCII_SYMBOLS;

	const bold = paint(enabled, '\x1b[1m', '\x1b[22m');
	const dim = paint(enabled, '\x1b[2m', '\x1b[22m');
	const red = paint(enabled, '\x1b[31m', '\x1b[39m');
	const green = paint(enabled, '\x1b[32m', '\x1b[39m');
	const yellow = paint(enabled, '\x1b[33m', '\x1b[39m');
	const cyan = paint(enabled, '\x1b[36m', '\x1b[39m');
	const gray = paint(enabled, '\x1b[90m', '\x1b[39m');

	const envPainter: Record<ThemeEnvironment, Painter> = {
		local: green,
		preview: yellow,
		production: (text) => bold(red(text)),
		'disposable-test': gray,
	};

	const semanticPainter = {
		ok: green,
		warn: yellow,
		fail: red,
		info: cyan,
		pending: yellow,
	} as const;

	const theme: Theme = {
		enabled,
		unicode,
		spinnerFrames: unicode ? UNICODE_SPINNER_FRAMES : ASCII_SPINNER_FRAMES,
		bold,
		dim,
		red,
		green,
		yellow,
		cyan,
		ok: green,
		warn: yellow,
		fail: red,
		info: cyan,
		symbol: (kind) => symbols[kind],
		mark: (kind, text) => `${semanticPainter[kind](symbols[kind])} ${text}`,
		env: (environment) => envPainter[environment](ENVIRONMENT_NAMES[environment]),
		envName: (environment) => ENVIRONMENT_NAMES[environment],
		header: (script, facts) =>
			[bold(script), ...facts.filter(Boolean)].join(`  ${dim(symbols.bullet)}  `),
		summary: (title, rows) => {
			const width = rows.reduce((max, [label]) => Math.max(max, visibleWidth(label)), 0);
			const lines = title ? [bold(title)] : [];
			for (const [label, value] of rows) {
				lines.push(`  ${padVisible(dim(label), width)}  ${value}`);
			}
			return lines.join('\n');
		},
		rule: (width = 60) => dim((unicode ? '─' : '-').repeat(width)),
		banner: (title, facts) => {
			const bar = (unicode ? '━' : '=').repeat(4);
			const head = bold(red(`${bar} ${title} ${bar}`));
			return [head, ...facts.map((fact) => `  ${red(fact)}`)].join('\n');
		},
	};
	return theme;
}

/** Inquirer-compatible theme object derived from the shared palette. */
export function promptTheme(theme: Theme = createTheme()): {
	prefix: { idle: string; done: string };
	spinner: { interval: number; frames: string[] };
	icon: { cursor: string; checked: string; unchecked: string };
	style: {
		message: (text: string) => string;
		answer: (text: string) => string;
		highlight: (text: string) => string;
		help: (text: string) => string;
		error: (text: string) => string;
		defaultAnswer: (text: string) => string;
		description: (text: string) => string;
		disabled: (text: string) => string;
		key: (text: string) => string;
		searchTerm: (text: string) => string;
		keysHelpTip: (keys: ReadonlyArray<readonly [string, string]>) => string;
	};
} {
	const asciiKey = (key: string): string =>
		key.replace(
			/[^ -~]+/g,
			(glyph) =>
				({ '↑↓': 'up/down', '←→': 'left/right', '⏎': 'enter', '␣': 'space', '⇥': 'tab' })[
					glyph
				] ?? '',
		);
	return {
		prefix: { idle: theme.cyan('?'), done: theme.green(theme.symbol('ok')) },
		spinner: { interval: 80, frames: [...theme.spinnerFrames] },
		icon: {
			cursor: theme.symbol('pointer'),
			checked: theme.green(theme.symbol('checked')),
			unchecked: theme.symbol('unchecked'),
		},
		style: {
			message: (text) => theme.bold(text),
			answer: (text) => theme.green(text),
			highlight: (text) => theme.cyan(text),
			help: (text) => theme.dim(text),
			error: (text) => theme.red(`${theme.symbol('fail')} ${text}`),
			defaultAnswer: (text) => theme.dim(`(${text})`),
			description: (text) => theme.dim(text),
			disabled: (text) => theme.dim(`- ${text}`),
			key: (text) => theme.cyan(`<${text}>`),
			searchTerm: (text) => theme.cyan(text),
			keysHelpTip: (keys) =>
				theme.dim(
					keys
						.map(([key, action]) => `${theme.unicode ? key : asciiKey(key)} ${action}`)
						.join(theme.unicode ? ' • ' : ' | '),
				),
		},
	};
}
