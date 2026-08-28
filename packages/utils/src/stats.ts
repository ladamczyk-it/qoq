// The sink, and the fallback every sender tries when a POST to it does not land:
// the same ledger reached with a GET, for the networks where an outbound POST
// never leaves but an image fetch does. Exported because each tool quotes both
// in the consent it asks for, and a disclosure naming an endpoint the code does
// not use is worse than none.
export const STATS_URL = 'https://stats.adamczyk.ovh';
export const PIXEL_URL = 'https://adamczyk.ovh/img/stats/pixel.png';

const STATS_TIMEOUT_MS = 2000;

// `tool` once, `options` once per option. The sink rejects any other key, so a
// cache-buster cannot ride along - and it accepts nothing here a POST body
// could not carry either.
const pixelUrl = (tool: string, options: string[]): string =>
  `${PIXEL_URL}?${new URLSearchParams([['tool', tool], ...options.map((o) => ['options', o])])}`;

/**
 * Transport only. Consent is the caller's: each tool owns the config file the
 * answer is recorded in and the prompt that asks for it, and nothing reaches
 * here until one of them has already decided it may.
 *
 * Fire-and-forget - a dead or slow endpoint must never surface as an error or
 * hold a run up, hence the swallowed catches and the 2s cap. That cap is one
 * deadline shared by both attempts, so the fallback cannot double what a caller
 * waits on: a POST that burns the budget leaves the pixel pre-aborted, and a
 * blocked one fails fast enough to leave room.
 */
export const sendStats = async (tool: string, options: string[] = []): Promise<void> => {
  const signal = AbortSignal.timeout(STATS_TIMEOUT_MS);

  try {
    const response = await fetch(STATS_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tool, options }),
      signal,
    });

    // A 4xx or 5xx counted nothing, same as never reaching the sink at all, so
    // it takes the same path out as a thrown request does.
    if (!response.ok) {
      throw new Error(`stats: ${response.status}`);
    }
  } catch {
    try {
      await fetch(pixelUrl(tool, options), { signal });
    } catch {
      // Stats are best-effort; a failed send is not the user's problem.
    }
  }
};
