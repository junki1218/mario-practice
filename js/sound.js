/**
 * sound.js
 * ------------------------------------------------------------------
 * 効果音まわり（仕様書10章：正解＝コイン取得音／不正解＝ブザー音／
 * ゲーム開始＝スタート音）。
 *
 * 外部の音声ファイルを用意しなくても鳴らせるよう、Web Audio API で
 * 簡易的な電子音を生成しています。あとで本物の効果音ファイル
 * （mp3/wav等）に差し替えたい場合は、下の SoundManager.play() 内の
 * 実装を <audio> 再生に置き換えるだけで済むようにしてあります。
 *
 * 今後の拡張予定（12章：効果音ON/OFF）は SoundManager.enabled を
 * トグルするだけで実装できます。
 * ------------------------------------------------------------------
 */

const SoundManager = (() => {
  let audioCtx = null;
  let enabled = true; // 将来的に「効果音ON/OFF」機能でこのフラグを切り替える想定

  function getContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContextClass();
    }
    // iOS Safari 等でスリープ状態のことがあるため、必要なら再開する
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  }

  /**
   * 単一の音（オシレーター）を鳴らす
   * @param {number} freq 周波数(Hz)
   * @param {number} durationMs 長さ(ms)
   * @param {string} type 波形 ("sine" | "square" | "triangle" | "sawtooth")
   * @param {number} startDelayMs 開始までの遅延(ms)
   * @param {number} gain 音量(0-1)
   */
  function tone(freq, durationMs, type = "sine", startDelayMs = 0, gain = 0.2) {
    if (!enabled) return;
    try {
      const ctx = getContext();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gainNode.gain.value = gain;

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      const startTime = ctx.currentTime + startDelayMs / 1000;
      const endTime = startTime + durationMs / 1000;

      // 急な音切れでプチノイズが出ないようフェードアウト
      gainNode.gain.setValueAtTime(gain, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, endTime);

      osc.start(startTime);
      osc.stop(endTime + 0.02);
    } catch (e) {
      // Web Audio が使えない環境では無音でフォールバック
      console.warn("SoundManager: playback failed", e);
    }
  }

  return {
    setEnabled(value) {
      enabled = value;
    },
    isEnabled() {
      return enabled;
    },
    /** ゲーム開始音（短いスタート音） */
    playStart() {
      tone(660, 90, "square", 0, 0.15);
      tone(880, 140, "square", 100, 0.15);
    },
    /** 正解音（コイン取得音っぽい2音） */
    playCorrect() {
      tone(988, 80, "square", 0, 0.18);
      tone(1319, 140, "square", 80, 0.18);
    },
    /** 不正解音（ブザー音） */
    playWrong() {
      tone(180, 260, "sawtooth", 0, 0.22);
      tone(120, 320, "sawtooth", 120, 0.22);
    },
  };
})();
