# スーパーマリオゲーム練習Webアプリ（Ver.1.0）

飲み会ゲーム「スーパーマリオゲーム」を一人で練習するためのWebアプリです。
前の人が言った単語だけを見て、記憶を頼りに次の発言を制限時間内に選びます。

仕様書（ユーザー提供）に準拠して実装しています。詳細な要件は本READMEの末尾「仕様書との対応」を参照してください。

## 動かし方

ビルド不要・外部ライブラリ不要の素のHTML/CSS/JSです。

- `index.html` をブラウザで直接開く
- もしくは開発時はローカルサーバーを立てて開く（例: VSCodeの Live Server 拡張、`npx serve` など）

## ファイル構成

```
Mario/
├── index.html        画面のHTML（タイトル / ゲーム / リザルトの3画面）
├── css/
│   └── style.css     スタイル（明朝体・背景差し替え・レスポンシブ）
├── js/
│   ├── data.js        お題データ・難易度・タイミングの設定（★調整はここ）
│   ├── sound.js        効果音（Web Audio APIで生成、外部音源ファイル不要）
│   └── game.js          ゲーム本体のロジック・画面遷移
├── assets/
│   └── README.txt        背景画像の差し替え手順
└── README.md（本ファイル）
```

## ゲームの内容（お題シーケンス）

`js/data.js` の `BUILD_SEQUENCE` に、下記の流れをデータとして定義しています。

```
スー → パー → マリ → オ → スーパー → マリオ → スーパーマリオ → コイン(×複数回) → スー（ループ）
```

- 最初の4ラウンドは「スーパーマリオ」を2文字ずつの断片（スー／パー／マリ／オ）に分けて1つずつ発言し、続く3ラウンドでその断片を組み合わせて「スーパー」「マリオ」「スーパーマリオ」と組み立てていくルールです。
- コインフェーズは「コイン」を連続で言い続ける区間で、仕様書どおり「何枚目か」は一切表示しません。連続回数は**周回数と同じ**です（1周目=コイン1回でスーに戻る／2周目=コイン2回／3周目=コイン3回…と周を重ねるごとに1回ずつ増える）。この周回制御は `game.js` の `state.lap` で行います。
- お題やダミー選択肢の文言を変えたい場合は `js/data.js` の `BUILD_SEQUENCE` を編集すれば反映されます。

## 今後の拡張ポイント（仕様書12章）と実装の起点

Antigravityでの追加開発を想定し、以下のように実装しやすい形にしてあります。

| 拡張項目 | 実装の起点 |
|---|---|
| ハイスコア保存（LocalStorage） | `game.js` の `showResult()` 内で `localStorage.getItem/setItem` を追加 |
| 効果音ON/OFF | `sound.js` の `SoundManager.setEnabled()` を呼ぶトグルボタンをタイトル画面に追加するだけ |
| 背景画像変更 | `assets/README.txt` の手順どおり、CSS変数 `--bg-image` を差し替え |
| ボタンデザイン変更 | `css/style.css` の `.choice-btn` / `.difficulty-btn` を編集 |
| アニメーション追加 | `.effect-overlay` や `.choice-btn` に CSS アニメーションを追加 |
| PWA対応 | `manifest.json` と Service Worker を追加し、`index.html` にリンクを追加 |
| 練習履歴・正答率の表示 | `game.js` の `onAnswer()` 内でラウンドごとの正誤を配列に蓄積し、リザルト画面に表示 |

## 仕様書との対応

- 目的／表示ルール（前の人の単語のみ表示、コインの枚数非表示）→ `data.js` の `BUILD_SEQUENCE` / コイン設定、`game.js` の `renderRound()`
- 回答方法（3択・ランダム配置）→ `game.js` の `renderRound()` 内 `shuffle()`
- 正解時（○エフェクト・即次問題・スコア+1）→ `game.js` の `onAnswer()` 正解分岐
- 不正解時（×表示・ゲーム終了）→ `game.js` の `onAnswer()` 不正解分岐、`showResult()`
- 制限時間（難易度別）→ `data.js` の `DIFFICULTY_CONFIG`
- UIデザイン（明朝体・大きいボタン・背景差し替え）→ `style.css`
- 効果音（任意）→ `sound.js`（Web Audio APIによる生成音。外部ファイル差し替えも可）
- 対応環境・レスポンシブ→ `style.css` のメディアクエリ、`viewport` 設定
