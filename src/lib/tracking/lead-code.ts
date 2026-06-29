const LEAD_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const LEAD_CODE_LENGTH = 6;

export function createLeadCode(random: () => number = Math.random): string {
	let code = '';
	for (let index = 0; index < LEAD_CODE_LENGTH; index += 1) {
		const alphabetIndex = Math.min(
			LEAD_CODE_ALPHABET.length - 1,
			Math.floor(random() * LEAD_CODE_ALPHABET.length),
		);
		code += LEAD_CODE_ALPHABET[alphabetIndex];
	}
	return `CM-${code}`;
}
