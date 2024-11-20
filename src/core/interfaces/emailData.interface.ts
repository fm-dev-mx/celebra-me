export interface EmailData {
	/**
	 * The email address of the recipient(s).
	 */
	to: string | string[];

	/**
	 * The email address of the sender.
	 */
	from: string;

	/**
	 * The subject of the email.
	 */
	subject: string;

	/**
	 * The body of the email, as plain text or HTML.
	 */
	text?: string;

	/**
	 * The HTML content of the email.
	 */
	html?: string;

	/**
	 * Optional list of email addresses to CC.
	 */
	cc?: string | string[];

	/**
	 * Optional list of email addresses to BCC.
	 */
	bcc?: string | string[];

	/**
	 * Optional email address for replies.
	 */
	replyTo?: string | string[];
}
