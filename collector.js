// collector.js
// 데이터 수집 페이지에서 실행되는 스크립트

console.log('ClassCard 데이터 수집 스크립트 실행 중...');

function normalizeText(t) {
  if (!t) return '';
  return t
    .replace(/\s+/g, ' ') // 연속 공백을 하나로
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // zero-width 제거
    .replace(/\[.*?\]/g, '') // Remove text inside square brackets including the brackets
    .replace(/;/g, ',') // Replace semicolons with commas
    .trim()
    .toLowerCase();
}

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
    }
  });

  // 단어의 앞면과 뒷면 텍스트를 정규화합니다
  words.forEach(word => {
    word.front = normalizeText(word.front);
    word.back = normalizeText(word.back);
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

  console.log("수집된 데이터:", collectedData);
  
  return collectedData;
}

// 데이터 수집 및 저장
(function() {
  const data = collectData();
  
  // 데이터를 백그라운드 스크립트로 전송하여 저장
  chrome.runtime.sendMessage({
    action: "saveData",
    data: data
  }, (response) => {
    if (response && response.status === "success") {
      console.log('데이터가 성공적으로 저장되었습니다');
      
      // 선택적: 사용자에게 알림
      const notification = document.createElement('div');
      notification.textContent = '!';
      notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background-color: green; color: white; padding: 10px; border-radius: 5px; z-index: 10000;';
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.remove();
      }, 3000);
    }
  });
})();
