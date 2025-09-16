chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'scheduleUpdate') {
    const { schedule, timezone } = message;
    const alertTime = message.alertTime; // User-configured time in minutes

    // Clear existing alarms to avoid duplicates
    chrome.alarms.clearAll();

    // Iterate through the schedule and set alarms for each event
    schedule.forEach(event => {
      const now = new Date();
      const startTime = new Date(event.startTime);
      const delayInMinutes = (startTime.getTime() - now.getTime()) / (1000 * 60) - alertTime;

      if (delayInMinutes > 0) {
        chrome.alarms.create(event.name, { delayInMinutes: delayInMinutes });
      }
    });

    sendResponse({ status: 'Alarms set successfully.' });
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  chrome.notifications.create('', {
    type: 'basic',
    iconUrl: 'images/icon48.png',
    title: 'Upcoming Schedule Change!',
    message: `Your next activity, "${alarm.name}", is starting in ${alertTime} minutes.`
  });
});