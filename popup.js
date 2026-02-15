document.addEventListener('DOMContentLoaded', () => {
  loadStats();
  loadCurrentSite();
  loadTopSites();
  
  // Button event listeners
  document.getElementById('dashboardBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  });
  
  document.getElementById('resetBtn').addEventListener('click', () => {
    if (confirm('Reset today\'s tracking data?')) {
      chrome.runtime.sendMessage({ action: 'resetData' }, () => {
        loadStats();
        loadTopSites();
        showNotification('Today\'s data reset', 'success');
      });
    }
  });
  
  document.getElementById('settingsBtn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  
  // Update time every second
  setInterval(updateCurrentTime, 1000);
});

// Load today's statistics
function loadStats() {
  chrome.runtime.sendMessage({ action: 'getStats' }, (response) => {
    if (!response?.daily) return;
    
    const daily = response.daily;
    const prodMins = Math.round(daily.productive / 60);
    const unprodMins = Math.round(daily.unproductive / 60);
    
    document.getElementById('todayProductive').textContent = formatTime(prodMins);
    document.getElementById('todayUnproductive').textContent = formatTime(unprodMins);
    
    const score = daily.total > 0 ? Math.round((daily.productive / daily.total) * 100) : 0;
    const scoreEl = document.getElementById('todayScore');
    scoreEl.textContent = score + '%';
    
    // Color code score
    if (score >= 70) {
      scoreEl.style.color = '#4CAF50';
    } else if (score >= 40) {
      scoreEl.style.color = '#FF9800';
    } else {
      scoreEl.style.color = '#F44336';
    }
  });
}

// Load current site information
function loadCurrentSite() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]?.url) {
      document.querySelector('.site-domain').textContent = 'No active site';
      return;
    }
    
    try {
      const url = new URL(tabs[0].url);
      const domain = url.hostname.replace('www.', '');
      
      const siteInfo = document.getElementById('currentSite');
      document.querySelector('.site-domain').textContent = domain;
      
      // Check category
      chrome.storage.local.get(['categories'], (result) => {
        const cats = result.categories || { productive: [], unproductive: [] };
        
        siteInfo.className = 'site-info';
        if (cats.productive.includes(domain)) {
          siteInfo.classList.add('productive');
        } else if (cats.unproductive.includes(domain)) {
          siteInfo.classList.add('unproductive');
        }
      });
    } catch (e) {
      document.querySelector('.site-domain').textContent = 'Invalid URL';
    }
  });
}

// Update current site time
function updateCurrentTime() {
  chrome.storage.local.get(['daily'], (result) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.url) return;
      
      try {
        const url = new URL(tabs[0].url);
        const domain = url.hostname.replace('www.', '');
        const time = result.daily?.sites?.[domain]?.time || 0;
        document.getElementById('currentTime').textContent = formatTime(Math.round(time / 60));
      } catch (e) {
        document.getElementById('currentTime').textContent = '0m';
      }
    });
  });
}

// Load top sites for today
function loadTopSites() {
  chrome.storage.local.get(['daily'], (result) => {
    const sites = result.daily?.sites || {};
    const container = document.getElementById('topSitesList');
    
    const topSites = Object.entries(sites)
      .map(([domain, data]) => ({ domain, ...data }))
      .sort((a, b) => b.time - a.time)
      .slice(0, 5);
    
    if (topSites.length === 0) {
      container.innerHTML = '<div class="empty-state">No data yet</div>';
      return;
    }
    
    container.innerHTML = '';
    topSites.forEach(site => {
      const timeDisplay = formatTime(Math.round(site.time / 60));
      
      const item = document.createElement('div');
      item.className = `site-item ${site.category || 'neutral'}`;
      item.innerHTML = `
        <span class="site-name">${truncateDomain(site.domain)}</span>
        <span class="site-time">${timeDisplay}</span>
      `;
      
      container.appendChild(item);
    });
  });
}

// Helper: Format time (minutes to readable format)
function formatTime(minutes) {
  if (minutes < 60) return minutes + 'm';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours + 'h ' + (mins > 0 ? mins + 'm' : '');
}

// Helper: Truncate long domain names
function truncateDomain(domain, maxLength = 25) {
  if (domain.length <= maxLength) return domain;
  return domain.substring(0, maxLength - 3) + '...';
}

// Helper: Show notification
function showNotification(message, type = 'info') {
  // You could implement a simple toast notification here
  console.log(`[${type}] ${message}`);
}