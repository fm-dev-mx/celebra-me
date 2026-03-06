#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const CONTENT_DIR = path.join(PROJECT_ROOT, 'src', 'content', 'events');
const EVENT_STYLES_DIR = path.join(PROJECT_ROOT, 'src', 'styles', 'events');
const CHECKLIST_DIR = path.join(PROJECT_ROOT, 'docs', 'domains', 'invitations', 'checklists');

const DEFAULT_TEMPLATE = 'template-xv-real.json';
const EVENT_TYPES = new Set(['xv', 'boda', 'bautizo', 'cumple']);

function toTitleCaseFromSlug(slug) {
	return slug
		.split('-')
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}

function ensureDir(dir) {
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
}

function writeFile(filePath, content, force) {
	if (fs.existsSync(filePath) && !force) {
		throw new Error(
			`File already exists: ${path.relative(PROJECT_ROOT, filePath)} (use --force to overwrite)`,
		);
	}
	fs.writeFileSync(filePath, content, 'utf8');
}

async function main() {
	const { values, positionals } = parseArgs({
		options: {
			help: { type: 'boolean', short: 'h' },
			eventType: { type: 'string', default: 'xv' },
			title: { type: 'string' },
			template: { type: 'string', default: DEFAULT_TEMPLATE },
			force: { type: 'boolean', default: false },
			skipStyle: { type: 'boolean', default: false },
		},
		allowPositionals: true,
		strict: false,
	});

	if (values.help) {
		console.log(`
Create a new invitation scaffold (content + optional event override style + checklist).

Usage:
  pnpm ops new-invitation <slug> [options]

Options:
  --eventType <type>    Event type: xv | boda | bautizo | cumple (default: xv)
  --title <title>       Invitation title (default generated from slug)
  --template <file>     Template file from src/content/events (default: ${DEFAULT_TEMPLATE})
  --skipStyle           Do not create src/styles/events/<slug>.scss
  --force               Overwrite existing scaffold files
  --help, -h            Show this help
`);
		return;
	}

	const slug = (positionals[0] || '').trim().toLowerCase();
	if (!slug) {
		throw new Error('Missing slug. Usage: pnpm ops new-invitation <slug>');
	}
	if (!/^[a-z0-9-]+$/.test(slug)) {
		throw new Error('Invalid slug. Use lowercase letters, numbers, and hyphens only.');
	}

	const eventType = values.eventType;
	if (!EVENT_TYPES.has(eventType)) {
		throw new Error('Invalid --eventType. Allowed: xv, boda, bautizo, cumple.');
	}

	const templatePath = path.join(CONTENT_DIR, values.template);
	if (!fs.existsSync(templatePath)) {
		throw new Error(`Template not found: src/content/events/${values.template}`);
	}

	ensureDir(CONTENT_DIR);
	ensureDir(EVENT_STYLES_DIR);
	ensureDir(CHECKLIST_DIR);

	const rawTemplate = fs.readFileSync(templatePath, 'utf8');
	const template = JSON.parse(rawTemplate);
	const title = values.title || `${toTitleCaseFromSlug(slug)} - Invitación`;

	const scaffoldEvent = {
		...template,
		eventType,
		isDemo: false,
		title,
		description:
			template.description ||
			'Invitación en producción. Completar copy y assets antes de publicar.',
		hero: {
			...template.hero,
			name: template.hero?.name || 'Nombre de la festejada',
			date: template.hero?.date || new Date().toISOString(),
		},
	};

	const contentFilePath = path.join(CONTENT_DIR, `${slug}.json`);
	writeFile(contentFilePath, `${JSON.stringify(scaffoldEvent, null, 4)}\n`, values.force);

	const created = [path.relative(PROJECT_ROOT, contentFilePath)];

	if (!values.skipStyle) {
		const stylePath = path.join(EVENT_STYLES_DIR, `${slug}.scss`);
		const styleContent = `.event--${slug} {\n\t/* Invitation-specific overrides for ${slug} */\n}\n`;
		writeFile(stylePath, styleContent, values.force);
		created.push(path.relative(PROJECT_ROOT, stylePath));
	}

	const assetsManifestPath = path.join(CONTENT_DIR, `${slug}.assets.json`);
	const assetsManifest = {
		eventSlug: slug,
		eventType,
		assets: {
			heroBackground: '',
			heroPortrait: '',
			gallery: [],
			location: {
				ceremony: '',
				reception: '',
			},
		},
		notes: 'Fill this manifest and update event content assets before publish.',
	};
	writeFile(assetsManifestPath, `${JSON.stringify(assetsManifest, null, 4)}\n`, values.force);
	created.push(path.relative(PROJECT_ROOT, assetsManifestPath));

	const checklistPath = path.join(CHECKLIST_DIR, `${slug}.md`);
	const checklistLines = [
		`# Invitation Onboarding Checklist: ${slug}`,
		'',
		'## Content',
		`- [ ] Validate \`src/content/events/${slug}.json\` against current schema`,
		'- [ ] Confirm section toggles and navigation anchors',
		'- [ ] Configure indication semantics with `iconName` and `styleVariant`',
		'',
		'## Assets',
		`- [ ] Complete \`src/content/events/${slug}.assets.json\``,
		'- [ ] Replace temporary URLs with approved assets',
		'- [ ] Verify mobile image performance',
		'',
		'## Styles',
		'- [ ] Review shared preset impact',
		`- [ ] Implement event-only overrides in \`src/styles/events/${slug}.scss\` (if required)`,
		'- [ ] Run visual check against other invitations',
		'',
		'## Parity and Governance',
		`- [ ] Create/update DB event with slug \`${slug}\` and type \`${eventType}\``,
		`- [ ] Run \`pnpm ops validate-event-parity --slug ${slug}\``,
		'- [ ] Run `pnpm ops check-links` if docs changed',
	];
	const checklist = `${checklistLines.join('\n')}\n`;
	writeFile(checklistPath, checklist, values.force);
	created.push(path.relative(PROJECT_ROOT, checklistPath));

	console.log('Created invitation scaffold:');
	for (const file of created) {
		console.log(`- ${file}`);
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
