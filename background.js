// background.js
// 백그라운드 서비스 워커는 익스텐션의 수명 주기를 관리하고, 
// 다른 컴포넌트와 통신합니다.

// ClassCard 사이트의 URL 패턴을 정의합니다
const DATA_COLLECTION_URL_PATTERN = "classcard.net/set/";
const DATA_USAGE_URL_PATTERN = "example.com/use-data"; // 이 부분은 필요에 따라 수정하세요
const TEST_URL_PATTERN = "classcard.net/ClassTest/";

// 탭이 업데이트될 때마다 URL을 체크합니다
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    
    // ClassCard 단어장 URL인 경우
    if (tab.url.includes(DATA_COLLECTION_URL_PATTERN)) {
      console.log("ClassCard 단어장 페이지 감지됨:", tab.url);
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['collector.js']
      });
    }
    
    // ClassCard 테스트 URL인 경우
    else if (tab.url.includes(TEST_URL_PATTERN)) {
      console.log("ClassCard 테스트 페이지 감지됨:", tab.url);
      
      // 테스트 페이지가 완전히 로드된 후 스크립트 실행 (지연 시간 최소화)
      setTimeout(() => {
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['test_helper.js']
        });
      }, 500);
    }
    
    // 데이터 사용 URL인 경우
    else if (tab.url.includes(DATA_USAGE_URL_PATTERN)) {
      console.log("데이터 사용 페이지 감지됨:", tab.url);
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['user.js']
      });
    }
  }
});

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
            notification.textContent = `${wordCount}개의 단어가 성공적으로 저장되었습니다!`;
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
