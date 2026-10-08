import path from 'node:path';

export const TABLE_RULES = Object.freeze({
	maxColumns: 4,
	warningMaxCellCharacters: 120,
	blockingMaxCellCharacters: 240,
});

const ACTIVE_MARKDOWN_PREFIXES = [
	'AGENTS.md',
	'README.md',
	'.agent/index.md',
	'.agent/load-skills.md',
	'.agent/rules/',
	'.agent/workflows/',
	'.agent/skills/',
	'.agent/templates/',
	'docs/core/',
	'docs/domains/',
	'docs/invitations/',
];

const TABLE_RECOMMENDATION =
	'Convert narrative table content to a paragraph, list, or separate subsection.';

const PARSED_TABLE_RECOMMENDATION =
	'This table is read by the invitation preparation parser, so it is never converted automatically. Keep the cell short and move notes to prose below the table.';

/**
 * Headings whose tables are read row-by-row by the invitation preparation parser
 * (`src/lib/invitation-preparation/markdown-state.ts`). Keep these aligned with
 * the parser: converting such a table into a list silently drops its data.
 */
const MACHINE_PARSED_HEADINGS = [
	{ pattern: /fact register/iu, label: 'Fact Register' },
	{ pattern: /^placeholders\b/iu, label: 'Placeholders' },
	{ pattern: /^photograph inventory\b/iu, label: 'Photograph Inventory' },
	{
		pattern: /uniqueness\s+table|photo-role\s+map|final photo-role map/iu,
		label: 'uniqueness table',
	},
	{ pattern: /^identity\b/iu, label: 'Identity' },
	{ pattern: /^design direction\b/iu, label: 'Design Direction' },
];

/** Row labels the parser matches anywhere in the document (Event Type, creative outcome, demo). */
const MACHINE_PARSED_ROW_LABELS = new Set([
	'event type',
	'human creative outcome',
	'client-selected demo',
	'owner-selected base demo',
]);

const PLACEHOLDER_TOKEN = /^\[\[PENDIENTE:[A-Z0-9_]+\]\]$/u;

function normalizePath(file) {
	const candidate = path.isAbsolute(file) ? path.relative(process.cwd(), file) : file;
	return candidate.replaceAll('\\', '/').replace(/^\.\//u, '');
}

export function isActiveMarkdownPath(file) {
	const normalized = normalizePath(file);
	return (
		normalized.endsWith('.md') &&
		ACTIVE_MARKDOWN_PREFIXES.some(
			(prefix) => normalized === prefix || normalized.startsWith(prefix),
		)
	);
}

function findChild(token, type) {
	return (token?.children ?? []).find((child) => child.type === type);
}

function findDescendant(token, type) {
	if (!token) return undefined;
	if (token.type === type) return token;
	for (const child of token.children ?? []) {
		const match = findDescendant(child, type);
		if (match) return match;
	}
	return undefined;
}

function visibleInlineText(token) {
	if (!token) return '';

	if (token.type === 'codeText') {
		return (token.children ?? [])
			.filter((child) => child.type === 'codeTextData')
			.map((child) => child.text.replace(/\\([\\|])/gu, '$1'))
			.join('');
	}

	if (token.type === 'link' || token.type === 'image') {
		const labelText = findDescendant(token, 'labelText');
		return labelText ? visibleInlineText(labelText) : '';
	}

	if (token.type === 'characterEscape') {
		return findChild(token, 'characterEscapeValue')?.text ?? '';
	}

	if (
		token.type.endsWith('Sequence') ||
		token.type.endsWith('Marker') ||
		token.type === 'resource' ||
		token.type === 'reference' ||
		token.type === 'resourceDestination'
	) {
		return (token.children ?? []).map(visibleInlineText).join('');
	}

	if (token.type === 'htmlText') {
		return token.text.replace(/<[^>]*>/gu, '');
	}

	if (token.children?.length) {
		return token.children.map(visibleInlineText).join('');
	}

	return token.text ?? '';
}

/**
 * Return the text rendered from a table cell, excluding Markdown delimiters
 * and link destinations.
 */
export function getVisibleCellText(cellTokenOrText) {
	if (typeof cellTokenOrText === 'string') {
		return cellTokenOrText
			.replace(/!\[([^\]]*)\]\([^)]*\)/gu, '$1')
			.replace(/\[([^\]]+)\]\([^)]*\)/gu, '$1')
			.replace(/`+([^`]+)`+/gu, '$1')
			.replace(/\\([\\|*_~])/gu, '$1')
			.replace(/\s+/gu, ' ')
			.trim();
	}

	return visibleInlineText(cellTokenOrText).replace(/\s+/gu, ' ').trim();
}

function getTableRows(tableToken) {
	const tableHead = findChild(tableToken, 'tableHead');
	const tableBody = findChild(tableToken, 'tableBody');
	const headerRow = (tableHead?.children ?? []).find((child) => child.type === 'tableRow');
	const bodyRows = (tableBody?.children ?? []).filter((child) => child.type === 'tableRow');
	return { headerRow, bodyRows };
}

function getRowCells(rowToken) {
	return (rowToken?.children ?? [])
		.filter((child) => child.type === 'tableHeader' || child.type === 'tableData')
		.map((cellToken) => {
			const contentToken = findChild(cellToken, 'tableContent');
			return {
				raw: contentToken?.text.trim() ?? '',
				visible: getVisibleCellText(contentToken),
				line: cellToken.startLine,
				column: cellToken.startColumn,
				contentToken,
			};
		});
}

function getCellHeader(headers, index) {
	const header = headers[index];
	const visibleHeader = header?.visible || '';
	return visibleHeader || `column ${index + 1}`;
}

function escapeLabel(label) {
	return label
		.replace(/[\\*_]/gu, '\\$&')
		.replaceAll('[', '\\[')
		.replaceAll(']', '\\]');
}

function formatTableAsRecords(table) {
	const { headerRow, bodyRows } = getTableRows(table);
	const headers = getRowCells(headerRow);
	const rows = bodyRows.map(getRowCells);
	const columnCount = Math.max(headers.length, ...rows.map((row) => row.length), 0);

	if (rows.length === 0) {
		return headers
			.map((header, index) => `- **column ${index + 1}:** ${header.raw}`)
			.join('\n');
	}

	return rows
		.map((row) => {
			const lines = [];
			for (let index = 0; index < columnCount; index += 1) {
				const header = escapeLabel(getCellHeader(headers, index));
				const value = row[index]?.raw ?? '';
				const prefix = index === 0 ? '- ' : '  - ';
				lines.push(`${prefix}**${header}:** ${value}`.trimEnd());
			}
			return lines.join('\n');
		})
		.join('\n');
}

function getTableModel(table) {
	const { headerRow, bodyRows } = getTableRows(table);
	const headers = getRowCells(headerRow);
	const rows = bodyRows.map(getRowCells);
	const cells = [
		...headers.map((cell, index) => ({
			...cell,
			rowType: 'header',
			header: getCellHeader(headers, index),
			index,
		})),
		...rows.flatMap((row) =>
			row.map((cell, index) => ({
				...cell,
				rowType: 'data',
				header: getCellHeader(headers, index),
				index,
			})),
		),
	];

	return {
		startLine: table.startLine,
		endLine: table.endLine,
		columnCount: Math.max(headers.length, ...rows.map((row) => row.length), 0),
		cells,
		replacement: formatTableAsRecords(table),
	};
}

function getHeadingLevel(token) {
	if (token.type === 'atxHeading') {
		return findChild(token, 'atxHeadingSequence')?.text.length ?? 1;
	}
	const underline = findChild(token, 'setextHeadingLineSequence')?.text ?? '=';
	return underline.startsWith('=') ? 1 : 2;
}

function getHeadingText(token) {
	const text = findChild(token, 'atxHeadingText') ?? findChild(token, 'setextHeadingText');
	return getVisibleCellText(text);
}

/**
 * Return the reason a table is machine-parsed (a label), or null for ordinary tables.
 * Tables count as parsed when they sit under a parsed heading (at any nesting level) or
 * when their shape matches a row the parser reads anywhere in the document.
 */
function getMachineParsedReason(model, headingStack) {
	for (const heading of headingStack) {
		const match = MACHINE_PARSED_HEADINGS.find(({ pattern }) => pattern.test(heading.text));
		if (match) return match.label;
	}

	const headerCells = model.cells.filter((cell) => cell.rowType === 'header');
	if (headerCells.some((cell) => /^classification$/iu.test(cell.visible))) {
		return 'Fact Register';
	}

	const firstColumn = model.cells.filter((cell) => cell.index === 0);
	if (firstColumn.some((cell) => PLACEHOLDER_TOKEN.test(cell.visible))) return 'Placeholders';
	const labelCell = firstColumn.find((cell) =>
		MACHINE_PARSED_ROW_LABELS.has(cell.visible.toLowerCase()),
	);
	return labelCell ? labelCell.visible : null;
}

/**
 * List top-level tables with their model and, when applicable, the parsed-table reason.
 */
function getTables(params) {
	const headingStack = [];
	const tables = [];
	for (const token of params.parsers.micromark.tokens) {
		if (token.type === 'atxHeading' || token.type === 'setextHeading') {
			const level = getHeadingLevel(token);
			while (headingStack.length && headingStack.at(-1).level >= level) headingStack.pop();
			headingStack.push({ level, text: getHeadingText(token) });
			continue;
		}
		if (token.type !== 'table') continue;
		const model = getTableModel(token);
		tables.push({
			table: token,
			model,
			parsedReason: getMachineParsedReason(model, headingStack),
		});
	}
	return tables;
}

function getFixInfos(table, replacement, lines) {
	const firstLine = lines[table.startLine - 1] ?? '';
	return [
		{
			lineNumber: table.startLine,
			editColumn: 1,
			deleteCount: firstLine.length,
			insertText: replacement,
		},
		...Array.from({ length: table.endLine - table.startLine }, (_, index) => ({
			lineNumber: table.startLine + index + 1,
			deleteCount: -1,
		})),
	];
}

function reportTableWarnings(params, onError, config = {}) {
	if (!isActiveMarkdownPath(params.name)) return;

	const maxColumns = config.maxColumns ?? TABLE_RULES.maxColumns;
	for (const { table, model } of getTables(params)) {
		if (model.columnCount > maxColumns) {
			onError({
				lineNumber: table.startLine,
				detail: `Table has ${model.columnCount} columns; keep tables at ${maxColumns} columns or fewer when possible.`,
				context: params.lines[table.startLine - 1],
			});
		}
	}
}

function reportNarrativeCells(params, onError, config = {}) {
	if (!isActiveMarkdownPath(params.name)) return;

	const maxCharacters = config.maxCharacters ?? TABLE_RULES.warningMaxCellCharacters;
	for (const { table, model, parsedReason } of getTables(params)) {
		// Parsed tables are never rewritten; celebra-table-hard-limit reports them as errors.
		if (parsedReason) continue;
		const offender = model.cells.find((cell) => cell.visible.length > maxCharacters);
		if (!offender) continue;

		const fixInfos = getFixInfos(table, model.replacement, params.lines);
		onError({
			lineNumber: offender.line,
			detail: `Cell ${offender.index + 1} (${offender.header}) has ${offender.visible.length} visible characters. ${TABLE_RECOMMENDATION}`,
			context: params.lines[offender.line - 1],
			range: [
				offender.column,
				Math.max(
					1,
					Math.min(
						offender.raw.length,
						params.lines[offender.line - 1].length - offender.column + 1,
					),
				),
			],
			fixInfo: fixInfos[0],
		});

		for (const fixInfo of fixInfos.slice(1)) {
			onError({
				lineNumber: fixInfo.lineNumber,
				detail: 'Remove the remaining source lines after the table is converted.',
				fixInfo,
			});
		}
	}
}

function reportBlockingCells(params, onError, config = {}) {
	if (!isActiveMarkdownPath(params.name)) return;

	const maxCharacters = config.maxCharacters ?? TABLE_RULES.blockingMaxCellCharacters;
	const parsedMaxCharacters =
		config.parsedTableMaxCharacters ?? TABLE_RULES.warningMaxCellCharacters;
	for (const { model, parsedReason } of getTables(params)) {
		const limit = parsedReason ? parsedMaxCharacters : maxCharacters;
		const offender = model.cells.find((cell) => cell.visible.length > limit);
		if (!offender) continue;

		const detail = parsedReason
			? `Cell ${offender.index + 1} (${offender.header}) has ${offender.visible.length} visible characters in a machine-parsed table (${parsedReason}); the limit for parsed tables is ${limit}. ${PARSED_TABLE_RECOMMENDATION}`
			: `Cell ${offender.index + 1} (${offender.header}) has ${offender.visible.length} visible characters; the blocking limit is ${limit}. ${TABLE_RECOMMENDATION}`;
		onError({
			lineNumber: offender.line,
			detail,
			context: params.lines[offender.line - 1],
			range: [
				offender.column,
				Math.max(
					1,
					Math.min(
						offender.raw.length,
						params.lines[offender.line - 1].length - offender.column + 1,
					),
				),
			],
		});
	}
}

/** @type {import('markdownlint').Rule} */
export const tableColumnCountRule = {
	names: ['celebra-table-columns'],
	description: 'Markdown tables should stay compact when possible',
	tags: ['tables', 'readability'],
	parser: 'micromark',
	function: reportTableWarnings,
};

/** @type {import('markdownlint').Rule} */
export const tableNarrativeRule = {
	names: ['celebra-table-narrative'],
	description: 'Markdown table cells should not contain long narrative prose',
	tags: ['tables', 'readability'],
	parser: 'micromark',
	function: reportNarrativeCells,
};

/** @type {import('markdownlint').Rule} */
export const tableBlockingRule = {
	names: ['celebra-table-hard-limit'],
	description: 'Markdown table cells must not exceed the hard readability limit',
	tags: ['tables', 'readability'],
	parser: 'micromark',
	function: reportBlockingCells,
};

export default [tableColumnCountRule, tableNarrativeRule, tableBlockingRule];
