// collector.js
// 데이터 수집 페이지에서 실행되는 스크립트

console.log('ClassCard 데이터 수집 스크립트 실행 중...');

// ClassCard 사이트에서 단어 데이터를 수집합니다
function collectData() {
  // 단어 세트를 찾습니다
  const wordSetElement = document.getElementsByClassName("word-set")[0];
  
  // 단어가 없으면 빈 배열 반환
  if (!wordSetElement) {
    console.log("단어 세트를 찾을 수 없습니다.");
    return {
      pageTitle: document.title,
      timestamp: new Date().toISOString(),
      setName: document.title,
      words: []
    };
  }
  
  // 단어 목록을 추출합니다
  const wordItems = Array.from(wordSetElement.children);
  const words = [];
  
  // 각 단어 아이템에서 단어(앞면)와 의미(뒷면)를 추출합니다
  wordItems.forEach((item, index) => {
    const frontElement = item.getElementsByClassName("ex_front")[0];
    const backElement = item.getElementsByClassName("ex_back")[0];
    
    if (frontElement && backElement) {
      const frontText = frontElement.innerText;
      const backText = backElement.innerText;
      
      words.push({
        index: index + 1,
        front: frontText,
        back: backText
      });
      
      console.log(`단어 ${index + 1}: ${frontText} - ${backText}`);
    }
  });
  
  // 수집한 데이터를 반환합니다
  const collectedData = {
    pageTitle: document.title,
    timestamp: new Date().toISOString(),
    setName: document.title,
    url: window.location.href,
    totalWords: words.length,
    words: words
  };
  
  return collectedData;
}

// 데이터 수집 및 저장 (동적 로딩 대비 재시도)
(function() {
  const MAX_TRIES = 20; // 최대 20회 재시도 (~6초)
  const INTERVAL_MS = 300;
  let tries = 0;

  const tryCollect = () => {
    tries += 1;
    const data = collectData();

    if (data && Array.isArray(data.words) && data.words.length > 0) {
      // 데이터를 백그라운드 스크립트로 전송하여 저장
      chrome.runtime.sendMessage({ action: "saveData", data }, (response) => {
        if (response && response.status === "success") {
          console.log(`단어 ${data.words.length}개 저장 완료`);
          // 선택적: 사용자에게 알림
          const notification = document.createElement('div');
          notification.textContent = `${data.words.length}개의 단어가 수집되었습니다!`;
          notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background-color: green; color: white; padding: 10px; border-radius: 5px; z-index: 10000;';
          document.body.appendChild(notification);
          setTimeout(() => notification.remove(), 2500);
        }
      });
    } else if (tries < MAX_TRIES) {
      // DOM 로딩이 늦는 경우 재시도
      setTimeout(tryCollect, INTERVAL_MS);
    } else {
      console.log('단어 세트를 찾지 못해 수집을 종료합니다.');
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryCollect);
  } else {
    tryCollect();
  }
})();
