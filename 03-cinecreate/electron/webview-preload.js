// Preload script for webview: intercept window.open and redirect to host
const { ipcRenderer } = require('electron');

// Override window.open before any page JS runs
window.open = function(url) {
  if (url && url !== 'about:blank') {
    ipcRenderer.sendToHost('open-tab', String(url));
  }
  return null;
};

// Capture link clicks with target=_blank
document.addEventListener('click', function(e) {
  const a = e.target.closest('a');
  if (a && a.target === '_blank' && a.href) {
    e.preventDefault();
    e.stopPropagation();
    ipcRenderer.sendToHost('open-tab', a.href);
  }
}, true);
