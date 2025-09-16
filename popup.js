document.addEventListener('DOMContentLoaded', () => {
  const alertTimeInput = document.getElementById('alertTime');
  const saveButton = document.getElementById('saveButton');

  // Load saved settings
  chrome.storage.sync.get('alertTime', ({ alertTime }) => {
    if (alertTime) {
      alertTimeInput.value = alertTime;
    }
  });

  // Save settings
  saveButton.addEventListener('click', () => {
    const time = parseInt(alertTimeInput.value, 10);
    if (!isNaN(time) && time > 0) {
      chrome.storage.sync.set({ alertTime: time }, () => {
        alert('Settings saved!');
      });
    } else {
      alert('Please enter a valid positive number.');
    }
  });
});