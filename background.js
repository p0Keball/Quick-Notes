// Auto mở sidebar khi browser start
chrome.runtime.onStartup.addListener(() => {
  chrome.sidePanel.setOptions({ enabled: true });
});

// Auto mở sidebar khi extension được cài đặt
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setOptions({ enabled: true });
});

// Mở sidebar khi click vào icon extension
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});
