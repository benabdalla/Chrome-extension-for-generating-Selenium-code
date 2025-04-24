chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  console.log("[Selenium Recorder] Background script received message:", request);

  if (request.action === 'generateJavaCode') {
    try {
      const javaCode= generateJavaCode(request.actions);
      const javaString = extractAttributesThenMethods(javaCode);

       // 🧠 Créer un Data URL à la place de createObjectURL
    const base64Code = btoa(unescape(encodeURIComponent(javaString)));
    const dataUrl = 'data:text/plain;charset=utf-8;base64,' + base64Code;

    chrome.downloads.download({
      url: dataUrl,
      filename: 'SeleniumTest.java',
      saveAs: true
    }, function(downloadId) {
      if (chrome.runtime.lastError) {
        console.error('[Background] Download failed:', chrome.runtime.lastError.message);
      } else {
        console.log('[Background] Download started with ID:', downloadId);
      }
    });

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
function generateJavaCode(actions) {

  let classCode = `
package com.xray.projects.qualipro.*.page;

import com.xray.constants.FrameworkConstants;
import com.xray.helpers.ExcelHelpers;
import com.xray.keywords.WebUI;
import com.xray.projects.qualipro.GRH.page.EmployerPage;
import com.xray.projects.qualipro.authentification.pages.LoginPage;
import com.xray.projects.qualipro.home.pages.HomePage;
import com.xray.utils.LogUtils;
import net.datafaker.Faker;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.testng.Assert;

import java.time.Duration;
import java.util.*;

  public class CodeTransformer{ 
  
  \n`;
  let javaCode = '';
  actions.forEach(action => {
    const type = action.elementType || action.inputType || action.checked;
    if(type!=undefined){
    const selector = action.selector?.type ;
    const elementId = action.selector?.value || '';
    const fieldName = elementId+type+selector;

    let actionLine = '';

    if (type === 'select') {
      actionLine = `WebUI.selectOptionByText(${fieldName}, "Your Data");`;
    } else if (type === 'input' || type === 'textarea') {
      actionLine = `WebUI.setText(${fieldName}, "Your Data");`;
    } else if (type === 'click' || type === 'a' || type === 'span' || type === 'h4') {
      actionLine = `WebUI.clickElement(${fieldName});`;
    } else {
      actionLine = `WebUI.clickElement(${fieldName}); // Default`;
    }

    javaCode += `private final By ${fieldName} = By.${selector}("${elementId}");\n`;
    javaCode += `public void ${fieldName}() {\n`;
    javaCode += `    ${actionLine}\n`;
    javaCode += `}\n\n`;
  }
  });

  letcode=extractAttributesThenMethods (javaCode)
  letcode=classCode+letcode+`\n\n}\n\n`;
return letcode;

}

function extractAttributesThenMethods(code) {
  const lines = code.split('\n');
  const attributes = [];
  const methods = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    // Step 1: Collect all attribute lines
    if (line.startsWith('private final By')) {
      attributes.push(lines[i]);
    }

    // Step 2: Collect methods
    if (line.startsWith('public void')) {
      const methodBlock = [lines[i]];
      i++;

      // Add lines until we reach the closing bracket of the method
      while (i < lines.length) {
        methodBlock.push(lines[i]);
        if (lines[i].includes('}')) break;
        i++;
      }
      methods.push(methodBlock.join('\n'));
    }

    i++;
  }

  // Combine attributes first, then methods
  return [...attributes, '', ...methods].join('\n');
}







