// background.js
// 백그라운드 서비스 워커는 익스텐션의 수명 주기를 관리하고, 
// 다른 컴포넌트와 통신합니다.

// ClassCard 사이트의 URL 패턴을 정의합니다
const DATA_COLLECTION_URL_PATTERN = "classcard.net/set/";
const DATA_USAGE_URL_PATTERN = "classcard.net/ClassTest/"; // 시험 페이지 인식

// 탭이 업데이트될 때마다 URL을 체크합니다
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    if (tab.url.includes(DATA_COLLECTION_URL_PATTERN)) {
      console.log("ClassCard 단어장 페이지 감지됨:", tab.url);
      chrome.scripting.executeScript({ target: { tabId }, files: ['collector.js'] });
    } else if (tab.url.includes(DATA_USAGE_URL_PATTERN)) {
      console.log("ClassCard 시험 페이지 감지됨:", tab.url);
      chrome.scripting.executeScript({ target: { tabId }, files: ['classtest.js'] });
    }
  }
});

// SPA 네비게이션 대응 (history.pushState 등)
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  const url = details.url || '';
  if (url.includes(DATA_COLLECTION_URL_PATTERN)) {
    console.log('SPA 이동 감지 - 단어장 페이지:', url);
    chrome.scripting.executeScript({ target: { tabId: details.tabId }, files: ['collector.js'] });
  } else if (url.includes(DATA_USAGE_URL_PATTERN)) {
    console.log('SPA 이동 감지 - 시험 페이지:', url);
    chrome.scripting.executeScript({ target: { tabId: details.tabId }, files: ['classtest.js'] });
  }
}, { url: [{ hostEquals: 'www.classcard.net' }] });

// 콘텐츠 스크립트로부터 메시지 수신
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "saveData") {
    // 데이터를 로컬 스토리지에 저장
    chrome.storage.local.set({ savedData: message.data }, function() {
      console.log('ClassCard 단어 데이터가 저장되었습니다:', message.data);
      console.log(`총 ${message.data.words ? message.data.words.length : 0}개의 단어가 저장되었습니다.`);
      
      // 팝업에 데이터 업데이트 알림
      chrome.runtime.sendMessage({
        action: "dataUpdated"
      });
      
      // 사용자에게 알림 표시 (옵션)
      if (sender.tab) {
        chrome.scripting.executeScript({
          target: { tabId: sender.tab.id },
          func: (wordCount) => {
            const notification = document.createElement('div');
            notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background-color: green; color: white; padding: 10px; border-radius: 5px; z-index: 10000; font-weight: bold;';
            document.body.appendChild(notification);
            
            setTimeout(() => {
              notification.remove();
            }, 3000);
          },
          args: [message.data.words ? message.data.words.length : 0]
        });
      }
      
      sendResponse({ status: "success" });
    });
    return true; // 비동기 응답을 위해 true 반환
  }
  else if (message.action === "getData") {
    // 저장된 데이터 가져오기
    chrome.storage.local.get(['savedData'], function(result) {
      sendResponse({ data: result.savedData });
    });
    return true; // 비동기 응답을 위해 true 반환
  }
});
