import React, { useCallback, useEffect, useRef, useState } from 'react';
import { dashboardApi } from '@/lib/dashboard/api-client';
import {
	INVITATION_DATA_STEPS,
	type InvitationDataAnswers,
	type InvitationDataStatus,
} from '@/lib/invitation-data/form';

export interface InvitationDataSummary {
	status: InvitationDataStatus;
	tokenIssuedAt: string;
	expiresAt: string;
	expired: boolean;
	lastSavedAt: string | null;
	submittedAt: string | null;
	ownerReviewedAt: string | null;
	needsReview: boolean;
	answers: InvitationDataAnswers;
}

interface IssuedLink {
	url: string;
	whatsappUrl: string | null;
	expiresAt: string;
	summary: InvitationDataSummary | null;
}

interface InvitationDataPanelProps {
	orderId: string;
	/** Issue the link right away when the order has none (just after the deposit). */
	autoIssue?: boolean;
	/** Called after the owner marks the answers as reviewed, so the inbox can refresh. */
	onReviewed?: () => void;
}

function formatDateTime(value: string): string {
	return new Date(value).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
}

function describeStatus(summary: InvitationDataSummary | null): string {
	if (!summary) return 'Sin enlace todavía';
	if (summary.status === 'submitted') {
		return summary.needsReview
			? 'Datos recibidos · por revisar'
			: 'Datos recibidos · revisados';
	}
	if (summary.expired) return 'El enlace venció';
	if (summary.status === 'in_progress') return 'El cliente está llenando sus datos';
	return 'Enlace enviado · sin respuesta';
}

function countAnswers(summary: InvitationDataSummary | null): number {
	return summary ? Object.values(summary.answers).filter((value) => value?.trim()).length : 0;
}

/** The form's state and, once the client saved something, when and how much. */
const PanelStatus: React.FC<{
	summary: InvitationDataSummary | null;
	loading: boolean;
	answerCount: number;
}> = ({ summary, loading, answerCount }) => (
	<>
		<div className="invitation-data-panel__head">
			<strong>Datos de la invitación</strong>
			<span
				className={`invitation-data-panel__status${summary?.needsReview ? ' invitation-data-panel__status--alert' : ''}`}
			>
				{loading ? 'Cargando…' : describeStatus(summary)}
			</span>
		</div>
		{summary?.lastSavedAt && (
			<p className="order-meta">
				Último guardado: {formatDateTime(summary.lastSavedAt)} · {answerCount}{' '}
				{answerCount === 1 ? 'dato' : 'datos'}
			</p>
		)}
	</>
);

/** The freshly issued link, shown once: WhatsApp with the prefilled message, or copy. */
const IssuedLinkBlock: React.FC<{ link: IssuedLink }> = ({ link }) => {
	const [copied, setCopied] = useState(false);
	const [copyError, setCopyError] = useState('');

	const copyLink = async () => {
		try {
			await navigator.clipboard.writeText(link.url);
			setCopied(true);
			setCopyError('');
		} catch {
			setCopyError('No se pudo copiar. Seleccione el enlace y cópielo a mano.');
		}
	};

	return (
		<div className="invitation-data-panel__link">
			<p className="order-meta">
				Enlace privado (vence {formatDateTime(link.expiresAt)}). Solo se muestra ahora; si
				lo pierde, genere uno nuevo.
			</p>
			<input
				type="text"
				readOnly
				value={link.url}
				aria-label="Enlace privado del formulario"
				onFocus={(event) => event.currentTarget.select()}
			/>
			<div className="dashboard-actions">
				{link.whatsappUrl ? (
					<a
						className="btn-primary"
						href={link.whatsappUrl}
						target="_blank"
						rel="noreferrer"
					>
						Enviar por WhatsApp
					</a>
				) : (
					<p className="order-meta">
						El cliente no tiene un WhatsApp válido; copie el enlace.
					</p>
				)}
				<button type="button" className="btn-secondary" onClick={() => void copyLink()}>
					{copied ? 'Copiado' : 'Copiar enlace'}
				</button>
			</div>
			{copyError && (
				<p className="crm-inline-error" role="alert">
					{copyError}
				</p>
			)}
		</div>
	);
};

/** The client's answers grouped by form step, skipping empty steps. */
const AnswersList: React.FC<{ answers: InvitationDataAnswers }> = ({ answers }) => (
	<div className="invitation-data-panel__answers">
		{INVITATION_DATA_STEPS.map((step) => {
			const filled = step.fields.filter((field) => answers[field.name]?.trim());
			if (filled.length === 0) return null;
			return (
				<div key={step.id}>
					<h5>{step.title}</h5>
					<dl>
						{filled.map((field) => (
							<div key={field.name}>
								<dt>{field.label}</dt>
								<dd>{answers[field.name]}</dd>
							</div>
						))}
					</dl>
				</div>
			);
		})}
	</div>
);

/**
 * Private invitation data link of one paid order: issues the link with its prefilled WhatsApp
 * message, shows the client's progress and answers, and clears the review notice.
 */
const InvitationDataPanel: React.FC<InvitationDataPanelProps> = ({
	orderId,
	autoIssue = false,
	onReviewed,
}) => {
	const [summary, setSummary] = useState<InvitationDataSummary | null>(null);
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const [link, setLink] = useState<IssuedLink | null>(null);
	const [showAnswers, setShowAnswers] = useState(false);
	const autoIssuedRef = useRef(false);

	const issueLink = useCallback(async () => {
		setBusy(true);
		setError('');
		try {
			const response = await dashboardApi.post<{ data: IssuedLink }>(
				`/api/dashboard/commercial/orders/${orderId}/invitation-data`,
				{ action: 'issue-link' },
			);
			if (response.ok) {
				setLink(response.data.data);
				setSummary(response.data.data.summary);
			} else setError(response.message || 'No se pudo generar el enlace.');
		} catch (issueError) {
			setError(issueError instanceof Error ? issueError.message : 'Error de red.');
		} finally {
			setBusy(false);
		}
	}, [orderId]);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		dashboardApi
			.get<{ data: InvitationDataSummary | null }>(
				`/api/dashboard/commercial/orders/${orderId}/invitation-data`,
			)
			.then((response) => {
				if (cancelled) return;
				if (!response.ok) {
					setError(response.message || 'No se pudo cargar el enlace de datos.');
					return;
				}
				setSummary(response.data.data);
				if (!response.data.data && autoIssue && !autoIssuedRef.current) {
					autoIssuedRef.current = true;
					void issueLink();
				}
			})
			.catch((loadError: unknown) => {
				if (!cancelled)
					setError(loadError instanceof Error ? loadError.message : 'Error de red.');
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [orderId, autoIssue, issueLink]);

	const markReviewed = async () => {
		setBusy(true);
		setError('');
		try {
			const response = await dashboardApi.post<{ data: InvitationDataSummary }>(
				`/api/dashboard/commercial/orders/${orderId}/invitation-data`,
				{ action: 'mark-reviewed' },
			);
			if (response.ok) {
				setSummary(response.data.data);
				onReviewed?.();
			} else setError(response.message || 'No se pudo marcar como revisado.');
		} catch (reviewError) {
			setError(reviewError instanceof Error ? reviewError.message : 'Error de red.');
		} finally {
			setBusy(false);
		}
	};

	const answerCount = countAnswers(summary);

	return (
		<section className="invitation-data-panel" aria-label="Datos de la invitación">
			<PanelStatus summary={summary} loading={loading} answerCount={answerCount} />

			{link && <IssuedLinkBlock link={link} />}

			{error && (
				<p className="crm-inline-error" role="alert">
					{error}
				</p>
			)}

			<div className="dashboard-actions">
				{!loading && (
					<button
						type="button"
						className={summary ? 'btn-secondary' : 'btn-primary'}
						disabled={busy}
						onClick={() => void issueLink()}
					>
						{busy ? 'Generando…' : summary ? 'Generar enlace nuevo' : 'Generar enlace'}
					</button>
				)}
				{summary && answerCount > 0 && (
					<button
						type="button"
						className="btn-ghost"
						aria-expanded={showAnswers}
						onClick={() => setShowAnswers((open) => !open)}
					>
						{showAnswers ? 'Ocultar datos' : 'Ver datos'}
					</button>
				)}
				{summary?.needsReview && (
					<button
						type="button"
						className="btn-secondary"
						disabled={busy}
						onClick={() => void markReviewed()}
					>
						Marcar como revisado
					</button>
				)}
			</div>
			{summary && link === null && (
				<p className="order-meta">
					Generar un enlace nuevo desactiva el anterior; lo que el cliente ya escribió se
					conserva.
				</p>
			)}

			{showAnswers && summary && <AnswersList answers={summary.answers} />}
		</section>
	);
};

export default InvitationDataPanel;
