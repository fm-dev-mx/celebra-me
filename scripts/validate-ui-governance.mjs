import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import ts from 'typescript';

const projectRoot = process.cwd();
const srcRoot = path.join(projectRoot, 'src');

const allowedHydratedComponents = new Set([
	'GuestDashboardApp',
	'ClaimCodesApp',
	'EventsAdminTable',
	'UsersAdminTable',
	'DashboardUserMenu',
	'MfaSetupBehavior',
	'LoginFlowBehavior',
	'RSVP',
]);

const violations = [];

function walkFiles(rootDir, predicate) {
	const results = [];
	const stack = [rootDir];

	while (stack.length > 0) {
		const currentDir = stack.pop();
		if (!currentDir) {
			continue;
		}

		for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
			const fullPath = path.join(currentDir, entry.name);
			if (entry.isDirectory()) {
				stack.push(fullPath);
				continue;
			}
			if (predicate(fullPath)) {
				results.push(fullPath);
			}
		}
	}

	return results;
}

function toRelativePath(filePath) {
	return path.relative(projectRoot, filePath).replaceAll('\\', '/');
}

function getLineNumber(text, index) {
	let line = 1;
	for (let currentIndex = 0; currentIndex < index; currentIndex += 1) {
		if (text[currentIndex] === '\n') {
			line += 1;
		}
	}
	return line;
}

function addViolation(filePath, line, message) {
	violations.push(`${toRelativePath(filePath)}:${line} ${message}`);
}

function validateTsxFile(filePath) {
	const text = fs.readFileSync(filePath, 'utf8');
	const sourceFile = ts.createSourceFile(
		filePath,
		text,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TSX,
	);

	function visit(node) {
		if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
			const importPath = node.moduleSpecifier.text;
			const { line } = sourceFile.getLineAndCharacterOfPosition(
				node.moduleSpecifier.getStart(),
			);

			if (importPath.startsWith('./') || importPath.startsWith('../')) {
				addViolation(filePath, line + 1, `import relativo no permitido: "${importPath}"`);
			}
		}

		if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
			if (node.tagName.getText(sourceFile) === 'button') {
				const hasTypeAttribute = node.attributes.properties.some(
					(attribute) =>
						ts.isJsxAttribute(attribute) &&
						attribute.name.getText(sourceFile) === 'type',
				);

				if (!hasTypeAttribute) {
					const { line } = sourceFile.getLineAndCharacterOfPosition(
						node.getStart(sourceFile),
					);
					addViolation(filePath, line + 1, '<button> sin atributo type explícito');
				}
			}
		}

		ts.forEachChild(node, visit);
	}

	visit(sourceFile);
}

function validateAstroFile(filePath) {
	const text = fs.readFileSync(filePath, 'utf8');
	const hydrationPattern =
		/<([A-Z][A-Za-z0-9]*)\b[^>]*\bclient:(?:load|idle|visible|only)(?:=|(?=[\s>]))/g;

	for (const match of text.matchAll(hydrationPattern)) {
		const componentName = match[1];
		const matchIndex = match.index ?? 0;

		if (!allowedHydratedComponents.has(componentName)) {
			addViolation(
				filePath,
				getLineNumber(text, matchIndex),
				`client:* no permitido para ${componentName}`,
			);
		}
	}
}

const tsxFiles = walkFiles(srcRoot, (filePath) => filePath.endsWith('.tsx'));
const astroFiles = walkFiles(srcRoot, (filePath) => filePath.endsWith('.astro'));

tsxFiles.forEach(validateTsxFile);
astroFiles.forEach(validateAstroFile);

if (violations.length > 0) {
	console.error('Se detectaron violaciones de gobernanza UI:\n');
	for (const violation of violations) {
		console.error(`- ${violation}`);
	}
	process.exit(1);
}

console.log('Validación UI Governance completada sin hallazgos.');
