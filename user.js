// user.js
// 데이터를 사용하는 페이지에서 실행되는 스크립트

console.log('데이터 사용 스크립트 실행 중...');

// 백그라운드 스크립트에서 저장된 데이터 가져오기
chrome.runtime.sendMessage({
  action: "getData"
}, (response) => {
  if (response && response.data) {
    console.log('수신된 데이터:', response.data);
    useData(response.data);
  } else {
    console.log('사용 가능한 데이터가 없습니다');
    
    // 선택적: 사용자에게 알림
    const notification = document.createElement('div');
    notification.textContent = '먼저 데이터 수집 페이지를 방문해야 합니다';
    notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background-color: orange; color: white; padding: 10px; border-radius: 5px; z-index: 10000;';
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 5000);
  }
});

// 가져온 데이터를 사용하여 페이지에서 작업 수행
function useData(data) {
  // 예시: 받은 데이터를 사용하여 페이지에 무언가를 수행
  // 실제 사용 시에는 이 부분을 수정하여 원하는 작업을 수행하세요
  
  console.log('수집된 데이터를 사용하여 작업 실행 중...');
  
  // 예: 데이터를 기반으로 폼 자동 완성
  if (document.querySelector('#target-form')) {
    if (data.content) {
      document.querySelector('#content-field').value = data.content;
    }
    
    if (data.pageTitle) {
      document.querySelector('#title-field').value = data.pageTitle;
    }
  }
  
  // 예: 데이터 기반으로 페이지에 요소 추가
  const dataDisplay = document.createElement('div');
  dataDisplay.innerHTML = `
    <div style="background-color: #f0f0f0; padding: 15px; margin: 10px; border-radius: 5px;">
      <h3>수집된 데이터</h3>
      <p><strong>제목:</strong> ${data.pageTitle}</p>
      <p><strong>수집 시간:</strong> ${data.timestamp}</p>
      <p><strong>내용:</strong> ${data.content}</p>
    </div>
  `;
  
  // 페이지의 적절한 위치에 삽입
  const targetElement = document.querySelector('body') || document.body;
  if (targetElement) {
    targetElement.prepend(dataDisplay);
  }
  
  // 선택적: 사용자에게 성공 알림
  const notification = document.createElement('div');
  notification.textContent = '저장된 데이터를 성공적으로 적용했습니다!';
  notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background-color: blue; color: white; padding: 10px; border-radius: 5px; z-index: 10000;';
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
}
