/**
 * Wires the "show password" buttons of auth forms (`[data-password-toggle]` + `aria-controls`).
 *
 * The state is conveyed once, through the button name ("Mostrar"/"Ocultar contraseña"); the
 * visible text stays inside that name so voice-control users can say what they see. Every field
 * is masked again on submit so browsers and password managers see a password field when they
 * offer to save the credential.
 */
const STATES = {
	hidden: { label: 'Mostrar contraseña', text: 'Mostrar' },
	revealed: { label: 'Ocultar contraseña', text: 'Ocultar' },
} as const;

function render(input: HTMLInputElement, button: HTMLButtonElement, revealed: boolean) {
	const state = revealed ? STATES.revealed : STATES.hidden;
	input.type = revealed ? 'text' : 'password';
	button.setAttribute('aria-label', state.label);
	button.textContent = state.text;
}

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
			render(input, button, input.type === 'password');
		});
		// Capture phase: mask before any submit handler serializes or navigates.
		input.form?.addEventListener('submit', () => render(input, button, false), true);
	}
}
