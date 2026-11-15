/** Wires the "show password" buttons of auth forms (`[data-password-toggle]` + `aria-controls`). */
const SHOW_LABEL = 'Mostrar contraseña';
const HIDE_LABEL = 'Ocultar contraseña';

export function initPasswordToggles(root: ParentNode = document) {
	for (const button of root.querySelectorAll<HTMLButtonElement>('[data-password-toggle]')) {
		if (button.dataset.passwordToggleReady === 'true') continue;
		const inputId = button.getAttribute('aria-controls');
		const input = inputId
			? (document.getElementById(inputId) as HTMLInputElement | null)
			: null;
		if (!input) continue;
		button.dataset.passwordToggleReady = 'true';

		button.addEventListener('click', () => {
			const reveal = input.type === 'password';
			input.type = reveal ? 'text' : 'password';
			button.setAttribute('aria-pressed', String(reveal));
			button.setAttribute('aria-label', reveal ? HIDE_LABEL : SHOW_LABEL);
			button.textContent = reveal ? 'Ocultar' : 'Mostrar';
		});
	}
}
