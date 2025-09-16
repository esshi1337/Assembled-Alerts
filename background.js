// Background script for handling alarms and notifications
let currentAlertTime = 5; // Default alert time

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'scheduleUpdate') {
    const { schedule, timezone, alertTime = 5 } = message;
    currentAlertTime = alertTime;

    console.log('Background: Received schedule update', schedule);

    // Clear existing alarms to avoid duplicates
    chrome.alarms.clearAll();

    const now = new Date();
    let alarmsSet = 0;

    // Create alarms for events with valid start times
    schedule.forEach((event, index) => {
      if (!event.startTime) return;

      const startTime = new Date(event.startTime);
      const alertTime = new Date(startTime.getTime() - (currentAlertTime * 60 * 1000));
      const delayInMinutes = (alertTime.getTime() - now.getTime()) / (1000 * 60);

      // Only set alarm if it's in the future
      if (delayInMinutes > 0) {
        const alarmName = `${event.name}_${index}`;
        chrome.alarms.create(alarmName, { delayInMinutes: delayInMinutes });
        alarmsSet++;
        
        console.log(`Alarm set for "${event.name}" in ${delayInMinutes.toFixed(1)} minutes`);
      }
    });

    // Store schedule data for alarm reference
    chrome.storage.local.set({
      scheduleForAlarms: schedule,
      alertTime: currentAlertTime,
      alarmsSet: alarmsSet
    });

    sendResponse({ 
      status: 'success',
      alarmsSet: alarmsSet,
      message: `${alarmsSet} alarms set successfully.` 
    });
  }
  
  if (message.type === 'getAlarmStatus') {
    chrome.alarms.getAll((alarms) => {
      sendResponse({
        activeAlarms: alarms.length,
        alarms: alarms.map(alarm => ({
          name: alarm.name,
          scheduledTime: new Date(alarm.scheduledTime)
        }))
      });
    });
    return true; // Keep message channel open for async response
  }
});

// Handle alarm notifications
chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log('Alarm triggered:', alarm.name);
  
  // Get stored schedule data
  const result = await chrome.storage.local.get(['scheduleForAlarms', 'alertTime']);
  const schedule = result.scheduleForAlarms || [];
  const alertMinutes = result.alertTime || 5;
  
  // Find the event that triggered this alarm
  const eventIndex = alarm.name.split('_').pop();
  const event = schedule[parseInt(eventIndex)];
  
  if (event) {
    const startTime = new Date(event.startTime);
    const now = new Date();
    const minutesUntil = Math.round((startTime.getTime() - now.getTime()) / (1000 * 60));
    
    // Create notification
    chrome.notifications.create(alarm.name, {
      type: 'basic',
      iconUrl: 'images/icon48.png',
      title: 'Upcoming Schedule Event',
      message: `"${event.name}" ${minutesUntil > 0 ? `starts in ${minutesUntil} minutes` : 'is starting now'}`,
      contextMessage: event.description || 'Assembled Schedule Reminder',
      priority: 2
    });
    
    // Optional: Play sound or create additional alerts
    console.log(`Notification sent for: ${event.name}`);
  }
});

// Handle notification clicks
chrome.notifications.onClicked.addListener((notificationId) => {
  // Close the notification
  chrome.notifications.clear(notificationId);
  
  // Optional: Open Assembled page
  chrome.tabs.query({ url: '*://app.assembledhq.com/*' }, (tabs) => {
    if (tabs.length > 0) {
      chrome.tabs.update(tabs[0].id, { active: true });
      chrome.windows.update(tabs[0].windowId, { focused: true });
    } else {
      chrome.tabs.create({ url: 'https://app.assembledhq.com/' });
    }
  });
});

// Clean up old alarms periodically
chrome.alarms.create('cleanup', { periodInMinutes: 60 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cleanup') {
    chrome.alarms.getAll((alarms) => {
      const now = Date.now();
      alarms.forEach((alarm) => {
        if (alarm.scheduledTime < now && alarm.name !== 'cleanup') {
          chrome.alarms.clear(alarm.name);
        }
      });
    });
  }
});