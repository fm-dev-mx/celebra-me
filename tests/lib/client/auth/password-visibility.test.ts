import { initPasswordToggles } from '@/lib/client/auth/password-visibility';

const renderField = () => {
	document.body.innerHTML = `
		<form id="f"><input id="pw" type="password" value="Secreto-123" /></form>
		<button type="button" data-password-toggle aria-controls="pw" aria-label="Mostrar contraseña">Mostrar</button>
	`;
	return {
		input: document.getElementById('pw') as HTMLInputElement,
		button: document.querySelector('[data-password-toggle]') as HTMLButtonElement,
	};
};

describe('initPasswordToggles', () => {
	afterEach(() => {
		document.body.innerHTML = '';
	});

	it('reveals the password and renames the button with its new action', () => {
		const { input, button } = renderField();
		initPasswordToggles();

		button.click();

		expect(input.type).toBe('text');
		expect(button.getAttribute('aria-label')).toBe('Ocultar contraseña');
		expect(button.textContent).toBe('Ocultar');
		expect(input.value).toBe('Secreto-123');
	});

	it('hides the password again on a second click', () => {
		const { input, button } = renderField();
		initPasswordToggles();

		button.click();
		button.click();

		expect(input.type).toBe('password');
		expect(button.getAttribute('aria-label')).toBe('Mostrar contraseña');
		expect(button.textContent).toBe('Mostrar');
	});

	it('binds each button only once when initialized twice', () => {
		const { input, button } = renderField();
		initPasswordToggles();
		initPasswordToggles();

		button.click();

		expect(input.type).toBe('text');
	});

	it('ignores buttons whose controlled input does not exist', () => {
		document.body.innerHTML = `<button type="button" data-password-toggle aria-controls="missing">Mostrar</button>`;
		const button = document.querySelector('button') as HTMLButtonElement;

		expect(() => initPasswordToggles()).not.toThrow();
		button.click();
		expect(button.textContent).toBe('Mostrar');
		expect(button.dataset.passwordToggleReady).toBeUndefined();
	});

	it('masks a revealed password again when its form is submitted', () => {
		const { input, button } = renderField();
		initPasswordToggles();
		button.click();

		const form = document.getElementById('f') as HTMLFormElement;
		form.addEventListener('submit', (event) => event.preventDefault());
		form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

		expect(input.type).toBe('password');
		expect(button.getAttribute('aria-label')).toBe('Mostrar contraseña');
		expect(button.textContent).toBe('Mostrar');
		expect(input.value).toBe('Secreto-123');
	});

	it('masks the field before other submit handlers read it', () => {
		const { input, button } = renderField();
		const form = document.getElementById('f') as HTMLFormElement;
		let typeSeenByHandler = '';
		form.addEventListener('submit', (event) => {
			event.preventDefault();
			typeSeenByHandler = input.type;
		});
		initPasswordToggles();
		button.click();

		form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

		expect(typeSeenByHandler).toBe('password');
	});

	it('conveys the state only through the button name', () => {
		const { button } = renderField();
		initPasswordToggles();

		button.click();

		expect(button.hasAttribute('aria-pressed')).toBe(false);
		expect(button.getAttribute('aria-label')).toContain(button.textContent ?? '');
	});

	it('works for a field outside any form', () => {
		document.body.innerHTML = `
			<input id='loose' type='password' />
			<button type='button' data-password-toggle aria-controls='loose'>Mostrar</button>
		`;
		const input = document.getElementById('loose') as HTMLInputElement;
		const button = document.querySelector('button') as HTMLButtonElement;

		expect(() => initPasswordToggles()).not.toThrow();
		button.click();
		expect(input.type).toBe('text');
	});
});
