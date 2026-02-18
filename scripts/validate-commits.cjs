#!/usr/bin/env node

/**
 * Script de validación de commits ADU (Atomic, Descriptive, Unitary)
 *
 * Este script valida que los commits cumplan con:
 * 1. Formato Conventional Commits
 * 2. No contengan indicadores WIP/draft
 * 3. No sean merge commits en PRs
 * 4. Tengan cuerpo explicativo para cambios complejos
 *
 * Uso:
 *   node scripts/validate-commits.cjs <base-sha> <head-sha>
 */

const { execSync } = require('child_process');
const { exit } = require('process');

function runCommand(command) {
	try {
		return execSync(command, { encoding: 'utf8', stdio: 'pipe' }).trim();
	} catch (error) {
		console.error(`Error ejecutando comando: ${command}`);
		console.error(error.message);
		return null;
	}
}

function validateCommit(commitHash) {
	console.log(`\n🔍 Validando commit: ${commitHash}`);

	// Obtener mensaje completo del commit
	const commitMessage = runCommand(`git log --format="%B" -n 1 ${commitHash}`);
	const commitSubject = runCommand(`git log --format="%s" -n 1 ${commitHash}`);

	if (!commitMessage) {
		console.error(`❌ No se pudo obtener mensaje del commit ${commitHash}`);
		return false;
	}

	console.log(`   Asunto: ${commitSubject}`);

	// 1. Validar con commitlint (solo el título/subject)
	try {
		// Tomar solo la primera línea (el título/subject) y limpiar espacios y newlines
		const commitSubject = commitMessage
			.split('\n')[0]
			.replace(/\r?\n$/, '')
			.trim();
		// Crear un archivo temporal para pasar el subject a commitlint
		const fs = require('fs');
		const tmpFile = `/tmp/commit-${commitHash}.txt`;
		fs.writeFileSync(tmpFile, commitSubject);

		// Ejecutar commitlint de forma programática solo con el subject
		// eslint-disable-next-line no-unused-vars
		const _result = execSync(`npx commitlint --edit "${tmpFile}"`, {
			encoding: 'utf8',
			stdio: 'pipe',
		});

		// Limpiar archivo temporal
		fs.unlinkSync(tmpFile);

		console.log('   ✅ Formato Conventional Commits válido');
	} catch (error) {
		console.error('   ❌ Error en formato Conventional Commits:');
		console.error(`      ${error.stdout || error.message}`);
		console.error('\n   Formato esperado:');
		console.error('     feat: agregar nueva funcionalidad');
		console.error('     fix: corregir error');
		console.error('     docs: cambios en documentación');
		console.error('     style: formato, punto y coma, etc');
		console.error('     refactor: refactorización de código');
		console.error('     test: agregar o corregir tests');
		console.error('     chore: tareas de mantenimiento');
		return false;
	}

	// 2. Verificar indicadores WIP/draft
	const wipPatterns = [/wip/i, /draft/i, /work in progress/i, /en progreso/i];
	for (const pattern of wipPatterns) {
		if (pattern.test(commitSubject)) {
			console.error(`   ❌ Commit contiene indicador WIP/draft: "${commitSubject}"`);
			console.error('      Por favor elimina indicadores WIP/draft antes de hacer merge');
			return false;
		}
	}

	// 3. Verificar merge commits
	if (commitSubject.startsWith('Merge ')) {
		console.error(`   ❌ Commit es un merge commit: "${commitSubject}"`);
		console.error('      Por favor usa rebase en lugar de merge en ramas de feature');
		return false;
	}

	// 4. Verificar cuerpo para cambios complejos
	const commitBody = commitMessage.split('\n').slice(1).join('\n').trim();
	const subjectLength = commitSubject.length;

	if (!commitBody && subjectLength > 72) {
		console.warn('   ⚠️  Advertencia: Asunto largo sin cuerpo explicativo');
		console.warn('      Considera agregar un cuerpo para explicar el "por qué" del cambio');
	}

	// 5. Verificar atomicidad (análisis básico)
	const changedFiles = runCommand(`git show --name-only --format="" ${commitHash}`);
	const fileCount = changedFiles ? changedFiles.split('\n').filter((f) => f.trim()).length : 0;

	if (fileCount > 10) {
		console.warn(`   ⚠️  Advertencia: Commit modifica ${fileCount} archivos`);
		console.warn('      Considera si este cambio podría dividirse en commits más atómicos');
	}

	console.log('   ✅ Commit válido');
	return true;
}

function main() {
	const args = process.argv.slice(2);

	if (args.length < 2) {
		console.error('Uso: node scripts/validate-commits.cjs <base-sha> <head-sha>');
		console.error('Ejemplo: node scripts/validate-commits.cjs main feature-branch');
		exit(1);
	}

	const [baseSha, headSha] = args;

	console.log('🚀 Validación de commits ADU');
	console.log(`📊 Rango: ${baseSha}..${headSha}`);

	// Obtener lista de commits en el rango
	const commitsOutput = runCommand(`git log --oneline --format="%H" ${baseSha}..${headSha}`);

	if (!commitsOutput) {
		console.log('✅ No hay commits para validar en este rango');
		exit(0);
	}

	const commitHashes = commitsOutput.split('\n').filter((hash) => hash.trim());

	if (commitHashes.length === 0) {
		console.log('✅ No hay commits para validar en este rango');
		exit(0);
	}

	console.log(`📝 Encontrados ${commitHashes.length} commit(s) para validar\n`);

	let allValid = true;

	for (const commitHash of commitHashes) {
		if (!validateCommit(commitHash)) {
			allValid = false;
		}
	}

	if (allValid) {
		console.log('\n🎉 ¡Todos los commits pasaron la validación ADU!');
		console.log('✅ Atomic - Cada commit tiene un propósito único');
		console.log('✅ Descriptive - Mensajes claros y descriptivos');
		console.log('✅ Unitary - Cambios cohesivos y bien definidos');
		exit(0);
	} else {
		console.error('\n❌ Algunos commits no pasaron la validación ADU');
		console.error('   Por favor corrige los problemas antes de hacer merge');
		exit(1);
	}
}

if (require.main === module) {
	main();
}

module.exports = { validateCommit };
