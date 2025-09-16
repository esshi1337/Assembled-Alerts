// Enhanced popup script with schedule UI functionality
class ScheduleNotifierPopup {
    constructor() {
        this.currentSchedule = null;
        this.settings = {
            alertTime: 5,
            enableNotifications: true,
            autoRefresh: true
        };
        this.activeTab = 'schedule';
        
        this.initializeElements();
        this.bindEvents();
        this.loadSettings();
        this.loadSchedule();
        this.loadAlarms();
    }

    initializeElements() {
        // Tab elements
        this.tabButtons = document.querySelectorAll('.tab-button');
        this.tabContents = document.querySelectorAll('.tab-content');
        
        // Status elements
        this.statusDot = document.getElementById('statusDot');
        this.statusText = document.getElementById('statusText');
        
        // Schedule elements
        this.scheduleDate = document.getElementById('scheduleDate');
        this.scheduleTimezone = document.getElementById('scheduleTimezone');
        this.scheduleList = document.getElementById('scheduleList');
        this.noSchedule = document.getElementById('noSchedule');
        this.refreshButton = document.getElementById('refreshButton');
        this.openAssembledButton = document.getElementById('openAssembled');
        
        // Settings elements
        this.alertTimeInput = document.getElementById('alertTime');
        this.enableNotificationsInput = document.getElementById('enableNotifications');
        this.autoRefreshInput = document.getElementById('autoRefresh');
        this.saveSettingsButton = document.getElementById('saveSettings');
        
        // Alarms elements
        this.alarmCount = document.getElementById('alarmCount');
        this.alarmsList = document.getElementById('alarmsList');
        this.clearAllAlarmsButton = document.getElementById('clearAllAlarms');
        this.refreshAlarmsButton = document.getElementById('refreshAlarms');
        
        // Footer elements
        this.lastUpdated = document.getElementById('lastUpdated');
    }

    bindEvents() {
        // Tab switching
        this.tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                this.switchTab(button.dataset.tab);
            });
        });

        // Schedule actions
        this.refreshButton.addEventListener('click', () => {
            this.refreshSchedule();
        });
        
        this.openAssembledButton.addEventListener('click', () => {
            this.openAssembledPage();
        });

        // Settings actions
        this.saveSettingsButton.addEventListener('click', () => {
            this.saveSettings();
        });

        // Alarms actions
        this.clearAllAlarmsButton.addEventListener('click', () => {
            this.clearAllAlarms();
        });
        
        this.refreshAlarmsButton.addEventListener('click', () => {
            this.loadAlarms();
        });
    }

    switchTab(tabName) {
        this.activeTab = tabName;
        
        // Update tab buttons
        this.tabButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.tab === tabName);
        });
        
        // Update tab content
        this.tabContents.forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}Tab`);
        });
        
        // Load tab-specific data
        if (tabName === 'alarms') {
            this.loadAlarms();
        }
    }

    async loadSettings() {
        try {
            const result = await chrome.storage.sync.get(['alertTime', 'enableNotifications', 'autoRefresh']);
            
            this.settings = {
                alertTime: result.alertTime || 5,
                enableNotifications: result.enableNotifications !== false,
                autoRefresh: result.autoRefresh !== false
            };
            
            // Update UI
            this.alertTimeInput.value = this.settings.alertTime;
            this.enableNotificationsInput.checked = this.settings.enableNotifications;
            this.autoRefreshInput.checked = this.settings.autoRefresh;
            
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    async saveSettings() {
        try {
            const alertTime = parseInt(this.alertTimeInput.value);
            
            if (isNaN(alertTime) || alertTime < 1 || alertTime > 60) {
                this.showMessage('Please enter a valid alert time (1-60 minutes)', 'error');
                return;
            }
            
            this.settings = {
                alertTime: alertTime,
                enableNotifications: this.enableNotificationsInput.checked,
                autoRefresh: this.autoRefreshInput.checked
            };
            
            await chrome.storage.sync.set(this.settings);
            
            // If we have a current schedule, refresh alarms with new settings
            if (this.currentSchedule) {
                this.sendScheduleToBackground();
            }
            
            this.showMessage('Settings saved successfully!', 'success');
            
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showMessage('Error saving settings', 'error');
        }
    }

    async loadSchedule() {
        try {
            this.updateStatus('loading', 'Loading schedule...');
            
            const result = await chrome.storage.local.get(['currentSchedule', 'lastExtraction']);
            
            if (result.currentSchedule) {
                this.currentSchedule = result.currentSchedule;
                this.displaySchedule();
                this.updateStatus('success', 'Schedule loaded');
                
                if (result.lastExtraction) {
                    const lastUpdate = new Date(result.lastExtraction);
                    this.lastUpdated.textContent = `Last updated: ${this.formatRelativeTime(lastUpdate)}`;
                }
            } else {
                this.displayNoSchedule();
                this.updateStatus('warning', 'No schedule found');
                this.lastUpdated.textContent = 'Last updated: Never';
            }
            
        } catch (error) {
            console.error('Error loading schedule:', error);
            this.updateStatus('error', 'Error loading schedule');
            this.displayNoSchedule();
        }
    }

    displaySchedule() {
        if (!this.currentSchedule || !this.currentSchedule.schedule) {
            this.displayNoSchedule();
            return;
        }

        const { schedule, timezone, date } = this.currentSchedule;
        
        // Update header info
        this.scheduleDate.textContent = date || 'Today';
        this.scheduleTimezone.textContent = timezone || 'CST';
        
        // Clear and populate schedule list
        this.scheduleList.innerHTML = '';
        this.noSchedule.style.display = 'none';
        
        if (schedule.length === 0) {
            this.displayNoSchedule();
            return;
        }
        
        schedule.forEach((event, index) => {
            const scheduleItem = this.createScheduleItem(event, index);
            this.scheduleList.appendChild(scheduleItem);
        });
    }

    createScheduleItem(event, index) {
        const item = document.createElement('div');
        item.className = `schedule-item ${event.type || 'activity'} ${!event.startTime ? 'no-time' : ''}`;
        
        const timeText = event.startTime ? 
            this.formatTime(new Date(event.startTime)) : 
            'Time not available';
        
        const relativeTime = event.startTime ? 
            this.getRelativeTime(new Date(event.startTime)) : 
            '';
        
        item.innerHTML = `
            <div class="item-header">
                <div class="item-name">${this.escapeHtml(event.name)}</div>
                <div class="item-time">${timeText}</div>
            </div>
            ${event.description ? `<div class="item-description">${this.escapeHtml(event.description)}</div>` : ''}
            <div class="item-type ${event.type || 'activity'}">${event.type || 'activity'}</div>
            ${relativeTime ? `<div class="relative-time">${relativeTime}</div>` : ''}
        `;
        
        return item;
    }

    displayNoSchedule() {
        this.scheduleList.innerHTML = '';
        this.noSchedule.style.display = 'block';
        this.scheduleDate.textContent = 'No Schedule';
        this.scheduleTimezone.textContent = '';
    }

    async refreshSchedule() {
        try {
            this.refreshButton.disabled = true;
            this.updateStatus('loading', 'Refreshing...');
            
            // Send message to content script to refresh
            const tabs = await chrome.tabs.query({ url: '*://app.assembledhq.com/*' });
            
            if (tabs.length === 0) {
                this.showMessage('Please open Assembled page first', 'warning');
                this.updateStatus('warning', 'Assembled page not found');
                this.refreshButton.disabled = false;
                return;
            }
            
            // Send refresh message to content script
            const response = await chrome.tabs.sendMessage(tabs[0].id, { type: 'refreshSchedule' });
            
            // Wait a moment for extraction to complete
            setTimeout(() => {
                this.loadSchedule();
                this.refreshButton.disabled = false;
            }, 1000);
            
        } catch (error) {
            console.error('Error refreshing schedule:', error);
            this.showMessage('Error refreshing schedule', 'error');
            this.updateStatus('error', 'Refresh failed');
            this.refreshButton.disabled = false;
        }
    }

    async sendScheduleToBackground() {
        if (!this.currentSchedule) return;
        
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'scheduleUpdate',
                ...this.currentSchedule,
                alertTime: this.settings.alertTime
            });
            
            if (response && response.alarmsSet !== undefined) {
                this.showMessage(`${response.alarmsSet} alarms set`, 'success');
            }
        } catch (error) {
            console.error('Error sending schedule to background:', error);
        }
    }

    async loadAlarms() {
        try {
            const response = await chrome.runtime.sendMessage({ type: 'getAlarmStatus' });
            
            if (response) {
                this.alarmCount.textContent = `${response.activeAlarms} active`;
                this.displayAlarms(response.alarms || []);
            }
        } catch (error) {
            console.error('Error loading alarms:', error);
            this.alarmCount.textContent = '0 active';
            this.alarmsList.innerHTML = '<div class="no-alarms">Unable to load alarms</div>';
        }
    }

    displayAlarms(alarms) {
        this.alarmsList.innerHTML = '';
        
        if (alarms.length === 0) {
            this.alarmsList.innerHTML = '<div class="no-alarms">No active alarms</div>';
            return;
        }
        
        alarms.forEach(alarm => {
            const alarmItem = document.createElement('div');
            alarmItem.className = 'alarm-item';
            
            const alarmName = alarm.name.replace(/_\d+$/, ''); // Remove index suffix
            const scheduledTime = new Date(alarm.scheduledTime);
            
            alarmItem.innerHTML = `
                <div class="alarm-name">${this.escapeHtml(alarmName)}</div>
                <div class="alarm-time">${this.formatTime(scheduledTime)}</div>
            `;
            
            this.alarmsList.appendChild(alarmItem);
        });
    }

    async clearAllAlarms() {
        try {
            await chrome.alarms.clearAll();
            this.loadAlarms();
            this.showMessage('All alarms cleared', 'success');
        } catch (error) {
            console.error('Error clearing alarms:', error);
            this.showMessage('Error clearing alarms', 'error');
        }
    }

    openAssembledPage() {
        chrome.tabs.create({ url: 'https://app.assembledhq.com/' });
        window.close();
    }

    updateStatus(type, message) {
        this.statusDot.className = `status-dot ${type}`;
        this.statusText.textContent = message;
    }

    showMessage(message, type = 'info') {
        // Simple message display - could be enhanced with a toast system
        const existingMessage = document.querySelector('.message');
        if (existingMessage) existingMessage.remove();
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = message;
        messageDiv.style.cssText = `
            position: fixed;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'error' ? '#f44336' : type === 'warning' ? '#ff9800' : '#4caf50'};
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 1000;
        `;
        
        document.body.appendChild(messageDiv);
        
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 3000);
    }

    formatTime(date) {
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }

    formatRelativeTime(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return date.toLocaleDateString();
    }

    getRelativeTime(date) {
        const now = new Date();
        const diffMs = date - now;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        
        if (diffMs < 0) return 'Past';
        if (diffMins < 60) return `in ${diffMins}m`;
        if (diffHours < 24) return `in ${diffHours}h`;
        
        return 'Future';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ScheduleNotifierPopup();
});