import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import ts from 'typescript';

/**
 * Data prerequisites: facts about the data of a target environment that application code assumes
 * and that no schema migration delivers (for example, a backfill of Auth metadata through the
 * admin API). `supabase/data-prerequisites.json` declares them, and the release gate refuses a
 * Production release while one of them has no verified evidence. See "Data prerequisites" in
 * `docs/core/release-process.md`.
 */
export const DATA_PREREQUISITES_PATH = 'supabase/data-prerequisites.json';
export const DATA_PREREQUISITE_DOCS = 'docs/core/release-process.md ("Data prerequisites")';

export type DataPrerequisiteStatus = 'verified' | 'pending' | 'not-applicable';
const STATUSES: ReadonlySet<string> = new Set(['verified', 'pending', 'not-applicable']);

export interface DataPrerequisiteEnvironment {
	status: DataPrerequisiteStatus;
	verifiedAt?: string;
	evidence?: string;
}

export interface DataPrerequisite {
	id: string;
	summary: string;
	introducedBy: string;
	verify: string;
	environments: Record<string, DataPrerequisiteEnvironment>;
}

export type AuthAppMetadataKeyDeclaration =
	{ prerequisite: string } | { migration: 'none'; reason: string };

export interface DataPrerequisiteManifest {
	version: 1;
	authAppMetadataKeys: Record<string, AuthAppMetadataKeyDeclaration>;
	prerequisites: DataPrerequisite[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string =>
	typeof value === 'string' && value.trim() !== '';

function invalid(detail: string): Error {
	return new Error(
		`${DATA_PREREQUISITES_PATH} is invalid: ${detail} See ${DATA_PREREQUISITE_DOCS}.`,
	);
}

function parseEnvironment(id: string, name: string, value: unknown): DataPrerequisiteEnvironment {
	if (!isRecord(value) || !STATUSES.has(String(value.status)))
		throw invalid(
			`prerequisite "${id}" needs a status of verified, pending or not-applicable for ${name}.`,
		);
	const status = value.status as DataPrerequisiteStatus;
	if (status === 'verified') {
		if (!isText(value.verifiedAt) || !/^\d{4}-\d{2}-\d{2}$/u.test(value.verifiedAt))
			throw invalid(
				`prerequisite "${id}" is verified for ${name} without a verifiedAt date.`,
			);
		if (!isText(value.evidence))
			throw invalid(`prerequisite "${id}" is verified for ${name} without evidence.`);
	}
	if (status === 'not-applicable' && !isText(value.evidence))
		throw invalid(
			`prerequisite "${id}" is not-applicable for ${name} without an evidence line saying why.`,
		);
	return {
		status,
		...(isText(value.verifiedAt) ? { verifiedAt: value.verifiedAt } : {}),
		...(isText(value.evidence) ? { evidence: value.evidence } : {}),
	};
}

function parsePrerequisite(value: unknown): DataPrerequisite {
	if (!isRecord(value) || !isText(value.id)) throw invalid('every prerequisite needs an id.');
	const { id } = value;
	for (const field of ['summary', 'introducedBy', 'verify'] as const)
		if (!isText(value[field])) throw invalid(`prerequisite "${id}" needs "${field}".`);
	if (!isRecord(value.environments))
		throw invalid(`prerequisite "${id}" needs an "environments" object.`);
	const environments: Record<string, DataPrerequisiteEnvironment> = {};
	for (const [name, environment] of Object.entries(value.environments))
		environments[name] = parseEnvironment(id, name, environment);
	return {
		id,
		summary: value.summary as string,
		introducedBy: value.introducedBy as string,
		verify: value.verify as string,
		environments,
	};
}

export function parseDataPrerequisiteManifest(text: string): DataPrerequisiteManifest {
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		throw invalid('it is not valid JSON.');
	}
	if (!isRecord(raw) || raw.version !== 1) throw invalid('"version" must be 1.');
	if (!Array.isArray(raw.prerequisites)) throw invalid('"prerequisites" must be a list.');
	if (!isRecord(raw.authAppMetadataKeys))
		throw invalid('"authAppMetadataKeys" must be an object.');
	const prerequisites = raw.prerequisites.map(parsePrerequisite);
	const ids = new Set<string>();
	for (const { id } of prerequisites) {
		if (ids.has(id)) throw invalid(`prerequisite "${id}" is declared twice.`);
		ids.add(id);
	}
	const authAppMetadataKeys: Record<string, AuthAppMetadataKeyDeclaration> = {};
	for (const [key, declaration] of Object.entries(raw.authAppMetadataKeys)) {
		if (!isRecord(declaration)) throw invalid(`app_metadata key "${key}" needs a declaration.`);
		if (isText(declaration.prerequisite)) {
			if (!ids.has(declaration.prerequisite))
				throw invalid(
					`app_metadata key "${key}" names the unknown prerequisite "${declaration.prerequisite}".`,
				);
			authAppMetadataKeys[key] = { prerequisite: declaration.prerequisite };
		} else if (declaration.migration === 'none' && isText(declaration.reason)) {
			authAppMetadataKeys[key] = { migration: 'none', reason: declaration.reason };
		} else {
			throw invalid(
				`app_metadata key "${key}" needs either "prerequisite" or "migration": "none" with a "reason".`,
			);
		}
	}
	return { version: 1, authAppMetadataKeys, prerequisites };
}

/**
 * Refuses a release while a prerequisite lacks verified evidence for the target environment.
 * `manifestText` is the manifest at the exact SHA being released, or null when that commit has none.
 */
export function requireDataPrerequisites(
	manifestText: string | null,
	environment = 'production',
): DataPrerequisite[] {
	if (manifestText === null)
		throw new Error(
			`Data prerequisites are unknown: ${DATA_PREREQUISITES_PATH} could not be read at the release SHA. ` +
				`The commit predates the manifest or GitHub is unreachable. See ${DATA_PREREQUISITE_DOCS}.`,
		);
	const manifest = parseDataPrerequisiteManifest(manifestText);
	const blocked = manifest.prerequisites.filter((prerequisite) => {
		const status = prerequisite.environments[environment]?.status;
		return status !== 'verified' && status !== 'not-applicable';
	});
	if (blocked.length > 0)
		throw new Error(
			[
				`Data prerequisites are not verified for ${environment}; do not activate this release:`,
				...blocked.map(
					(prerequisite) =>
						`- ${prerequisite.id}: ${prerequisite.summary} Verify with \`${prerequisite.verify}\`.`,
				),
				`Run the verification against ${environment}, then record the result in ${DATA_PREREQUISITES_PATH}. ` +
					`See ${DATA_PREREQUISITE_DOCS}.`,
			].join('\n'),
		);
	return manifest.prerequisites;
}

const SOURCE_FILE = /\.(?:ts|tsx|mts|js|mjs|astro)$/u;
export interface AppMetadataKeyRead {
	key: string;
	file: string;
	line: number;
}

export const DEFAULT_SCAN_ROOTS = ['src', 'scripts', 'supabase/functions'] as const;

function unwrapExpression(expr: ts.Expression): ts.Expression {
	let current = expr;
	while (
		ts.isParenthesizedExpression(current) ||
		ts.isAsExpression(current) ||
		ts.isTypeAssertionExpression(current) ||
		ts.isNonNullExpression(current)
	) {
		current = current.expression;
	}
	return current;
}

/**
 * Extracts string value from expression (literal, identifier lookup, or type assertions).
 */
function getExpressionStringValue(
	expr: ts.Expression | undefined,
	constants: ReadonlyMap<string, string>,
): string | undefined {
	if (!expr) return undefined;
	const current = unwrapExpression(expr);
	if (ts.isStringLiteral(current) || ts.isNoSubstitutionTemplateLiteral(current)) {
		return current.text;
	}
	if (ts.isIdentifier(current)) {
		return constants.get(current.text);
	}
	return undefined;
}

function isAppMetadataIdentifier(text: string, aliases: ReadonlySet<string>): boolean {
	return (
		text === 'app_metadata' ||
		text === 'appMetadata' ||
		text === 'raw_app_meta_data' ||
		aliases.has(text)
	);
}

/**
 * Checks whether an expression references or resolves to `app_metadata`.
 */
function isAppMetadataTarget(
	expr: ts.Expression | undefined,
	aliases: ReadonlySet<string>,
	helpersReturningMeta: ReadonlySet<string>,
	constants: ReadonlyMap<string, string>,
): boolean {
	if (!expr) return false;
	const current = unwrapExpression(expr);

	if (
		ts.isBinaryExpression(current) &&
		(current.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
			current.operatorToken.kind === ts.SyntaxKind.BarBarToken)
	) {
		return isAppMetadataTarget(current.left, aliases, helpersReturningMeta, constants);
	}
	if (ts.isPropertyAccessExpression(current)) {
		return current.name.text === 'app_metadata';
	}
	if (ts.isElementAccessExpression(current)) {
		return getExpressionStringValue(current.argumentExpression, constants) === 'app_metadata';
	}
	if (ts.isIdentifier(current)) {
		return isAppMetadataIdentifier(current.text, aliases);
	}
	if (ts.isCallExpression(current) && ts.isIdentifier(current.expression)) {
		return helpersReturningMeta.has(current.expression.text);
	}
	return false;
}

/**
 * Extracts property key from a binding element (e.g. `{ login_alias }` or `{ role: myRole }` or `{ [KEY]: val }`).
 */
function resolveBindingElementKey(
	elem: ts.BindingElement,
	constants: ReadonlyMap<string, string>,
): string | undefined {
	if (elem.propertyName) {
		if (ts.isIdentifier(elem.propertyName) || ts.isStringLiteral(elem.propertyName)) {
			return elem.propertyName.text;
		}
		if (ts.isComputedPropertyName(elem.propertyName)) {
			return getExpressionStringValue(elem.propertyName.expression, constants);
		}
	} else if (ts.isIdentifier(elem.name)) {
		return elem.name.text;
	}
	return undefined;
}

function getBindingElementName(elem: ts.BindingElement): string | undefined {
	if (elem.propertyName && ts.isIdentifier(elem.propertyName)) return elem.propertyName.text;
	if (ts.isIdentifier(elem.name)) return elem.name.text;
	return undefined;
}

interface ScanContext {
	constants: ReadonlyMap<string, string>;
	aliases: Set<string>;
	helpersReturningMeta: ReadonlySet<string>;
	addRead: (key: string, node: ts.Node) => void;
}

function scanDestructuredAppMetadata(pattern: ts.ObjectBindingPattern, ctx: ScanContext): void {
	for (const elem of pattern.elements) {
		const propName = getBindingElementName(elem);
		if (propName !== 'app_metadata' && propName !== 'appMetadata') continue;
		if (ts.isIdentifier(elem.name)) {
			ctx.aliases.add(elem.name.text);
		} else if (ts.isObjectBindingPattern(elem.name)) {
			for (const sub of elem.name.elements) {
				const key = resolveBindingElementKey(sub, ctx.constants);
				if (key) ctx.addRead(key, sub);
			}
		}
	}
}

function checkVariableDeclaration(node: ts.VariableDeclaration, ctx: ScanContext): void {
	if (!node.initializer) return;
	const isTarget = isAppMetadataTarget(
		node.initializer,
		ctx.aliases,
		ctx.helpersReturningMeta,
		ctx.constants,
	);

	if (ts.isObjectBindingPattern(node.name)) {
		if (isTarget) {
			for (const elem of node.name.elements) {
				const key = resolveBindingElementKey(elem, ctx.constants);
				if (key) ctx.addRead(key, elem);
			}
		} else {
			scanDestructuredAppMetadata(node.name, ctx);
		}
	} else if (ts.isIdentifier(node.name) && isTarget) {
		ctx.aliases.add(node.name.text);
	}
}

function checkAssignment(node: ts.BinaryExpression, ctx: ScanContext): void {
	if (node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) return;
	if (!isAppMetadataTarget(node.right, ctx.aliases, ctx.helpersReturningMeta, ctx.constants))
		return;

	const left = unwrapExpression(node.left);
	if (ts.isObjectLiteralExpression(left)) {
		for (const prop of left.properties) {
			if (ts.isShorthandPropertyAssignment(prop)) {
				ctx.addRead(prop.name.text, prop);
			} else if (ts.isPropertyAssignment(prop)) {
				if (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name)) {
					ctx.addRead(prop.name.text, prop);
				} else if (ts.isComputedPropertyName(prop.name)) {
					const key = getExpressionStringValue(prop.name.expression, ctx.constants);
					if (key) ctx.addRead(key, prop);
				}
			}
		}
	} else if (ts.isIdentifier(left)) {
		ctx.aliases.add(left.text);
	}
}

/**
 * Finds reads of Auth `app_metadata` keys in a single file via TypeScript AST.
 * Handles property access (`.key`), element access (`['key']` or `[KEY]`),
 * destructuring, and helpers receiving or returning `app_metadata`.
 */
export function findAppMetadataKeyReads(
	source: string,
	file: string,
	externalConstants?: ReadonlyMap<string, string> | Record<string, string>,
): AppMetadataKeyRead[] {
	const scriptKind = file.endsWith('.tsx')
		? ts.ScriptKind.TSX
		: file.endsWith('.jsx')
			? ts.ScriptKind.JSX
			: file.endsWith('.js') || file.endsWith('.mjs') || file.endsWith('.cjs')
				? ts.ScriptKind.JS
				: file.endsWith('.astro')
					? ts.ScriptKind.TSX
					: ts.ScriptKind.TS;

	const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKind);

	const constants = new Map<string, string>(
		externalConstants
			? externalConstants instanceof Map
				? externalConstants
				: Object.entries(externalConstants)
			: [],
	);
	const aliases = new Set<string>();
	const helpersReturningMeta = new Set<string>();
	const fnParams = new Map<string, { params: (string | null)[]; node: ts.Node }>();
	const reads: AppMetadataKeyRead[] = [];

	// Pass 1: collect local string constants and function declarations / expressions
	function pass1(node: ts.Node): void {
		if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
			const value = getExpressionStringValue(node.initializer, constants);
			if (value !== undefined) {
				constants.set(node.name.text, value);
			}
			if (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)) {
				const params = node.initializer.parameters.map((p) =>
					ts.isIdentifier(p.name) ? p.name.text : null,
				);
				fnParams.set(node.name.text, { params, node: node.initializer });
			}
		}
		if (ts.isFunctionDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
			const params = node.parameters.map((p) =>
				ts.isIdentifier(p.name) ? p.name.text : null,
			);
			fnParams.set(node.name.text, { params, node });
		}
		ts.forEachChild(node, pass1);
	}
	pass1(sourceFile);

	// Check helper return values
	for (const [name, { node }] of fnParams) {
		if (
			ts.isArrowFunction(node) &&
			!ts.isBlock(node.body) &&
			isAppMetadataTarget(node.body, aliases, helpersReturningMeta, constants)
		) {
			helpersReturningMeta.add(name);
		} else {
			const checkReturn = (n: ts.Node): void => {
				if (
					ts.isReturnStatement(n) &&
					n.expression &&
					isAppMetadataTarget(n.expression, aliases, helpersReturningMeta, constants)
				) {
					helpersReturningMeta.add(name);
				}
				ts.forEachChild(n, checkReturn);
			};
			checkReturn(
				ts.isArrowFunction(node)
					? node.body
					: ((node as ts.FunctionDeclaration).body ?? node),
			);
		}
	}

	// Pass 1.5: find calls to helpers passing app_metadata to bind parameters as aliases
	function passCalls(node: ts.Node): void {
		if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
			const fnInfo = fnParams.get(node.expression.text);
			if (fnInfo) {
				node.arguments.forEach((arg, idx) => {
					if (
						isAppMetadataTarget(
							arg as ts.Expression,
							aliases,
							helpersReturningMeta,
							constants,
						)
					) {
						const paramName = fnInfo.params[idx];
						if (paramName) aliases.add(paramName);
					}
				});
			}
		}
		ts.forEachChild(node, passCalls);
	}
	passCalls(sourceFile);

	function addRead(key: string, node: ts.Node): void {
		const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
		reads.push({ key, file, line });
	}

	const scanCtx: ScanContext = {
		constants,
		aliases,
		helpersReturningMeta,
		addRead,
	};

	// Pass 2: traverse AST and collect reads
	function pass2(node: ts.Node): void {
		if (ts.isPropertyAccessExpression(node)) {
			if (isAppMetadataTarget(node.expression, aliases, helpersReturningMeta, constants)) {
				addRead(node.name.text, node.name);
			}
		} else if (ts.isElementAccessExpression(node)) {
			if (isAppMetadataTarget(node.expression, aliases, helpersReturningMeta, constants)) {
				const key = getExpressionStringValue(node.argumentExpression, constants);
				if (key) addRead(key, node.argumentExpression);
			}
		} else if (ts.isVariableDeclaration(node)) {
			checkVariableDeclaration(node, scanCtx);
		} else if (ts.isParameter(node)) {
			if (ts.isObjectBindingPattern(node.name)) {
				scanDestructuredAppMetadata(node.name, scanCtx);
			}
		} else if (ts.isBinaryExpression(node)) {
			checkAssignment(node, scanCtx);
		}
		ts.forEachChild(node, pass2);
	}
	pass2(sourceFile);

	return reads;
}

/**
 * Collects exported string constants across all source files in the given roots.
 */
function collectExportedConstants(roots: readonly string[]): Map<string, string> {
	const constants = new Map<string, string>();
	const walk = (directory: string): void => {
		if (!existsSync(directory)) return;
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const path = join(directory, entry.name);
			if (entry.isDirectory()) {
				if (
					entry.name !== 'node_modules' &&
					entry.name !== '.git' &&
					entry.name !== 'dist' &&
					entry.name !== '.astro'
				) {
					walk(path);
				}
			} else if (SOURCE_FILE.test(entry.name)) {
				try {
					const text = readFileSync(path, 'utf8');
					const sf = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
					ts.forEachChild(sf, (node) => {
						if (
							ts.isVariableStatement(node) &&
							node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
						) {
							for (const decl of node.declarationList.declarations) {
								if (ts.isIdentifier(decl.name) && decl.initializer) {
									let cur = decl.initializer;
									while (
										ts.isParenthesizedExpression(cur) ||
										ts.isAsExpression(cur) ||
										ts.isTypeAssertionExpression(cur)
									) {
										cur = cur.expression;
									}
									if (
										ts.isStringLiteral(cur) ||
										ts.isNoSubstitutionTemplateLiteral(cur)
									) {
										constants.set(decl.name.text, cur.text);
									}
								}
							}
						}
					});
				} catch {
					// Ignore parse errors during constant harvesting
				}
			}
		}
	};
	for (const root of roots) walk(root);
	return constants;
}

export function scanAppMetadataKeyReads(
	rootOrRoots: string | readonly string[] = DEFAULT_SCAN_ROOTS,
	baseDir?: string,
): AppMetadataKeyRead[] {
	const roots = Array.isArray(rootOrRoots) ? rootOrRoots : [rootOrRoots];
	const isSingleExplicit = typeof rootOrRoots === 'string';
	const exportedConstants = collectExportedConstants(roots);
	const reads: AppMetadataKeyRead[] = [];

	const walk = (directory: string, relativePrefix: string): void => {
		if (!existsSync(directory)) return;
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const path = join(directory, entry.name);
			const name = relativePrefix ? `${relativePrefix}/${entry.name}` : entry.name;
			if (entry.isDirectory()) {
				if (
					entry.name !== 'node_modules' &&
					entry.name !== '.git' &&
					entry.name !== 'dist' &&
					entry.name !== '.astro'
				) {
					walk(path, name);
				}
			} else if (SOURCE_FILE.test(entry.name)) {
				reads.push(
					...findAppMetadataKeyReads(readFileSync(path, 'utf8'), name, exportedConstants),
				);
			}
		}
	};

	for (const root of roots) {
		if (!existsSync(root)) continue;
		const prefix = isSingleExplicit
			? baseDir
				? relative(baseDir, root).replace(/\\/g, '/')
				: ''
			: baseDir
				? relative(baseDir, root).replace(/\\/g, '/')
				: basename(root);
		walk(root, prefix);
	}

	return reads;
}

/** Reads of an `app_metadata` key that the manifest does not declare. */
export function findUndeclaredAppMetadataKeys(
	reads: readonly AppMetadataKeyRead[],
	manifest: DataPrerequisiteManifest,
): AppMetadataKeyRead[] {
	return reads.filter((read) => !Object.hasOwn(manifest.authAppMetadataKeys, read.key));
}

export function describeUndeclaredAppMetadataKeys(reads: readonly AppMetadataKeyRead[]): string {
	return [
		'Application code reads Auth app_metadata keys that are not declared:',
		...reads.map((read) => `- ${read.key} (${read.file}:${read.line})`),
		`Declare each key under "authAppMetadataKeys" in ${DATA_PREREQUISITES_PATH}: either ` +
			'{"migration": "none", "reason": "…"} when existing accounts need no data, or ' +
			'{"prerequisite": "<id>"} plus a prerequisite entry when they need a backfill. ' +
			`See ${DATA_PREREQUISITE_DOCS}.`,
	].join('\n');
}
