/**
 * Candidate review report: lists only captures that fail the gate against the accepted bytes.
 *
 * A SHA-256 change alone is not a review item. Gate-passing byte changes are counted in a
 * collapsed group because the accepted bytes are kept for them (or would pass compare).
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { CaptureManifest } from './visual-manifest.ts';
import { compareWithVisualGate } from './visual-gate-comparator.ts';

type ReviewCapture = CaptureManifest['captures'][number] & Record<string, unknown>;

export interface CandidateReviewItem {
	file: string;
	label: string;
	kind: 'variant' | 'page';
	viewport: string;
	preset: string;
	cssOwner?: string;
	status: 'changed' | 'new';
	previousSha256?: string;
	sha256: string;
	differentPixels?: number;
	pixelRatio?: number;
	heightDelta?: number;
	message?: string;
	diff?: string;
}

export interface CandidateReview {
	referenceSha?: unknown;
	matrixHash?: string;
	candidateManifestSha256: string;
	items: CandidateReviewItem[];
	renderNoise: string[];
	removed: string[];
}

function captureLabel(capture: ReviewCapture): string {
	if (capture.section) return `${capture.section}.${capture.variant}`;
	return `${String(capture.kind ?? 'page')} ${String(capture.eventType ?? '')}/${String(capture.slug ?? '')}`;
}

/** Height changes first (they shift everything below), then by share of differing pixels. */
function severity(item: CandidateReviewItem): number {
	if (item.status === 'new') return -1;
	return (item.heightDelta ? 10 + Math.abs(item.heightDelta) : 0) + (item.pixelRatio ?? 0);
}

export function buildCandidateReview(options: {
	root: string;
	captures: readonly ReviewCapture[];
	previous: CaptureManifest | null;
	acceptedRoot: string;
	observedSha256: ReadonlyMap<string, string>;
	matrixHash?: string;
	referenceSha?: unknown;
	candidateManifestSha256: string;
}): CandidateReview {
	const { root, captures, previous, acceptedRoot, observedSha256 } = options;
	const referencesRoot = resolve(root, '..', 'candidate-references');
	const diffsRoot = resolve(root, '..', 'candidate-diffs');
	const previousByFile = new Map(previous?.captures.map((capture) => [capture.file, capture]));
	const items: CandidateReviewItem[] = [];
	const renderNoise: string[] = [];
	for (const capture of captures) {
		const old = previousByFile.get(capture.file);
		const base = {
			file: capture.file,
			label: captureLabel(capture),
			kind: capture.section ? ('variant' as const) : ('page' as const),
			viewport: capture.viewport,
			preset: capture.preset ?? '',
			...(typeof capture.cssOwner === 'string' ? { cssOwner: capture.cssOwner } : {}),
			sha256: capture.sha256,
		};
		if (!old) {
			items.push({ ...base, status: 'new' });
			continue;
		}
		if (old.sha256 === capture.sha256) {
			const observed = observedSha256.get(capture.file);
			if (observed && observed !== capture.sha256) renderNoise.push(capture.file);
			continue;
		}
		const accepted = readFileSync(join(acceptedRoot, old.file));
		const comparison = compareWithVisualGate(readFileSync(join(root, capture.file)), accepted);
		if (comparison.passed) {
			renderNoise.push(capture.file);
			continue;
		}
		const reference = join(referencesRoot, old.file);
		mkdirSync(dirname(reference), { recursive: true });
		cpSync(join(acceptedRoot, old.file), reference);
		let diff: string | undefined;
		if (comparison.diff) {
			const target = join(diffsRoot, capture.file);
			mkdirSync(dirname(target), { recursive: true });
			writeFileSync(target, comparison.diff);
			diff = capture.file;
		}
		const area = accepted.readUInt32BE(16) * accepted.readUInt32BE(20);
		items.push({
			...base,
			status: 'changed',
			previousSha256: old.sha256,
			message: comparison.message,
			...(comparison.differentPixels !== undefined
				? {
						differentPixels: comparison.differentPixels,
						pixelRatio: comparison.differentPixels / area,
					}
				: {}),
			...(comparison.actualSize && comparison.expectedSize
				? { heightDelta: comparison.actualSize.height - comparison.expectedSize.height }
				: {}),
			...(diff ? { diff } : {}),
		});
	}
	items.sort((left, right) => severity(right) - severity(left));
	const current = new Set(captures.map((capture) => capture.file));
	return {
		referenceSha: options.referenceSha,
		matrixHash: options.matrixHash,
		candidateManifestSha256: options.candidateManifestSha256,
		items,
		renderNoise,
		removed:
			previous?.captures.filter((old) => !current.has(old.file)).map((old) => old.file) ?? [],
	};
}

function escapeHtml(value: unknown): string {
	return String(value ?? '')
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

function formatMetrics(item: CandidateReviewItem): string {
	if (item.status === 'new') return 'Captura nueva';
	const parts: string[] = [];
	if (item.heightDelta)
		parts.push(`Δ alto ${item.heightDelta > 0 ? '+' : ''}${item.heightDelta} px`);
	if (item.differentPixels !== undefined) {
		parts.push(
			`${item.differentPixels.toLocaleString('es-MX')} píxeles distintos (${((item.pixelRatio ?? 0) * 100).toFixed(2)} %)`,
		);
	}
	return parts.join(' · ') || 'Falla el gate';
}

function renderCard(item: CandidateReviewItem): string {
	const candidate = escapeHtml(item.file);
	const before =
		item.status === 'changed' ? `../candidate-references/${escapeHtml(item.file)}` : undefined;
	const diff = item.diff ? `../candidate-diffs/${escapeHtml(item.diff)}` : undefined;
	const views = [
		before
			? `<div class="view side" data-view="side"><figure><figcaption>Aceptada</figcaption><img loading="lazy" alt="Referencia aceptada" src="${before}"></figure><figure><figcaption>Candidata</figcaption><img loading="lazy" alt="Candidata" src="${candidate}"></figure></div>`
			: `<div class="view side" data-view="side"><figure><figcaption>Candidata</figcaption><img loading="lazy" alt="Candidata" src="${candidate}"></figure></div>`,
		before
			? `<div class="view slider" data-view="slider" hidden><div class="stack"><img loading="lazy" alt="Referencia aceptada" src="${before}"><img class="top" loading="lazy" alt="Candidata" src="${candidate}"></div><input type="range" min="0" max="100" value="50" aria-label="Posición del deslizador"></div>`
			: '',
		diff
			? `<div class="view diff" data-view="diff" hidden><img loading="lazy" alt="Diferencias marcadas por el gate" src="${diff}"></div>`
			: '',
	].join('');
	const tabs = [
		'<button type="button" data-show="side" aria-pressed="true">Lado a lado</button>',
		before ? '<button type="button" data-show="slider">Deslizador</button>' : '',
		diff ? '<button type="button" data-show="diff">Diferencias</button>' : '',
	].join('');
	const search = `${item.file} ${item.label} ${item.preset} ${item.cssOwner ?? ''}`.toLowerCase();
	return `<article data-kind="${item.kind}" data-viewport="${escapeHtml(item.viewport)}" data-status="${item.status}" data-search="${escapeHtml(search)}">
<header><h2>${escapeHtml(item.label)}</h2><p>${escapeHtml(item.preset)} · ${escapeHtml(item.viewport)} · <strong>${escapeHtml(formatMetrics(item))}</strong></p>
<p class="meta"><code>${escapeHtml(item.file)}</code>${item.cssOwner ? ` · CSS: <code>${escapeHtml(item.cssOwner)}</code>` : ''}</p></header>
<nav>${tabs}</nav>${views}</article>`;
}

const REVIEW_STYLE = `body{font-family:system-ui;margin:0;background:#f8fafc;color:#0f172a}main{padding:1rem 1.5rem}header.top{position:sticky;top:0;background:#0f172a;color:#f8fafc;padding:1rem 1.5rem;z-index:2}header.top p{margin:.25rem 0}form{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.5rem}article{background:#fff;border:1px solid #cbd5e1;border-radius:8px;margin:1rem 0;padding:1rem}article h2{margin:0;font-size:1.1rem}.meta{color:#475569;font-size:.8rem;word-break:break-all}nav button{margin-right:.25rem}nav button[aria-pressed=true]{font-weight:700}.side{display:flex;gap:1rem;align-items:flex-start}.side figure{flex:1;margin:0}.view{max-height:80vh;overflow:auto;margin-top:.5rem;border:1px solid #e2e8f0}.view img{width:100%;height:auto;display:block}.stack{position:relative}.stack .top{position:absolute;inset:0;clip-path:inset(0 50% 0 0)}.slider input{width:100%;position:sticky;bottom:0}details{background:#fff;border:1px solid #cbd5e1;border-radius:8px;padding:1rem;margin:1rem 0}`;

const REVIEW_SCRIPT = `const q=document.querySelector('#q'),k=document.querySelector('#kind'),v=document.querySelector('#viewport');
function apply(){const t=q.value.trim().toLowerCase();for(const a of document.querySelectorAll('article')){a.hidden=!((!t||a.dataset.search.includes(t))&&(!k.value||a.dataset.kind===k.value)&&(!v.value||a.dataset.viewport===v.value));}}
for(const c of[q,k,v])c.addEventListener('input',apply);
document.addEventListener('click',e=>{const b=e.target.closest('button[data-show]');if(!b)return;const a=b.closest('article');for(const x of a.querySelectorAll('[data-view]'))x.hidden=x.dataset.view!==b.dataset.show;for(const x of a.querySelectorAll('button[data-show]'))x.setAttribute('aria-pressed',String(x===b));});
document.addEventListener('input',e=>{if(!e.target.matches('.slider input'))return;e.target.closest('.slider').querySelector('.top').style.clipPath='inset(0 '+(100-e.target.value)+'% 0 0)';});`;

export function renderCandidateReviewHtml(review: CandidateReview): string {
	const changed = review.items.filter((item) => item.status === 'changed').length;
	const added = review.items.length - changed;
	const viewports = [...new Set(review.items.map((item) => item.viewport))].sort();
	return `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Revisión visual</title><style>${REVIEW_STYLE}</style>
<header class="top"><h1>Revisión visual</h1>
<p>SHA: <code>${escapeHtml(review.referenceSha)}</code> · Matriz: <code>${escapeHtml(review.matrixHash)}</code> · Manifiesto: <code>${escapeHtml(review.candidateManifestSha256)}</code></p>
<p><strong>${changed}</strong> capturas fallan el gate · <strong>${added}</strong> nuevas · ${review.renderNoise.length} con ruido de render que pasa el gate · ${review.removed.length} eliminadas · <a href="combined-contact-sheet.html" style="color:#93c5fd">Ver matriz completa</a></p>
<form onsubmit="return false"><input id="q" type="search" placeholder="Buscar sección, variante, preset o archivo" aria-label="Buscar"><select id="kind" aria-label="Tipo"><option value="">Todos los tipos</option><option value="variant">Variantes</option><option value="page">Páginas completas</option></select><select id="viewport" aria-label="Viewport"><option value="">Todos los viewports</option>${viewports.map((viewport) => `<option>${escapeHtml(viewport)}</option>`).join('')}</select></form></header>
<main>${review.items.length ? review.items.map(renderCard).join('\n') : '<p>No hay capturas que fallen el gate ni capturas nuevas.</p>'}
<details><summary>Ruido de render que pasa el gate (${review.renderNoise.length}): se conservan los bytes aceptados</summary><p>${review.renderNoise.map(escapeHtml).join('<br>') || 'Ninguno.'}</p></details>
<details${review.removed.length ? ' open' : ''}><summary>Eliminadas (${review.removed.length})</summary><p>${review.removed.map(escapeHtml).join('<br>') || 'Ninguna.'}</p></details></main>
<script>${REVIEW_SCRIPT}</script></html>`;
}

export function writeCandidateReview(root: string, review: CandidateReview): void {
	writeFileSync(join(root, 'changes.html'), renderCandidateReviewHtml(review), 'utf8');
	writeFileSync(join(root, 'review.json'), `${JSON.stringify(review, null, 2)}\n`, 'utf8');
}

export function readCandidateReview(root: string): CandidateReview | null {
	const file = join(root, 'review.json');
	return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as CandidateReview) : null;
}
