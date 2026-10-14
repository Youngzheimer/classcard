// classtest.js
// ClassCard 시험 페이지에서 저장된 단어 데이터로 정답 후보를 하이라이트합니다.
// 1. 정확히 일치하는 정답 후보를 우선 탐색
// 2. 정확한 후보가 보기 안에 없으면 가장 유사한 보기 선택
// 3. 질문 자체가 일치하지 않으면 저장된 데이터에서 유사한 질문 탐색

(function () {
  'use strict';

  const EXACT_HIGHLIGHT_COLOR = '#fbfbfb';
  const FUZZY_HIGHLIGHT_COLOR = '#fff4bf';
  const OUTLINE_COLOR = '#eab308';

  // 질문이 저장된 키와 비슷하다고 판단할 최소 유사도.
  // 0~1 범위이며, 값이 클수록 더 엄격하게 일치 여부를 판단합니다.
  const QUESTION_FUZZY_THRESHOLD = 0.42;

  // 비슷한 질문 후보를 함께 고려할 때 허용하는 점수 차이
  const QUESTION_TIE_MARGIN = 0.025;

  // 재검사 예약 지연 시간
  const PROCESS_DELAY = 500;

  /**
   * 텍스트 정규화.
   * 기존 코드의 정규화 규칙을 유지합니다.
   */
  function normalizeText(t) {
    if (t == null) return '';

    return String(t)
      .replace(/\s+/g, ' ')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\[.*?\]/g, '')
      .replace(/;/g, ',')
      .trim()
      .toLowerCase();
  }

  /**
   * 유사도 계산용 정규화.
   * 구두점 차이 때문에 유사도가 과도하게 낮아지는 것을 방지합니다.
   */
  function normalizeForSimilarity(t) {
    return normalizeText(t)
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * 저장된 단어 데이터를 가져옵니다.
   */
  function getSavedData() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: 'getData' },
        (res) => {
          resolve(res && res.data ? res.data : null);
        }
      );
    });
  }

  /**
   * 양방향 검색 맵을 생성합니다.
   *
   * f2b: front -> back
   * b2f: back -> front
   *
   * 같은 질문에 여러 답이 연결될 수 있으므로 Set을 사용합니다.
   */
  function buildMaps(words) {
    const f2b = new Map();
    const b2f = new Map();

    words.forEach(({ front, back }) => {
      const nf = normalizeText(front);
      const nb = normalizeText(back);

      // 질문과 답이 모두 있는 유효한 데이터만 사용합니다.
      if (!nf || !nb) return;

      if (!f2b.has(nf)) {
        f2b.set(nf, new Set());
      }
      f2b.get(nf).add(nb);

      if (!b2f.has(nb)) {
        b2f.set(nb, new Set());
      }
      b2f.get(nb).add(nf);
    });

    return { f2b, b2f };
  }

  /**
   * Levenshtein 편집 거리.
   * 두 문자열을 같게 만들기 위해 필요한 삽입/삭제/교체 횟수를 계산합니다.
   */
  function levenshteinDistance(a, b) {
    const aa = Array.from(a);
    const bb = Array.from(b);

    if (aa.length === 0) return bb.length;
    if (bb.length === 0) return aa.length;

    let previous = Array.from(
      { length: bb.length + 1 },
      (_, i) => i
    );

    for (let i = 1; i <= aa.length; i++) {
      const current = [i];

      for (let j = 1; j <= bb.length; j++) {
        const substitutionCost =
          aa[i - 1] === bb[j - 1] ? 0 : 1;

        current[j] = Math.min(
          current[j - 1] + 1,                  // 삽입
          previous[j] + 1,                     // 삭제
          previous[j - 1] + substitutionCost   // 교체
        );
      }

      previous = current;
    }

    return previous[bb.length];
  }

  /**
   * 0~1 범위의 문자열 유사도를 계산합니다.
   *
   * 반영하는 요소:
   * - 편집 거리: 철자가 얼마나 비슷한가
   * - 토큰 겹침: 공백으로 구분된 단어가 얼마나 겹치는가
   * - 부분 문자열: 한 문자열이 다른 문자열 안에 포함되는가
   *
   * 이 값은 확률이 아니라 문자열 유사도 점수입니다.
   */
  function textSimilarity(textA, textB) {
    const a = normalizeForSimilarity(textA);
    const b = normalizeForSimilarity(textB);

    if (!a || !b) return 0;
    if (a === b) return 1;

    // 공백을 제거한 문자열로 철자 유사도를 계산합니다.
    const compactA = a.replace(/\s/g, '');
    const compactB = b.replace(/\s/g, '');

    const maxLength = Math.max(
      Array.from(compactA).length,
      Array.from(compactB).length
    );

    const distance = levenshteinDistance(compactA, compactB);

    const editSimilarity =
      maxLength === 0 ? 1 : 1 - distance / maxLength;

    // 공백으로 구분된 토큰의 겹침을 계산합니다.
    const tokensA = new Set(a.split(' ').filter(Boolean));
    const tokensB = new Set(b.split(' ').filter(Boolean));

    let intersection = 0;

    for (const token of tokensA) {
      if (tokensB.has(token)) {
        intersection++;
      }
    }

    const tokenDenominator = tokensA.size + tokensB.size;

    const tokenSimilarity =
      tokenDenominator === 0
        ? 0
        : (2 * intersection) / tokenDenominator;

    // 한 문자열이 다른 문자열에 포함된 경우를 보정합니다.
    let substringSimilarity = 0;

    if (
      compactA.length >= 2 &&
      compactB.length >= 2 &&
      (
        compactA.includes(compactB) ||
        compactB.includes(compactA)
      )
    ) {
      const shorterLength = Math.min(
        Array.from(compactA).length,
        Array.from(compactB).length
      );

      const longerLength = Math.max(
        Array.from(compactA).length,
        Array.from(compactB).length
      );

      const lengthRatio = shorterLength / longerLength;

      substringSimilarity = 0.55 + 0.25 * lengthRatio;
    }

    return Math.max(
      editSimilarity,
      tokenSimilarity * 0.95,
      substringSimilarity
    );
  }

  /**
   * 질문과 가장 유사한 맵 키를 찾습니다.
   * 최고 점수와 비슷한 점수의 키들도 함께 반환합니다.
   */
  function findBestMapKeyMatch(query, map) {
    const scored = [];
    let bestScore = 0;

    for (const key of map.keys()) {
      const score = textSimilarity(query, key);

      scored.push({ key, score });

      if (score > bestScore) {
        bestScore = score;
      }
    }

    return {
      score: bestScore,
      matches: scored.filter(
        (item) => bestScore - item.score <= QUESTION_TIE_MARGIN
      ),
    };
  }

  /**
   * 질문에 대응하는 정답 후보를 구합니다.
   *
   * 1. 정확한 질문 키로 검색
   * 2. 양쪽 맵 모두 찾지 못했으면 유사한 질문 키 검색
   */
  function findExpectedAnswers(question, maps) {
    const exactBacks = maps.f2b.get(question);
    const exactFronts = maps.b2f.get(question);

    const exactCandidates = new Set();

    if (exactBacks) {
      exactBacks.forEach((answer) => {
        if (answer) exactCandidates.add(answer);
      });
    }

    if (exactFronts) {
      exactFronts.forEach((answer) => {
        if (answer) exactCandidates.add(answer);
      });
    }

    // 질문과 정확히 일치하는 항목을 찾았다면 그대로 사용합니다.
    if (exactCandidates.size > 0) {
      return {
        candidates: exactCandidates,
        mode: 'exact-question',
        score: 1,
        matchedKeys: [question],
      };
    }

    // 정확한 질문을 찾지 못한 경우 양쪽 맵에서 유사한 키를 검색합니다.
    const frontMatch = findBestMapKeyMatch(question, maps.f2b);
    const backMatch = findBestMapKeyMatch(question, maps.b2f);

    const bestScore = Math.max(
      frontMatch.score,
      backMatch.score
    );

    if (bestScore < QUESTION_FUZZY_THRESHOLD) {
      return {
        candidates: new Set(),
        mode: 'no-question-match',
        score: bestScore,
        matchedKeys: [],
      };
    }

    const candidates = new Set();
    const matchedKeys = [];

    // 최고 점수와 충분히 가까운 맵 키들의 답을 모읍니다.
    if (bestScore - frontMatch.score <= QUESTION_TIE_MARGIN) {
      for (const match of frontMatch.matches) {
        if (bestScore - match.score > QUESTION_TIE_MARGIN) {
          continue;
        }

        matchedKeys.push({
          direction: 'front->back',
          key: match.key,
          score: match.score,
        });

        const answers = maps.f2b.get(match.key);

        if (answers) {
          answers.forEach((answer) => {
            if (answer) candidates.add(answer);
          });
        }
      }
    }

    if (bestScore - backMatch.score <= QUESTION_TIE_MARGIN) {
      for (const match of backMatch.matches) {
        if (bestScore - match.score > QUESTION_TIE_MARGIN) {
          continue;
        }

        matchedKeys.push({
          direction: 'back->front',
          key: match.key,
          score: match.score,
        });

        const answers = maps.b2f.get(match.key);

        if (answers) {
          answers.forEach((answer) => {
            if (answer) candidates.add(answer);
          });
        }
      }
    }

    return {
      candidates,
      mode: candidates.size > 0
        ? 'fuzzy-question'
        : 'no-question-match',
      score: bestScore,
      matchedKeys,
    };
  }

  /**
   * 이전 실행에서 적용한 하이라이트를 원래 인라인 스타일로 복원합니다.
   * 같은 DOM 요소가 다음 문제에 재사용되는 경우를 처리합니다.
   */
  function clearPreviousHighlights() {
    const highlighted = document.querySelectorAll(
      '[data-ccp-highlighted="1"]'
    );

    highlighted.forEach((el) => {
      el.style.backgroundColor =
        el.dataset.ccpOriginalBackgroundColor || '';

      el.style.outline =
        el.dataset.ccpOriginalOutline || '';

      el.style.outlineOffset =
        el.dataset.ccpOriginalOutlineOffset || '';

      delete el.dataset.ccpHighlighted;
      delete el.dataset.ccpMatchType;
      delete el.dataset.ccpSimilarity;

      delete el.dataset.ccpOriginalBackgroundColor;
      delete el.dataset.ccpOriginalOutline;
      delete el.dataset.ccpOriginalOutlineOffset;
    });
  }

  /**
   * 정확히 일치하는 후보와 추정 후보를 서로 다른 스타일로 표시합니다.
   */
  function highlightOptionEl(
    optionEl,
    matchType = 'exact',
    score = null
  ) {
    if (!optionEl) return;

    // 원래 스타일은 최초 하이라이트 시 한 번만 저장합니다.
    if (optionEl.dataset.ccpHighlighted !== '1') {
      optionEl.dataset.ccpOriginalBackgroundColor =
        optionEl.style.backgroundColor;

      optionEl.dataset.ccpOriginalOutline =
        optionEl.style.outline;

      optionEl.dataset.ccpOriginalOutlineOffset =
        optionEl.style.outlineOffset;
    }

    optionEl.dataset.ccpHighlighted = '1';
    optionEl.dataset.ccpMatchType = matchType;

    if (matchType === 'fuzzy') {
      optionEl.style.backgroundColor = FUZZY_HIGHLIGHT_COLOR;
      optionEl.style.outline = `2px solid ${OUTLINE_COLOR}`;
      optionEl.style.outlineOffset = '1px';

      if (typeof score === 'number') {
        optionEl.dataset.ccpSimilarity = score.toFixed(3);
      }
    } else {
      optionEl.style.backgroundColor = EXACT_HIGHLIGHT_COLOR;
    }
  }

  /**
   * 카드 하나의 질문과 보기를 검사하고 정답 후보를 하이라이트합니다.
   */
  function processCard(card, maps) {
    const qEl = card.querySelector(
      '.flip-card-front .front-hidden'
    );

    const questionRaw = qEl ? qEl.innerText : '';
    const question = normalizeText(questionRaw);

    if (!question) return;

    const optionEls = card.querySelectorAll(
      '.cc-radio-box-body'
    );

    if (!optionEls.length) return;

    const result = findExpectedAnswers(question, maps);
    const expectedCandidates = result.candidates;

    console.log(`[ClassCard Helper] 질문: ${question}`);
    console.log(
      '[ClassCard Helper] 정답 후보:',
      Array.from(expectedCandidates)
    );

    // 질문 자체를 저장 데이터와 연결하지 못한 경우
    if (expectedCandidates.size === 0) {
      console.warn(
        '[ClassCard Helper] 유사한 질문을 찾지 못했습니다.',
        {
          question,
          bestSimilarity: result.score,
        }
      );
      return;
    }

    if (result.mode === 'fuzzy-question') {
      console.warn(
        '[ClassCard Helper] 유사한 질문을 사용해 후보를 추론했습니다.',
        {
          matchedKeys: result.matchedKeys,
          similarity: result.score,
        }
      );
    }

    // 비교 대상인 보기 label들을 수집합니다.
    const options = [];

    optionEls.forEach((container) => {
      container.querySelectorAll('label').forEach((labelEl) => {
        const rawText = labelEl.innerText || '';
        const normalized = normalizeText(rawText);

        if (!normalized) return;

        options.push({
          element: labelEl,
          text: normalized,
        });
      });
    });

    if (options.length === 0) return;

    // 1단계: 정답 후보와 정확히 일치하는 보기를 모두 표시합니다.
    let exactMatches = 0;

    for (const option of options) {
      if (expectedCandidates.has(option.text)) {
        highlightOptionEl(option.element, 'exact');
        exactMatches++;

        console.log(
          '[ClassCard Helper] 정확히 일치:',
          option.text
        );
      }
    }

    // 정확히 일치하는 보기가 있다면 유사도 추정을 추가하지 않습니다.
    if (exactMatches > 0) {
      return;
    }

    // 2단계: 일치하는 보기가 하나도 없으면 모든 보기를 비교합니다.
    let bestOption = null;
    let bestScore = -1;

    for (const option of options) {
      let optionScore = 0;

      for (const candidate of expectedCandidates) {
        const score = textSimilarity(option.text, candidate);

        if (score > optionScore) {
          optionScore = score;
        }
      }

      if (optionScore > bestScore) {
        bestScore = optionScore;

        bestOption = {
          ...option,
          score: optionScore,
        };
      }
    }

    // 문제에 보기가 존재하지만 정확한 일치가 없으면
    // 가장 높은 점수를 받은 보기 하나를 선택합니다.
    if (bestOption) {
      highlightOptionEl(
        bestOption.element,
        'fuzzy',
        bestOption.score
      );

      console.warn(
        '[ClassCard Helper] 정확한 정답이 없어 가장 유사한 보기를 선택했습니다.',
        {
          question,
          option: bestOption.text,
          similarity: bestOption.score,
          candidates: Array.from(expectedCandidates),
        }
      );
    }
  }

  /**
   * 페이지에 있는 모든 문제를 검사합니다.
   */
  function processOnce(maps) {
    // 문제나 보기가 교체되었을 때 이전 하이라이트가 남지 않도록 합니다.
    clearPreviousHighlights();

    const cards = document.querySelectorAll('.flip-card');

    cards.forEach((card) => {
      try {
        processCard(card, maps);
      } catch (error) {
        console.error(
          '[ClassCard Helper] 카드 처리 중 오류:',
          error
        );
      }
    });
  }

  /**
   * 다음 문제 로딩 등 DOM 변경에 대응합니다.
   */
  function observeAndProcess(maps) {
    processOnce(maps);

    let scheduled = false;

    const schedule = () => {
      if (scheduled) return;

      scheduled = true;

      setTimeout(() => {
        scheduled = false;
        processOnce(maps);
      }, PROCESS_DELAY);
    };

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (
          (mutation.addedNodes && mutation.addedNodes.length > 0) ||
          mutation.type === 'characterData'
        ) {
          schedule();
          break;
        }
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  /**
   * 진입점
   */
  async function main() {
    try {
      const saved = await getSavedData();

      if (
        !saved ||
        !Array.isArray(saved.words) ||
        saved.words.length === 0
      ) {
        console.log(
          '[ClassCard Helper] 저장된 단어 데이터가 없습니다. set 페이지에서 먼저 추출하세요.'
        );
        return;
      }

      const maps = buildMaps(saved.words);

      console.log(
        `[ClassCard Helper] 저장된 단어 ${saved.words.length}개를 불러왔습니다.`
      );

      observeAndProcess(maps);
    } catch (error) {
      console.error(
        '[ClassCard Helper] 처리 중 오류:',
        error
      );
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }
})();
