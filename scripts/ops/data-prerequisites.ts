/* eslint-disable max-lines -- AST metadata scanner and prerequisite release gate share one module boundary. */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
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
const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', '.astro']);
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

export type ExternalConstants =
	| ReadonlyMap<string, string | ReadonlyMap<string, string>>
	| Record<string, string | Record<string, string>>;

function normalizeModulePath(p: string): string {
	return p.replace(/\\/g, '/').replace(/\.(?:ts|tsx|mts|js|mjs|cjs|astro)$/u, '');
}

/**
 * Extracts only the frontmatter script from an Astro component source file,
 * preserving line numbers so reported reads point to the exact source lines.
 * Returns an empty string if no frontmatter is found.
 */
export function extractAstroFrontmatter(source: string): string {
	const match = source
		.replace(/^\uFEFF/u, '')
		.match(/^[ \t]*---[^\r\n]*(\r?\n)([\s\S]*?)\r?\n[ \t]*---(?:\r?\n|$)/u);
	if (!match) return '';
	return match[1] + match[2];
}

interface Scope {
	parent: Scope | null;
	constants: Map<string, string>;
	aliases: Set<string>;
	namespaces: Map<string, Map<string, string>>;
}

const createScope = (parent: Scope | null = null): Scope => ({
	parent,
	constants: new Map(),
	aliases: new Set(),
	namespaces: new Map(),
});

const resolveConstant = (scope: Scope, name: string): string | undefined =>
	scope.constants.get(name) ?? (scope.parent ? resolveConstant(scope.parent, name) : undefined);

const META_NAMES = new Set(['app_metadata', 'appMetadata', 'raw_app_meta_data']);
const isAlias = (scope: Scope, name: string): boolean =>
	META_NAMES.has(name) ||
	scope.aliases.has(name) ||
	(scope.parent ? isAlias(scope.parent, name) : false);

const resolveNamespace = (scope: Scope, name: string): Map<string, string> | undefined =>
	scope.namespaces.get(name) ?? (scope.parent ? resolveNamespace(scope.parent, name) : undefined);

function getScope(node: ts.Node, nodeToScope: Map<ts.Node, Scope>, rootScope: Scope): Scope {
	let curr: ts.Node | undefined = node;
	while (curr) {
		const s = nodeToScope.get(curr);
		if (s) return s;
		curr = curr.parent;
	}
	return rootScope;
}

/**
 * Extracts string value from expression (literal, identifier lookup, or type assertions).
 */
function getExpressionStringValue(
	expr: ts.Expression | undefined,
	scope: Scope,
): string | undefined {
	if (!expr) return undefined;
	const current = unwrapExpression(expr);
	if (ts.isStringLiteral(current) || ts.isNoSubstitutionTemplateLiteral(current)) {
		return current.text;
	}
	if (ts.isIdentifier(current)) return resolveConstant(scope, current.text);
	if (ts.isPropertyAccessExpression(current) && ts.isIdentifier(current.expression)) {
		return resolveNamespace(scope, current.expression.text)?.get(current.name.text);
	}
	if (ts.isElementAccessExpression(current) && ts.isIdentifier(current.expression)) {
		const prop = getExpressionStringValue(current.argumentExpression, scope);
		return prop ? resolveNamespace(scope, current.expression.text)?.get(prop) : undefined;
	}
	return undefined;
}

/**
 * Checks whether an expression references or resolves to `app_metadata`.
 */
function isAppMetadataTarget(
	expr: ts.Expression | undefined,
	scope: Scope,
	helpersReturningMeta: ReadonlySet<string>,
): boolean {
	if (!expr) return false;
	const current = unwrapExpression(expr);
	if (
		ts.isBinaryExpression(current) &&
		(current.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
			current.operatorToken.kind === ts.SyntaxKind.BarBarToken)
	) {
		return isAppMetadataTarget(current.left, scope, helpersReturningMeta);
	}
	return (
		(ts.isPropertyAccessExpression(current) && current.name.text === 'app_metadata') ||
		(ts.isElementAccessExpression(current) &&
			getExpressionStringValue(current.argumentExpression, scope) === 'app_metadata') ||
		(ts.isIdentifier(current) && isAlias(scope, current.text)) ||
		(ts.isCallExpression(current) &&
			(ts.isIdentifier(current.expression)
				? helpersReturningMeta.has(current.expression.text)
				: ts.isPropertyAccessExpression(current.expression)
					? helpersReturningMeta.has(current.expression.name.text)
					: false))
	);
}

/**
 * Extracts property key from a binding element (e.g. `{ login_alias }` or `{ role: myRole }` or `{ [KEY]: val }`).
 */
function resolveBindingElementKey(elem: ts.BindingElement, scope: Scope): string | undefined {
	if (elem.dotDotDotToken) return undefined;
	if (!elem.propertyName) return ts.isIdentifier(elem.name) ? elem.name.text : undefined;
	if (ts.isIdentifier(elem.propertyName) || ts.isStringLiteral(elem.propertyName))
		return elem.propertyName.text;
	if (ts.isComputedPropertyName(elem.propertyName)) {
		return getExpressionStringValue(elem.propertyName.expression, scope) ?? '<unknown>';
	}
	return undefined;
}

const getBindingElementName = (elem: ts.BindingElement): string | undefined =>
	(elem.propertyName && ts.isIdentifier(elem.propertyName)
		? elem.propertyName.text
		: undefined) ?? (ts.isIdentifier(elem.name) ? elem.name.text : undefined);

interface ParameterInfo {
	name?: string;
	pattern?: ts.ObjectBindingPattern;
}

interface FunctionInfo {
	parameters: ParameterInfo[];
	scope: Scope;
	body?: ts.Node;
}

interface FileScanContext {
	sourceFile: ts.SourceFile;
	file: string;
	nodeToScope: Map<ts.Node, Scope>;
	rootScope: Scope;
	helpersReturningMeta: Set<string>;
	reads: AppMetadataKeyRead[];
	seenReads: Set<string>;
}

function addRead(ctx: FileScanContext, key: string, node: ts.Node): void {
	const line =
		ctx.sourceFile.getLineAndCharacterOfPosition(node.getStart(ctx.sourceFile)).line + 1;
	const signature = `${key}:${line}`;
	if (!ctx.seenReads.has(signature)) {
		ctx.seenReads.add(signature);
		ctx.reads.push({ key, file: ctx.file, line });
	}
}

function parseExternalConstants(ext?: ExternalConstants): {
	moduleMap: Map<string, Map<string, string>>;
	fallback: Map<string, string>;
} {
	const moduleMap = new Map<string, Map<string, string>>();
	const fallback = new Map<string, string>();
	if (!ext) return { moduleMap, fallback };
	for (const [key, val] of ext instanceof Map ? ext.entries() : Object.entries(ext)) {
		if (typeof val === 'string') {
			fallback.set(key, val);
		} else {
			const inner = new Map<string, string>(
				val instanceof Map ? val.entries() : Object.entries(val),
			);
			moduleMap.set(key, inner);
			moduleMap.set(normalizeModulePath(key), inner);
			if (key.startsWith('@/')) {
				const srcKey = 'src/' + key.slice(2);
				moduleMap.set(srcKey, inner);
				moduleMap.set(normalizeModulePath(srcKey), inner);
			} else if (key.startsWith('src/')) {
				const atKey = '@/' + key.slice(4);
				moduleMap.set(atKey, inner);
				moduleMap.set(normalizeModulePath(atKey), inner);
			}
		}
	}
	return { moduleMap, fallback };
}

function resolveModuleExports(
	spec: string,
	currentFile: string,
	map: Map<string, Map<string, string>>,
): Map<string, string> | undefined {
	const candidates: string[] = [spec];
	if (spec.startsWith('@/')) {
		candidates.push('src/' + spec.slice(2));
	} else if (spec.startsWith('@tests/')) {
		candidates.push('tests/' + spec.slice(7));
	}
	for (const cand of candidates) {
		if (map.has(cand)) return map.get(cand);
		const norm = normalizeModulePath(cand);
		if (map.has(norm)) return map.get(norm);
		const indexNorm = normalizeModulePath(join(cand, 'index'));
		if (map.has(indexNorm)) return map.get(indexNorm);
	}
	const dir = currentFile ? dirname(currentFile) : '';
	if (!dir) return undefined;
	const target = normalizeModulePath(join(dir, spec));
	return map.get(target) ?? map.get(normalizeModulePath(join(target, 'index')));
}

function bindImports(
	sf: ts.SourceFile,
	filePath: string,
	root: Scope,
	modules: Map<string, Map<string, string>>,
	fallback: Map<string, string>,
): void {
	for (const stmt of sf.statements) {
		if (!ts.isImportDeclaration(stmt) || !stmt.importClause) continue;
		const spec = ts.isStringLiteral(stmt.moduleSpecifier)
			? stmt.moduleSpecifier.text
			: undefined;
		const exports = spec ? resolveModuleExports(spec, filePath, modules) : undefined;
		const named = stmt.importClause.namedBindings;
		if (named && ts.isNamedImports(named)) {
			for (const elem of named.elements) {
				const exp = elem.propertyName ? elem.propertyName.text : elem.name.text;
				const val = exports?.get(exp) ?? fallback.get(exp);
				if (val !== undefined) root.constants.set(elem.name.text, val);
			}
		} else if (named && ts.isNamespaceImport(named) && exports) {
			root.namespaces.set(named.name.text, exports);
		}
		if (stmt.importClause.name) {
			const val = exports?.get('default') ?? fallback.get(stmt.importClause.name.text);
			if (val !== undefined) root.constants.set(stmt.importClause.name.text, val);
		}
	}
}

function buildScopeTree(sf: ts.SourceFile, root: Scope): Map<ts.Node, Scope> {
	const map = new Map<ts.Node, Scope>([[sf, root]]);
	const walk = (node: ts.Node, current: Scope): void => {
		const isScope =
			node !== sf &&
			(ts.isFunctionDeclaration(node) ||
				ts.isFunctionExpression(node) ||
				ts.isArrowFunction(node) ||
				ts.isMethodDeclaration(node) ||
				ts.isBlock(node) ||
				ts.isIterationStatement(node, false));
		const next = isScope ? createScope(current) : current;
		if (isScope) map.set(node, next);
		ts.forEachChild(node, (child) => walk(child, next));
	};
	walk(sf, root);
	return map;
}

interface ParsedDeclarations {
	variableDecls: ts.VariableDeclaration[];
	assignments: ts.BinaryExpression[];
	calls: ts.CallExpression[];
	functions: Map<string, FunctionInfo>;
}

function collectDeclarations(
	sourceFile: ts.SourceFile,
	nodeToScope: Map<ts.Node, Scope>,
	rootScope: Scope,
): ParsedDeclarations {
	const variableDecls: ts.VariableDeclaration[] = [];
	const assignments: ts.BinaryExpression[] = [];
	const calls: ts.CallExpression[] = [];
	const functions = new Map<string, FunctionInfo>();

	const toParams = (params: readonly ts.ParameterDeclaration[]): ParameterInfo[] =>
		params.map((p) => ({
			...(ts.isIdentifier(p.name) ? { name: p.name.text } : {}),
			...(ts.isObjectBindingPattern(p.name) ? { pattern: p.name } : {}),
		}));

	const walk = (node: ts.Node): void => {
		if (ts.isVariableDeclaration(node)) {
			variableDecls.push(node);
			const init = node.initializer;
			const isFn = init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init));
			if (ts.isIdentifier(node.name) && isFn) {
				functions.set(node.name.text, {
					parameters: toParams(init.parameters),
					scope: getScope(init, nodeToScope, rootScope),
					body: init.body,
				});
			}
		} else if (ts.isFunctionDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
			functions.set(node.name.text, {
				parameters: toParams(node.parameters),
				scope: getScope(node, nodeToScope, rootScope),
				body: node.body,
			});
		} else if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name)) {
			functions.set(node.name.text, {
				parameters: toParams(node.parameters),
				scope: getScope(node, nodeToScope, rootScope),
				body: node.body,
			});
		} else if (
			ts.isPropertyAssignment(node) &&
			ts.isIdentifier(node.name) &&
			node.initializer &&
			(ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
		) {
			const fn = node.initializer;
			functions.set(node.name.text, {
				parameters: toParams(fn.parameters),
				scope: getScope(fn, nodeToScope, rootScope),
				body: fn.body,
			});
		} else if (
			ts.isBinaryExpression(node) &&
			node.operatorToken.kind === ts.SyntaxKind.EqualsToken
		) {
			assignments.push(node);
		} else if (ts.isCallExpression(node)) {
			calls.push(node);
		}
		ts.forEachChild(node, walk);
	};
	walk(sourceFile);
	return { variableDecls, assignments, calls, functions };
}

function resolveScopeConstants(
	variableDecls: readonly ts.VariableDeclaration[],
	nodeToScope: Map<ts.Node, Scope>,
	rootScope: Scope,
): void {
	let changed = true;
	while (changed) {
		changed = false;
		for (const decl of variableDecls) {
			if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
			const scope = getScope(decl, nodeToScope, rootScope);
			if (scope.constants.has(decl.name.text)) continue;
			const val = getExpressionStringValue(decl.initializer, scope);
			if (val !== undefined) {
				scope.constants.set(decl.name.text, val);
				changed = true;
			}
		}
	}
}

function addRestAliases(pattern: ts.ObjectBindingPattern, scope: Scope): void {
	for (const elem of pattern.elements) {
		if (elem.dotDotDotToken && ts.isIdentifier(elem.name)) scope.aliases.add(elem.name.text);
	}
}

function scanDestructuredMetadataAliases(pattern: ts.ObjectBindingPattern, scope: Scope): void {
	for (const elem of pattern.elements) {
		const prop = getBindingElementName(elem);
		if (prop !== 'app_metadata' && prop !== 'appMetadata') continue;
		if (ts.isIdentifier(elem.name)) scope.aliases.add(elem.name.text);
		else if (ts.isObjectBindingPattern(elem.name)) addRestAliases(elem.name, scope);
	}
}

function checkDeclAliases(decl: ts.VariableDeclaration, ctx: FileScanContext): void {
	if (!decl.initializer) return;
	const isTarget = isAppMetadataTarget(
		decl.initializer,
		getScope(decl.initializer, ctx.nodeToScope, ctx.rootScope),
		ctx.helpersReturningMeta,
	);
	const scope = getScope(decl, ctx.nodeToScope, ctx.rootScope);
	if (ts.isObjectBindingPattern(decl.name)) {
		if (isTarget) addRestAliases(decl.name, scope);
		else scanDestructuredMetadataAliases(decl.name, scope);
	} else if (ts.isIdentifier(decl.name) && isTarget) {
		scope.aliases.add(decl.name.text);
	}
}

function checkAssignmentAliases(node: ts.BinaryExpression, ctx: FileScanContext): void {
	if (
		!isAppMetadataTarget(
			node.right,
			getScope(node.right, ctx.nodeToScope, ctx.rootScope),
			ctx.helpersReturningMeta,
		)
	) {
		return;
	}
	const left = unwrapExpression(node.left);
	const scope = getScope(node, ctx.nodeToScope, ctx.rootScope);
	if (ts.isObjectLiteralExpression(left)) {
		for (const prop of left.properties) {
			if (ts.isSpreadAssignment(prop) && ts.isIdentifier(prop.expression)) {
				scope.aliases.add(prop.expression.text);
			}
		}
	} else if (ts.isIdentifier(left)) {
		scope.aliases.add(left.text);
	}
}

function checkHelperReturns(
	functions: ReadonlyMap<string, FunctionInfo>,
	ctx: FileScanContext,
): void {
	for (const [name, fnInfo] of functions) {
		if (ctx.helpersReturningMeta.has(name) || !fnInfo.body) continue;
		if (!ts.isBlock(fnInfo.body)) {
			if (
				isAppMetadataTarget(
					fnInfo.body as ts.Expression,
					fnInfo.scope,
					ctx.helpersReturningMeta,
				)
			) {
				ctx.helpersReturningMeta.add(name);
			}
			continue;
		}
		let returnsMeta = false;
		const check = (n: ts.Node): void => {
			if (returnsMeta) return;
			if (ts.isReturnStatement(n) && n.expression) {
				returnsMeta = isAppMetadataTarget(
					n.expression,
					getScope(n.expression, ctx.nodeToScope, ctx.rootScope),
					ctx.helpersReturningMeta,
				);
			} else if (
				!ts.isFunctionDeclaration(n) &&
				!ts.isFunctionExpression(n) &&
				!ts.isArrowFunction(n) &&
				!ts.isMethodDeclaration(n)
			) {
				ts.forEachChild(n, check);
			}
		};
		ts.forEachChild(fnInfo.body, check);
		if (returnsMeta) ctx.helpersReturningMeta.add(name);
	}
}

function checkCallSite(
	call: ts.CallExpression,
	functions: ReadonlyMap<string, FunctionInfo>,
	ctx: FileScanContext,
): void {
	const calleeName = ts.isIdentifier(call.expression)
		? call.expression.text
		: ts.isPropertyAccessExpression(call.expression)
			? call.expression.name.text
			: undefined;
	if (!calleeName) return;
	const fnInfo = functions.get(calleeName);
	if (!fnInfo) return;

	call.arguments.forEach((arg, idx) => {
		const param = fnInfo.parameters[idx];
		if (
			!param ||
			!isAppMetadataTarget(
				arg as ts.Expression,
				getScope(arg, ctx.nodeToScope, ctx.rootScope),
				ctx.helpersReturningMeta,
			)
		) {
			return;
		}
		if (param.name) {
			fnInfo.scope.aliases.add(param.name);
		} else if (param.pattern) {
			addRestAliases(param.pattern, fnInfo.scope);
			for (const elem of param.pattern.elements) {
				if (elem.dotDotDotToken) continue;
				const key = resolveBindingElementKey(elem, fnInfo.scope);
				if (key) addRead(ctx, key, elem);
			}
		}
	});
}

function propagateAliases(decls: ParsedDeclarations, ctx: FileScanContext): void {
	const total = (): number => {
		let sum = ctx.helpersReturningMeta.size + ctx.reads.length;
		for (const s of ctx.nodeToScope.values()) sum += s.aliases.size;
		return sum;
	};
	let prev = -1;
	while (total() !== prev) {
		prev = total();
		for (const d of decls.variableDecls) checkDeclAliases(d, ctx);
		for (const a of decls.assignments) checkAssignmentAliases(a, ctx);
		checkHelperReturns(decls.functions, ctx);
		for (const c of decls.calls) checkCallSite(c, decls.functions, ctx);
	}
}

function checkDestructuredElements(
	pattern: ts.ObjectBindingPattern,
	scope: Scope,
	ctx: FileScanContext,
): void {
	for (const elem of pattern.elements) {
		if (elem.dotDotDotToken) continue;
		const key = resolveBindingElementKey(elem, scope);
		if (key) addRead(ctx, key, elem);
	}
}

function checkPatternReads(
	pattern: ts.ObjectBindingPattern,
	scope: Scope,
	ctx: FileScanContext,
): void {
	for (const elem of pattern.elements) {
		const prop = getBindingElementName(elem);
		if (
			(prop === 'app_metadata' || prop === 'appMetadata') &&
			ts.isObjectBindingPattern(elem.name)
		) {
			checkDestructuredElements(elem.name, scope, ctx);
		}
	}
}

function checkAssignmentRead(node: ts.BinaryExpression, ctx: FileScanContext): void {
	const scope = getScope(node, ctx.nodeToScope, ctx.rootScope);
	if (!isAppMetadataTarget(node.right, scope, ctx.helpersReturningMeta)) return;
	const left = unwrapExpression(node.left);
	if (!ts.isObjectLiteralExpression(left)) return;

	for (const prop of left.properties) {
		if (ts.isShorthandPropertyAssignment(prop)) {
			addRead(ctx, prop.name.text, prop);
		} else if (ts.isPropertyAssignment(prop)) {
			const key =
				ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name)
					? prop.name.text
					: ts.isComputedPropertyName(prop.name)
						? (getExpressionStringValue(prop.name.expression, scope) ?? '<unknown>')
						: undefined;
			if (key) addRead(ctx, key, prop);
		}
	}
}

function collectAllReads(ctx: FileScanContext): void {
	const visit = (node: ts.Node): void => {
		const scope = getScope(node, ctx.nodeToScope, ctx.rootScope);
		if (
			ts.isPropertyAccessExpression(node) &&
			isAppMetadataTarget(node.expression, scope, ctx.helpersReturningMeta)
		) {
			addRead(ctx, node.name.text, node.name);
		} else if (
			ts.isElementAccessExpression(node) &&
			isAppMetadataTarget(node.expression, scope, ctx.helpersReturningMeta)
		) {
			const key = getExpressionStringValue(node.argumentExpression, scope) ?? '<unknown>';
			addRead(ctx, key, node.argumentExpression);
		} else if (ts.isVariableDeclaration(node)) {
			const isTarget =
				node.initializer &&
				isAppMetadataTarget(
					node.initializer,
					getScope(node.initializer, ctx.nodeToScope, ctx.rootScope),
					ctx.helpersReturningMeta,
				);
			if (isTarget && ts.isObjectBindingPattern(node.name)) {
				checkDestructuredElements(node.name, scope, ctx);
			} else if (ts.isObjectBindingPattern(node.name)) {
				checkPatternReads(node.name, scope, ctx);
			}
		} else if (ts.isParameter(node) && ts.isObjectBindingPattern(node.name)) {
			checkPatternReads(node.name, scope, ctx);
		} else if (
			ts.isBinaryExpression(node) &&
			node.operatorToken.kind === ts.SyntaxKind.EqualsToken
		) {
			checkAssignmentRead(node, ctx);
		}
		ts.forEachChild(node, visit);
	};
	visit(ctx.sourceFile);
}

/**
 * Finds reads of Auth `app_metadata` keys in a single file via TypeScript AST.
 * Handles property access (`.key`), element access (`['key']` or `[KEY]`),
 * destructuring, and helpers receiving or returning `app_metadata`.
 */
export function findAppMetadataKeyReads(
	source: string,
	file: string,
	externalConstants?: ExternalConstants,
): AppMetadataKeyRead[] {
	const effectiveSource = file.endsWith('.astro') ? extractAstroFrontmatter(source) : source;
	const scriptKind = /\.[tj]sx$|\.astro$/u.test(file)
		? ts.ScriptKind.TSX
		: /\.[cm]?js$/u.test(file)
			? ts.ScriptKind.JS
			: ts.ScriptKind.TS;

	const sourceFile = ts.createSourceFile(
		file,
		effectiveSource,
		ts.ScriptTarget.Latest,
		true,
		scriptKind,
	);
	const { moduleMap, fallback } = parseExternalConstants(externalConstants);
	const rootScope = createScope(null);
	bindImports(sourceFile, file, rootScope, moduleMap, fallback);
	const nodeToScope = buildScopeTree(sourceFile, rootScope);
	const decls = collectDeclarations(sourceFile, nodeToScope, rootScope);
	resolveScopeConstants(decls.variableDecls, nodeToScope, rootScope);

	const ctx: FileScanContext = {
		sourceFile,
		file,
		nodeToScope,
		rootScope,
		helpersReturningMeta: new Set(),
		reads: [],
		seenReads: new Set(),
	};

	propagateAliases(decls, ctx);
	collectAllReads(ctx);
	return ctx.reads;
}

function harvestFileExports(sf: ts.SourceFile): Map<string, string> {
	const local = new Map<string, string>();
	const exportedNames = new Map<string, string>();
	for (const stmt of sf.statements) {
		if (ts.isVariableStatement(stmt)) {
			const isExported = stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
			for (const d of stmt.declarationList.declarations) {
				if (!ts.isIdentifier(d.name) || !d.initializer) continue;
				const cur = unwrapExpression(d.initializer);
				if (ts.isStringLiteral(cur) || ts.isNoSubstitutionTemplateLiteral(cur)) {
					local.set(d.name.text, cur.text);
					if (isExported) exportedNames.set(d.name.text, d.name.text);
				}
			}
		} else if (
			ts.isExportDeclaration(stmt) &&
			stmt.exportClause &&
			ts.isNamedExports(stmt.exportClause)
		) {
			for (const spec of stmt.exportClause.elements) {
				exportedNames.set(
					spec.name.text,
					spec.propertyName ? spec.propertyName.text : spec.name.text,
				);
			}
		}
	}
	const exports = new Map<string, string>();
	for (const [exp, src] of exportedNames) {
		const val = local.get(src);
		if (val !== undefined) exports.set(exp, val);
	}
	return exports;
}

/**
 * Collects exported string constants across all source files in the given roots.
 * Returns a map of module path -> exported constant name -> string value.
 */
function collectExportedConstants(
	roots: readonly string[],
	baseDir?: string,
): Map<string, Map<string, string>> {
	const moduleExports = new Map<string, Map<string, string>>();
	const register = (path: string, exports: Map<string, string>): void => {
		const targets = [path, relative(process.cwd(), path)];
		if (baseDir) targets.push(relative(baseDir, path));
		for (const p of targets) {
			const norm = p.replace(/\\/g, '/');
			moduleExports.set(norm, exports);
			moduleExports.set(normalizeModulePath(norm), exports);
			if (norm.startsWith('src/')) {
				const atNorm = '@/' + norm.slice(4);
				moduleExports.set(atNorm, exports);
				moduleExports.set(normalizeModulePath(atNorm), exports);
			}
		}
	};

	const walk = (dir: string): void => {
		if (!existsSync(dir)) return;
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const path = join(dir, entry.name);
			if (entry.isDirectory()) {
				if (!IGNORED_DIRS.has(entry.name)) walk(path);
			} else if (SOURCE_FILE.test(entry.name)) {
				try {
					const text = readFileSync(path, 'utf8');
					const effective = entry.name.endsWith('.astro')
						? extractAstroFrontmatter(text)
						: text;
					const sf = ts.createSourceFile(path, effective, ts.ScriptTarget.Latest, true);
					const fileExports = harvestFileExports(sf);
					if (fileExports.size > 0) register(path, fileExports);
				} catch {
					// Ignore parse errors during constant harvesting
				}
			}
		}
	};
	for (const root of roots) walk(root);
	return moduleExports;
}

export function scanAppMetadataKeyReads(
	rootOrRoots: string | readonly string[] = DEFAULT_SCAN_ROOTS,
	baseDir?: string,
): AppMetadataKeyRead[] {
	const roots = Array.isArray(rootOrRoots) ? rootOrRoots : [rootOrRoots];
	const exportedConstants = collectExportedConstants(roots, baseDir);
	const reads: AppMetadataKeyRead[] = [];

	const walk = (directory: string, relativePrefix: string): void => {
		if (!existsSync(directory)) return;
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const path = join(directory, entry.name);
			const name = relativePrefix ? `${relativePrefix}/${entry.name}` : entry.name;
			if (entry.isDirectory()) {
				if (!IGNORED_DIRS.has(entry.name)) walk(path, name);
			} else if (SOURCE_FILE.test(entry.name)) {
				reads.push(
					...findAppMetadataKeyReads(readFileSync(path, 'utf8'), name, exportedConstants),
				);
			}
		}
	};

	for (const root of roots) {
		if (!existsSync(root)) continue;
		const rel = baseDir ? relative(baseDir, root).replace(/\\/g, '/') : '';
		walk(root, typeof rootOrRoots === 'string' ? rel : rel || basename(root));
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
