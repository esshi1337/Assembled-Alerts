// This script extracts schedule data from the Assembled page and sends it to the background script.
// Note: Due to the page's structure, precise start/end times for individual events
// are not available in a text-based format. This script infers the full shift's
// start/end times from the "shift pattern" text and extracts activity names.

function getSchedule() {
  const schedule = [];
  const timezoneElement = document.querySelector('._timeZoneDetails_QLRw6');
  const timezone = timezoneElement ? timezoneElement.textContent.trim() : 'America/Mexico_City (CST)';

  const dayLabel = document.querySelector('._container_FInZ0._standardRow_JBvQE ._label_xYwxd');
  const dayText = dayLabel ? dayLabel.textContent.trim().split(' ')[1] : '';

  const today = new Date();
  let currentYear = today.getFullYear();
  if (dayText) {
    const [month, day] = dayText.split('/').map(Number);
    // Adjust year if the date is in the next year (e.g., today is Dec 30, event is Jan 5)
    if (month < today.getMonth() + 1) {
      currentYear++;
    }
  }
  
  // Extracting shift start and end time from the text
  const shiftSummaryElement = document.querySelector('._shiftSummaryTrigger_Q50a_ ._span_qfND4');
  if (shiftSummaryElement) {
      const shiftText = shiftSummaryElement.textContent.trim();
      const timeMatch = shiftText.match(/(\d{1,2}:\d{2}(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}(?:AM|PM))/i);

      if (timeMatch) {
          const shiftStart = timeMatch[1];
          const shiftEnd = timeMatch[2];

          // Create date objects for the shift boundaries
          const shiftStartDate = new Date(`${currentYear}/${dayText} ${shiftStart}`);
          const shiftEndDate = new Date(`${currentYear}/${dayText} ${shiftEnd}`);

          // Add shift start and end to the schedule
          schedule.push({ name: 'Start of Shift', startTime: shiftStartDate.toISOString() });
          schedule.push({ name: 'End of Shift', startTime: shiftEndDate.toISOString() });
      }
  }

  // Fallback to push event names without times if no shift summary is found
  const eventBlocks = document.querySelectorAll('.events-timeline-block span');
  eventBlocks.forEach(block => {
    schedule.push({ name: block.textContent.trim(), startTime: null });
  });

  return { schedule, timezone };
}

chrome.storage.sync.get('alertTime', ({ alertTime }) => {
  const { schedule, timezone } = getSchedule();
  if (schedule.length > 0) {
    chrome.runtime.sendMessage({
      type: 'scheduleUpdate',
      schedule,
      timezone,
      alertTime: alertTime || 5
    });
  }
});