// ===========================================
// PRODUCTIVITY TRACKER - BACKGROUND SERVICE
// ===========================================

// Website classification database
const WEBSITE_CATEGORIES = {
  productive: [
    // Coding & Development
    'github.com', 'gitlab.com', 'stackoverflow.com', 'stackexchange.com',
    'codesandbox.io', 'codepen.io', 'replit.com', 'w3schools.com',
    'developer.mozilla.org', 'freecodecamp.org', 'codecademy.com',
    'udemy.com', 'coursera.org', 'edx.org', 'pluralsight.com',
    'leetcode.com', 'hackerrank.com', 'codeforces.com',
    
    // Documentation & Tools
    'docs.google.com', 'drive.google.com', 'calendar.google.com',
    'notion.so', 'miro.com', 'figma.com', 'asana.com', 'trello.com',
    'jira.com', 'slack.com', 'teams.microsoft.com', 'zoom.us',
    'meet.google.com', 'evernote.com', 'onenote.com',
    
    // Learning & Productivity
    'medium.com', 'dev.to', 'hashnode.com', 'todoist.com',
    'grammarly.com', 'canva.com', 'overleaf.com', 'draw.io'
  ],
  
  unproductive: [
    // Social Media
    'facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'tiktok.com',
    'snapchat.com', 'pinterest.com', 'reddit.com', 'tumblr.com',
    'linkedin.com', 'threads.net',
    
    // Video Streaming
    'youtube.com', 'netflix.com', 'primevideo.com', 'hulu.com',
    'disneyplus.com', 'hotstar.com', 'vimeo.com', 'twitch.tv',
    'dailymotion.com',
    
    // Gaming
    'steam.com', 'epicgames.com', 'origin.com', 'xbox.com', 'playstation.com',
    'roblox.com', 'minecraft.net', 'chess.com', 'lichess.org',
    
    // Entertainment & News
    '9gag.com', 'buzzfeed.com', 'imgur.com', 'cnn.com', 'bbc.com',
    'nytimes.com', 'theguardian.com', 'foxnews.com', 'wsj.com',
    'espn.com', 'sports.yahoo.com',
    
    // Shopping
    'amazon.com', 'ebay.com', 'walmart.com', 'target.com', 'aliexpress.com',
    'flipkart.com', 'etsy.com', 'bestbuy.com', 'newegg.com'
  ]
};

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('✅ Productivity Tracker installed');
  
  const today = new Date().toDateString();
  
  // Initialize storage
  chrome.storage.local.set({
    settings: {
      autoReset: true,
      notifications: true,
      weeklyReport: true,
      syncToServer: false,
      serverUrl: 'http://localhost:5000'
    },
    categories: WEBSITE_CATEGORIES,
    daily: {
      date: today,
      sites: {},
      productive: 0,
      unproductive: 0,
      neutral: 0,
      total: 0
    },
    weekly: {
      days: [],
      productive: 0,
      unproductive: 0,
      neutral: 0,
      total: 0
    },
    monthly: {
      months: [],
      productive: 0,
      unproductive: 0,
      total: 0
    },
    history: [],
    reports: []
  });
  
  // Create alarms
  chrome.alarms.create('trackingAlarm', { periodInMinutes: 1 });
  chrome.alarms.create('dailyReset', { periodInMinutes: 60 });
  chrome.alarms.create('weeklyReport', { periodInMinutes: 60 * 24 });
});

// Tracking variables
let activeTabId = null;
let activeDomain = null;
let startTime = null;
let isTracking = true;

// Tab change listeners
chrome.tabs.onActivated.addListener((activeInfo) => {
  handleTabChange(activeInfo.tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tabId === activeTabId) {
    handleTabChange(tabId);
  }
});

// Handle tab change
function handleTabChange(tabId) {
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError || !tab?.url || !tab.url.startsWith('http')) {
      return;
    }
    
    // Save time for previous domain
    saveTimeForCurrentDomain();
    
    // Start tracking new domain
    activeTabId = tabId;
    activeDomain = extractDomain(tab.url);
    startTime = Date.now();
    
    console.log(`🔍 Tracking: ${activeDomain}`);
  });
}

// Extract domain from URL
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch (e) {
    return null;
  }
}

// Save time for current domain
function saveTimeForCurrentDomain() {
  if (!activeDomain || !startTime || !isTracking) return;
  
  const endTime = Date.now();
  const timeSpent = Math.round((endTime - startTime) / 1000); // in seconds
  
  if (timeSpent < 2) return; // Ignore very short visits
  
  updateTrackingData(activeDomain, timeSpent);
  startTime = Date.now();
}

// Update tracking data
function updateTrackingData(domain, seconds) {
  chrome.storage.local.get(['categories', 'daily', 'weekly', 'history', 'settings'], (result) => {
    const categories = result.categories || WEBSITE_CATEGORIES;
    const daily = result.daily || { sites: {}, productive: 0, unproductive: 0, neutral: 0, total: 0 };
    const weekly = result.weekly || { days: [], productive: 0, unproductive: 0, neutral: 0, total: 0 };
    const history = result.history || [];
    const settings = result.settings || {};
    
    // Determine category
    let category = 'neutral';
    if (categories.productive.includes(domain)) {
      category = 'productive';
    } else if (categories.unproductive.includes(domain)) {
      category = 'unproductive';
    }
    
    // Update daily data
    if (!daily.sites[domain]) {
      daily.sites[domain] = { time: 0, category, visits: 0 };
    }
    daily.sites[domain].time += seconds;
    daily.sites[domain].visits += 1;
    daily.total += seconds;
    daily[category] += seconds;
    
    // Update weekly data
    weekly.total += seconds;
    weekly[category] += seconds;
    
    // Add to history
    history.push({
      timestamp: new Date().toISOString(),
      domain,
      seconds,
      category
    });
    
    // Keep only last 30 days of history
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    while (history.length > 0 && new Date(history[0].timestamp).getTime() < thirtyDaysAgo) {
      history.shift();
    }
    
    chrome.storage.local.set({ daily, weekly, history });
    
    // Sync with backend if enabled
    if (settings.syncToServer && settings.serverUrl) {
      syncWithServer({ domain, seconds, category, timestamp: new Date().toISOString() }, settings.serverUrl);
    }
    
    console.log(`📊 +${seconds}s on ${domain} (${category})`);
  });
}

// Window focus change
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Window lost focus - pause tracking
    if (isTracking) {
      saveTimeForCurrentDomain();
      isTracking = false;
    }
  } else {
    // Window gained focus - resume tracking
    if (!isTracking) {
      isTracking = true;
      startTime = Date.now();
    }
  }
});

// Idle state detection
chrome.idle.onStateChanged.addListener((state) => {
  if (state === 'idle' || state === 'locked') {
    if (isTracking) {
      saveTimeForCurrentDomain();
      isTracking = false;
    }
  } else if (state === 'active') {
    if (!isTracking) {
      isTracking = true;
      startTime = Date.now();
    }
  }
});

// Alarm handler
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'trackingAlarm') {
    // Save current session every minute
    if (isTracking && activeDomain && startTime) {
      saveTimeForCurrentDomain();
    }
  } else if (alarm.name === 'dailyReset') {
    checkAndResetDaily();
  } else if (alarm.name === 'weeklyReport') {
    generateWeeklyReport();
  }
});

// Check and reset daily data
function checkAndResetDaily() {
  const now = new Date();
  const today = now.toDateString();
  
  chrome.storage.local.get(['daily', 'weekly', 'monthly'], (result) => {
    const daily = result.daily;
    const weekly = result.weekly;
    const monthly = result.monthly;
    
    if (daily && daily.date !== today) {
      // Archive yesterday's data
      const yesterday = {
        date: daily.date,
        productive: daily.productive,
        unproductive: daily.unproductive,
        neutral: daily.neutral,
        total: daily.total,
        sites: daily.sites
      };
      
      // Add to weekly days
      if (!weekly.days) weekly.days = [];
      weekly.days.push(yesterday);
      
      // Keep only last 7 days
      if (weekly.days.length > 7) {
        weekly.days.shift();
      }
      
      // Add to monthly
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      if (!monthly.months) monthly.months = [];
      
      let monthData = monthly.months.find(m => m.month === currentMonth && m.year === currentYear);
      if (!monthData) {
        monthData = { month: currentMonth, year: currentYear, productive: 0, unproductive: 0, total: 0 };
        monthly.months.push(monthData);
      }
      
      monthData.productive += daily.productive;
      monthData.unproductive += daily.unproductive;
      monthData.total += daily.total;
      
      // Keep only last 12 months
      if (monthly.months.length > 12) {
        monthly.months.shift();
      }
      
      // Reset daily
      chrome.storage.local.set({
        daily: {
          date: today,
          sites: {},
          productive: 0,
          unproductive: 0,
          neutral: 0,
          total: 0
        },
        weekly: weekly,
        monthly: monthly
      });
      
      console.log('🔄 Daily data reset');
    }
  });
}

// Generate weekly report
function generateWeeklyReport() {
  chrome.storage.local.get(['weekly', 'settings'], (result) => {
    const weekly = result.weekly;
    const settings = result.settings || { notifications: true };
    
    if (!weekly || weekly.total === 0) return;
    
    const productiveMins = Math.round(weekly.productive / 60);
    const unproductiveMins = Math.round(weekly.unproductive / 60);
    const totalMins = productiveMins + unproductiveMins;
    const productivityScore = Math.round((weekly.productive / weekly.total) * 100);
    
    // Determine productivity level
    let level = 'Needs Improvement';
    let color = '#F44336';
    
    if (productivityScore >= 70) {
      level = 'Excellent';
      color = '#4CAF50';
    } else if (productivityScore >= 50) {
      level = 'Good';
      color = '#2196F3';
    } else if (productivityScore >= 30) {
      level = 'Average';
      color = '#FF9800';
    }
    
    // Show notification
    if (settings.notifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: '📊 Weekly Productivity Report',
        message: `This week: ${productiveMins}m productive, ${unproductiveMins}m unproductive\nScore: ${productivityScore}% - ${level}`,
        buttons: [
          { title: 'View Dashboard' }
        ],
        priority: 2
      });
    }
    
    // Save weekly report to history
    chrome.storage.local.get(['reports'], (reportsResult) => {
      const reports = reportsResult.reports || [];
      reports.push({
        week: getWeekNumber(new Date()),
        year: new Date().getFullYear(),
        productive: weekly.productive,
        unproductive: weekly.unproductive,
        neutral: weekly.neutral,
        total: weekly.total,
        score: productivityScore,
        level: level,
        date: new Date().toISOString()
      });
      
      chrome.storage.local.set({ reports });
    });
  });
}

// Get week number
function getWeekNumber(date) {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

// Sync with backend server
function syncWithServer(data, serverUrl) {
  fetch(`${serverUrl}/api/track`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...data,
      extensionId: chrome.runtime.id
    })
  }).catch(err => console.log('Sync error:', err));
}

// Handle notification clicks
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (buttonIndex === 0) {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  }
});

// Message listener for popup/dashboard
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getStats') {
    chrome.storage.local.get(['daily', 'weekly', 'monthly', 'history', 'reports'], (result) => {
      sendResponse(result);
    });
    return true;
  }
  
  if (request.action === 'resetData') {
    const today = new Date().toDateString();
    chrome.storage.local.set({
      daily: {
        date: today,
        sites: {},
        productive: 0,
        unproductive: 0,
        neutral: 0,
        total: 0
      }
    }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (request.action === 'exportData') {
    chrome.storage.local.get(null, (data) => {
      sendResponse(data);
    });
    return true;
  }
  
  if (request.action === 'clearAllData') {
    chrome.storage.local.clear(() => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (request.action === 'updateSettings') {
    chrome.storage.local.set({ settings: request.settings }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (request.action === 'updateCategories') {
    chrome.storage.local.set({ categories: request.categories }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

console.log('🚀 Productivity Tracker background service running');