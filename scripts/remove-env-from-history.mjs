#!/usr/bin/env node

/**
 * remove-env-from-history.mjs
 * Script to remove `.env` files from Git history safely.
 * Replaces old Bash counterpart for Windows/Linux portability.
 */

import { parseArgs } from 'node:util';
import readline from 'node:readline';
import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const REPO_ROOT = path.resolve(process.cwd());

if (!fs.existsSync(path.join(REPO_ROOT, '.git'))) {
	console.error('❌ Error: El script debe ejecutarse desde un repositorio git.');
	process.exit(1);
}

const { values } = parseArgs({
	options: {
		help: { type: 'boolean', short: 'h' },
		'dry-run': { type: 'boolean' },
	},
	strict: false,
});

if (values.help) {
	console.log(`
Elimina por completo archivos .env filtrados en el historial de Git.

Usage:
  pnpm ops remove-env-from-history [options]

Options:
  --help, -h    Show this help message.
  --dry-run     Ejecuta comandos simulados sin mutar el historial git real.
	`);
	process.exit(0);
}

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});

const red = '\x1B[31m';
const green = '\x1B[32m';
const yellow = '\x1B[33m';
const reset = '\x1B[0m';

console.log(`🧹 Eliminando archivos .env del historial git
==============================================

⚠️  ADVERTENCIA: Este script reescribe el historial de git
   - Todos los commits serán modificados
   - Requiere force push
   - Todo el equipo debe reclonar el repo después
`);

console.log(`📋 Archivos que serán eliminados del historial:`);
try {
	const gitLogFiles = execSync('git log --all --full-history --name-only --pretty=format:', {
		encoding: 'utf8',
	})
		.split('\n')
		.filter((l) => l.startsWith('.env'))
		.filter((v, i, a) => a.indexOf(v) === i)
		.sort();

	if (gitLogFiles.length === 0) {
		console.log(
			`${green}No se encontraron archivos .env en el historial. Todo limpio.${reset}`,
		);
		process.exit(0);
	}
	gitLogFiles.forEach((f) => console.log(`  - ${f}`));
} catch (e) {
	console.error('Git history check failed.', e.message);
}

rl.question(`\n¿Estás seguro de continuar? Escribe 'ELIMINAR' para confirmar: `, (confirm) => {
	if (confirm !== 'ELIMINAR') {
		console.log(`\n${yellow}⚠️  Operación cancelada${reset}`);
		process.exit(0);
	}

	console.log(`\n🔧 Eliminando archivos del historial...`);
	console.log(`Usando git-filter-branch...`);

	try {
		if (values['dry-run']) {
			console.log(
				`[DRY RUN] git filter-branch --force --index-filter 'git rm --cached --ignore-unmatch .env .env.local' ...`,
			);
		} else {
			execSync(
				`git filter-branch --force --index-filter "git rm --cached --ignore-unmatch .env .env.local .env.production .env.*.local" --prune-empty --tag-name-filter cat -- --all`,
				{ stdio: 'inherit' },
			);

			console.log(`\n🧹 Limpiando referencias...`);
			const refsPath = path.join(REPO_ROOT, '.git', 'refs', 'original');
			if (fs.existsSync(refsPath)) fs.rmSync(refsPath, { recursive: true, force: true });

			console.log(`🗑️  Expirando reflog...`);
			execSync('git reflog expire --expire=now --all', { stdio: 'ignore' });

			console.log(`♻️  Garbage collection...`);
			execSync('git gc --prune=now --aggressive', { stdio: 'ignore' });
		}
	} catch (e) {
		console.error(`${red}🚨 Error filtrando historial: ${e.message}${reset}`);
		process.exit(1);
	}

	console.log(
		`\n${green}✅ Archivos eliminados del historial (DRY RUN: ${values['dry-run'] ? 'SI' : 'NO'})${reset}`,
	);
	console.log(`
📋 Próximos pasos:
1. Verificar que no quedan rastros: git log --all --full-history -- .env
2. Force push al remote: git push origin --force --all
3. Notificar al equipo para hacer clon/fetch fresco.
`);
	process.exit(0);
});
