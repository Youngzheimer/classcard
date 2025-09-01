// test_helper.js
// ClassCard 테스트 페이지에서 정답을 표시하는 스크립트

console.log('ClassCard 테스트 도우미 실행 중...');

// 저장된 데이터를 가져오는 함수
function loadSavedData() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "getData" }, (response) => {
      if (response && response.data) {
        resolve(response.data);
      } else {
        console.log("저장된 단어 데이터가 없습니다. 먼저 단어장 페이지를 방문하세요.");
        resolve(null);
      }
    });
  });
}

// 단어와 뜻이 일치하는지 확인하는 함수
function matchWordAndMeaning(word, meaning, savedWords) {
  if (!savedWords || !savedWords.length) return false;
  
  // 정확한 일치 검사
  for (const savedWord of savedWords) {
    // 단어의 앞면(front)과 뒷면(back)을 모두 검사
    // 문제의 텍스트가 단어(front)와 일치하는 경우 (뜻을 고르는 문제)
    if (normalizeText(savedWord.front) === normalizeText(word)) {
      return normalizeText(savedWord.back) === normalizeText(meaning);
    }
    
    // 문제의 텍스트가 뜻(back)과 일치하는 경우 (단어를 고르는 문제)
    if (normalizeText(savedWord.back) === normalizeText(word)) {
      return normalizeText(savedWord.front) === normalizeText(meaning);
    }
  }
  
  // 부분 일치 검사 (더 관대한 검사)
  for (const savedWord of savedWords) {
    // 앞면이 문제와 비슷한 경우, 선택지가 뒷면과 비슷한지 확인
    if (isSimilarText(savedWord.front, word)) {
      return isSimilarText(savedWord.back, meaning);
    }
    
    // 뒷면이 문제와 비슷한 경우, 선택지가 앞면과 비슷한지 확인
    if (isSimilarText(savedWord.back, word)) {
      return isSimilarText(savedWord.front, meaning);
    }
  }
  
  return false;
}

// 텍스트 정규화 (공백, 특수문자 등 처리)
function normalizeText(text) {
  if (!text) return '';
  return text.trim().toLowerCase()
    .replace(/\s+/g, ' ')                  // 여러 공백을 하나로
    .replace(/[.,;:!?()[\]{}'"]/g, '')     // 특수문자 제거
    .replace(/^(to|a|an|the)\s+/i, '');    // 영어 관사/불필요한 to 제거
}

// 텍스트 유사도 검사 (부분 일치)
function isSimilarText(text1, text2) {
  const norm1 = normalizeText(text1);
  const norm2 = normalizeText(text2);
  
  // 포함 관계 확인
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    return true;
  }
  
  // 단어들을 나누어 공통 단어가 많은지 확인
  const words1 = norm1.split(/\s+/);
  const words2 = norm2.split(/\s+/);
  
  // 짧은 단어들은 비교에서 제외
  const filteredWords1 = words1.filter(w => w.length > 2);
  const filteredWords2 = words2.filter(w => w.length > 2);
  
  // 공통 단어 개수
  let commonWordCount = 0;
  for (const word of filteredWords1) {
    if (filteredWords2.some(w => w.includes(word) || word.includes(w))) {
      commonWordCount++;
    }
  }
  
  // 공통 단어가 충분히 많으면 유사하다고 판단
  const threshold = Math.min(filteredWords1.length, filteredWords2.length) * 0.5;
  return commonWordCount >= threshold;
}

// 디버그 함수 - 선택지 요소의 정보 출력
function debugElement(element) {
  console.group('요소 디버그 정보');
  try {
    console.log('요소:', element);
    console.log('HTML:', element.outerHTML);
    console.log('클래스:', element.className);
    console.log('ID:', element.id);
    console.log('현재 스타일:', window.getComputedStyle(element));
    console.log('인라인 스타일:', element.style.cssText);
    console.log('부모 요소:', element.parentElement);
  } catch (error) {
    console.error('디버그 중 오류:', error);
  }
  console.groupEnd();
}

// 특정 선택자의 요소를 찾고 디버그하는 함수
function findAndDebugElements(selector) {
  console.group(`선택자 "${selector}" 디버그`);
  const elements = document.querySelectorAll(selector);
  console.log(`${elements.length}개 요소 찾음`);
  
  elements.forEach((el, index) => {
    console.log(`요소 ${index + 1}:`, el);
  });
  console.groupEnd();
}

// 메인 함수: ClassCard 테스트 페이지에서 정답 표시
async function highlightAnswers() {
  console.group('정답 강조 표시 실행');
  
  // 페이지 구조 디버그
  console.log('페이지 구조 분석:');
  findAndDebugElements('.flip-card');
  findAndDebugElements('.cc-radio-box');
  
  // CSS 스타일 추가 (전역 스타일)
  injectGlobalStyles();
  
  // 저장된 단어 데이터 가져오기
  const savedData = await loadSavedData();
  
  if (!savedData || !savedData.words || savedData.words.length === 0) {
    console.log("사용 가능한 단어 데이터가 없습니다. 먼저 단어장 페이지를 방문해주세요.");
    
    // 사용자에게 알림
    const notification = document.createElement('div');
    notification.textContent = '단어 데이터가 없습니다. 먼저 ClassCard 단어장 페이지를 방문해주세요.';
    notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background-color: orange; color: white; padding: 10px; border-radius: 5px; z-index: 10000; font-weight: bold;';
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 5000);
    
    return;
  }
  
  console.log(`단어장 "${savedData.setName}"에서 ${savedData.words.length}개 단어 로드됨`);
  
  // 문제 카드 요소들 가져오기
  const flipCards = Array.from(document.getElementsByClassName("flip-card"));
  
  if (flipCards.length === 0) {
    console.log("문제 카드를 찾을 수 없습니다.");
    return;
  }
  
  console.log(`${flipCards.length}개의 문제 카드 찾음`);
  let matchCount = 0;
  
  // 각 문제 카드 처리
  flipCards.forEach((card) => {
    // 문제 텍스트 (앞면)
    const questionElement = card.getElementsByClassName("flip-card-front")[0]?.getElementsByClassName("front-hidden")[0];
    if (!questionElement) return;
    
    const questionText = questionElement.innerText.trim();
    
    // 선택지 목록
    const optionsBox = card.getElementsByClassName("cc-radio-box-body")[0];
    if (!optionsBox) return;
    
    const options = Array.from(optionsBox.getElementsByClassName("cc-radio-box"));
    
    console.log(`문제: "${questionText}"`);
    console.log(`선택지 개수: ${options.length}`);
    
    // 각 선택지 처리
    options.forEach((option) => {
      const optionText = option.innerText.trim();
      
      // 단어 데이터와 비교하여 정답인지 확인
      const isCorrect = matchWordAndMeaning(questionText, optionText, savedData.words);
      
      if (isCorrect) {
        console.log(`정답 발견: "${optionText}"`);
        console.log('정답 선택지 DOM:', option);
        
        try {
          // 여러 방식으로 정답 표시
          markAsCorrectAnswer(option);
          matchCount++;
        } catch (error) {
          console.error('정답 스타일 적용 중 오류 발생:', error);
          
          // 오류 발생 시 대체 방법 시도
          try {
            // 가장 기본적인 방법 적용
            option.style.backgroundColor = '#e6f7e6';
            option.setAttribute('data-cc-correct-answer', 'true');
            console.log('대체 방법으로 스타일 적용');
          } catch (fallbackError) {
            console.error('대체 방법도 실패:', fallbackError);
          }
        }
      }
    });
  });
  
  // 모든 정답 스타일 강제 적용
  applyDirectStyles();
  
  // 선택지 클릭 이벤트 추가
  setupOptionClickEvents();
  
  // 모든 cc-radio-box 요소의 현재 상태 출력
    });
  });
  
  // 강제 DOM 요소 디버깅
  console.log('모든 cc-radio-box 요소의 현재 상태:');
  const allOptions = document.querySelectorAll('.cc-radio-box');
  allOptions.forEach((opt, idx) => {
    console.log(`옵션 ${idx+1} 스타일:`, window.getComputedStyle(opt).backgroundColor);
  });
  
  // 정답 표시 결과 로깅
  if (matchCount > 0) {
    console.log(`총 ${matchCount}개의 정답을 표시했습니다.`);
  } else {
    console.warn('일치하는 정답을 찾지 못했습니다.');
  }
  
  // 일치하지 않는 단어 목록 출력 (디버깅용)
  const questionTexts = Array.from(document.querySelectorAll('.front-hidden')).map(el => el.innerText.trim());
  console.log('현재 문제 목록:', questionTexts);
  console.log('저장된 단어 목록:', savedData.words.map(w => `${w.front} - ${w.back}`));
  
  // 사용자에게 알림
  const notificationColor = matchCount > 0 ? '#28a745' : '#ffc107';
  const notificationText = matchCount > 0 
    ? `${matchCount}개의 정답을 표시했습니다.` 
    : '일치하는 정답을 찾지 못했습니다. 단어장 데이터를 확인해주세요.';
  
  const notification = document.createElement('div');
  notification.textContent = notificationText;
  notification.style.cssText = `position: fixed; top: 20px; right: 20px; background-color: ${notificationColor}; color: white; padding: 10px; border-radius: 5px; z-index: 10000; font-weight: bold;`;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 5000);
  
  // 디버그 그룹 종료
  console.groupEnd();
}

// 클래스카드의 선택지 클릭 이벤트 재정의
function interceptClassCardClicks() {
  // 전체 문서에 클릭 이벤트 리스너 추가 (이벤트 캡처링 사용)
  document.addEventListener('click', function(e) {
    // 클릭된 요소 또는 부모가 cc-radio-box 클래스를 가지고 있는지 확인
    let radioBox = e.target.closest('.cc-radio-box');
    if (radioBox) {
      // 정답 선택지인 경우 다시 강조 표시
      if (radioBox.hasAttribute('data-cc-correct-answer') || radioBox.classList.contains('cc-answer-highlight')) {
        console.log('정답 선택지 클릭 감지, 스타일 재적용');
        
        // 기본 이벤트는 그대로 진행되도록 함 (선택지를 선택할 수 있게)
        
        // 약간의 지연 후 스타일 재적용
        setTimeout(() => {
          applyDirectStyles();
        }, 100);
      }
    }
  }, true);
  
  console.log('클래스카드 클릭 이벤트 인터셉터 설정 완료');
}

// 문제 카드가 변경될 때 정답 강조 표시를 다시 실행
function setupCardChangeMonitoring() {
  // 이전 문제와 현재 문제 상태 추적
  let currentQuestion = '';
  
  // 문제 변경 감지 함수
  function checkQuestionChange() {
    const visibleCards = Array.from(document.querySelectorAll('.flip-card.showing'));
    if (visibleCards.length > 0) {
      const questionElement = visibleCards[0].querySelector('.front-hidden');
      if (questionElement) {
        const newQuestion = questionElement.innerText.trim();
        if (newQuestion !== currentQuestion) {
          console.log(`문제 변경 감지: "${currentQuestion}" -> "${newQuestion}"`);
          currentQuestion = newQuestion;
          highlightAnswers();
        }
      }
    }
  }
  
  // 주기적으로 문제 변경 확인
  setInterval(checkQuestionChange, 300);
  
  // 페이지 변경 감시 (새로운 문제 카드 추가)
  let observer = new MutationObserver((mutations) => {
    let shouldHighlight = false;
    
    for (const mutation of mutations) {
      // 노드 추가 또는 속성 변경 감지
      if (
        (mutation.type === 'childList' && mutation.addedNodes.length > 0) ||
        (mutation.type === 'attributes' && 
         mutation.target.classList && 
         (mutation.target.classList.contains('flip-card') || 
          mutation.target.classList.contains('cc-radio-box')))
      ) {
        shouldHighlight = true;
        break;
      }
    }
    
    if (shouldHighlight) {
      console.log("DOM 변경 감지됨, 정답 다시 표시합니다.");
      // 약간의 지연 후 강조 표시 실행 (DOM이 완전히 업데이트될 시간 제공)
      setTimeout(() => {
        highlightAnswers();
      }, 100);
    }
  });
  
  // DOM 트리 및 속성 변화 감시 설정
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style']
  });
  
  console.log('카드 변경 모니터링 설정 완료');
}

// 스크립트 실행
(function initializeTestHelper() {
  console.log('ClassCard 테스트 도우미 초기화 시작...');
  
  // 정답 강조 표시 실행
  highlightAnswers();
  
  // 이벤트 인터셉터 설정
  interceptClassCardClicks();
  
  // 카드 변경 모니터링 설정
  setupCardChangeMonitoring();
  
  // 일정 시간마다 강제로 다시 실행 (안전장치)
  setInterval(() => {
    console.log('주기적 정답 강조 표시 실행 (백업)');
    highlightAnswers();
  }, 3000);
  
  console.log('ClassCard 테스트 도우미 초기화 완료!');
})();

// 전역 CSS 스타일 주입 함수
function injectGlobalStyles() {
  // 이미 스타일이 존재하면 업데이트
  let styleElement = document.getElementById('cc-helper-styles');
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = 'cc-helper-styles';
    document.head.appendChild(styleElement);
  }
  
  // !important를 사용하여 원래 CSS를 덮어쓰기
  styleElement.textContent = `
    /* 정답 선택지 강조 스타일 - 최대한 강력한 선택자 사용 */
    html body .cc-radio-box[data-cc-correct-answer="true"],
    html body .cc-answer-highlight,
    html body .cc-radio-box.cc-answer-highlight {
      background-color: #e6f7e6 !important;
      background: linear-gradient(to right, #e6f7e6, #e6f7e6) !important;
      border: 2px solid #28a745 !important;
      box-shadow: 0 0 5px rgba(40, 167, 69, 0.5) !important;
      position: relative !important;
      z-index: 1000 !important;
    }
    
    /* 투명 배경이 아닌 선택지들 - 정답이 아닌 경우 */
    html body .cc-radio-box:not([data-cc-correct-answer="true"]):not(.cc-answer-highlight) {
      background-color: transparent !important;
    }
    
    /* 정답 선택지에 체크 표시 추가 */
    html body .cc-radio-box[data-cc-correct-answer="true"]::before,
    html body .cc-answer-highlight::before {
      content: "✓";
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      color: #28a745;
      font-weight: bold;
      font-size: 20px;
      z-index: 99999;
      pointer-events: none;
    }
    
    /* 정답 배지 스타일 */
    html body .correct-answer-badge {
      display: block !important;
      position: absolute !important;
      right: 10px !important;
      top: 50% !important;
      transform: translateY(-50%) !important;
      color: #28a745 !important;
      font-weight: bold !important;
      font-size: 20px !important;
      z-index: 99999 !important;
      pointer-events: none !important;
      user-select: none !important;
      text-shadow: 0 0 3px white !important;
    }
    
    /* 각 정답 선택지에 테두리 오버레이 추가 */
    html body .answer-overlay {
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      width: 100% !important;
      height: 100% !important;
      border: 2px solid #28a745 !important;
      box-sizing: border-box !important;
      background-color: rgba(40, 167, 69, 0.1) !important;
      pointer-events: none !important;
      z-index: 99998 !important;
    }
  `;
  
  console.log('전역 스타일 주입 완료');
  
  // 직접 DOM 요소에 스타일을 적용
  applyDirectStyles();
  
  // ClassCard의 스타일 변경 탐지 및 재적용을 위한 interval 설정
  if (!window.answerStyleInterval) {
    window.answerStyleInterval = setInterval(applyDirectStyles, 500);
    console.log('스타일 재적용 인터벌 설정됨');
  }
}

// 직접적인 스타일 적용 함수 (외부에서도 호출 가능)
function applyDirectStyles() {
  try {
    const correctAnswers = document.querySelectorAll('[data-cc-correct-answer="true"]');
    console.log(`스타일 직접 적용: ${correctAnswers.length}개 요소`);
    
    correctAnswers.forEach(element => {
      // 강제로 인라인 스타일 적용
      element.setAttribute('style', `
        background-color: #e6f7e6 !important;
        background: linear-gradient(to right, #e6f7e6, #e6f7e6) !important;
        border: 2px solid #28a745 !important;
        box-shadow: 0 0 5px rgba(40, 167, 69, 0.5) !important;
        position: relative !important;
        z-index: 1000 !important;
      `);
      
      // CSS 클래스도 추가 (CSS 선택자로 스타일링하기 위함)
      if (!element.classList.contains('cc-answer-highlight')) {
        element.classList.add('cc-answer-highlight');
      }
      
      // 오버레이 요소 추가 (별도의 레이어로 스타일 적용)
      if (!element.querySelector('.answer-overlay')) {
        const overlay = document.createElement('div');
        overlay.className = 'answer-overlay';
        element.appendChild(overlay);
      }
      
      // 정답 표시 배지 추가
      if (!element.querySelector('.correct-answer-badge')) {
        const badge = document.createElement('span');
        badge.className = 'correct-answer-badge';
        badge.textContent = '✓';
        element.appendChild(badge);
      }
      
      // 클릭 이벤트를 방지하기 위한 추가 처리
      element.addEventListener('mousedown', stopPropagation, true);
      element.addEventListener('click', stopPropagation, true);
    });
  } catch (e) {
    console.error('직접 스타일 적용 중 오류:', e);
  }
}

// 이벤트 전파 방지 함수
function stopPropagation(e) {
  e.stopPropagation();
}

// 페이지 로드 후 일정 시간 후에 다시 실행 (안전장치)
setTimeout(() => {
  console.log('5초 후 다시 실행 - 안전장치');
  highlightAnswers();
}, 5000);
