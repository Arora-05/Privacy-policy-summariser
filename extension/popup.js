/**
 * What it does: Drives the extension popup UI, handling domain matching, policy analysis requests, summary rendering, and change history timelines.
 * Why it exists: Provides the interactive frontend logic allowing users to inspect privacy scores and track updates on any website.
 * Connects to: popup.html DOM elements, content.js messaging, and backend API endpoints (/api/sites).
 */

const API_BASE_URL = 'http://localhost:5000/api';

let activeTabDomain = null;
let activeTabUrl = null;
let detectedPolicyLink = null;
let trackedSiteData = null;

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

function switchActiveView(viewId) {
  const views = ['view-loading', 'view-untracked', 'view-summary', 'view-history'];
  views.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.classList.toggle('active', id === viewId);
    }
  });
}

function formatScoreBadge(scoreValue) {
  const scoreElement = document.getElementById('field-score');
  if (!scoreElement) return;

  const scoreNum = Number(scoreValue) || 0;
  scoreElement.textContent = `${scoreNum}/10`;

  if (scoreNum >= 7) {
    scoreElement.style.color = '#10b981';
    scoreElement.style.borderColor = '#10b981';
  } else if (scoreNum >= 5) {
    scoreElement.style.color = '#f59e0b';
    scoreElement.style.borderColor = '#f59e0b';
  } else {
    scoreElement.style.color = '#ef4444';
    scoreElement.style.borderColor = '#ef4444';
  }
}

function renderSummaryCard(summary) {
  if (!summary) return;

  formatScoreBadge(summary.bottomLineScore);

  const fieldsMap = {
    'field-collected': summary.dataCollected || 'No specific data collection practices outlined.',
    'field-sharing': summary.thirdPartySharing || 'No third-party sharing disclosed.',
    'field-rights': summary.userRights || 'No user privacy rights specified.',
    'field-retention': summary.dataRetention || 'No data retention period defined.'
  };

  for (const [elementId, contentText] of Object.entries(fieldsMap)) {
    const el = document.getElementById(elementId);
    if (el) el.textContent = contentText;
  }

  const flagsElement = document.getElementById('field-flags');
  if (flagsElement) {
    if (Array.isArray(summary.notableRedFlags) && summary.notableRedFlags.length > 0) {
      flagsElement.innerHTML = summary.notableRedFlags.map(flag => `• ${flag}`).join('<br>');
    } else if (typeof summary.notableRedFlags === 'string' && summary.notableRedFlags.trim()) {
      flagsElement.textContent = summary.notableRedFlags;
    } else {
      flagsElement.textContent = 'None detected. Practices appear standard.';
    }
  }
}

async function fetchAndRenderHistory(siteId) {
  const container = document.getElementById('timeline-container');
  if (!container) return;

  container.innerHTML = '<div class="empty-state"><div class="spinner" style="margin-bottom:8px;"></div><p>Loading change timeline...</p></div>';

  try {
    const response = await fetch(`${API_BASE_URL}/sites/${siteId}/history`);
    if (!response.ok) throw new Error('Failed to fetch history');

    const data = await response.json();
    const changes = data.changes || [];

    if (changes.length === 0) {
      container.innerHTML = '<div class="empty-state">No privacy policy changes recorded yet.<br>We check this site automatically every Sunday!</div>';
      return;
    }

    container.innerHTML = '';
    changes.forEach(change => {
      const dateStr = new Date(change.detectedAt).toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric'
      });

      const diffHtml = (change.diffChunks || []).map(chunk => {
        const prefix = chunk.type === 'added' ? '+ ' : '- ';
        const color = chunk.type === 'added' ? '#6ee7b7' : '#fca5a5';
        return `<div style="color:${color}; margin-bottom:4px;">${prefix}${chunk.text}</div>`;
      }).join('');

      const itemHtml = `
        <div class="timeline-item">
          <div class="timeline-dot"></div>
          <div class="timeline-card">
            <div class="timeline-header">
              <span class="timeline-date">${dateStr}</span>
              <span class="badge badge-${change.classification}">${change.classification.replace('_', ' ')}</span>
            </div>
            <div class="diff-preview">${diffHtml || 'No readable text diff.'}</div>
          </div>
        </div>
      `;
      container.insertAdjacentHTML('beforeend', itemHtml);
    });

    const alertBanner = document.getElementById('alert-banner');
    if (alertBanner) alertBanner.style.display = 'none';

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        chrome.action.setBadgeText({ text: '', tabId: tabs[0].id });
        chrome.action.setBadgeBackgroundColor({ color: '#00c853', tabId: tabs[0].id });
      }
    });
  } catch (error) {
    container.innerHTML = `<div class="empty-state" style="color:#ef4444;">Failed to load history: ${error.message}</div>`;
  }
}

async function handleAnalyzeButtonClick() {
  const analyzeBtn = document.getElementById('btn-analyze');
  if (analyzeBtn) {
    analyzeBtn.disabled = true;
    analyzeBtn.innerHTML = '<div class="spinner"></div><span>Analyzing with Gemini AI...</span>';
  }

  try {
    const targetPolicyUrl = detectedPolicyLink || activeTabUrl;
    const response = await fetch(`${API_BASE_URL}/sites/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        policyUrl: targetPolicyUrl,
        url: activeTabDomain
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || 'Summarization request failed');
    }

    const data = await response.json();
    trackedSiteData = data.site;

    renderSummaryCard(data.summary);
    document.getElementById('nav-tabs').style.display = 'grid';
    document.getElementById('status-text').textContent = 'Active';
    document.getElementById('last-checked-text').textContent = 'Just now';
    switchActiveView('view-summary');
  } catch (error) {
    alert(`Failed to analyze policy: ${error.message}`);
    if (analyzeBtn) {
      analyzeBtn.disabled = false;
      analyzeBtn.innerHTML = '<span>✨ Analyze & Track Policy</span>';
    }
  }
}

async function initializePopup() {
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    const currentTab = tabs[0];
    if (!currentTab || !currentTab.url) {
      document.getElementById('domain-badge').textContent = 'Invalid Tab';
      switchActiveView('view-untracked');
      return;
    }

    activeTabUrl = currentTab.url;
    activeTabDomain = getDomainFromUrl(currentTab.url);

    if (!activeTabDomain) {
      document.getElementById('domain-badge').textContent = 'System Page';
      switchActiveView('view-untracked');
      return;
    }

    document.getElementById('domain-badge').textContent = activeTabDomain;

    try {
      chrome.tabs.sendMessage(currentTab.id, { type: 'GET_POLICY_URL' }, (response) => {
        if (!chrome.runtime.lastError && response && response.policyUrl) {
          detectedPolicyLink = response.policyUrl;
          const urlContainer = document.getElementById('detected-url-container');
          const urlBox = document.getElementById('detected-url-box');
          if (urlContainer && urlBox) {
            urlBox.textContent = detectedPolicyLink;
            urlContainer.style.display = 'block';
          }
        }
      });
    } catch (e) {
      // Silently ignore messaging errors on browser internal tabs
    }

    try {
      const sitesResponse = await fetch(`${API_BASE_URL}/sites`);
      const sitesData = await sitesResponse.json();
      const allSites = sitesData.sites || [];

      const matchedSite = allSites.find(s => s.url === activeTabDomain || activeTabDomain.endsWith(`.${s.url}`));

      if (matchedSite) {
        trackedSiteData = matchedSite;
        document.getElementById('nav-tabs').style.display = 'grid';
        document.getElementById('status-text').textContent = 'Active';

        if (matchedSite.lastCheckedAt) {
          const checkDate = new Date(matchedSite.lastCheckedAt).toLocaleDateString();
          document.getElementById('last-checked-text').textContent = `Checked: ${checkDate}`;
        }

        if (matchedSite.hasUnseenChange) {
          const alertBanner = document.getElementById('alert-banner');
          if (alertBanner) alertBanner.style.display = 'block';
        }

        const detailResponse = await fetch(`${API_BASE_URL}/sites/${matchedSite._id}`);
        if (detailResponse.ok) {
          const detailData = await detailResponse.json();
          renderSummaryCard(detailData.summary);
          switchActiveView('view-summary');
          return;
        }
      }

      switchActiveView('view-untracked');
    } catch (error) {
      document.getElementById('domain-badge').textContent = 'Offline';
      switchActiveView('view-untracked');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initializePopup();

  const analyzeBtn = document.getElementById('btn-analyze');
  if (analyzeBtn) {
    analyzeBtn.addEventListener('click', handleAnalyzeButtonClick);
  }

  const summaryTabBtn = document.getElementById('tab-summary');
  const historyTabBtn = document.getElementById('tab-history');

  if (summaryTabBtn && historyTabBtn) {
    summaryTabBtn.addEventListener('click', () => {
      summaryTabBtn.classList.add('active');
      historyTabBtn.classList.remove('active');
      switchActiveView('view-summary');
    });

    historyTabBtn.addEventListener('click', () => {
      historyTabBtn.classList.add('active');
      summaryTabBtn.classList.remove('active');
      switchActiveView('view-history');
      if (trackedSiteData && trackedSiteData._id) {
        fetchAndRenderHistory(trackedSiteData._id);
      }
    });
  }
});
