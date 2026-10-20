import { footerReplyMode, hasContentToken, isFooterReplyOn } from '@/lib/invitation/footer-reply';

describe('footer reply', () => {
	it('turns on only for the on token', () => {
		expect(isFooterReplyOn(' on')).toBe(true);
		expect(isFooterReplyOn('')).toBe(false);
		expect(isFooterReplyOn('off')).toBe(false);
	});

	it('asks while the form is open, thanks after a yes, and stays away otherwise', () => {
		expect(footerReplyMode('form', true)).toBe('pending');
		expect(footerReplyMode('form', false)).toBe('pending');
		expect(footerReplyMode('confirmed', true)).toBe('answered');
		expect(footerReplyMode('confirmed', false)).toBe('none');
		expect(footerReplyMode('declined', true)).toBe('none');
		expect(footerReplyMode('locked', true)).toBe('none');
		expect(footerReplyMode(undefined, true)).toBe('none');
	});

	it('reads a content token as words unless it is none or empty', () => {
		expect(hasContentToken(" 'Su linterna ya está encendida.'")).toBe(true);
		expect(hasContentToken('none')).toBe(false);
		expect(hasContentToken('  ')).toBe(false);
	});
});
