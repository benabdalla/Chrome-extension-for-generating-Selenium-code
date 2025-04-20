(function() {
  let isRecording = false;
  
  console.log("[Selenium Recorder] Content script loaded and ready");
  
  // Immediately announce presence to any listeners
  chrome.runtime.sendMessage({ action: 'contentScriptReady' }, function(response) {
    // Ignore any errors here - just announcing presence
    console.log("[Selenium Recorder] Content script announced readiness");
  });
  
  // Listen for messages from popup
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log("[Selenium Recorder] Content script received message:", request);
    
    if (request.action === 'startRecording') {
      console.log("[Selenium Recorder] Starting recording session");
      isRecording = true;
      
      // Record the initial navigation
      recordAction({
        type: 'navigation',
        url: request.url || window.location.href
      });
      
      installListeners();
      sendResponse({ status: "recording_started", success: true });
      console.log("[Selenium Recorder] Recording started successfully");
    } else if (request.action === 'stopRecording') {
      console.log("[Selenium Recorder] Stopping recording session");
      isRecording = false;
      removeListeners();
      sendResponse({ status: "recording_stopped", success: true });
      console.log("[Selenium Recorder] Recording stopped successfully");
    } else if (request.action === 'checkStatus') {
      console.log("[Selenium Recorder] Status check received");
      sendResponse({ 
        status: isRecording ? "recording" : "idle",
        url: window.location.href
      });
    }
    return true; // Required for async response
  });
  
  // Check if recording was already in progress when page loaded
  chrome.storage.local.get('recording', function(data) {
    console.log("[Selenium Recorder] Checking storage for recording status:", data);
    if (data.recording) {
      console.log("[Selenium Recorder] Recording was in progress, resuming");
      isRecording = true;
      installListeners();
      
      // Record navigation event for this page
      recordAction({
        type: 'navigation',
        url: window.location.href
      });
    }
  });
  
  function installListeners() {
    // Remove any existing listeners first to avoid duplicates
    removeListeners();
    
    document.addEventListener('click', handleClick, true);
    document.addEventListener('change', handleChange, true);
    document.addEventListener('submit', handleSubmit, true);
    document.addEventListener('keydown', handleKeydown, true);
    console.log("[Selenium Recorder] Event listeners installed");
  }
  
  function removeListeners() {
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('change', handleChange, true);
    document.removeEventListener('submit', handleSubmit, true);
    document.removeEventListener('keydown', handleKeydown, true);
    console.log("[Selenium Recorder] Event listeners removed");
  }
  
  function recordAction(action) {
    if (!isRecording) return;
    
    console.log("[Selenium Recorder] Recording action:", action);
    
    // Add timestamp and URL
    action.timestamp = Date.now();
    action.url = action.url || window.location.href;
    
    chrome.storage.local.get('actions', function(data) {
      let actions = data.actions || [];
      actions.push(action);
      chrome.storage.local.set({ actions: actions }, function() {
        if (chrome.runtime.lastError) {
          console.error("[Selenium Recorder] Error storing action:", chrome.runtime.lastError);
        } else {
          console.log("[Selenium Recorder] Action stored successfully");
        }
      });
    });
  }
  
  function getSelector(element) {
    if (!element) return { type: 'unknown', value: 'unknown' };
    
    // Try to get id
    if (element.id) {
      return { type: 'id', value: element.id };
    }
    
    // Try to get name
    if (element.name) {
      return { type: 'name', value: element.name };
    }
    
    // Try to use link text for anchor tags
    if (element.tagName === 'A' && element.textContent.trim()) {
      return { type: 'linkText', value: element.textContent.trim() };
    }
    
    // Try to use button text
    if (element.tagName === 'BUTTON' && element.textContent.trim()) {
      return { type: 'buttonText', value: element.textContent.trim() };
    }
    
    // Use xpath as fallback
    return { type: 'xpath', value: getXPath(element) };
  }
  
  function getXPath(element) {
    if (!element) return '';
    if (element === document.body) return '/html/body';
    
    let ix = 0;
    let siblings = element.parentNode.childNodes;
    
    for (let i = 0; i < siblings.length; i++) {
      let sibling = siblings[i];
      if (sibling === element) {
        return getXPath(element.parentNode) + '/' + element.tagName.toLowerCase() + '[' + (ix + 1) + ']';
      }
      if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
        ix++;
      }
    }
    return ''; // Fallback
  }
  
  function handleClick(event) {
    if (!isRecording) return;
    
    console.log("[Selenium Recorder] Click event detected");
    
    try {
      const element = event.target;
      
      // Skip if the click is on the extension's own UI
      if (element.closest('[data-selenium-recorder]')) {
        return;
      }
      
      // Handle clicks on checkboxes and radio buttons separately
      if (element.tagName === 'INPUT' && (element.type === 'checkbox' || element.type === 'radio')) {
        return; // These are handled by handleChange
      }
      
      const selector = getSelector(element);
      
      recordAction({
        type: 'click',
        selector: selector,
        elementType: element.tagName.toLowerCase()
      });
    } catch (err) {
      console.error("[Selenium Recorder] Error in click handler:", err);
    }
  }
  
  function handleChange(event) {
    if (!isRecording) return;
    
    console.log("[Selenium Recorder] Change event detected");
    
    try {
      const element = event.target;
      const selector = getSelector(element);
      
      // Handle different input types
      if (element.tagName === 'INPUT') {
        if (element.type === 'checkbox' || element.type === 'radio') {
          recordAction({
            type: element.type,
            selector: selector,
            checked: element.checked
          });
        } else if (element.type === 'text' || element.type === 'password' || element.type === 'email' || element.type === 'number') {
          recordAction({
            type: 'input',
            selector: selector,
            value: element.value,
            inputType: element.type
          });
        }
      } else if (element.tagName === 'SELECT') {
        recordAction({
          type: 'select',
          selector: selector,
          value: element.value
        });
      } else if (element.tagName === 'TEXTAREA') {
        recordAction({
          type: 'textarea',
          selector: selector,
          value: element.value
        });
      }
    } catch (err) {
      console.error("[Selenium Recorder] Error in change handler:", err);
    }
  }
  
  function handleSubmit(event) {
    if (!isRecording) return;
    
    console.log("[Selenium Recorder] Submit event detected");
    
    try {
      const form = event.target;
      const selector = getSelector(form);
      
      recordAction({
        type: 'submit',
        selector: selector
      });
    } catch (err) {
      console.error("[Selenium Recorder] Error in submit handler:", err);
    }
  }
  
  function handleKeydown(event) {
    if (!isRecording) return;
    
    // Only record Enter key presses
    if (event.key === 'Enter') {
      console.log("[Selenium Recorder] Enter key event detected");
      
      try {
        const element = event.target;
        const selector = getSelector(element);
        
        // Don't record if it's a form element as the submit event will capture this
        if (element.form) return;
        
        recordAction({
          type: 'keypress',
          key: 'Enter',
          selector: selector,
          elementType: element.tagName.toLowerCase()
        });
      } catch (err) {
        console.error("[Selenium Recorder] Error in keydown handler:", err);
      }
    }
  }
  
  console.log("[Selenium Recorder] Content script initialized");
})();
