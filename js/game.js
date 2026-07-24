/**
 * game.js
 * ------------------------------------------------------------------
 * ゲーム本体のロジック（状態遷移・出題・判定・タイマー・スコア）。
 * データ（お題・難易度・タイミング）は data.js に、効果音は sound.js に
 * 分離してあります。画面のDOM操作だけをこのファイルで担当します。
 * ------------------------------------------------------------------
 */

(function () {
  "use strict";

  // ================================================================
  // DOM 参照
  // ================================================================
  const screenTitle = document.getElementById("screen-title");
  const screenGame = document.getElementById("screen-game");
  const screenResult = document.getElementById("screen-result");

  const prevWordEl = document.getElementById("prev-word");
  const prevImageEl = document.getElementById("prev-image");
  const prevEmojiEl = document.getElementById("prev-emoji");
  const choicesEl = document.getElementById("choices");
  const scoreEl = document.getElementById("score");
  const timerBarFillEl = document.getElementById("timer-bar-fill");
  const effectOverlayEl = document.getElementById("effect-overlay");

  const resultIconEl = document.getElementById("result-icon");
  const resultScoreEl = document.getElementById("result-score");
  const resultMessageEl = document.getElementById("result-message");
  const btnRetry = document.getElementById("btn-retry");
  const btnToTitle = document.getElementById("btn-to-title");
  const difficultyButtons = document.querySelectorAll("[data-difficulty]");

  // ================================================================
  // ゲーム状態
  // ================================================================
  let state = null;

  function createInitialState(difficultyKey) {
    return {
      difficultyKey,
      score: 0,
      lap: 1,           // 周回数。この数だけコインが連続する（1周目=1回, 2周目=2回…）
      phase: "build",   // "build" | "coin"
      buildIndex: 0,
      coinRoundsTotal: 0,
      coinRoundsDone: 0,
      currentRound: null,
      answered: false,
      timeoutId: null,
      rafId: null,
      roundStartTime: 0,
    };
  }

  // ================================================================
  // ユーティリティ
  // ================================================================
  /**
   * 単語の文字数に応じてマリオ画像の表示サイズ(px)を線形補間で求める。
   * 文字数が多いほど（フレーズが長く育つほど）大きく表示される。
   */
  function getScaledSizePx(word) {
    const { minChars, maxChars, minSizePx, maxSizePx } = VISUAL_CONFIG;
    const len = Math.min(Math.max(word.length, minChars), maxChars);
    const ratio = maxChars === minChars ? 1 : (len - minChars) / (maxChars - minChars);
    return minSizePx + ratio * (maxSizePx - minSizePx);
  }

  /**
   * 「前の人」の単語に応じて、マリオ画像 または コイン絵文字を表示する。
   * コインフェーズ中は仕様書4章の通り「何枚目か」を悟らせないため、
   * コイン絵文字は常に一定サイズで表示する。
   */
  function updatePrevVisual(word) {
    if (word === COIN_WORD) {
      prevImageEl.classList.add("is-hidden");
      prevEmojiEl.classList.remove("is-hidden");
      prevEmojiEl.style.fontSize = `${VISUAL_CONFIG.coinSizePx}px`;
    } else {
      prevEmojiEl.classList.add("is-hidden");
      prevImageEl.classList.remove("is-hidden");
      prevImageEl.style.width = `${getScaledSizePx(word)}px`;
    }
  }

  function shuffle(array) {
    const arr = array.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function showScreen(el) {
    [screenTitle, screenGame, screenResult].forEach((s) => {
      s.classList.toggle("is-active", s === el);
    });
  }

  // ================================================================
  // お題（ラウンド）の生成 — data.js の BUILD_SEQUENCE / コイン設定を利用
  // ================================================================
  function nextRoundData() {
    let round;

    if (state.phase === "build") {
      round = BUILD_SEQUENCE[state.buildIndex];
      state.buildIndex++;
      if (state.buildIndex >= BUILD_SEQUENCE.length) {
        // ビルドフェーズ終了（＝スーパーマリオ→コインの回答が済んだ）→ コインフェーズへ。
        // コインの連続回数は「現在の周回数」と同じ（1周目=1回, 2周目=2回, 3周目=3回…）。
        state.phase = "coin";
        state.coinRoundsTotal = state.lap;
        state.coinRoundsDone = 0;
      }
    } else {
      // コインフェーズ：仕様上「コイン」としか表示せず、何枚目かは出さない。
      // prev="コイン" のラウンドを、この周の回数(state.coinRoundsTotal)ぶん繰り返す。
      state.coinRoundsDone++;
      if (state.coinRoundsDone >= state.coinRoundsTotal) {
        // この周のコインを言い切った → 最初の「スー」に戻り、次の周へ（コインが1回増える）
        round = { prev: COIN_WORD, correct: GAME_START_WORD, dummies: COIN_EXIT_DUMMIES };
        state.phase = "build";
        state.buildIndex = 0;
        state.lap++;
      } else {
        // まだコインが続く → 次もコイン
        round = { prev: COIN_WORD, correct: COIN_WORD, dummies: COIN_DUMMIES };
      }
    }

    return round;
  }

  // ================================================================
  // ラウンド表示
  // ================================================================
  function renderRound(round) {
    state.currentRound = round;
    state.answered = false;

    prevWordEl.textContent = round.prev;
    scoreEl.textContent = String(state.score);
    updatePrevVisual(round.prev);

    const choices = shuffle([round.correct, ...round.dummies]);
    choicesEl.innerHTML = "";
    choices.forEach((word) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice-btn";
      btn.textContent = word;
      btn.addEventListener("click", () => onAnswer(word));
      choicesEl.appendChild(btn);
    });

    startTimer();
  }

  function loadNextRound() {
    const round = nextRoundData();
    renderRound(round);
  }

  // ================================================================
  // タイマー（難易度別の制限時間 / 残り時間バー）
  // ================================================================
  function startTimer() {
    const limitMs = DIFFICULTY_CONFIG[state.difficultyKey].timeLimitMs;
    state.roundStartTime = performance.now();

    timerBarFillEl.style.transition = "none";
    timerBarFillEl.style.width = "100%";
    // 強制リフローしてから transition を再度有効にする
    // (幅を100%→0%へアニメーションさせるため)
    void timerBarFillEl.offsetWidth;
    timerBarFillEl.style.transition = `width ${limitMs}ms linear`;
    timerBarFillEl.style.width = "0%";

    clearTimeout(state.timeoutId);
    state.timeoutId = setTimeout(() => {
      if (!state.answered) {
        onAnswer(null); // 時間切れ = 不正解扱い
      }
    }, limitMs);
  }

  function stopTimer() {
    clearTimeout(state.timeoutId);
    // バーをその場で止める
    const computedWidth = getComputedStyle(timerBarFillEl).width;
    timerBarFillEl.style.transition = "none";
    timerBarFillEl.style.width = computedWidth;
  }

  // ================================================================
  // 回答判定
  // ================================================================
  function onAnswer(selectedWord) {
    if (state.answered) return;
    state.answered = true;
    stopTimer();

    const isCorrect = selectedWord === state.currentRound.correct;

    if (isCorrect) {
      state.score++;
      scoreEl.textContent = String(state.score);
      SoundManager.playCorrect();
      showEffect("correct");
      setTimeout(loadNextRound, TIMING.correctEffectMs);
    } else {
      SoundManager.playWrong();
      showEffect("wrong");
      setTimeout(() => showResult(), TIMING.wrongEffectMs);
    }
  }

  function showEffect(type) {
    effectOverlayEl.className = ""; // reset
    effectOverlayEl.classList.add("effect-overlay", `effect-${type}`, "is-visible");
    effectOverlayEl.textContent = type === "correct" ? "○" : "×";
    setTimeout(() => {
      effectOverlayEl.classList.remove("is-visible");
    }, type === "correct" ? TIMING.correctEffectMs - 50 : TIMING.wrongEffectMs - 50);
  }

  // ================================================================
  // 画面遷移：タイトル / ゲーム / リザルト
  // ================================================================
  function startGame(difficultyKey) {
    state = createInitialState(difficultyKey);
    SoundManager.playStart();
    showScreen(screenGame);
    loadNextRound();
  }

  function showResult() {
    resultIconEl.textContent = "×";
    resultScoreEl.textContent = String(state.score);
    resultMessageEl.textContent = "ゲームオーバー";
    showScreen(screenResult);
  }

  function showTitle() {
    showScreen(screenTitle);
  }

  // ================================================================
  // イベント登録
  // ================================================================
  difficultyButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-difficulty");
      startGame(key);
    });
  });

  btnRetry.addEventListener("click", () => {
    startGame(state.difficultyKey);
  });

  btnToTitle.addEventListener("click", () => {
    showTitle();
  });

  // 初期表示
  showTitle();
})();
