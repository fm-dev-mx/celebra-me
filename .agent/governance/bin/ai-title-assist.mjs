function hasAiTitleConfig(policy, env = process.env) {
	const config = policy?.workflow?.commit?.aiTitle || {};
	return Boolean(
		config.enabled &&
		String(config.mode || 'assist') === 'assist' &&
		env.GATEKEEPER_AI_TITLE_ENDPOINT &&
		env.GATEKEEPER_AI_TITLE_MODEL &&
		env.GATEKEEPER_AI_TITLE_API_KEY,
	);
}

async function requestAiTitleAssist(payload, options = {}) {
	const fetchImpl = options.fetchImpl || globalThis.fetch;
	if (typeof fetchImpl !== 'function') {
		throw new Error('Fetch is not available for AI title assist.');
	}

	const response = await fetchImpl(options.endpoint, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: `Bearer ${options.apiKey}`,
		},
		body: JSON.stringify({
			model: options.model,
			payload,
		}),
		signal: options.signal,
	});

	if (!response.ok) {
		throw new Error(`AI title assist request failed with status ${response.status}`);
	}

	const json = await response.json();
	const normalized = json?.subject ? json : json?.result ? json.result : null;
	if (!normalized?.subject) {
		throw new Error('AI title assist response did not include a subject.');
	}
	return {
		subject: String(normalized.subject || '').trim(),
		confidence: Number(normalized.confidence || 0),
		rationale: String(normalized.rationale || '').trim(),
	};
}

function shouldUseAiTitleAssist(policy, deterministicSummary) {
	const config = policy?.workflow?.commit?.aiTitle || {};
	const threshold = Number(config.confidenceThreshold || 0.75);
	return (
		Number(deterministicSummary?.confidence || 0) < threshold ||
		Number(deterministicSummary?.meaningfulAreaCount || 0) > 1
	);
}

export { hasAiTitleConfig, requestAiTitleAssist, shouldUseAiTitleAssist };
