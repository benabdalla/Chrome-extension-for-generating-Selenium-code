chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  console.log("[Selenium Recorder] Background script received message:", request);

  if (request.action === 'generateJavaCode') {
    try {
      generateJavaCode(request.actions);
      sendResponse({ success: true });
    } catch (e) {
      console.error("[Selenium Recorder] Error generating Java code:", e);
      sendResponse({ success: false, error: e.message });
    }
    return true;
  } else if (request.action === 'contentScriptReady') {
    console.log("[Selenium Recorder] Content script reported ready");
    sendResponse({ acknowledged: true });
    return true;
  }
});

function escapeString(str) {
  return str
    .replace(/\\/g, '\\\\')   // échappe les backslashes
    .replace(/"/g, '\\"')     // échappe les guillemets doubles
    .replace(/\n/g, '\\n')    // échappe les sauts de ligne
    .replace(/\r/g, '\\r');   // échappe les retours chariot
}

function getLocatorCode(selector) {
  switch (selector.type) {
    case 'css':
      return `By.cssSelector("${escapeString(selector.value)}")`;
    case 'xpath':
      return `By.xpath("${escapeString(selector.value)}")`;
    case 'id':
      return `By.id("${escapeString(selector.value)}")`;
    case 'name':
      return `By.name("${escapeString(selector.value)}")`;
    case 'class':
      return `By.className("${escapeString(selector.value)}")`;
    default:
      return `By.cssSelector("${escapeString(selector.value)}")`; // fallback
  }
}



function generateJavaCode(actions) {

  let code = `public void runTest() {\n`;

  actions.forEach(action => {
    let selector = action.selector?.value || '';
    let type = action.selector?.type || 'id'; // fallback to id
    let by = '';

    switch (type) {
      case 'id':
        by = `By.id("${selector}")`;
        break;
      case 'name':
        by = `By.name("${selector}")`;
        break;
      case 'xpath':
        by = `By.xpath("${selector}")`;
        break;
      case 'css':
        by = `By.cssSelector("${selector}")`;
        break;
      default:
        by = `By.id("${selector}")`;
    }

    switch (action.type) {
      case 'navigation':
        code += `    driver.get("${action.url}");\n`;
        break;

      case 'click':
        code += `    driver.findElement(${by}).click();\n`;
        break;

      case 'input':
        code += `    driver.findElement(${by}).sendKeys("${action.value || ''}");\n`;
        break;

      case 'submit':
        code += `    driver.findElement(${by}).submit();\n`;
        break;

      case 'select':
        code += `    new Select(driver.findElement(${by})).selectByValue("${action.value}");\n`;
        break;

      default:
        code += `    // Unsupported action: ${action.type}\n`;
    }
  });

  code += `}`;
  return code;
}


/*

  if (!actions || actions.length === 0) {
    throw new Error("No actions to generate code from");
  }

  console.log("[Selenium Recorder] Generating Java code from", actions.length, "actions");

  let javaCode = `import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.Select;
import org.openqa.selenium.support.ui.WebDriverWait;
import java.time.Duration;


public class RecordedTest {
    private WebDriver driver;
    private WebDriverWait wait;
    
    public void setUp() {
        // Set the path to your ChromeDriver if needed
        // System.setProperty("webdriver.chrome.driver", "/path/to/chromedriver");
        
        ChromeOptions options = new ChromeOptions();
        // Add any desired options here
        // options.addArguments("--headless");
        
        driver = new ChromeDriver(options);
        wait = new WebDriverWait(driver, Duration.ofSeconds(10));
        
        // Set window size and position
        driver.manage().window().maximize();
    }
    
    public void runTest() {
`;

  // Process each action
  actions.forEach((action, index) => {
    javaCode += `        // Action ${index + 1}: ${action.type}\n`;
    javaCode += generateActionCode(action);
    javaCode += '\n';
  });

  javaCode += `    }
    
    

}
`;

  console.log("[Selenium Recorder] Java code generated successfully");

  try {
    // Use chrome.downloads API directly with data URL
    const encodedCode = encodeURIComponent(javaCode);
    chrome.downloads.download({
      url: 'data:text/java;charset=utf-8,' + encodedCode,
      filename: 'RecordedTest.java',
      saveAs: true
    }, function (downloadId) {
      if (chrome.runtime.lastError) {
        console.error("[Selenium Recorder] Download error:", chrome.runtime.lastError);
        throw new Error(chrome.runtime.lastError.message);
      }
      console.log("[Selenium Recorder] Download started with ID:", downloadId);
    });
  } catch (e) {
    console.error("[Selenium Recorder] Error initiating download:", e);
    throw e;
  }
}
*/
function generateActionCode(action) {
  let code = '';
  switch (action.type) {
    case 'navigation':
      code = `        // Navigate to URL\n`;
      code += `        driver.get("${escapeString(action.url)}");\n`;
      code += `        waitForPageLoad();\n`;
      break;

    case 'click':
      code = `        // Click on ${action.elementType || 'element'}\n`;
      code += `        waitForElement(${getLocatorCode(action.selector)}).click();\n`;
      break;

    case 'input':
      code = `        // Enter text in input field\n`;
      code += `        WebElement inputElement = waitForElement(${getLocatorCode(action.selector)});\n`;
      code += `        inputElement.clear();\n`;
      code += `        inputElement.sendKeys("${escapeString(action.value || '')}");\n`;
      break;

    case 'select':
      code = `        // Select option from dropdown\n`;
      code += `        WebElement selectElement = waitForElement(${getLocatorCode(action.selector)});\n`;
      code += `        new Select(selectElement).selectByValue("${escapeString(action.value || '')}");\n`;
      break;

    case 'textarea':
      code = `        // Enter text in textarea\n`;
      code += `        WebElement textareaElement = waitForElement(${getLocatorCode(action.selector)});\n`;
      code += `        textareaElement.clear();\n`;
      code += `        textareaElement.sendKeys("${escapeString(action.value || '')}");\n`;
      break;

    case 'checkbox':
    case 'radio':
      const actionVerb = action.checked ? 'Select' : 'Deselect';
      code = `        // ${actionVerb} ${action.type} button\n`;
      code += `        WebElement element = waitForElement(${getLocatorCode(action.selector)});\n`;
      code += `        if (element.isSelected() != ${action.checked}) {\n`;
      code += `            element.click();\n`;
      code += `        }\n`;
      break;

    case 'submit':
      code = `        // Submit form\n`;
      code += `        waitForElement(${getLocatorCode(action.selector)}).submit();\n`;
      code += `        waitForPageLoad();\n`;
      break;

    case 'keypress':
      if (action.key === 'Enter') {
        code = `        // Press Enter key\n`;
        code += `        waitForElement(${getLocatorCode(action.selector)}).sendKeys(org.openqa.selenium.Keys.ENTER);\n`;
        code += `        waitForPageLoad();\n`;
      }
      break;

    default:
      code = `        // Unsupported action type: ${action.type}\n`;
      break;
  }
}


