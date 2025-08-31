// test_helper.js
// ClassCard 테스트 페이지에서 정답을 표시하는 스크립트 (성능 최적화 버전)

// 디버깅 레벨 설정 (0: 끔, 1: 기본, 2: 상세)
const DEBUG_LEVEL = 0;

// 디버깅 로그 출력 함수
function debugLog(message, level = 1) {
  if (DEBUG_LEVEL >= level) {
    console.log(message);
  }
}

debugLog('ClassCard 테스트 도우미 실행 중...');

// 스타일시트 추가 (한 번만 실행)
function addStyles() {
  // 이미 스타일이 추가되었는지 확인
  if (document.getElementById('cc-answer-styles')) return;
  
  const styleElement = document.createElement('style');
  styleElement.id = 'cc-answer-styles';
  styleElement.textContent = `
    .cc-correct-answer {
      background-color: #e6f7e6 !important;
      border: 2px solid #28a745 !important;
      position: relative;
    }
    
    .cc-correct-answer::after {
      content: "✓";
      position: absolute;
      right: 10px;
      top: 10px;
      color: #28a745;
      font-weight: bold;
      font-size: 16px;
    }
  `;
  document.head.appendChild(styleElement);
}

// 페이지에 스타일 추가 (최초 1회)
addStyles();

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

// 단어와 뜻이 일치하는지 확인하는 함수 (최적화된 버전)
function matchWordAndMeaning(word, meaning, savedWords) {
  if (!savedWords || !savedWords.length) return false;
  
  debugLog(`매칭: "${word}" ↔ "${meaning}"`, 2);
  
  // 한국어 문제 패턴 캐싱 (정규식 연산 줄이기)
  const koreanPattern = /^\[\w+\]\s+(.+)$/;
  const koreanMatch = word.match(koreanPattern);
  const cleanWord = koreanMatch ? koreanMatch[1] : word;
  
  // 빠른 정규화
  const normWord = fastNormalize(cleanWord);
  const normMeaning = fastNormalize(meaning);
  
  // 캐싱된 정규화 텍스트 사용 (동일한 단어 반복 계산 방지)
  if (!savedWords._normalized) {
    // 한 번만 정규화하여 저장
    savedWords._normalized = savedWords.map(word => ({
      front: fastNormalize(word.front),
      back: fastNormalize(word.back),
      original: word
    }));
  }
  
  // 1. 빠른 정확한 일치 검사 (O(n) 단일 패스)
  for (const word of savedWords._normalized) {
    // 정방향 일치 (문제=단어, 선택지=의미) - 완전 일치만 허용
    if (word.front === normWord && word.back === normMeaning) {
      return true;
    }
    
    // 역방향 일치 (문제=의미, 선택지=단어) - 완전 일치만 허용
    if (word.back === normWord && word.front === normMeaning) {
      return true;
    }
    
    // 포함 관계는 제거 - 너무 관대한 매칭으로 오답 표시 문제 발생
  }
  
  // 2. 엄격한 부분 일치 검사 (오답 표시 방지 버전)
  // 한국어 문제인 경우에만 유사도 검사 수행
  if (koreanMatch) {
    // 임계값 상향 조정 (매우 엄격하게)
    const threshold = 0.85;
    
    // 최대 점수만 필요하므로 단순화
    let bestScore = 0;
    
    for (const word of savedWords._normalized) {
      // 유사도 검사 (매우 엄격한 조건)
      let score = 0;
      
      // 정방향 검사 (문제=단어, 선택지=의미)
      if (exactOrStrongMatch(word.front, normWord)) {
        score = exactOrStrongMatch(word.back, normMeaning) ? 0.9 : 0;
      }
      // 역방향 검사 (문제=의미, 선택지=단어)
      else if (exactOrStrongMatch(word.back, normWord)) {
        score = exactOrStrongMatch(word.front, normMeaning) ? 0.9 : 0;
      }
      
      // 점수가 임계값을 넘는 경우에만 정답으로 인정
      if (score >= threshold) {
        return true;
      }
    }
  }
  
  return false;
}

// 정확한 매칭을 위한 정규화 함수
function fastNormalize(text) {
  if (!text) return '';
  // 기본 정규화 (최소한의 처리)
  return text.trim().toLowerCase()
    .replace(/\s+/g, ' ');  // 연속 공백만 제거 (다른 문자는 유지)
}

// 매우 엄격한 일치 검사 (정확한 일치 또는 매우 높은 유사도만 허용)
function exactOrStrongMatch(text1, text2) {
  // 완전히 동일한 경우
  if (text1 === text2) return true;
  
  // 매우 긴 문자열이면 완전 일치만 허용
  if (text1.length > 20 || text2.length > 20) {
    // 긴 문자열은 완전 일치가 아니면 false
    return false;
  }
  
  // 한쪽이 다른쪽을 완전히 포함하는 경우
  // 예: "geographical position" vs "geographical"
  if (text1.length > text2.length && text1.includes(text2)) {
    // 짧은 텍스트가 긴 텍스트의 60% 이상을 차지하는 경우에만 true
    return text2.length / text1.length > 0.6;
  }
  
  if (text2.length > text1.length && text2.includes(text1)) {
    // 짧은 텍스트가 긴 텍스트의 60% 이상을 차지하는 경우에만 true
    return text1.length / text2.length > 0.6;
  }
  
  // 둘 다 아닌 경우 매칭 실패로 간주
  return false;
}

// 더 이상 사용하지 않는 유사도 확인 함수 (참조용으로만 유지)
function quickSimilarityCheck(text1, text2) {
  // 완전 일치만 허용 (모든 유사도 검사 비활성화)
  return text1 === text2;
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

// 메인 함수: ClassCard 테스트 페이지에서 정답 표시 (성능 최적화 버전)
let savedWordData = null; // 단어 데이터 캐싱

async function highlightAnswers() {
  // 캐시된 데이터가 없으면 데이터 가져오기
  if (!savedWordData) {
    savedWordData = await loadSavedData();
    
    if (!savedWordData || !savedWordData.words || savedWordData.words.length === 0) {
      debugLog("사용 가능한 단어 데이터가 없습니다.");
      
      // 사용자에게 간단히 알림
      const notification = document.createElement('div');
      notification.textContent = '단어 데이터가 없습니다. 먼저 단어장 페이지를 방문하세요.';
      notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background-color: orange; color: white; padding: 10px; border-radius: 5px; z-index: 10000;';
      document.body.appendChild(notification);
      
      setTimeout(() => notification.remove(), 3000);
      return;
    }
    
    debugLog(`${savedWordData.words.length}개 단어 로드됨`);
  }
  
  // 이미 표시된 정답이 있는지 확인 (불필요한 재처리 방지)
  const existingAnswers = document.querySelectorAll('.cc-correct-answer');
  if (existingAnswers.length > 0) {
    debugLog(`이미 ${existingAnswers.length}개의 정답이 표시되어 있습니다.`, 2);
    return;
  }
  
  // DOM 쿼리 최소화 (한 번만 쿼리)
  const flipCards = document.querySelectorAll(".flip-card");
  
  if (flipCards.length === 0) {
    debugLog("문제 카드를 찾을 수 없습니다.");
    return;
  }
  
  debugLog(`${flipCards.length}개의 문제 카드 발견`);
  let matchCount = 0;
  let processedStart = performance.now();
  
  // 각 문제 카드 처리 (최적화된 버전)
  for (let i = 0; i < flipCards.length; i++) {
    const card = flipCards[i];
    
    // 문제 텍스트 (앞면)
    const questionElement = card.querySelector(".flip-card-front .front-hidden");
    if (!questionElement) continue;
    
    const questionText = questionElement.innerText.trim();
    
    // 선택지 목록 (DOM 쿼리 최소화)
    const optionsBox = card.querySelector(".cc-radio-box-body");
    if (!optionsBox) continue;
    
    const options = optionsBox.querySelectorAll(".cc-radio-box");
    debugLog(`문제: "${questionText}" (${options.length}개 선택지)`, 2);
    
    // 각 선택지 처리 (안전하게 수정된 버전)
    // 정답 후보 찾기 (점수와 함께)
    let bestOption = null;
    let bestScore = 0;
    let correctAnswers = [];
    
    for (let j = 0; j < options.length; j++) {
      const option = options[j];
      const optionText = option.innerText.trim();
      
      // 이미 처리된 요소면 건너뛰기
      if (option.classList.contains('cc-correct-answer') || option.dataset.processed) {
        continue;
      }
      
      try {
        // 정답인지 확인 (엄격한 검사)
        const isCorrect = matchWordAndMeaning(questionText, optionText, savedWordData.words);
        
        if (isCorrect) {
          correctAnswers.push({
            option: option,
            text: optionText
          });
        }
      } catch (err) {
        debugLog(`오류 발생: ${err.message}`, 1);
      }
    }
    
    // 각 문제에 대해 정답이 하나만 있어야 함 (안전장치)
    // 복수의 정답이 감지되면 아무것도 표시하지 않음
    if (correctAnswers.length === 1) {
      const correctOption = correctAnswers[0].option;
      correctOption.classList.add('cc-correct-answer');
      correctOption.dataset.processed = "true"; // 처리 완료 표시
      matchCount++;
      debugLog(`정답 표시: "${correctAnswers[0].text}"`, 1);
    } else if (correctAnswers.length > 1) {
      debugLog(`경고: "${questionText}" 문제에 대해 여러 정답 후보 감지됨 (${correctAnswers.length}개) - 표시하지 않음`, 1);
    }
  }
  
  // 처리 시간 로깅
  const processTime = performance.now() - processedStart;
  debugLog(`처리 시간: ${processTime.toFixed(1)}ms, ${matchCount}개 정답 발견`);
  
  // 정답이 있을 경우만 알림 표시
  if (matchCount > 0) {
    // 간단한 알림
    const notification = document.createElement('div');
    notification.textContent = `${matchCount}개의 정답을 표시했습니다.`;
    notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background-color: #28a745; color: white; padding: 8px; border-radius: 4px; z-index: 10000;';
    document.body.appendChild(notification);
    
    setTimeout(() => notification.remove(), 2000);
  }
}

// 스크립트 실행
highlightAnswers();

// 디버그 정보 함수 (필요할 때만 사용)
function debugLayout() {
  if (DEBUG_LEVEL < 2) return; // 상세 디버깅이 비활성화된 경우 실행 안 함
  
  debugLog("--- 레이아웃 분석 ---");
  const flipCards = document.querySelectorAll('.flip-card');
  debugLog(`문제 카드: ${flipCards.length}개`);
}

// 최적화된 문제 카드 변경 감지 함수
let lastDetectedChange = 0; // 마지막 변경 감지 시간
let updateTimerId = null; // 타이머 ID 저장 (중복 실행 방지)

function detectCardChanges() {
  debugLog("변경 감지 시작");
  
  // DOM 변경 감지를 위한 MutationObserver
  const observer = new MutationObserver((mutations) => {
    // 스로틀링 - 너무 잦은 업데이트 방지
    const now = Date.now();
    if (now - lastDetectedChange < 500) {
      return; // 0.5초 내에 다시 호출되면 무시
    }
    
    // 관련 변경인지 빠르게 확인
    let relevantChange = false;
    
    // 모든 변경을 검사하지 않고 일부만 샘플링
    const samplingLimit = Math.min(mutations.length, 5);
    
    for (let i = 0; i < samplingLimit; i++) {
      const mutation = mutations[i];
      
      // 클래스카드의 주요 이벤트는 클래스와 콘텐츠 변경
      if (
        (mutation.type === 'attributes' && mutation.attributeName === 'class') ||
        (mutation.type === 'childList' && mutation.addedNodes.length > 0)
      ) {
        relevantChange = true;
        break;
      }
    }
    
    // 관련 변경이 감지된 경우
    if (relevantChange) {
      lastDetectedChange = now;
      
      // 중복 실행 방지
      if (updateTimerId) clearTimeout(updateTimerId);
      
      // 지연 실행 (DOM이 완전히 업데이트된 후 실행)
      updateTimerId = setTimeout(() => {
        highlightAnswers();
        updateTimerId = null;
      }, 300);
    }
  });

  // 성능을 위해 감시 옵션 최적화
  observer.observe(document.body, {
    childList: true,     // 요소 추가/제거 감시
    subtree: true,       // 하위 요소도 감시
    attributes: true,    // 속성 변경 감시
    attributeFilter: ['class'], // 클래스 변경만 감시
    characterData: false // 텍스트 변경은 무시
  });
  
  // 클래스카드 특화 이벤트 (필수만 유지)
  try {
    // 페이지 이동을 감지하기 위해 hashchange 이벤트 사용
    window.addEventListener('hashchange', () => {
      debugLog("URL 해시 변경 감지됨");
      
      if (updateTimerId) clearTimeout(updateTimerId);
      updateTimerId = setTimeout(highlightAnswers, 500);
    });
    
    // 최적화된 간헐적 확인 (너무 자주 실행하지 않음)
    setInterval(() => {
      // 마지막 업데이트가 10초 이상 전이면 다시 확인
      const now = Date.now();
      if (now - lastDetectedChange > 10000) {
        highlightAnswers();
      }
    }, 10000);
  } catch (e) {
    debugLog("이벤트 감지 오류", e);
  }
}

// 페이지 로드 후 최초 1회만 실행
(function init() {
  // 정답 표시 최초 실행
  highlightAnswers();
  
  // 변경 감지 시작
  detectCardChanges();
})();
