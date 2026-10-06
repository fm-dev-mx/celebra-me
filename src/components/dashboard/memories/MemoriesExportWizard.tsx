import { useEffect, useState } from 'react';
import ModalShell from '@/components/dashboard/ModalShell';
import type { MemoriesOrganizerItem } from '@/lib/memories/contract/catalog';
import {
	MEMORIES_ARCHIVE_MAX_BYTES,
	MEMORIES_ARCHIVE_MAX_FILES,
} from '@/lib/memories/contract/limits';
import {
	MemoriesRequestError,
	memoriesOrganizerApi,
	type OrganizerSpaceItem,
} from '@/lib/memories/client/api';
import {
	createMemoriesZip,
	generateBulkZipPassphrase,
	partitionMemoriesExport,
	type BulkExportProgress,
} from '@/lib/memories/client/export';

type OrganizerItem = MemoriesOrganizerItem;
export type MemoriesExportScope = 'all' | 'selected';
type ExportStep = 'confirm' | 'password' | 'processing' | 'complete';

interface Props {
	space: OrganizerSpaceItem;
	scope: MemoriesExportScope;
	selectedItems: OrganizerItem[];
	onClose: () => void;
}

function downloadBlob(blob: Blob, publicSlug: string, batchIndex: number): void {
	const downloadUrl = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = downloadUrl;
	link.download = `recuerdos-${publicSlug}-${new Date().toISOString().slice(0, 10)}-parte-${batchIndex + 1}.zip`;
	document.body.appendChild(link);
	link.click();
	link.remove();
	URL.revokeObjectURL(downloadUrl);
}

async function fetchAllAccepted(eventId: string): Promise<OrganizerItem[]> {
	let page = 0;
	const accepted: OrganizerItem[] = [];
	let hasNextPage = true;
	while (hasNextPage) {
		const payload = await memoriesOrganizerApi.listItems(eventId, page, { status: 'accepted' });
		accepted.push(...payload.items);
		hasNextPage = typeof payload.nextPage === 'number';
		if (hasNextPage) page = payload.nextPage as number;
	}
	return accepted;
}

function zipLabel(batches: number): string {
	return batches === 1 ? 'ZIP' : `${batches} ZIP`;
}

/** Download wizard: scope, optional password and the ZIP batches built in the browser. */
export default function MemoriesExportWizard({ space, scope, selectedItems, onClose }: Props) {
	const [step, setStep] = useState<ExportStep>('confirm');
	const [items, setItems] = useState<OrganizerItem[]>([]);
	const [batches, setBatches] = useState<OrganizerItem[][]>([]);
	const [encrypt, setEncrypt] = useState(true);
	const [passphrase, setPassphrase] = useState('');
	const [passphraseCopied, setPassphraseCopied] = useState(false);
	const [passphraseConfirmed, setPassphraseConfirmed] = useState(false);
	const [progress, setProgress] = useState<BulkExportProgress | null>(null);
	const [batchIndex, setBatchIndex] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const [working, setWorking] = useState(true);
	const [candidates, setCandidates] = useState<OrganizerItem[]>([]);
	const [includeHidden, setIncludeHidden] = useState(false);
	const hiddenCount = candidates.filter((item) => item.hidden).length;

	const applyScope = (all: OrganizerItem[], withHidden: boolean) => {
		// «Descargar todo» leaves out what the host hid unless asked; a selection is taken as is.
		const scoped = scope === 'all' && !withHidden ? all.filter((item) => !item.hidden) : all;
		setItems(scoped);
		setBatches(partitionMemoriesExport(scoped));
	};

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			try {
				const found =
					scope === 'all'
						? await fetchAllAccepted(space.eventId)
						: selectedItems.filter((item) => item.status === 'accepted');
				if (found.length === 0)
					throw new Error('No hay recuerdos disponibles en este alcance.');
				if (cancelled) return;
				setCandidates(found);
				applyScope(found, false);
			} catch (caught) {
				if (!cancelled)
					setError(
						caught instanceof Error
							? caught.message
							: 'No se pudo preparar la descarga.',
					);
			} finally {
				if (!cancelled) setWorking(false);
			}
		})();
		return () => {
			cancelled = true;
		};
		// The scope is fixed for the wizard's lifetime.
	}, []);

	const close = () => {
		if (!working) onClose();
	};

	const run = async (activePassphrase: string | null) => {
		if (batches.length === 0) return;
		setWorking(true);
		setStep('processing');
		setError(null);
		let unavailableItemId: string | null = null;
		let activeBatchIndex = batchIndex;
		try {
			for (let index = batchIndex; index < batches.length; index += 1) {
				activeBatchIndex = index;
				setBatchIndex(index);
				const batch = batches[index];
				if (batch.length === 0) {
					setBatchIndex(index + 1);
					continue;
				}
				const completedBefore = batches
					.slice(0, index)
					.reduce((total, current) => total + current.length, 0);
				const blob = await createMemoriesZip({
					folderName: `recuerdos-${space.publicSlug}`,
					items: batch,
					passphrase: activePassphrase,
					fetchItemBlob: async (item) => {
						try {
							return await memoriesOrganizerApi.fetchItemBlob(space.eventId, item.id);
						} catch (caught) {
							// Only a file the server no longer has leaves the export. A download
							// cut by the connection keeps its place so the retry fetches it again.
							if (caught instanceof MemoriesRequestError && caught.status === 404) {
								unavailableItemId = item.id;
								throw new Error(
									'Un recuerdo dejó de estar disponible. Revise el alcance y reintente este lote.',
									{ cause: caught },
								);
							}
							throw new Error(
								'La descarga de un recuerdo se interrumpió. Revise su conexión y reintente este lote.',
								{ cause: caught },
							);
						}
					},
					onProgress: (next) =>
						setProgress({
							completed: completedBefore + next.completed,
							total: items.length,
							currentFileName: next.currentFileName,
						}),
				});
				downloadBlob(blob, space.publicSlug, index);
				setBatchIndex(index + 1);
			}
			setProgress({
				completed: items.length,
				total: items.length,
				currentFileName: 'Completado',
			});
			setStep('complete');
		} catch (caught) {
			if (unavailableItemId) {
				const unavailableId = unavailableItemId;
				setItems((current) => current.filter((item) => item.id !== unavailableId));
				setBatches((current) =>
					current.map((batch, index) =>
						index === activeBatchIndex
							? batch.filter((item) => item.id !== unavailableId)
							: batch,
					),
				);
			}
			setError(caught instanceof Error ? caught.message : 'No se pudo generar el lote.');
		} finally {
			setWorking(false);
		}
	};

	const continueFromScope = () => {
		if (items.length === 0 || batches.length === 0) return;
		setError(null);
		if (!encrypt) {
			void run(null);
			return;
		}
		try {
			setPassphrase(generateBulkZipPassphrase());
			setStep('password');
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : 'No se pudo preparar la descarga.');
		}
	};

	const copyPassphrase = async () => {
		try {
			await navigator.clipboard.writeText(passphrase);
			setPassphraseCopied(true);
		} catch {
			setError('No se pudo copiar automáticamente. Seleccione y copie la contraseña.');
		}
	};

	const activePassphrase = encrypt ? passphrase : null;
	const counts = { items: items.length, batches: batches.length };

	return (
		<ModalShell
			title="Descargar recuerdos"
			subtitle={
				scope === 'all'
					? 'Todos los recuerdos disponibles, sin aplicar los filtros visibles.'
					: 'Solo los recuerdos que seleccionó.'
			}
			size="lg"
			descriptionId="memories-export-description"
			disableClose={working && step === 'processing'}
			onClose={close}
			footer={
				<ExportFooter
					step={step}
					working={working}
					encrypt={encrypt}
					hasError={Boolean(error)}
					canGenerate={passphraseConfirmed}
					counts={counts}
					batchIndex={batchIndex}
					onClose={close}
					onContinue={continueFromScope}
					onGenerate={() => void run(passphrase)}
					onRetry={() => void run(activePassphrase)}
				/>
			}
		>
			<div
				className="dashboard-modal__content dashboard-memories__export"
				id="memories-export-description"
			>
				<ExportSteps step={step} encrypt={encrypt} />
				{step === 'confirm' ? (
					<ScopeStep
						working={working}
						counts={counts}
						encrypt={encrypt}
						onEncryptChange={setEncrypt}
						hiddenCount={scope === 'all' ? hiddenCount : 0}
						includeHidden={includeHidden}
						onIncludeHiddenChange={(value) => {
							setIncludeHidden(value);
							applyScope(candidates, value);
						}}
					/>
				) : null}
				{step === 'password' ? (
					<PasswordStep
						passphrase={passphrase}
						copied={passphraseCopied}
						confirmed={passphraseConfirmed}
						counts={counts}
						onCopy={() => void copyPassphrase()}
						onConfirmedChange={setPassphraseConfirmed}
					/>
				) : null}
				{step === 'processing' || step === 'complete' ? (
					<ProgressStep
						complete={step === 'complete'}
						batchIndex={batchIndex}
						counts={counts}
						progress={progress}
						passphrase={activePassphrase}
					/>
				) : null}
				{error ? (
					<p role="alert" className="memories-notice memories-notice--danger">
						{error}
					</p>
				) : null}
			</div>
		</ModalShell>
	);
}

type Counts = { items: number; batches: number };

function countsLabel({ items, batches }: Counts): string {
	return `${items} archivos en ${batches} ${batches === 1 ? 'lote' : 'lotes'}.`;
}

function ExportFooter(props: {
	step: ExportStep;
	working: boolean;
	encrypt: boolean;
	hasError: boolean;
	canGenerate: boolean;
	counts: Counts;
	batchIndex: number;
	onClose: () => void;
	onContinue: () => void;
	onGenerate: () => void;
	onRetry: () => void;
}) {
	const { step, working, counts } = props;
	if (step === 'complete') {
		return (
			<button type="button" className="btn-primary" onClick={props.onClose}>
				Finalizar
			</button>
		);
	}
	if (step === 'processing' && !props.hasError) return null;
	const cancel = (
		<button type="button" className="btn-secondary" onClick={props.onClose}>
			{step === 'processing' ? 'Cerrar' : 'Cancelar'}
		</button>
	);
	if (step === 'processing') {
		return (
			<>
				{cancel}
				<button
					type="button"
					className="btn-primary"
					disabled={working}
					onClick={props.onRetry}
				>
					Reintentar lote {props.batchIndex + 1}
				</button>
			</>
		);
	}
	if (step === 'password') {
		return (
			<>
				{cancel}
				<button
					type="button"
					className="btn-primary"
					disabled={!props.canGenerate || working}
					onClick={props.onGenerate}
				>
					Generar {zipLabel(counts.batches)}
				</button>
			</>
		);
	}
	const label = props.encrypt
		? 'Continuar y crear contraseña'
		: `Generar ${zipLabel(counts.batches)}`;
	return (
		<>
			{cancel}
			<button
				type="button"
				className="btn-primary"
				disabled={working || counts.items === 0}
				onClick={props.onContinue}
			>
				{working ? 'Calculando alcance…' : label}
			</button>
		</>
	);
}

function ExportSteps({ step, encrypt }: { step: ExportStep; encrypt: boolean }) {
	const current = (active: boolean) => (active ? ('step' as const) : undefined);
	return (
		<ol className="dashboard-memories__steps" aria-label="Progreso de la descarga">
			<li aria-current={current(step === 'confirm')}>1. Alcance</li>
			{encrypt ? <li aria-current={current(step === 'password')}>2. Contraseña</li> : null}
			<li aria-current={current(step === 'processing' || step === 'complete')}>
				{encrypt ? '3' : '2'}. Archivos ZIP
			</li>
		</ol>
	);
}

function ScopeStep(props: {
	working: boolean;
	counts: Counts;
	encrypt: boolean;
	onEncryptChange: (value: boolean) => void;
	hiddenCount: number;
	includeHidden: boolean;
	onIncludeHiddenChange: (value: boolean) => void;
}) {
	return (
		<div className="dashboard-memories__password">
			<h4>Confirme el alcance</h4>
			<p>
				{props.working ? 'Calculando cantidad y particiones…' : countsLabel(props.counts)}
			</p>
			<p>
				Cada ZIP conserva los límites de {MEMORIES_ARCHIVE_MAX_FILES} archivos y{' '}
				{MEMORIES_ARCHIVE_MAX_BYTES / 1024 / 1024} MiB para que su navegador los maneje sin
				problemas.
			</p>
			{props.hiddenCount > 0 ? (
				<label className="dashboard-memories__password-confirm">
					<input
						type="checkbox"
						checked={props.includeHidden}
						onChange={(event) => props.onIncludeHiddenChange(event.target.checked)}
					/>
					<span>
						Incluir{' '}
						{props.hiddenCount === 1
							? 'el recuerdo oculto'
							: `los ${props.hiddenCount} recuerdos ocultos`}
					</span>
				</label>
			) : null}
			<label className="dashboard-memories__password-confirm">
				<input
					type="checkbox"
					checked={props.encrypt}
					onChange={(event) => props.onEncryptChange(event.target.checked)}
				/>
				<span>Proteger los ZIP con contraseña (recomendado)</span>
			</label>
			{!props.encrypt ? (
				<p className="memories-notice memories-notice--warning" role="status">
					Sin contraseña, cualquier persona que obtenga los archivos podrá abrirlos.
					Guárdelos en un lugar privado.
				</p>
			) : null}
		</div>
	);
}

function PasswordStep(props: {
	passphrase: string;
	copied: boolean;
	confirmed: boolean;
	counts: Counts;
	onCopy: () => void;
	onConfirmedChange: (value: boolean) => void;
}) {
	return (
		<div className="dashboard-memories__password">
			<h4>Guarde la contraseña antes de continuar</h4>
			<p>
				La contraseña se creó en este navegador. No se guarda ni se envía al servidor y será
				necesaria para abrir cada ZIP.
			</p>
			<div className="dashboard-memories__password-value">
				<code tabIndex={0}>{props.passphrase}</code>
				<button type="button" className="btn-secondary" onClick={props.onCopy}>
					{props.copied ? 'Contraseña copiada' : 'Copiar contraseña'}
				</button>
			</div>
			<p>{countsLabel(props.counts)}</p>
			<label className="dashboard-memories__password-confirm">
				<input
					type="checkbox"
					checked={props.confirmed}
					onChange={(event) => props.onConfirmedChange(event.target.checked)}
				/>
				<span>Confirmo que guardé la contraseña en un lugar seguro.</span>
			</label>
		</div>
	);
}

function ProgressStep(props: {
	complete: boolean;
	batchIndex: number;
	counts: Counts;
	progress: BulkExportProgress | null;
	passphrase: string | null;
}) {
	const { progress, counts } = props;
	return (
		<div className="dashboard-memories__progress" aria-live="polite">
			<h4>
				{props.complete
					? 'Descarga preparada'
					: `Generando lote ${Math.min(props.batchIndex + 1, counts.batches)} de ${counts.batches}`}
			</h4>
			<progress
				value={progress?.completed ?? 0}
				max={Math.max(progress?.total ?? counts.items, 1)}
			/>
			<p>
				{progress
					? `${progress.completed} de ${progress.total}: ${progress.currentFileName}`
					: 'Preparando archivos…'}
			</p>
			{props.passphrase ? (
				<p className="dashboard-memories__password-reminder">
					Contraseña: <code>{props.passphrase}</code>
				</p>
			) : null}
		</div>
	);
}
