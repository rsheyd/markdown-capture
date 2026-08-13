async function fetchRedditJson(tabId, jsonUrl) {
  const injectionResults = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: async url => {
      try {
        const response = await fetch(url, {
          headers: { Accept: 'application/json' },
          credentials: 'include'
        });
        return {
          ok: response.ok,
          status: response.status,
          payload: response.ok ? await response.json() : null
        };
      } catch (error) {
        return { ok: false, status: 0, error: error.message };
      }
    },
    args: [jsonUrl]
  });

  const result = injectionResults[0]?.result;
  if (!result) throw new Error('Reddit tab did not return a response');
  if (!result.ok) {
    const detail = result.status ? `HTTP ${result.status}` : result.error;
    throw new Error(`Reddit request failed with ${detail || 'an unknown error'}`);
  }
  return result.payload;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'fetch-reddit-json') return false;

  fetchRedditJson(message.tabId, message.jsonUrl)
    .then(payload => sendResponse({ ok: true, payload }))
    .catch(error => {
      console.error('Reddit acquisition failed', error);
      sendResponse({ ok: false, error: error.message });
    });

  return true;
});
