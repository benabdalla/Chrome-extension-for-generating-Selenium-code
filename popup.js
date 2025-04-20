document.addEventListener('DOMContentLoaded', function() {
  const startButton = document.getElementById('startRecording');
  const stopButton = document.getElementById('stopRecording');
  const downloadButton = document.getElementById('downloadCode');
  const clearButton = document.getElementById('clearRecording');
  const statusDiv = document.getElementById('status');
  
  console.log("[Selenium Recorder] Popup initialized");
  
  // First check if content script is active in current tab
  function checkContentScriptStatus() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (!tabs || !tabs[0]) {
        updateStatus('Error: Cannot access current tab', 'error');
        disableButtons();
        return;
      }
      
      try {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'checkStatus' }, function(response) {
          if (chrome.runtime.lastError) {
            console.log('[Selenium Recorder] Content script not ready:', chrome.runtime.lastError.message);
            updateStatus('Content script not ready. Trying to inject...', 'warning');
            injectContentScript(tabs[0].id);
            return;
          }
          
          if (response && response.status) {
            console.log('[Selenium Recorder] Content script status:', response.status);
            
            if (response.status === 'recording') {
              updateStatus('Recording in progress...', 'recording');
              startButton.disabled = true;
              stopButton.disabled = false;
              clearButton.disabled = true;
              downloadButton.disabled = true;
            } else {
              // Check if we have recorded actions
              chrome.storage.local.get('actions', function(data) {
                if (data.actions && data.actions.length > 0) {
                  downloadButton.disabled = false;
                  clearButton.disabled = false;
                  updateStatus('Ready to record (actions available)', 'ready');
                } else {
                  updateStatus('Ready to record', 'ready');
                }
              });
            }
          }
        });
      } catch (e) {
        console.error('[Selenium Recorder] Error checking content script status:', e);
        updateStatus('Error: ' + e.message, 'error');
      }
    });
  }
  
  function injectContentScript(tabId) {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    }, function() {
      if (chrome.runtime.lastError) {
        console.error('[Selenium Recorder] Error injecting content script:', chrome.runtime.lastError);
        updateStatus('Error: Could not inject content script. Make sure you are on a web page.', 'error');
        disableButtons();
      } else {
        console.log('[Selenium Recorder] Content script injected successfully');
        updateStatus('Content script injected. Ready to record.', 'ready');
        setTimeout(checkContentScriptStatus, 1000); // Check again after a delay
      }
    });
  }
  
  function updateStatus(message, className) {
    statusDiv.textContent = message;
    statusDiv.className = className || '';
    console.log('[Selenium Recorder] Status update:', message);
  }
  
  function disableButtons() {
    startButton.disabled = true;
    stopButton.disabled = true;
    downloadButton.disabled = true;
    clearButton.disabled = true;
  }
  
  // Check if we're allowed to record on this page
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (!tabs || !tabs[0]) {
      updateStatus('Error: Cannot access current tab', 'error');
      disableButtons();
      return;
    }
    
    const currentUrl = tabs[0].url;
    console.log('[Selenium Recorder] Current URL:', currentUrl);
    
    // Check if we're on a valid page (not chrome:// or extension page)
    if (currentUrl.startsWith('chrome://') || currentUrl.startsWith('chrome-extension://')) {
      updateStatus('Recording not allowed on this page. Please navigate to a website.', 'error');
      disableButtons();
      return;
    }
    
    // Check content script status after validating the URL
    checkContentScriptStatus();
  });
  
  // Check if recording is already in progress
  chrome.storage.local.get(['recording', 'actions'], function(data) {
    console.log('[Selenium Recorder] Storage data:', data);
    
    if (data.recording) {
      startButton.disabled = true;
      stopButton.disabled = false;
      clearButton.disabled = true;
      downloadButton.disabled = true;
      updateStatus('Recording in progress...', 'recording');
    } else if (data.actions && data.actions.length > 0) {
      downloadButton.disabled = false;
      clearButton.disabled = false;
    }
  });
  
  startButton.addEventListener('click', function() {
    console.log('[Selenium Recorder] Start button clicked');
    
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (!tabs || !tabs[0]) {
        updateStatus('Error: Cannot access current tab', 'error');
        return;
      }
      
      const tabId = tabs[0].id;
      const url = tabs[0].url;
      
      // Reset actions and set recording state
      chrome.storage.local.set({ recording: true, actions: [] }, function() {
        if (chrome.runtime.lastError) {
          console.error('[Selenium Recorder] Error setting storage:', chrome.runtime.lastError);
          updateStatus('Error: ' + chrome.runtime.lastError.message, 'error');
          return;
        }
        
        console.log('[Selenium Recorder] Storage updated, sending message to tab:', tabId);
        
        // Try to send message to content script
        try {
          chrome.tabs.sendMessage(tabId, { action: 'startRecording', url: url }, function(response) {
            if (chrome.runtime.lastError) {
              console.error('[Selenium Recorder] Error sending message:', chrome.runtime.lastError);
              updateStatus('Error: Content script not responding. Trying to inject...', 'error');
              
              // Inject content script and then try again
              injectContentScript(tabId);
              setTimeout(function() {
                chrome.tabs.sendMessage(tabId, { action: 'startRecording', url: url }, function(secondResponse) {
                  if (chrome.runtime.lastError) {
                    console.error('[Selenium Recorder] Second attempt failed:', chrome.runtime.lastError);
                    updateStatus('Error: Could not start recording. Please refresh the page.', 'error');
                    chrome.storage.local.set({ recording: false });
                  } else {
                    console.log('[Selenium Recorder] Second attempt succeeded:', secondResponse);
                    startButton.disabled = true;
                    stopButton.disabled = false;
                    clearButton.disabled = true;
                    downloadButton.disabled = true;
                    updateStatus('Recording in progress...', 'recording');
                  }
                });
              }, 1000);
              return;
            }
            
            console.log('[Selenium Recorder] Response from content script:', response);
            if (response && response.success) {
              startButton.disabled = true;
              stopButton.disabled = false;
              clearButton.disabled = true;
              downloadButton.disabled = true;
              updateStatus('Recording in progress...', 'recording');
            } else {
              updateStatus('Error: Failed to start recording', 'error');
              chrome.storage.local.set({ recording: false });
            }
          });
        } catch (e) {
          console.error('[Selenium Recorder] Exception sending message:', e);
          updateStatus('Error: ' + e.message, 'error');
          chrome.storage.local.set({ recording: false });
        }
      });
    });
  });
  
  stopButton.addEventListener('click', function() {
    console.log('[Selenium Recorder] Stop button clicked');
    
    chrome.storage.local.set({ recording: false }, function() {
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs && tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'stopRecording' }, function(response) {
            if (chrome.runtime.lastError) {
              console.error('[Selenium Recorder] Error stopping recording:', chrome.runtime.lastError);
            }
            
            chrome.storage.local.get('actions', function(data) {
              if (data.actions && data.actions.length > 0) {
                startButton.disabled = false;
                stopButton.disabled = true;
                downloadButton.disabled = false;
                clearButton.disabled = false;
                updateStatus('Recording stopped. ' + data.actions.length + ' actions recorded.', 'stopped');
              } else {
                startButton.disabled = false;
                stopButton.disabled = true;
                downloadButton.disabled = true;
                clearButton.disabled = true;
                updateStatus('Recording stopped. No actions recorded.', 'stopped');
              }
            });
          });
        }
      });
    });
  });
  
  downloadButton.addEventListener('click', function() {
    console.log('[Selenium Recorder] Download button clicked');
    
    chrome.storage.local.get('actions', function(data) {
      if (data.actions && data.actions.length > 0) {
        updateStatus('Generating Java code...', 'processing');
        
        chrome.runtime.sendMessage({ 
          action: 'generateJavaCode',
          actions: data.actions
        }, function(response) {
          if (chrome.runtime.lastError) {
            console.error('[Selenium Recorder] Error generating code:', chrome.runtime.lastError);
            updateStatus('Error generating code: ' + chrome.runtime.lastError.message, 'error');
          } else {
            updateStatus('Java code downloaded!', 'success');
          }
        });
      } else {
        updateStatus('No actions recorded', 'warning');
      }
    });
  });
  
  clearButton.addEventListener('click', function() {
    console.log('[Selenium Recorder] Clear button clicked');
    
    chrome.storage.local.set({ actions: [] }, function() {
      if (chrome.runtime.lastError) {
        console.error('[Selenium Recorder] Error clearing actions:', chrome.runtime.lastError);
        updateStatus('Error: ' + chrome.runtime.lastError.message, 'error');
      } else {
        downloadButton.disabled = true;
        clearButton.disabled = true;
        updateStatus('Recording cleared', 'ready');
      }
    });
  });
  
  console.log('[Selenium Recorder] Popup initialization complete');
});

