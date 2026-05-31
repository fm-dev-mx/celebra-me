import type { FC } from 'react';
import type { EventType } from '@/lib/theme/theme-contract';

interface Props {
	data: Record<string, unknown>;
	onChange: (field: string, value: unknown) => void;
	disabled?: boolean;
	eventType: EventType;
}

const SpecialMessagesBlock: FC<Props> = ({ data, onChange, disabled }) => {
	const getValue = (key: string, fallback = '') => (data[key] as string) ?? fallback;

	return (
		<div className="intake-block intake-block--special-messages">
			<h3 className="intake-block__title">Mensajes especiales</h3>

			<div className="intake-field">
				<label className="intake-field__label" htmlFor="quoteText">
					Frase o cita <span className="intake-field__required">*</span>
				</label>
				<textarea
					id="quoteText"
					className="intake-field__textarea"
					value={getValue('quoteText')}
					onChange={(e) => onChange('quoteText', e.target.value)}
					placeholder="El amor es paciente, el amor es bondadoso..."
					disabled={disabled}
					rows={3}
					required
				/>
			</div>

			<div className="intake-field">
				<label className="intake-field__label" htmlFor="quoteAuthor">
					Autor de la frase
				</label>
				<input
					id="quoteAuthor"
					type="text"
					className="intake-field__input"
					value={getValue('quoteAuthor')}
					onChange={(e) => onChange('quoteAuthor', e.target.value)}
					placeholder="1 Corintios 13:4"
					disabled={disabled}
				/>
			</div>

			<div className="intake-field">
				<label className="intake-field__label" htmlFor="thankYouMessage">
					Mensaje de agradecimiento <span className="intake-field__required">*</span>
				</label>
				<textarea
					id="thankYouMessage"
					className="intake-field__textarea"
					value={getValue('thankYouMessage')}
					onChange={(e) => onChange('thankYouMessage', e.target.value)}
					placeholder="Gracias por acompanarnos en este dia tan especial..."
					disabled={disabled}
					rows={4}
					required
				/>
			</div>

			<div className="intake-field">
				<label className="intake-field__label" htmlFor="thankYouClosingName">
					Nombre de cierre <span className="intake-field__required">*</span>
				</label>
				<input
					id="thankYouClosingName"
					type="text"
					className="intake-field__input"
					value={getValue('thankYouClosingName')}
					onChange={(e) => onChange('thankYouClosingName', e.target.value)}
					placeholder="Con carino, Familia Valenzuela"
					disabled={disabled}
					required
				/>
			</div>
		</div>
	);
};

export default SpecialMessagesBlock;
