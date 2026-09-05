import { sendEmail, sendIntakeNotification } from '@/lib/server/email';
import nodemailer from 'nodemailer';

// Mock nodemailer
jest.mock('nodemailer');

const mockedNodemailer = nodemailer as jest.Mocked<typeof nodemailer>;

describe('Email Service (Gmail/Nodemailer)', () => {
	const samplePayload = {
		name: 'John Doe',
		email: 'john@example.com',
		message: 'Hello!',
		type: 'contact' as const,
	};

	const mockSendMail = jest.fn();

	beforeEach(() => {
		jest.clearAllMocks();
		jest.spyOn(console, 'error').mockImplementation(() => {});

		// Mock transporter creation
		(mockedNodemailer.createTransport as jest.Mock).mockReturnValue({
			sendMail: mockSendMail,
		});

		// Set process.env mock values
		process.env.GMAIL_USER = 'test@gmail.com';
		process.env.GMAIL_PASS = 'app-password';
		process.env.CONTACT_FORM_RECIPIENT_EMAIL = 'recipient@test.com';
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe('sendEmail utility', () => {
		it('should create transporter and send mail with correct params', async () => {
			mockSendMail.mockResolvedValue({ messageId: '123' });

			const result = await sendEmail(samplePayload);

			expect(mockedNodemailer.createTransport).toHaveBeenCalledWith({
				host: 'smtp.gmail.com',
				port: 465,
				secure: true,
				auth: {
					user: 'test@gmail.com',
					pass: 'app-password',
				},
			});

			expect(mockSendMail).toHaveBeenCalledWith(
				expect.objectContaining({
					from: expect.stringContaining('test@gmail.com'),
					to: 'recipient@test.com',
					subject: expect.stringContaining('John Doe'),
					text: expect.stringContaining('Hello!'),
				}),
			);

			expect(result).toBe(true);
		});

		it('should return false if credentials are missing', async () => {
			process.env.GMAIL_USER = '';

			const result = await sendEmail(samplePayload);

			expect(result).toBe(false);
			expect(mockSendMail).not.toHaveBeenCalled();
		});

		it('should handle nodemailer failure gracefully', async () => {
			mockSendMail.mockRejectedValue(new Error('Auth failed'));

			const result = await sendEmail(samplePayload);

			expect(result).toBe(false);
			expect(console.error).toHaveBeenCalled();
		});

		it('escapes untrusted contact fields in the HTML template', async () => {
			mockSendMail.mockResolvedValue({ messageId: '123' });

			await sendEmail({
				name: '<img src=x onerror=alert(1)>',
				email: 'client@example.com',
				phone: '<script>bad</script>',
				message: 'Mensaje <strong>no confiable</strong>',
				type: 'contact',
			});

			const html = (mockSendMail.mock.calls[0]?.[0] as { html: string }).html;
			expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
			expect(html).toContain('&lt;script&gt;bad&lt;/script&gt;');
			expect(html).not.toContain('<img src=x onerror=alert(1)>');
			expect(html).not.toContain('<script>bad</script>');
		});
	});

	describe('sendIntakeNotification utility', () => {
		it('rejects unsafe review URLs before creating or sending mail', async () => {
			const result = await sendIntakeNotification({
				invitationTitle: 'Invitación',
				clientName: 'Cliente',
				reviewUrl: 'javascript:alert(1)',
			});

			expect(result).toBe(false);
			expect(mockedNodemailer.createTransport).not.toHaveBeenCalled();
			expect(mockSendMail).not.toHaveBeenCalled();
		});

		it('escapes notification labels and permits only safe review URLs', async () => {
			mockSendMail.mockResolvedValue({ messageId: '123' });

			await sendIntakeNotification({
				invitationTitle: '<b>Privada</b>',
				clientName: 'Ana & Luis',
				reviewUrl: 'https://www.celebra-me.com/dashboard/review?id=1&tab=main',
			});

			const html = (mockSendMail.mock.calls[0]?.[0] as { html: string }).html;
			expect(html).toContain('&lt;b&gt;Privada&lt;/b&gt;');
			expect(html).toContain('Ana &amp; Luis');
			expect(html).toContain('https://www.celebra-me.com/dashboard/review?id=1&amp;tab=main');
		});
	});
});
