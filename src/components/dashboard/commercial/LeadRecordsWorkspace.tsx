import { useEffect, useState, type FormEvent } from 'react';
import { dashboardApi, type ApiResult } from '@/lib/dashboard/api-client';
import {
	LEAD_AD_PLATFORM_LABELS,
	LEAD_AD_PLATFORMS,
	LEAD_LOST_REASON_LABELS,
	LEAD_LOST_REASONS,
	LEAD_ROUTE_LABELS,
	LEAD_STAGE_LABELS,
	LEAD_STAGES,
	type LeadAdPlatform,
	type LeadLostReason,
	type LeadStage,
} from '@/lib/commercial/lead-record';
import type { LeadAdCode, LeadRecord } from '@/lib/commercial/lead-record.service';
import {
	EVENT_TYPE_LABELS,
	labelCommercialEventType,
} from '@/lib/tracking/commercial-presentation';

const API = '/api/dashboard/commercial';
const money = (value: number) =>
	new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
const dateTime = new Intl.DateTimeFormat('es-MX', {
	timeZone: 'America/Mazatlan',
	day: 'numeric',
	month: 'short',
	hour: '2-digit',
	minute: '2-digit',
});
const formatDate = (iso: string) => dateTime.format(new Date(iso));

type Result<T> = { ok: true; data: T } | { ok: false; message: string };

async function request<T>(call: Promise<ApiResult<{ data: T }>>): Promise<Result<T>> {
	const result = await call;
	if (!result.ok) return { ok: false, message: result.message || 'Intente de nuevo.' };
	return { ok: true, data: result.data.data };
}

export default function LeadRecordsWorkspace() {
	const [query, setQuery] = useState('');
	const [records, setRecords] = useState<LeadRecord[]>([]);
	const [adCodes, setAdCodes] = useState<LeadAdCode[]>([]);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');
	const [notice, setNotice] = useState('');

	async function search(value: string) {
		setLoading(true);
		setError('');
		const result = await request<LeadRecord[]>(
			dashboardApi.get(`${API}/lead-records?q=${encodeURIComponent(value)}`),
		);
		setLoading(false);
		if (!result.ok) return setError(result.message);
		setRecords(result.data);
		setSelectedId(result.data.length === 1 ? result.data[0].id : null);
	}

	async function loadAdCodes() {
		const result = await request<LeadAdCode[]>(dashboardApi.get(`${API}/lead-ad-codes`));
		if (result.ok) setAdCodes(result.data);
	}

	useEffect(() => {
		void search('');
		void loadAdCodes();
	}, []);

	function replaceRecord(record: LeadRecord) {
		setRecords((current) => {
			const rest = current.filter((item) => item.id !== record.id);
			return [record, ...rest];
		});
		setSelectedId(record.id);
	}

	return (
		<div className="lead-records">
			<section
				className="dashboard-card lead-records__search"
				aria-labelledby="lead-search-title"
			>
				<h3 id="lead-search-title">Buscar ficha</h3>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						void search(query);
					}}
				>
					<label htmlFor="lead-search">Folio, teléfono o nombre</label>
					<div className="lead-records__inline">
						<input
							id="lead-search"
							type="search"
							value={query}
							placeholder="CM-XXXXXX"
							autoComplete="off"
							spellCheck={false}
							onChange={(event) => setQuery(event.target.value)}
						/>
						<button type="submit" className="btn-primary" disabled={loading}>
							Buscar
						</button>
					</div>
				</form>
				{error && (
					<p role="alert" className="dashboard-error">
						{error}
					</p>
				)}
				{notice && <p role="status">{notice}</p>}
			</section>

			<section
				className="lead-records__list"
				aria-labelledby="lead-list-title"
				aria-busy={loading}
			>
				<h3 id="lead-list-title">
					{query.trim() ? 'Resultados' : 'Fichas recientes abiertas'}
				</h3>
				{!loading && records.length === 0 && <p>No hay fichas con esa búsqueda.</p>}
				{records.map((record) => (
					<LeadRecordCard
						key={record.id}
						record={record}
						open={record.id === selectedId}
						onToggle={() => setSelectedId(record.id === selectedId ? null : record.id)}
						onSaved={(saved) => {
							replaceRecord(saved);
							setNotice(`${saved.leadCode}: ${LEAD_STAGE_LABELS[saved.stage]}.`);
						}}
					/>
				))}
			</section>

			<ChatLeadForm
				adCodes={adCodes.filter((code) => code.active)}
				onCreated={(record) => {
					replaceRecord(record);
					setNotice(`Ficha ${record.leadCode} creada. Use este folio en el chat.`);
				}}
			/>

			<AdCodesSection adCodes={adCodes} onSaved={() => void loadAdCodes()} />
		</div>
	);
}

function LeadRecordCard({
	record,
	open,
	onToggle,
	onSaved,
}: {
	record: LeadRecord;
	open: boolean;
	onToggle: () => void;
	onSaved: (record: LeadRecord) => void;
}) {
	const origin = [
		record.route ? LEAD_ROUTE_LABELS[record.route] : null,
		record.adCode ? `anuncio ${record.adCode}` : null,
		record.campaign,
		record.ad,
	]
		.filter(Boolean)
		.join(' · ');
	return (
		<article className="dashboard-card lead-records__card">
			<button
				type="button"
				className="lead-records__summary"
				aria-expanded={open}
				onClick={onToggle}
			>
				<strong>{record.leadCode}</strong>
				<span>{record.name || 'Sin nombre'}</span>
				<span className={`lead-records__stage lead-records__stage--${record.stage}`}>
					{LEAD_STAGE_LABELS[record.stage]}
				</span>
			</button>
			{open && (
				<div className="lead-records__detail">
					<dl className="lead-records__facts">
						<div>
							<dt>Teléfono</dt>
							<dd>{record.phone || '—'}</dd>
						</div>
						<div>
							<dt>Evento</dt>
							<dd>
								{record.eventType
									? labelCommercialEventType(record.eventType)
									: '—'}
								{record.eventDate ? ` · ${record.eventDate}` : ''}
							</dd>
						</div>
						<div>
							<dt>Origen</dt>
							<dd>{origin || '—'}</dd>
						</div>
						<div>
							<dt>Creada</dt>
							<dd>{formatDate(record.createdAt)}</dd>
						</div>
						<div>
							<dt>Identificadores de clic</dt>
							<dd>
								{[
									record.fbc || record.fbclid ? 'Meta' : null,
									record.ttclid ? 'TikTok' : null,
									record.ctwaClid ? 'Clic a WhatsApp' : null,
								]
									.filter(Boolean)
									.join(' · ') || 'Ninguno'}
							</dd>
						</div>
						{record.packageValue !== null && (
							<div>
								<dt>Valor del paquete</dt>
								<dd>{money(record.packageValue)}</dd>
							</div>
						)}
					</dl>
					{Object.keys(record.stageDates).length > 0 && (
						<ol className="lead-records__history" aria-label="Fechas de cada etapa">
							{LEAD_STAGES.filter((stage) => stage !== 'new').map((stage) => {
								const at = record.stageDates[stage as Exclude<LeadStage, 'new'>];
								return at ? (
									<li key={stage}>
										{LEAD_STAGE_LABELS[stage]}: {formatDate(at)}
									</li>
								) : null;
							})}
						</ol>
					)}
					<StageForm record={record} onSaved={onSaved} />
					<a
						href={`/dashboard/commercial?folio=${encodeURIComponent(record.leadCode)}#origen-folio`}
					>
						Ver navegación del folio
					</a>
				</div>
			)}
		</article>
	);
}

function StageForm({
	record,
	onSaved,
}: {
	record: LeadRecord;
	onSaved: (record: LeadRecord) => void;
}) {
	const [stage, setStage] = useState<LeadStage>(record.stage);
	const [lostReason, setLostReason] = useState<LeadLostReason | ''>(record.lostReason ?? '');
	const [packageValue, setPackageValue] = useState(
		record.packageValue === null ? '' : String(record.packageValue),
	);
	const [eventType, setEventType] = useState(record.eventType ?? '');
	const [eventDate, setEventDate] = useState(record.eventDate ?? '');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const id = record.id;

	async function submit(event: FormEvent) {
		event.preventDefault();
		if (stage === 'lost' && !lostReason) return setError('Elija el motivo de la pérdida.');
		setBusy(true);
		setError('');
		const result = await request<LeadRecord>(
			dashboardApi.patch(`${API}/lead-records`, {
				leadId: id,
				stage,
				lostReason: stage === 'lost' ? lostReason : null,
				packageValue: packageValue.trim() === '' ? undefined : Number(packageValue),
				eventType: eventType || undefined,
				eventDate: eventDate || undefined,
			}),
		);
		setBusy(false);
		if (!result.ok) return setError(result.message);
		onSaved(result.data);
	}

	return (
		<form className="lead-records__form" onSubmit={submit}>
			<fieldset className="lead-records__stages">
				<legend>Etapa</legend>
				{LEAD_STAGES.map((value) => (
					<label key={value}>
						<input
							type="radio"
							name={`stage-${id}`}
							value={value}
							checked={stage === value}
							onChange={() => setStage(value)}
						/>
						{LEAD_STAGE_LABELS[value]}
					</label>
				))}
			</fieldset>
			{stage === 'lost' && (
				<label>
					Motivo
					<select
						value={lostReason}
						onChange={(event) =>
							setLostReason(event.target.value as LeadLostReason | '')
						}
					>
						<option value="">Elija un motivo</option>
						{LEAD_LOST_REASONS.map((reason) => (
							<option key={reason} value={reason}>
								{LEAD_LOST_REASON_LABELS[reason]}
							</option>
						))}
					</select>
				</label>
			)}
			{stage === 'qualified' && (
				<p className="lead-records__hint">
					Lead calificado: dio tipo y fecha del evento y pidió ver diseños.
				</p>
			)}
			<div className="lead-records__grid">
				<label>
					Tipo de evento
					<select
						value={eventType}
						onChange={(event) => setEventType(event.target.value)}
					>
						<option value="">Sin dato</option>
						{Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
							<option key={value} value={value}>
								{label}
							</option>
						))}
					</select>
				</label>
				<label>
					Fecha del evento
					<input
						type="date"
						value={eventDate}
						onChange={(event) => setEventDate(event.target.value)}
					/>
				</label>
				<label>
					Valor del paquete (MXN)
					<input
						type="number"
						min="0"
						step="1"
						inputMode="numeric"
						value={packageValue}
						onChange={(event) => setPackageValue(event.target.value)}
					/>
				</label>
			</div>
			{error && (
				<p role="alert" className="dashboard-error">
					{error}
				</p>
			)}
			<button type="submit" className="btn-primary" disabled={busy}>
				Guardar etapa
			</button>
		</form>
	);
}

function ChatLeadForm({
	adCodes,
	onCreated,
}: {
	adCodes: LeadAdCode[];
	onCreated: (record: LeadRecord) => void;
}) {
	const [adCode, setAdCode] = useState('');
	const [phone, setPhone] = useState('');
	const [name, setName] = useState('');
	const [eventType, setEventType] = useState('');
	const [eventDate, setEventDate] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');

	async function submit(event: FormEvent) {
		event.preventDefault();
		setBusy(true);
		setError('');
		const result = await request<LeadRecord>(
			dashboardApi.post(`${API}/lead-records`, { adCode, phone, name, eventType, eventDate }),
		);
		setBusy(false);
		if (!result.ok) return setError(result.message);
		setPhone('');
		setName('');
		setEventType('');
		setEventDate('');
		onCreated(result.data);
	}

	return (
		<section className="dashboard-card lead-records__new" aria-labelledby="chat-lead-title">
			<h3 id="chat-lead-title">Nueva ficha desde un chat</h3>
			<p>Para chats que llegaron con el código de un anuncio, por ejemplo A07.</p>
			{adCodes.length === 0 ? (
				<p role="status">Primero registre los códigos de sus anuncios abajo.</p>
			) : (
				<form className="lead-records__form" onSubmit={submit}>
					<div className="lead-records__grid">
						<label>
							Código del anuncio
							<select
								required
								value={adCode}
								onChange={(event) => setAdCode(event.target.value)}
							>
								<option value="">Elija un código</option>
								{adCodes.map((code) => (
									<option key={code.code} value={code.code}>
										{code.code} · {code.label}
									</option>
								))}
							</select>
						</label>
						<label>
							Teléfono
							<input
								required
								type="tel"
								inputMode="tel"
								autoComplete="off"
								value={phone}
								onChange={(event) => setPhone(event.target.value)}
							/>
						</label>
						<label>
							Nombre
							<input
								value={name}
								maxLength={160}
								onChange={(event) => setName(event.target.value)}
							/>
						</label>
						<label>
							Tipo de evento
							<select
								value={eventType}
								onChange={(event) => setEventType(event.target.value)}
							>
								<option value="">Sin dato</option>
								{Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
									<option key={value} value={value}>
										{label}
									</option>
								))}
							</select>
						</label>
						<label>
							Fecha del evento
							<input
								type="date"
								value={eventDate}
								onChange={(event) => setEventDate(event.target.value)}
							/>
						</label>
					</div>
					{error && (
						<p role="alert" className="dashboard-error">
							{error}
						</p>
					)}
					<button type="submit" className="btn-primary" disabled={busy}>
						Crear ficha
					</button>
				</form>
			)}
		</section>
	);
}

function AdCodesSection({ adCodes, onSaved }: { adCodes: LeadAdCode[]; onSaved: () => void }) {
	const [code, setCode] = useState('');
	const [label, setLabel] = useState('');
	const [platform, setPlatform] = useState<LeadAdPlatform>('meta');
	const [campaign, setCampaign] = useState('');
	const [adName, setAdName] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');

	async function save(body: Record<string, unknown>) {
		setBusy(true);
		setError('');
		const result = await request<LeadAdCode>(dashboardApi.post(`${API}/lead-ad-codes`, body));
		setBusy(false);
		if (!result.ok) {
			setError(result.message);
			return false;
		}
		onSaved();
		return true;
	}

	async function submit(event: FormEvent) {
		event.preventDefault();
		const saved = await save({ code, label, platform, campaign, adName, active: true });
		if (!saved) return;
		setCode('');
		setLabel('');
		setCampaign('');
		setAdName('');
	}

	return (
		<section className="dashboard-card lead-records__codes" aria-labelledby="ad-codes-title">
			<h3 id="ad-codes-title">Códigos de anuncio</h3>
			<p>
				Escriba el código en el mensaje prellenado del anuncio, por ejemplo «Hola, vengo por
				A07».
			</p>
			{adCodes.length > 0 && (
				<ul className="lead-records__code-list">
					{adCodes.map((item) => (
						<li key={item.code} className={item.active ? undefined : 'is-inactive'}>
							<strong>{item.code}</strong> {item.label} ·{' '}
							{LEAD_AD_PLATFORM_LABELS[item.platform]}
							{item.campaign ? ` · ${item.campaign}` : ''}
							<button
								type="button"
								className="btn-secondary"
								disabled={busy}
								onClick={() =>
									void save({
										code: item.code,
										label: item.label,
										platform: item.platform,
										campaign: item.campaign ?? '',
										adName: item.adName ?? '',
										active: !item.active,
									})
								}
							>
								{item.active ? 'Desactivar' : 'Activar'}
							</button>
						</li>
					))}
				</ul>
			)}
			<form className="lead-records__form" onSubmit={submit}>
				<div className="lead-records__grid">
					<label>
						Código
						<input
							required
							value={code}
							placeholder="A07"
							maxLength={9}
							autoComplete="off"
							onChange={(event) => setCode(event.target.value)}
						/>
					</label>
					<label>
						Descripción
						<input
							required
							value={label}
							maxLength={120}
							onChange={(event) => setLabel(event.target.value)}
						/>
					</label>
					<label>
						Plataforma
						<select
							value={platform}
							onChange={(event) => setPlatform(event.target.value as LeadAdPlatform)}
						>
							{LEAD_AD_PLATFORMS.map((value) => (
								<option key={value} value={value}>
									{LEAD_AD_PLATFORM_LABELS[value]}
								</option>
							))}
						</select>
					</label>
					<label>
						Campaña
						<input
							value={campaign}
							maxLength={180}
							onChange={(event) => setCampaign(event.target.value)}
						/>
					</label>
					<label>
						Anuncio
						<input
							value={adName}
							maxLength={180}
							onChange={(event) => setAdName(event.target.value)}
						/>
					</label>
				</div>
				{error && (
					<p role="alert" className="dashboard-error">
						{error}
					</p>
				)}
				<button type="submit" className="btn-secondary" disabled={busy}>
					Guardar código
				</button>
			</form>
		</section>
	);
}
