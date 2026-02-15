// dashboard.js - FIXED VERSION
document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard loading...');
    loadAllData();
    
    // Event listeners
    document.getElementById('refreshBtn').addEventListener('click', loadAllData);
    document.getElementById('exportBtn').addEventListener('click', exportData);
    document.getElementById('settingsBtn').addEventListener('click', function() {
        chrome.runtime.openOptionsPage();
    });
    
    // Tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentPeriod = e.target.dataset.period;
            loadSitesTable();
        });
    });
});

// Global variables
let todayChart, weekChart, monthChart;
let currentPeriod = 'daily';

// Load all dashboard data
function loadAllData() {
    chrome.runtime.sendMessage({ action: 'getStats' }, function(response) {
        if (!response) {
            console.log('No response from background');
            showMockData();
            return;
        }
        
        updateTodayStats(response.daily);
        updateWeekStats(response.weekly);
        updateMonthStats(response.monthly);
        loadSitesTable();
        loadReports(response.reports);
    });
}

// Show mock data if no real data
function showMockData() {
    const mockDaily = {
        productive: 3600,
        unproductive: 1800,
        neutral: 900,
        total: 6300,
        sites: {
            'github.com': { time: 1800, category: 'productive', visits: 3 },
            'stackoverflow.com': { time: 1200, category: 'productive', visits: 5 },
            'youtube.com': { time: 1500, category: 'unproductive', visits: 2 },
            'gmail.com': { time: 600, category: 'neutral', visits: 4 }
        }
    };
    
    const mockWeekly = {
        productive: 18000,
        unproductive: 9000,
        neutral: 4500,
        total: 31500,
        days: []
    };
    
    updateTodayStats(mockDaily);
    updateWeekStats(mockWeekly);
    loadSitesTableFromData(mockDaily);
}

// Update today's statistics
function updateTodayStats(daily) {
    if (!daily) return;
    
    const prodMins = Math.round(daily.productive / 60);
    const unprodMins = Math.round(daily.unproductive / 60);
    const neutralMins = Math.round((daily.neutral || 0) / 60);
    const totalMins = prodMins + unprodMins + neutralMins;
    
    document.getElementById('todayProd').textContent = formatTime(prodMins);
    document.getElementById('todayUnprod').textContent = formatTime(unprodMins);
    document.getElementById('todayNeutral').textContent = formatTime(neutralMins);
    document.getElementById('todayTotal').textContent = formatTime(totalMins);
    
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
    
    // Create chart
    createTodayChart(daily.productive, daily.unproductive, daily.neutral || 0);
}

// Create today chart
function createTodayChart(productive, unproductive, neutral) {
    const canvas = document.getElementById('todayChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Destroy existing chart
    if (todayChart) {
        todayChart.destroy();
    }
    
    // Create new chart
    todayChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Productive', 'Unproductive', 'Neutral'],
            datasets: [{
                data: [productive, unproductive, neutral],
                backgroundColor: ['#4CAF50', '#F44336', '#9E9E9E']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { boxWidth: 12 }
                }
            }
        }
    });
}

// Update weekly statistics
function updateWeekStats(weekly) {
    if (!weekly) return;
    
    const prodMins = Math.round(weekly.productive / 60);
    const unprodMins = Math.round(weekly.unproductive / 60);
    const neutralMins = Math.round((weekly.neutral || 0) / 60);
    const totalMins = prodMins + unprodMins + neutralMins;
    
    document.getElementById('weekProd').textContent = formatTime(prodMins);
    document.getElementById('weekUnprod').textContent = formatTime(unprodMins);
    document.getElementById('weekNeutral').textContent = formatTime(neutralMins);
    document.getElementById('weekTotal').textContent = formatTime(totalMins);
    
    const avgScore = weekly.total > 0 ? Math.round((weekly.productive / weekly.total) * 100) : 0;
    document.getElementById('weekScore').textContent = avgScore + '%';
    
    // Create week chart
    createWeekChart(weekly.days);
}

// Create week chart
function createWeekChart(days) {
    const canvas = document.getElementById('weekChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (weekChart) {
        weekChart.destroy();
    }
    
    const labels = days && days.length > 0 
        ? days.map(d => new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' }))
        : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    const productiveData = days && days.length > 0
        ? days.map(d => Math.round(d.productive / 60))
        : [45, 60, 30, 75, 90, 45, 60];
    
    const unproductiveData = days && days.length > 0
        ? days.map(d => Math.round(d.unproductive / 60))
        : [30, 15, 45, 30, 15, 30, 20];
    
    weekChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Productive (min)',
                    data: productiveData,
                    backgroundColor: '#4CAF50'
                },
                {
                    label: 'Unproductive (min)',
                    data: unproductiveData,
                    backgroundColor: '#F44336'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Minutes'
                    }
                }
            }
        }
    });
}

// Update monthly statistics
function updateMonthStats(monthly) {
    if (!monthly) {
        document.getElementById('monthProd').textContent = '0 min';
        document.getElementById('monthUnprod').textContent = '0 min';
        document.getElementById('monthNeutral').textContent = '0 min';
        document.getElementById('monthTotal').textContent = '0 min';
        document.getElementById('monthScore').textContent = '0%';
        return;
    }
    
    const prodMins = Math.round(monthly.productive / 60);
    const unprodMins = Math.round(monthly.unproductive / 60);
    const neutralMins = Math.round((monthly.neutral || 0) / 60);
    const totalMins = prodMins + unprodMins + neutralMins;
    
    document.getElementById('monthProd').textContent = formatTime(prodMins);
    document.getElementById('monthUnprod').textContent = formatTime(unprodMins);
    document.getElementById('monthNeutral').textContent = formatTime(neutralMins);
    document.getElementById('monthTotal').textContent = formatTime(totalMins);
    
    const score = monthly.total > 0 ? Math.round((monthly.productive / monthly.total) * 100) : 0;
    document.getElementById('monthScore').textContent = score + '%';
    
    // Create month chart
    createMonthChart(monthly);
}

// Create month chart
function createMonthChart(monthly) {
    const canvas = document.getElementById('monthChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (monthChart) {
        monthChart.destroy();
    }
    
    monthChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Productive', 'Unproductive', 'Neutral'],
            datasets: [{
                data: [monthly.productive || 0, monthly.unproductive || 0, monthly.neutral || 0],
                backgroundColor: ['#4CAF50', '#F44336', '#9E9E9E']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { boxWidth: 12 }
                }
            }
        }
    });
}

// Load sites table based on current period
function loadSitesTable() {
    chrome.runtime.sendMessage({ action: 'getStats' }, function(response) {
        if (!response) return;
        
        let sites = {};
        let total = 0;
        
        if (currentPeriod === 'daily') {
            sites = response.daily?.sites || {};
            total = response.daily?.total || 0;
        } else if (currentPeriod === 'weekly') {
            // Aggregate weekly sites
            const days = response.weekly?.days || [];
            days.forEach(day => {
                Object.entries(day.sites || {}).forEach(([domain, data]) => {
                    if (!sites[domain]) {
                        sites[domain] = { time: 0, category: data.category, visits: 0 };
                    }
                    sites[domain].time += data.time;
                    sites[domain].visits += data.visits || 0;
                    total += data.time;
                });
            });
        } else {
            // For monthly, use weekly data as proxy
            return loadSitesTableFromData(response.daily);
        }
        
        loadSitesTableFromData(sites, total);
    });
}

// Load sites table from data object
function loadSitesTableFromData(sites, total = 0) {
    const tbody = document.getElementById('sitesTableBody');
    if (!tbody) return;
    
    const sitesArray = Object.entries(sites)
        .map(([domain, data]) => ({ domain, ...data }))
        .sort((a, b) => b.time - a.time)
        .slice(0, 15);
    
    if (sitesArray.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No data available</td></tr>';
        return;
    }
    
    tbody.innerHTML = '';
    sitesArray.forEach(site => {
        const minutes = Math.round(site.time / 60);
        const timeDisplay = formatTime(minutes);
        const percent = total > 0 ? Math.round((site.time / total) * 100) : 0;
        
        const row = document.createElement('tr');
        row.className = site.category || 'neutral';
        row.innerHTML = `
            <td>${site.domain}</td>
            <td><span class="badge ${site.category || 'neutral'}">${site.category || 'neutral'}</span></td>
            <td>${timeDisplay}</td>
            <td>${site.visits || 1}</td>
            <td>${percent}%</td>
        `;
        
        tbody.appendChild(row);
    });
}

// Load weekly reports
function loadReports(reports) {
    const reportsList = document.getElementById('reportsList');
    if (!reportsList) return;
    
    if (!reports || reports.length === 0) {
        reportsList.innerHTML = '<div class="empty-state">No reports yet</div>';
        return;
    }
    
    reportsList.innerHTML = '';
    reports.slice(-5).reverse().forEach(report => {
        const date = new Date(report.date);
        const prodMins = Math.round(report.productive / 60);
        
        const card = document.createElement('div');
        card.className = 'report-card';
        card.innerHTML = `
            <div class="report-date">Week ${report.week}, ${report.year}</div>
            <div class="report-stats">
                <span>Productive: ${formatTime(prodMins)}</span>
                <span>Score: ${report.score}%</span>
                <span class="badge ${report.score >= 70 ? 'productive' : report.score >= 40 ? 'neutral' : 'unproductive'}">
                    ${report.level || 'Average'}
                </span>
            </div>
        `;
        
        reportsList.appendChild(card);
    });
}

// Export data as JSON
function exportData() {
    chrome.runtime.sendMessage({ action: 'exportData' }, function(data) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        chrome.downloads.download({
            url: url,
            filename: `productivity-export-${new Date().toISOString().split('T')[0]}.json`
        });
    });
}

// Helper: Format time (minutes to readable format)
function formatTime(minutes) {
    if (minutes < 60) return minutes + ' min';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours + 'h ' + (mins > 0 ? mins + 'm' : '');
}