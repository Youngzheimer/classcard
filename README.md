# ClassCard 단어 추출 크롬 익스텐션

이 크롬 익스텐션은 ClassCard 웹사이트의 단어장 페이지에서 단어와 뜻을 자동으로 추출하여 저장하는 도구입니다.

## 기능

- ClassCard 단어장 페이지(`https://www.classcard.net/set/*`)에서 자동으로 단어와 의미 추출
- 추출된 단어 데이터를 브라우저 스토리지에 저장
- CSV 형식으로 추출된 단어 내보내기
- ClassCard 테스트 페이지(`https://www.classcard.net/ClassTest/*`)에서 정답 자동 표시 기능
- 다른 웹사이트에서 저장된 단어 데이터 활용 (선택적 기능)

## 설치 방법

1. Chrome 브라우저에서 `chrome://extensions/` 페이지로 이동합니다.
2. 개발자 모드를 켭니다 (오른쪽 상단 토글).
3. "압축해제된 확장 프로그램을 로드합니다" 버튼을 클릭합니다.
4. 이 프로젝트 폴더를 선택하여 로드합니다.

## 사용 방법

1. 익스텐션을 설치한 후 ClassCard 단어장 페이지(`https://www.classcard.net/set/{세트ID}`)를 방문합니다.
2. 페이지가 로드되면 자동으로 단어장의 모든 단어와 의미가 추출되어 저장됩니다.
3. 익스텐션 아이콘을 클릭하면 추출된 단어 목록을 확인할 수 있습니다.
4. "CSV로 내보내기" 버튼을 클릭하여 단어 데이터를 CSV 파일로 저장할 수 있습니다.
5. "데이터 지우기" 버튼을 클릭하여 저장된 단어 데이터를 삭제할 수 있습니다.
6. ClassCard 테스트 페이지(`https://www.classcard.net/ClassTest/{테스트ID}`)를 방문하면, 저장된 단어 데이터를 기반으로 정답이 자동으로 강조 표시됩니다.

## 단어 추출 원리

익스텐션은 ClassCard 단어장 페이지에서 다음 자바스크립트 코드를 실행하여 단어를 추출합니다:

```javascript
Array.from(document.getElementsByClassName("word-set")[0].children).forEach(e => {
    console.log(e.getElementsByClassName("ex_front")[0].innerText)
    console.log(e.getElementsByClassName("ex_back")[0].innerText)
})
```

이 코드는 각 단어의 앞면(`ex_front`)과 뒷면(`ex_back`) 텍스트를 추출합니다.

## 커스터마이징

- `collector.js` 파일에서 데이터 수집 로직을 수정할 수 있습니다.
- `test_helper.js` 파일에서 테스트 페이지의 정답 표시 로직을 수정할 수 있습니다.
- `user.js` 파일에서 저장된 단어를 다른 웹사이트에서 활용하는 방법을 구현할 수 있습니다.

## 주의사항

- 이 익스텐션은 ClassCard 웹사이트의 HTML 구조에 의존합니다. 웹사이트 구조가 변경되면 익스텐션이 제대로 작동하지 않을 수 있습니다.
- 교육 및 개인적인 학습 목적으로만 사용하세요.

## 기술 스택

- JavaScript
- Chrome Extension API
- Chrome Storage API
