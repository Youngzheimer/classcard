// popup.js

// DOM 요소 가져오기
const statusElement = document.getElementById('status');
const wordListElement = document.getElementById('word-list');
const wordCountElement = document.getElementById('word-count');
const clearDataButton = document.getElementById('clear-data');
const exportCsvButton = document.getElementById('export-csv');

// 저장된 데이터 불러오기
function loadData() {
  chrome.storage.local.get(['savedData'], function(result) {
    if (result.savedData && result.savedData.words && result.savedData.words.length > 0) {
      const data = result.savedData;
      
      // 단어장 정보 표시
      statusElement.textContent = `"${data.setName}" 단어장에서 ${data.words.length}개의 단어가 추출되었습니다.`;
      wordCountElement.textContent = `총 ${data.words.length}개의 단어가 추출되었습니다. (${new Date(data.timestamp).toLocaleString()})`;
      
      // 단어 목록 표시
      wordListElement.innerHTML = '';
      data.words.forEach(word => {
        const li = document.createElement('li');
        li.className = 'word-item';
        li.innerHTML = `<span class="word">${word.front}</span> - <span class="meaning">${word.back}</span>`;
        wordListElement.appendChild(li);
      });
    } else {
      wordListElement.innerHTML = '<li class="word-item">추출된 단어가 없습니다. ClassCard 단어장 페이지를 방문하세요.</li>';
      statusElement.textContent = '아직 추출된 단어가 없습니다.';
      wordCountElement.textContent = '';
    }
  });
}

// 저장된 데이터 지우기
clearDataButton.addEventListener('click', function() {
  chrome.storage.local.remove('savedData', function() {
    wordListElement.innerHTML = '<li class="word-item">추출된 단어가 없습니다. ClassCard 단어장 페이지를 방문하세요.</li>';
    statusElement.textContent = '저장된 단어 데이터가 삭제되었습니다.';
    wordCountElement.textContent = '';
  });
});

// CSV로 내보내기
exportCsvButton.addEventListener('click', function() {
  chrome.storage.local.get(['savedData'], function(result) {
    if (result.savedData && result.savedData.words && result.savedData.words.length > 0) {
      const data = result.savedData;
      
      // CSV 헤더
      let csvContent = "순번,단어,의미\n";
      
      // 단어 데이터 추가
      data.words.forEach((word, index) => {
        // 쉼표가 포함된 경우 따옴표로 묶기
        const front = word.front.includes(',') ? `"${word.front}"` : word.front;
        const back = word.back.includes(',') ? `"${word.back}"` : word.back;
        
        csvContent += `${index + 1},${front},${back}\n`;
      });
      
      // CSV 파일로 다운로드
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `${data.setName.replace(/[^\w가-힣]/g, '_')}_단어장.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      statusElement.textContent = 'CSV 파일이 다운로드되었습니다.';
    } else {
      statusElement.textContent = '내보낼 데이터가 없습니다.';
    }
  });
});

// 페이지 로드 시 데이터 불러오기
document.addEventListener('DOMContentLoaded', loadData);

// 백그라운드 스크립트로부터 메시지 수신
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "dataUpdated") {
    loadData();
  }
});
