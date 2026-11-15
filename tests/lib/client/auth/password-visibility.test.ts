import { initPasswordToggles } from '@/lib/client/auth/password-visibility';

const renderField = () => {
	document.body.innerHTML = `
		<input id="pw" type="password" value="Secreto-123" />
		<button type="button" data-password-toggle aria-controls="pw" aria-pressed="false" aria-label="Mostrar contraseña">Mostrar</button>
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

	it('reveals the password and updates the accessible state', () => {
		const { input, button } = renderField();
		initPasswordToggles();

		button.click();

		expect(input.type).toBe('text');
		expect(button.getAttribute('aria-pressed')).toBe('true');
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
		expect(button.getAttribute('aria-pressed')).toBe('false');
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
});
