/**
 * What it does: Scans webpage anchor tags for privacy or legal policy links and shares them with the extension popup and background script.
 * Why it exists: Automates discovery of direct privacy policy URLs so users don't have to hunt through site footers manually.
 * Connects to: Webpage DOM (anchor tags) and extension popup/background via chrome.runtime messaging.
 */

const POLICY_KEYWORDS = ['privacy', 'terms', 'policy', 'legal'];

function isPolicyLink(anchorElement) {
  if (!anchorElement || !anchorElement.href) {
    return false;
  }

  const hrefString = anchorElement.href.toLowerCase();
  const textString = (anchorElement.textContent || '').toLowerCase();

  for (const keyword of POLICY_KEYWORDS) {
    if (hrefString.includes(keyword) || textString.includes(keyword)) {
      return true;
    }
  }
  return false;
}

function scanForPolicyUrl() {
  const allAnchors = document.getElementsByTagName('a');

  for (let i = 0; i < allAnchors.length; i++) {
    const anchor = allAnchors[i];
    if (isPolicyLink(anchor)) {
      return anchor.href;
    }
  }

  return null;
}

const detectedPolicyUrl = scanForPolicyUrl();

try {
  chrome.runtime.sendMessage({
    type: 'POLICY_URL_DETECTED',
    policyUrl: detectedPolicyUrl
  }).catch(() => {
    // Silently ignore messaging errors if popup is closed during page load
  });
} catch (error) {
  // Ignore runtime context errors when extension reloads
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request && request.type === 'GET_POLICY_URL') {
    sendResponse({ policyUrl: detectedPolicyUrl });
  }
  return true;
});
