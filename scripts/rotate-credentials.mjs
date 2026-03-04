#!/usr/bin/env node

/**
 * rotate-credentials.mjs - Phase 0 Security Hardening
 * Detects and guides credential rotation defensively.
 */

import { parseArgs } from 'node:util';
import readline from 'node:readline';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(process.cwd());

if (!fs.existsSync(path.join(REPO_ROOT, 'package.json'))) {
	console.error('❌ Error: El script debe ejecutarse desde la raíz del proyecto.');
	process.exit(1);
}

const { values } = parseArgs({
	options: {
		help: { type: 'boolean', short: 'h' },
		'dry-run': { type: 'boolean' }
	},
	strict: false
});

if (values.help) {
	console.log(`
Guía paso a paso para rotar credenciales sensibles o llaves en Vercel/Supabase de forma segura.

Usage:
  pnpm ops rotate-credentials [options]

Options:
  --help, -h    Show this help message.
  --dry-run     Validate logic without writing to gitignore or performing cleanup ops.
	`);
	process.exit(0);
}

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

const red = '\x1B[31m';
const green = '\x1B[32m';
const yellow = '\x1B[33m';
const reset = '\x1B[0m';

console.log(`🔐 Security Hardening - Fase 0: Rotación de Credenciales\n=========================================================\n`);
console.log(`📋 Lista de credenciales a rotar:\n
1. SendGrid API Key
   - URL: https://app.sendgrid.com/settings/api_keys
   - Acción: Revocar key existente y crear nueva

2. Gmail App Password
   - URL: https://myaccount.google.com/apppasswords
   - Acción: Revocar password existente y crear nuevo

3. Supabase Service Role Key
   - URL: https://supabase.com/dashboard/project/_/settings/api
   - Acción: Regenerar service_role key

4. Supabase Anon Key
   - URL: https://supabase.com/dashboard/project/_/settings/api
   - Acción: Regenerar anon key

5. RSVP Admin Password
   - Acción: Cambiar password en Supabase Auth o variable de entorno\n`);

rl.question('¿Has rotado TODAS las credenciales listadas arriba? (s/N): ', (confirm) => {
	if (confirm.toLowerCase() !== 's') {
		console.log(`${yellow}⚠️  Por favor, rota las credenciales antes de continuar${reset}`);
		console.log(`Sigue instrucciones en docs/security-hardening/CREDENTIAL_ROTATION.md`);
		rl.close();
		process.exit(1);
	}

	console.log(`\n${green}✅ Confirmación recibida${reset}\n`);

	console.log(`🔍 Verificando .gitignore...`);
	const gitignorePath = path.join(REPO_ROOT, '.gitignore');
	let ignoreContent = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';

	if (/(^|\n)\.env(\r?\n|$)/.test(ignoreContent)) {
		console.log(`${green}✅ .gitignore contiene reglas para .env*${reset}`);
	} else {
		console.log(`${yellow}⚠️  Agregando .env* a .gitignore...${reset}`);
		if (!values['dry-run']) {
			fs.appendFileSync(gitignorePath, '\n# Environment variables\n.env\n.env.local\n.env.*.local\n');
		}
		console.log(`${green}✅ .gitignore actualizado${reset}`);
	}

	console.log(`\n🔍 Verificando que .env files no están trackeados...`);
	try {
		const gitFiles = execSync('git ls-files', { encoding: 'utf8' });
		if (gitFiles.split('\n').some(file => file.endsWith('.env') || file.endsWith('.env.local'))) {
			console.log(`${red}❌ ATENCIÓN: Archivos .env aún están en git${reset}`);
			console.log(`Ejecuta: git rm --cached .env .env.local`);
			rl.close();
			process.exit(1);
		} else {
			console.log(`${green}✅ Archivos .env no están trackeados${reset}`);
		}
	} catch (err) {
		console.log(`${yellow}⚠️  No se pudo verificar GIT. ¿Es un repositorio?${reset}`);
	}

	rl.question(`\n🔍 ¿Las nuevas credenciales están configuradas en dashboard Vercel? (s/N): `, (verConfirm) => {
		if (verConfirm.toLowerCase() !== 's') {
			console.log(`${yellow}⚠️  Configura credenciales en Vercel antes de continuar${reset}`);
			rl.close();
			process.exit(1);
		}

		console.log(`\n${green}✅ Fase 0.1 completada${reset}\n`);
		console.log(`Próximo paso: Eliminar archivos .env del historial git`);
		console.log(`Ejecuta: pnpm ops remove-env-from-history`);
		rl.close();
		process.exit(0);
	});
});
