import type { FC } from 'react';

interface Props {
	data: Record<string, unknown>;
	onChange: (field: string, value: unknown) => void;
	disabled?: boolean;
}

const MainPeopleBlock: FC<Props> = ({ data, onChange, disabled }) => {
	const getValue = (key: string, fallback = '') => (data[key] as string) ?? fallback;
	const getBool = (key: string) => Boolean(data[key]);

	return (
		<div className="intake-block intake-block--main-people">
			<h3 className="intake-block__title">Personas principales</h3>

			<div className="intake-field">
				<label className="intake-field__label" htmlFor="fatherName">
					Nombre del padre
				</label>
				<input
					id="fatherName"
					type="text"
					className="intake-field__input"
					value={getValue('fatherName')}
					onChange={(e) => onChange('fatherName', e.target.value)}
					disabled={disabled}
				/>
			</div>

			<div className="intake-field intake-field--checkbox">
				<label className="intake-field__checkbox-label">
					<input
						type="checkbox"
						checked={getBool('fatherDeceased')}
						onChange={(e) => onChange('fatherDeceased', e.target.checked)}
						disabled={disabled}
					/>
					<span>Fallecido</span>
				</label>
			</div>

			<div className="intake-field">
				<label className="intake-field__label" htmlFor="motherName">
					Nombre de la madre
				</label>
				<input
					id="motherName"
					type="text"
					className="intake-field__input"
					value={getValue('motherName')}
					onChange={(e) => onChange('motherName', e.target.value)}
					disabled={disabled}
				/>
			</div>

			<div className="intake-field intake-field--checkbox">
				<label className="intake-field__checkbox-label">
					<input
						type="checkbox"
						checked={getBool('motherDeceased')}
						onChange={(e) => onChange('motherDeceased', e.target.checked)}
						disabled={disabled}
					/>
					<span>Fallecida</span>
				</label>
			</div>

			<div className="intake-field">
				<label className="intake-field__label" htmlFor="spouseName">
					Nombre del esposo(a)
				</label>
				<input
					id="spouseName"
					type="text"
					className="intake-field__input"
					value={getValue('spouseName')}
					onChange={(e) => onChange('spouseName', e.target.value)}
					disabled={disabled}
				/>
			</div>

			<div className="intake-field">
				<label className="intake-field__label" htmlFor="godparents">
					Padrinos
				</label>
				<textarea
					id="godparents"
					className="intake-field__textarea"
					value={getValue('godparents')}
					onChange={(e) => onChange('godparents', e.target.value)}
					placeholder="Nombre y rol de cada padrino..."
					disabled={disabled}
					rows={3}
				/>
			</div>

			<div className="intake-field">
				<label className="intake-field__label" htmlFor="children">
					Hijos
				</label>
				<textarea
					id="children"
					className="intake-field__textarea"
					value={getValue('children')}
					onChange={(e) => onChange('children', e.target.value)}
					disabled={disabled}
					rows={2}
				/>
			</div>

			<div className="intake-field">
				<label className="intake-field__label" htmlFor="sectionMessage">
					Mensaje para la sección de familia
				</label>
				<textarea
					id="sectionMessage"
					className="intake-field__textarea"
					value={getValue('sectionMessage')}
					onChange={(e) => onChange('sectionMessage', e.target.value)}
					placeholder="Con la bendicion de Dios y de nuestros padres..."
					disabled={disabled}
					rows={3}
				/>
			</div>
		</div>
	);
};

export default MainPeopleBlock;
