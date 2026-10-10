import type { FC } from 'react';
import { useCallback, useEffect, useState } from 'react';
import type { DemoLinkItem } from '@/lib/tracking/demo-conversion-report';
import { EVENT_TYPE_LABELS } from '@/lib/intake/labels';
import type { EventType } from '@/lib/theme/theme-contract';
import '@/styles/dashboard/_demo-catalog.scss';

interface Props {
	demos: DemoLinkItem[];
}

const COPY_FEEDBACK_MS = 2000;

const DemoCatalog: FC<Props> = ({ demos }) => {
	const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
	const [copyError, setCopyError] = useState('');

	useEffect(() => {
		if (!copiedSlug) return;
		const timer = setTimeout(() => setCopiedSlug(null), COPY_FEEDBACK_MS);
		return () => clearTimeout(timer);
	}, [copiedSlug]);

	const copyLink = useCallback(async (demo: DemoLinkItem) => {
		setCopyError('');
		try {
			await navigator.clipboard.writeText(`${window.location.origin}${demo.href}`);
			setCopiedSlug(demo.slug);
		} catch {
			setCopyError('No se pudo copiar el enlace. Ábralo y copie la dirección del navegador.');
		}
	}, []);

	return (
		<section className="dashboard-card demo-catalog" aria-labelledby="demo-catalog-title">
			<h2 id="demo-catalog-title">Catálogo de demos</h2>
			<p>
				Demos disponibles para compartir con prospectos. Se administran en el repositorio,
				no en Producción de invitaciones.
			</p>
			{copyError && (
				<p className="demo-catalog__error" role="alert">
					{copyError}
				</p>
			)}
			{demos.length === 0 ? (
				<p role="status">No hay demos registradas.</p>
			) : (
				<div className="demo-catalog__table" tabIndex={0} role="region" aria-label="Demos">
					<table>
						<thead>
							<tr>
								<th scope="col">Demo</th>
								<th scope="col">Evento</th>
								<th scope="col">Enlace</th>
								<th scope="col">Acciones</th>
							</tr>
						</thead>
						<tbody>
							{demos.map((demo) => (
								<tr key={demo.slug}>
									<th scope="row">
										<span className="demo-catalog__title">{demo.title}</span>
										<span className="demo-catalog__subtitle">
											{demo.invitationTitle}
										</span>
									</th>
									<td>
										<span className="demo-catalog__event">
											{EVENT_TYPE_LABELS[demo.eventType as EventType] ??
												demo.eventType}
											<span
												className={`dashboard-badge ${demo.inShowroom ? 'dashboard-badge--published' : 'dashboard-badge--disabled'}`}
											>
												{demo.inShowroom
													? 'En showroom'
													: 'Fuera de showroom'}
											</span>
										</span>
									</td>
									<td>
										<code className="demo-catalog__path">{demo.href}</code>
									</td>
									<td>
										<div className="demo-catalog__actions">
											<button
												type="button"
												className="btn-secondary"
												onClick={() => void copyLink(demo)}
												aria-label={`Copiar enlace de ${demo.title}`}
											>
												{copiedSlug === demo.slug
													? 'Copiado'
													: 'Copiar enlace'}
											</button>
											<a
												href={demo.href}
												target="_blank"
												rel="noopener noreferrer"
												className="btn-secondary"
												aria-label={`Ver ${demo.title} en una pestaña nueva`}
											>
												Ver demo
											</a>
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</section>
	);
};

export default DemoCatalog;
