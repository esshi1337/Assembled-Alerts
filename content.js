// Fixed content script with correct DOM selectors for current Assembled interface
function getSchedule() {
  console.log('🔍 Starting schedule extraction...');
  const schedule = [];
  
  // Get timezone information - Updated selector
  const timezoneElement = document.querySelector('._timezoneLong_FfWSu') || 
                         document.querySelector('[class*="timezone"]') ||
                         document.querySelector('[class*="TimeZone"]');
  
  let timezone = 'America/Mexico_City (CST)'; // Default
  if (timezoneElement) {
    timezone = timezoneElement.textContent.trim();
    console.log('✅ Found timezone:', timezone);
  } else {
    console.log('⚠️ Timezone element not found, using default');
  }

  // Get date information - Updated selector  
  const dayLabel = document.querySelector('._container_FInZ0._standardRow_JBvQE ._label_xYwxd') ||
                  document.querySelector('._labelBackground_DSj1x') ||
                  document.querySelector('[class*="DatePicker"]') ||
                  document.querySelector('span:contains("Tue, Sep 16, 2025")');
  
  let targetDate = new Date();
  let dayText = '';
  
  if (dayLabel) {
    dayText = dayLabel.textContent.trim();
    console.log('✅ Found date element:', dayText);
    
    // Extract date from formats like "Tue, Sep 16, 2025" or "9/16"
    const fullDateMatch = dayText.match(/\w+,\s*(\w+)\s*(\d{1,2}),\s*(\d{4})/);
    const shortDateMatch = dayText.match(/(\d{1,2})\/(\d{1,2})/);
    
    if (fullDateMatch) {
      const [, month, day, year] = fullDateMatch;
      const monthNum = new Date(Date.parse(month + " 1, 2000")).getMonth();
      targetDate = new Date(parseInt(year), monthNum, parseInt(day));
    } else if (shortDateMatch) {
      const [, month, day] = shortDateMatch;
      const currentYear = new Date().getFullYear();
      targetDate = new Date(currentYear, parseInt(month) - 1, parseInt(day));
      
      // Handle year rollover
      if (targetDate < new Date() && Math.abs(targetDate - new Date()) > 30 * 24 * 60 * 60 * 1000) {
        targetDate.setFullYear(currentYear + 1);
      }
    }
  } else {
    console.log('⚠️ Date element not found, using today');
  }

  console.log('📅 Target date:', targetDate.toDateString());

  // Extract hour timeline for time mapping
  const hourElements = document.querySelectorAll('.hours-timeline-cell, [class*="hours-timeline"]');
  const timeMap = new Map();
  
  console.log(`⏰ Found ${hourElements.length} hour elements`);
  
  // Map hour positions to actual times
  hourElements.forEach((hourEl, index) => {
    const rect = hourEl.getBoundingClientRect();
    const hour = index; // Hours are sequential from 0
    timeMap.set(rect.left, hour);
  });

  // Extract schedule events from timeline blocks
  const eventBlocks = document.querySelectorAll('.events-timeline-block, [class*="events-timeline"]');
  console.log(`📋 Found ${eventBlocks.length} event blocks`);

  eventBlocks.forEach((block, blockIndex) => {
    const eventSpans = block.querySelectorAll('span');
    console.log(`📋 Block ${blockIndex}: Found ${eventSpans.length} event spans`);
    
    eventSpans.forEach((span, spanIndex) => {
      const eventName = span.textContent.trim();
      if (eventName && eventName.length > 1 && eventName !== 'Break' && eventName !== 'Lunch') {
        
        // Try to determine time based on position
        const spanRect = span.getBoundingClientRect();
        let estimatedHour = null;
        let closestDistance = Infinity;
        
        // Find closest hour marker
        for (const [leftPos, hour] of timeMap) {
          const distance = Math.abs(spanRect.left - leftPos);
          if (distance < closestDistance) {
            closestDistance = distance;
            estimatedHour = hour;
          }
        }
        
        let eventDateTime = null;
        if (estimatedHour !== null) {
          eventDateTime = new Date(targetDate);
          eventDateTime.setHours(estimatedHour, 0, 0, 0);
        }
        
        const event = {
          name: eventName,
          type: 'activity',
          startTime: eventDateTime ? eventDateTime.toISOString() : null,
          duration: 'Unknown',
          description: `Activity: ${eventName}${estimatedHour !== null ? ` at ${estimatedHour}:00` : ' (time estimated from position)'}`
        };
        
        schedule.push(event);
        console.log(`✅ Added event: ${eventName}${estimatedHour !== null ? ` at ${estimatedHour}:00` : ''}`);
      }
    });
  });

  // Look for time buttons/containers that show specific times
  const timeButtons = document.querySelectorAll('button[class*="_container_ltufp"], ._container_ltufp');
  console.log(`🕐 Found ${timeButtons.length} time containers`);

  timeButtons.forEach((timeBtn, index) => {
    const timeSpans = timeBtn.querySelectorAll('span');
    let hour = null;
    let period = null;
    
    timeSpans.forEach(span => {
      const text = span.textContent.trim();
      if (/^\d{1,2}$/.test(text)) {
        hour = parseInt(text);
      } else if (text === 'AM' || text === 'PM') {
        period = text;
      }
    });
    
    if (hour !== null && period) {
      // Convert to 24-hour format
      let hour24 = hour;
      if (period === 'PM' && hour !== 12) hour24 += 12;
      if (period === 'AM' && hour === 12) hour24 = 0;
      
      const timeDateTime = new Date(targetDate);
      timeDateTime.setHours(hour24, 0, 0, 0);
      
      // This represents a time marker, could be shift boundary
      const event = {
        name: `${hour}:00 ${period}`,
        type: 'time-marker',
        startTime: timeDateTime.toISOString(),
        duration: 'N/A',
        description: `Time marker: ${hour}:00 ${period}`
      };
      
      schedule.push(event);
      console.log(`🕐 Added time marker: ${hour}:00 ${period}`);
    }
  });

  // Look for any shift information in tooltips or other areas
  const tooltipContainers = document.querySelectorAll('[class*="Tooltip"], [data-testid*="Tooltip"]');
  console.log(`💡 Found ${tooltipContainers.length} tooltip containers`);
  
  tooltipContainers.forEach(tooltip => {
    const text = tooltip.textContent;
    const timeMatch = text.match(/(\d{1,2}:\d{2}(?:AM|PM))\s*[-–—]\s*(\d{1,2}:\d{2}(?:AM|PM))/i);
    
    if (timeMatch) {
      console.log(`📋 Found shift info in tooltip: ${timeMatch[0]}`);
      // Add shift start/end events
      // This would need the parseTime function from original code
    }
  });

  // Sort schedule by time
  const validTimeEvents = schedule.filter(event => event.startTime);
  const noTimeEvents = schedule.filter(event => !event.startTime);
  
  validTimeEvents.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  
  const finalSchedule = [...validTimeEvents, ...noTimeEvents];
  
  console.log(`📊 Extraction complete: ${finalSchedule.length} events found`);
  console.log('Events:', finalSchedule);

  return {
    schedule: finalSchedule,
    timezone: timezone,
    date: targetDate.toDateString(),
    lastUpdated: new Date().toISOString()
  };
}

// Helper function to parse time strings
function parseTime(timeStr) {
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return null;
  
  let [, hours, minutes, period] = match;
  hours = parseInt(hours);
  minutes = parseInt(minutes);
  
  if (period.toUpperCase() === 'PM' && hours !== 12) hours += 12;
  if (period.toUpperCase() === 'AM' && hours === 12) hours = 0;
  
  return { hours, minutes };
}

// Auto-extract schedule when page loads
function extractAndStoreSchedule() {
  console.log('🚀 Starting schedule extraction process...');
  
  // Add delay to ensure page is fully loaded
  setTimeout(() => {
    const scheduleData = getSchedule();
    
    if (scheduleData.schedule.length > 0) {
      // Store in Chrome storage for popup access
      chrome.storage.local.set({ 
        currentSchedule: scheduleData,
        lastExtraction: new Date().toISOString()
      }, () => {
        console.log('💾 Schedule data stored successfully');
      });
      
      // Send to background script for alarms
      chrome.storage.sync.get('alertTime', ({ alertTime }) => {
        chrome.runtime.sendMessage({
          type: 'scheduleUpdate',
          ...scheduleData,
          alertTime: alertTime || 5
        }, (response) => {
          console.log('📨 Message sent to background:', response);
        });
      });
      
      console.log('✅ Assembled Schedule Notifier: Schedule extracted successfully', scheduleData);
    } else {
      console.log('❌ No schedule data found');
      
      // Store empty result so popup knows extraction was attempted
      chrome.storage.local.set({ 
        currentSchedule: { schedule: [], timezone: '', date: '', lastUpdated: new Date().toISOString() },
        lastExtraction: new Date().toISOString()
      });
    }
  }, 2000); // 2 second delay to ensure dynamic content loads
}

// Run extraction when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', extractAndStoreSchedule);
} else {
  extractAndStoreSchedule();
}

// Re-extract when page content changes significantly
let extractionTimeout;
const observer = new MutationObserver((mutations) => {
  let shouldReExtract = false;
  
  mutations.forEach((mutation) => {
    if (mutation.type === 'childList') {
      const addedNodes = Array.from(mutation.addedNodes);
      if (addedNodes.some(node => 
        node.nodeType === Node.ELEMENT_NODE && 
        (node.className?.includes('timeline') || 
         node.className?.includes('event') ||
         node.className?.includes('DatePicker') ||
         node.className?.includes('hours'))
      )) {
        shouldReExtract = true;
      }
    }
  });
  
  if (shouldReExtract) {
    // Debounce the extraction
    clearTimeout(extractionTimeout);
    extractionTimeout = setTimeout(() => {
      console.log('🔄 Page content changed, re-extracting schedule...');
      extractAndStoreSchedule();
    }, 3000);
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Listen for manual refresh requests from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'refreshSchedule') {
    console.log('🔄 Manual refresh requested from popup');
    extractAndStoreSchedule();
    sendResponse({ status: 'Schedule refresh initiated' });
  }
});

console.log('🎯 Assembled Schedule Notifier content script loaded and ready');