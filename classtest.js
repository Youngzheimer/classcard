// classtest.js
// ClassCard 시험 페이지에서 저장된 단어 데이터로 정답 후보를 하이라이트합니다.

(function () {
  const HIGHLIGHT_COLOR = '#eeeeee'; 
  const OUTLINE_COLOR = '#eab308';

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

  function getSavedData() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getData' }, (res) => {
        resolve(res && res.data ? res.data : null);
      });
    });
  }

  function buildMaps(words) {
    const f2b = new Map(); // front -> back
    const b2f = new Map(); // back -> front
    words.forEach(({ front, back }) => {
      const nf = normalizeText(front);
      const nb = normalizeText(back);
      if (nf) f2b.set(nf, (f2b.get(nf) || new Set()).add(nb));
      if (nb) b2f.set(nb, (b2f.get(nb) || new Set()).add(nf));
    });
    return { f2b, b2f };
  }

  function highlightOptionEl(optionEl) {
    if (!optionEl || optionEl.dataset.ccpHighlighted === '1') return;
    optionEl.style.backgroundColor = HIGHLIGHT_COLOR;
  }

  function processOnce(maps) {
    const cards = document.querySelectorAll('.flip-card');
    cards.forEach((card) => {
      const qEl = card.querySelector('.flip-card-front .front-hidden');
      const questionRaw = qEl ? qEl.innerText : '';
      const nq = normalizeText(questionRaw);
      if (!nq) return;

      console.log(`질문: ${nq}`);

      // 이 카드의 보기들
      const optionEls = card.querySelectorAll('.cc-radio-box-body .cc-radio-box');
      if (!optionEls.length) return;

      // 질문이 front(단어)인 경우: 정답은 back(뜻)
      const expectedBacks = maps.f2b.get(nq);
      // 질문이 back(뜻)인 경우: 정답은 front(단어)
      const expectedFronts = maps.b2f.get(nq);

      console.log(`예상 정답 (Back): ${Array.from(expectedBacks || []).join(', ')}`);
      console.log(`예상 정답 (Front): ${Array.from(expectedFronts || []).join(', ')}`);

      var isHighlighted = false;

      optionEls.forEach((opt) => {
        const optTextRaw = opt.innerText || '';
        const no = normalizeText(optTextRaw);
        if (!no) return;

        console.log(`보기: ${no}`);

        if ((expectedBacks && expectedBacks.has(no)) || (expectedFronts && expectedFronts.has(no))) {
          highlightOptionEl(opt);
          isHighlighted = true;
          console.log(`정답 후보 하이라이트: ${no}`);
        }

      });

      if (!isHighlighted) {
        console.error(`정답 후보가 하이라이트되지 않았습니다: ${nq}`);
      }
    });
  }

  function observeAndProcess(maps) {
    // 초기 한 번 실행
    processOnce(maps);

    // 동적 변경(다음 문제 로딩 등)에 대응
    let scheduled = false;
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(() => {
        scheduled = false;
        processOnce(maps);
      }, 500);
    };

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.addedNodes && m.addedNodes.length) {
          schedule();
          break;
        }
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  async function main() {
    try {
      const saved = await getSavedData();
      if (!saved || !Array.isArray(saved.words) || saved.words.length === 0) {
        console.log('[ClassCard Helper] 저장된 단어 데이터가 없습니다. set 페이지에서 먼저 추출하세요.');
        return;
      }
      const maps = buildMaps(saved.words);
      observeAndProcess(maps);
    } catch (e) {
      console.error('[ClassCard Helper] 처리 중 오류:', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }
})();
