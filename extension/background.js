/**
 * What it does: Monitors browser tab navigation and updates the extension toolbar badge when visiting tracked websites.
 * Why it exists: Alerts users instantly with a red exclamation badge (!) when a visited site has an unseen privacy policy change.
 * Connects to: Chrome tabs/action APIs and backend GET /api/sites endpoint.
 */

const API_BASE_URL = 'http://localhost:5000/api';

function getDomainFromUrl(urlString) {
  try {
    const parsedUrl = new URL(urlString);
    if (!parsedUrl.protocol.startsWith('http')) {
      return null;
    }
    return parsedUrl.hostname.replace(/^www\./, '');
  } catch (error) {
    return null;
  }
}

async function fetchTrackedSites() {
  try {
    const response = await fetch(`${API_BASE_URL}/sites`);
    if (!response.ok) {
      return [];
    }
    const data = await response.json();
    return data.sites || [];
  } catch (error) {
    return [];
  }
}

function findMatchingSite(domain, sitesList) {
  if (!domain || !Array.isArray(sitesList)) {
    return null;
  }
  return sitesList.find(site => {
    return site.url === domain || domain.endsWith(`.${site.url}`);
  });
}

async function evaluateSiteBadge(tabId, urlString) {
  const currentDomain = getDomainFromUrl(urlString);
  if (!currentDomain) {
    chrome.action.setBadgeText({ text: '', tabId: tabId });
    return;
  }

  const trackedSites = await fetchTrackedSites();
  const matchedSite = findMatchingSite(currentDomain, trackedSites);

  if (!matchedSite) {
    chrome.action.setBadgeText({ text: '', tabId: tabId });
    return;
  }

  if (matchedSite.hasUnseenChange) {
    chrome.action.setBadgeText({ text: '!', tabId: tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#d50000', tabId: tabId });
  } else {
    chrome.action.setBadgeText({ text: '', tabId: tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#00c853', tabId: tabId });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab && tab.id && tab.url) {
        evaluateSiteBadge(tab.id, tab.url);
      }
    }
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab && tab.url) {
    evaluateSiteBadge(tabId, tab.url);
  }
});
