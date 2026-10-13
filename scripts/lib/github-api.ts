/** Minimal GitHub REST read for CI helpers that run under plain `node` (type stripping). */
export async function githubApi(
	suffix: string,
	repository: string,
	token: string,
): Promise<unknown> {
	const apiUrl = process.env.GITHUB_API_URL || 'https://api.github.com';
	const response = await fetch(`${apiUrl}/repos/${repository}/${suffix}`, {
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28',
		},
	});
	if (!response.ok) throw new Error(`Cannot read ${suffix}: HTTP ${response.status}.`);
	return response.json();
}
