import type { FC } from 'react';

interface Props {
	data: Record<string, unknown>;
	onChange: (field: string, value: unknown) => void;
	disabled?: boolean;
}

const MusicBlock: FC<Props> = ({ data, onChange, disabled }) => {
	const getValue = (key: string, fallback = '') => (data[key] as string) ?? fallback;

	return (
		<div className="intake-block intake-block--music">
			<h3 className="intake-block__title">Musica de fondo</h3>

			<div className="intake-field">
				<label className="intake-field__label" htmlFor="url">
					URL de la musica <span className="intake-field__required">*</span>
				</label>
				<input
					id="url"
					type="url"
					className="intake-field__input"
					value={getValue('url')}
					onChange={(e) => onChange('url', e.target.value)}
					placeholder="https://www.youtube.com/watch?v=..."
					disabled={disabled}
					required
				/>
				<p className="intake-field__hint">
					Pega el enlace de YouTube o Spotify de la cancion deseada.
				</p>
			</div>

			<div className="intake-field">
				<label className="intake-field__label" htmlFor="title">
					Titulo de la cancion
				</label>
				<input
					id="title"
					type="text"
					className="intake-field__input"
					value={getValue('title')}
					onChange={(e) => onChange('title', e.target.value)}
					disabled={disabled}
				/>
			</div>
		</div>
	);
};

export default MusicBlock;
