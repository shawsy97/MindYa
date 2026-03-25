// src/tasks/taskBank.js
const WCST_COLORS = [
  { key: "red", label: "红", hex: "#D94A4A" },
  { key: "green", label: "绿", hex: "#4FAE6A" },
  { key: "yellow", label: "黄", hex: "#D9B43B" },
  { key: "blue", label: "蓝", hex: "#4A78D9" },
];

const WCST_SHAPES = [
  { key: "triangle", label: "三角形", symbol: "▲" },
  { key: "star", label: "星形", symbol: "★" },
  { key: "cross", label: "十字", symbol: "✚" },
  { key: "circle", label: "圆形", symbol: "●" },
];

const WCST_NUMBERS = [1, 2, 3, 4];

const WCST_REF_CARDS = [
  { id: 0, color: "red", shape: "triangle", number: 1 },
  { id: 1, color: "green", shape: "star", number: 2 },
  { id: 2, color: "yellow", shape: "cross", number: 3 },
  { id: 3, color: "blue", shape: "circle", number: 4 },
];

function pickOne(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getColorMeta(key) {
  return WCST_COLORS.find((x) => x.key === key);
}

function getShapeMeta(key) {
  return WCST_SHAPES.find((x) => x.key === key);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function mean(xs) {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function sd(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = mean(xs.map((x) => (x - m) ** 2));
  return Math.sqrt(v);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// =========================
// N-BACK
// =========================
const NBACK_STIMS = "B C D F G H J K L M P Q R S T V X Y Z".split(" ");

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function makeNBackSequence({
  n = 2,
  totalTrials = 60,
  targetRate = 0.25,
  stimMs = 1200,
  isiMs = 800,
  phase = "main",
}) {
  const seq = [];
  const nTargets = Math.round(totalTrials * targetRate);
  const targetPositions = new Set();

  while (targetPositions.size < nTargets) {
    const pos = Math.floor(Math.random() * (totalTrials - n)) + n;
    targetPositions.add(pos);
  }

  for (let i = 0; i < totalTrials; i++) {
    let stim;
    let isTarget = false;

    if (i >= n && targetPositions.has(i)) {
      stim = seq[i - n].stim;
      isTarget = true;
    } else {
      const forbidden = i >= n ? seq[i - n].stim : null;
      let candidate = pickRandom(NBACK_STIMS);
      while (candidate === forbidden) {
        candidate = pickRandom(NBACK_STIMS);
      }
      stim = candidate;
    }

    seq.push({
      i,
      phase,
      mode: "nback",
      stim,
      n,
      isTarget,
      stimMs,
      isiMs,
      expectedKey: "match",
    });
  }

  return seq;
}

function makeNBackTrials({
  n = 2,
  practiceTrials = 12,
  nTrials = 60,
  targetRate = 0.25,
  stimMs = 1200,
  isiMs = 800,
}) {
  return {
    practiceTrials: makeNBackSequence({
      n,
      totalTrials: practiceTrials,
      targetRate,
      stimMs,
      isiMs,
      phase: "practice",
    }),
    trials: makeNBackSequence({
      n,
      totalTrials: nTrials,
      targetRate,
      stimMs,
      isiMs,
      phase: "main",
    }),
  };
}

function safeRate(num, den) {
  return den > 0 ? num / den : 0;
}

function zApprox(p) {
  if (p <= 0) return -2.33;
  if (p >= 1) return 2.33;
  const table = [
    [0.01, -2.33], [0.05, -1.64], [0.1, -1.28], [0.2, -0.84],
    [0.3, -0.52], [0.4, -0.25], [0.5, 0], [0.6, 0.25],
    [0.7, 0.52], [0.8, 0.84], [0.9, 1.28], [0.95, 1.64], [0.99, 2.33],
  ];
  let best = table[0][1];
  let minDiff = Infinity;
  for (const [pp, zz] of table) {
    const d = Math.abs(pp - p);
    if (d < minDiff) {
      minDiff = d;
      best = zz;
    }
  }
  return best;
}

function scoreNBack(trialResults, n = 2) {
  const mainOnly = trialResults.filter((t) => t.phase === "main");
  const analyzable = mainOnly.filter((t) => t.i >= n);

  const targets = analyzable.filter((t) => t.isTarget);
  const nonTargets = analyzable.filter((t) => !t.isTarget);

  const hits = targets.filter((t) => t.responded && t.correct).length;
  const misses = targets.filter((t) => !t.responded).length;
  const falseAlarms = nonTargets.filter((t) => t.responded).length;
  const correctRejections = nonTargets.filter((t) => !t.responded).length;

  const acc = analyzable.length
    ? analyzable.filter((t) => t.correct).length / analyzable.length
    : 0;

  const hitRTs = targets
    .filter((t) => t.responded && t.correct && typeof t.rtMs === "number")
    .map((t) => t.rtMs);

  const hitRate = safeRate(hits, targets.length);
  const faRate = safeRate(falseAlarms, nonTargets.length);
  const dPrime = Number((zApprox(hitRate) - zApprox(faRate)).toFixed(2));

  return {
    summary: {
      n: analyzable.length,
      level: `${n}-back`,
      accuracy: Number(acc.toFixed(3)),
      hits,
      misses,
      falseAlarms,
      correctRejections,
      meanRT: Math.round(mean(hitRTs)),
      sdRT: Math.round(sd(hitRTs)),
      hitRate: Number(hitRate.toFixed(3)),
      falseAlarmRate: Number(faRate.toFixed(3)),
      dPrime,
    },
  };
}

// =========================
// CPT X-type
// =========================
function makeCPT_X_Trials({
  nTrials = 120,
  targetProb = 0.2,
  stimMs = 500,
  isiMs = 500,
}) {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const trials = [];

  for (let i = 0; i < nTrials; i++) {
    const isTarget = Math.random() < targetProb;
    const stim = isTarget
      ? "X"
      : letters[Math.floor(Math.random() * letters.length)];

    trials.push({
      phase: "main",
      mode: "single",
      stim,
      isTarget,
      stimMs,
      isiMs,
      expectedKey: "Space",
    });
  }

  return trials;
}

function scoreCPT_X(trialResults) {
  const targets = trialResults.filter((t) => t.isTarget);
  const nontargets = trialResults.filter((t) => !t.isTarget);

  const hits = targets.filter((t) => t.responded && t.correct).length;
  const omissions = targets.filter((t) => !t.responded).length;
  const commissions = nontargets.filter((t) => t.responded).length;

  const acc =
    trialResults.length > 0
      ? trialResults.filter((t) => t.correct).length / trialResults.length
      : 0;

  const hitRTs = targets
    .filter((t) => t.responded && t.correct && typeof t.rtMs === "number")
    .map((t) => t.rtMs);

  return {
    summary: {
      n: trialResults.length,
      accuracy: Number(acc.toFixed(3)),
      hits,
      omissions,
      commissions,
      meanRT: Math.round(mean(hitRTs)),
      sdRT: Math.round(sd(hitRTs)),
    },
  };
}

// =========================
// SST
// =========================
function sampleArrowKey() {
  return Math.random() < 0.5 ? "ArrowLeft" : "ArrowRight";
}

function arrowKeyToStim(key) {
  return key === "ArrowLeft" ? "←" : "→";
}

function makeSSTBlock({
  nTrials,
  stopProb,
  stimMs,
  isiMs,
  initialSSD,
  ssdStep,
  minSSD,
  maxSSD,
  phase = "main",
}) {
  const stopCount = Math.round(nTrials * stopProb);
  const goCount = nTrials - stopCount;

  const pool = [
    ...Array.from({ length: goCount }, () => ({ trialType: "go" })),
    ...Array.from({ length: stopCount }, () => ({ trialType: "stop" })),
  ];

  const mixed = shuffle(pool);

  return mixed.map((x, i) => {
    const expectedKey = sampleArrowKey();

    return {
      i,
      phase,
      mode: "sst",
      trialType: x.trialType,
      stim: arrowKeyToStim(expectedKey),
      expectedKey,
      stimMs,
      isiMs,
      stopSignalDelayMs: x.trialType === "stop" ? initialSSD : null,
      stopSignalType: "text",
      stopSignalText: "停！",
      ssdStep,
      minSSD,
      maxSSD,
    };
  });
}

function makeSST_Trials(config) {
  const practiceTrials = makeSSTBlock({
    nTrials: config.practiceTrials ?? 12,
    stopProb: config.practiceStopProb ?? 0.25,
    stimMs: config.stimMs,
    isiMs: config.isiMs,
    initialSSD: config.initialSSD,
    ssdStep: config.ssdStep,
    minSSD: config.minSSD,
    maxSSD: config.maxSSD,
    phase: "practice",
  });

  const mainTrials = makeSSTBlock({
    nTrials: config.nTrials,
    stopProb: config.stopProb,
    stimMs: config.stimMs,
    isiMs: config.isiMs,
    initialSSD: config.initialSSD,
    ssdStep: config.ssdStep,
    minSSD: config.minSSD,
    maxSSD: config.maxSSD,
    phase: "main",
  });

  return {
    practiceTrials,
    trials: mainTrials,
    initialSSD: config.initialSSD,
  };
}

function scoreSST(trialResults) {
  const mainOnly = trialResults.filter((t) => t.phase === "main");
  const goTrials = mainOnly.filter((t) => t.trialType === "go");
  const stopTrials = mainOnly.filter((t) => t.trialType === "stop");

  const goCorrect = goTrials.filter((t) => t.correct);
  const goRTs = goCorrect
    .filter((t) => typeof t.rtMs === "number")
    .map((t) => t.rtMs);

  const stopSuccess = stopTrials.filter((t) => t.stopSuccess).length;
  const stopFail = stopTrials.filter((t) => !t.stopSuccess).length;

  const stopSuccessRate =
    stopTrials.length > 0 ? stopSuccess / stopTrials.length : 0;

  const ssdValues = stopTrials
    .map((t) => t.stopSignalDelayMs)
    .filter((x) => typeof x === "number");

  const meanGoRT = mean(goRTs);
  const meanSSD = mean(ssdValues);
  const ssrt = Math.max(0, Math.round(meanGoRT - meanSSD));

  return {
    summary: {
      n: mainOnly.length,
      goN: goTrials.length,
      stopN: stopTrials.length,
      goAccuracy:
        goTrials.length > 0
          ? Number((goCorrect.length / goTrials.length).toFixed(3))
          : 0,
      meanGoRT: Math.round(meanGoRT),
      sdGoRT: Math.round(sd(goRTs)),
      stopSuccess,
      stopFail,
      stopSuccessRate: Number(stopSuccessRate.toFixed(3)),
      meanSSD: Math.round(meanSSD),
      ssrt,
    },
  };
}
// ===== Stroop =====

const STROOP_COLORS = [
  { key: "red", label: "红", hex: "#D94A4A" },
  { key: "yellow", label: "黄", hex: "#D9B43B" },
  { key: "green", label: "绿", hex: "#4FAE6A" },
  { key: "blue", label: "蓝", hex: "#4A78D9" },
];

const STROOP_NEUTRAL_WORDS = ["球", "桥", "书", "云", "花", "门", "灯", "山"];

function sampleOne(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function sampleOneExcept(arr, exceptKey, getKey = (x) => x.key) {
  const filtered = arr.filter((x) => getKey(x) !== exceptKey);
  return sampleOne(filtered);
}

function makeStroopTrials({
  practiceTrials = 12,
  nTrialsPerCond = 24,
  stimMs = 2000,
  isiMs = 800,
}) {
  const practice = [];
  const main = [];

  // 练习：一致/冲突/中性混合
  for (let i = 0; i < practiceTrials; i++) {
    const cond = ["congruent", "incongruent", "neutral"][i % 3];
    const color = sampleOne(STROOP_COLORS);

    if (cond === "congruent") {
      practice.push({
        phase: "practice",
        mode: "stroop",
        condition: "congruent",
        text: color.label,
        colorKey: color.key,
        colorLabel: color.label,
        colorHex: color.hex,
        expectedKey: color.key,
        stimMs,
        isiMs,
      });
    } else if (cond === "incongruent") {
      const wordColor = sampleOneExcept(STROOP_COLORS, color.key);
      practice.push({
        phase: "practice",
        mode: "stroop",
        condition: "incongruent",
        text: wordColor.label,
        colorKey: color.key,
        colorLabel: color.label,
        colorHex: color.hex,
        expectedKey: color.key,
        stimMs,
        isiMs,
      });
    } else {
      practice.push({
        phase: "practice",
        mode: "stroop",
        condition: "neutral",
        text: sampleOne(STROOP_NEUTRAL_WORDS),
        colorKey: color.key,
        colorLabel: color.label,
        colorHex: color.hex,
        expectedKey: color.key,
        stimMs,
        isiMs,
      });
    }
  }

  // 正式 trials：三类均衡
  for (let i = 0; i < nTrialsPerCond; i++) {
    const color1 = sampleOne(STROOP_COLORS);
    main.push({
      phase: "main",
      mode: "stroop",
      condition: "congruent",
      text: color1.label,
      colorKey: color1.key,
      colorLabel: color1.label,
      colorHex: color1.hex,
      expectedKey: color1.key,
      stimMs,
      isiMs,
    });

    const inkColor = sampleOne(STROOP_COLORS);
    const wordColor = sampleOneExcept(STROOP_COLORS, inkColor.key);
    main.push({
      phase: "main",
      mode: "stroop",
      condition: "incongruent",
      text: wordColor.label,
      colorKey: inkColor.key,
      colorLabel: inkColor.label,
      colorHex: inkColor.hex,
      expectedKey: inkColor.key,
      stimMs,
      isiMs,
    });

    const color3 = sampleOne(STROOP_COLORS);
    main.push({
      phase: "main",
      mode: "stroop",
      condition: "neutral",
      text: sampleOne(STROOP_NEUTRAL_WORDS),
      colorKey: color3.key,
      colorLabel: color3.label,
      colorHex: color3.hex,
      expectedKey: color3.key,
      stimMs,
      isiMs,
    });
  }

  // 打乱正式试次
  for (let i = main.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [main[i], main[j]] = [main[j], main[i]];
  }

  return {
    practiceTrials: practice,
    trials: main,
  };
}

function scoreStroop(trialResults) {
  const mainOnly = trialResults.filter((t) => t.phase === "main");

  const byCond = (cond) => mainOnly.filter((t) => t.condition === cond);
  const correctRTs = (rows) =>
    rows.filter((t) => t.correct && typeof t.rtMs === "number").map((t) => t.rtMs);

  const calc = (rows) => {
    const rts = correctRTs(rows);
    const acc = rows.length
      ? rows.filter((t) => t.correct).length / rows.length
      : 0;
    return {
      n: rows.length,
      accuracy: Number(acc.toFixed(3)),
      meanRT: Math.round(mean(rts)),
      sdRT: Math.round(sd(rts)),
    };
  };

  const congruent = calc(byCond("congruent"));
  const incongruent = calc(byCond("incongruent"));
  const neutral = calc(byCond("neutral"));

  const allCorrectRTs = correctRTs(mainOnly);
  const totalAcc = mainOnly.length
    ? mainOnly.filter((t) => t.correct).length / mainOnly.length
    : 0;

  return {
    summary: {
      n: mainOnly.length,
      accuracy: Number(totalAcc.toFixed(3)),
      meanRT: Math.round(mean(allCorrectRTs)),
      sdRT: Math.round(sd(allCorrectRTs)),
      congruent,
      incongruent,
      neutral,
      interferenceRT: Math.max(0, incongruent.meanRT - congruent.meanRT),
      interferenceAcc: Number(
        (congruent.accuracy - incongruent.accuracy).toFixed(3)
      ),
    },
  };
}
// ===== WCST =====

function makeWCSTTrials({
  maxTrials = 72,
  categoriesToComplete = 3,
  correctStreakToShift = 6,
  stimMs = 2000,
  isiMs = 800,
}) {
  const rules = ["color", "shape", "number"];
  const ruleSequence = rules.slice(0, categoriesToComplete);

  const trials = [];
  let currentRuleIndex = 0;
  let currentRule = ruleSequence[currentRuleIndex];
  let currentStreak = 0;
  let completedCategories = 0;

  for (let i = 0; i < maxTrials; i++) {
    const colorCard = pickOne(WCST_REF_CARDS);
    const shapeCard = pickOne(WCST_REF_CARDS);
    const numberCard = pickOne(WCST_REF_CARDS);

    const stimulus = {
      color: colorCard.color,
      shape: shapeCard.shape,
      number: numberCard.number,
    };

    // 保证三个维度对应的目标卡尽量不同，避免歧义
    const colorTarget = WCST_REF_CARDS.findIndex((x) => x.color === stimulus.color);
    const shapeTarget = WCST_REF_CARDS.findIndex((x) => x.shape === stimulus.shape);
    const numberTarget = WCST_REF_CARDS.findIndex((x) => x.number === stimulus.number);

    const uniqueTargets = new Set([colorTarget, shapeTarget, numberTarget]);
    if (uniqueTargets.size < 3) {
      i--;
      continue;
    }

    trials.push({
      i,
      phase: "main",
      mode: "wcst",
      stimulus,
      referenceCards: WCST_REF_CARDS,
      ruleAtTrialStart: currentRule,
      categoryIndex: currentRuleIndex,
      correctStreakToShift,
      stimMs,
      isiMs,
    });

    // 这里只生成试次，不在生成阶段切规则
    // 真正的切换在 TaskRunner 根据作答结果动态处理
  }

  return {
    trials,
    meta: {
      currentRule,
      currentRuleIndex,
      completedCategories,
      currentStreak,
      ruleSequence,
      correctStreakToShift,
      categoriesToComplete,
    },
  };
}
function scoreWCST(trialResults) {
  const mainOnly = trialResults.filter((t) => t.phase === "main");
  const correctN = mainOnly.filter((t) => t.correct).length;
  const totalErrors = mainOnly.length - correctN;

  const perseverativeErrors = mainOnly.filter((t) => t.isPerseverativeError).length;

  const categoryCompletedSet = new Set(
    mainOnly
      .filter((t) => t.categoryCompleted === true)
      .map((t) => t.categoryIndex)
  );

  const categoriesCompleted = categoryCompletedSet.size;

  const firstCategoryEnd = mainOnly.find((t) => t.categoryCompleted === true);
  const trialsToFirstCategory = firstCategoryEnd ? firstCategoryEnd.i + 1 : null;

  const acc = mainOnly.length ? correctN / mainOnly.length : 0;

  return {
    summary: {
      n: mainOnly.length,
      accuracy: Number(acc.toFixed(3)),
      correctN,
      totalErrors,
      categoriesCompleted,
      perseverativeErrors,
      trialsToFirstCategory,
    },
  };
}
export const TASK_BANK = {
  CPT_X: {
    id: "CPT_X",
    name: "专注小挑战",
    durationHint: "约 3 分钟",
    instructions: [
      "屏幕会连续出现字母。",
      "看到“X”时，请尽快按下按钮或空格键。",
      "看到其他字母时不要按。",
      "尽量又快又准。",
    ],
    config: { nTrials: 180, targetProb: 0.2, stimMs: 500, isiMs: 500 },
    init: (config) => {
      const trials = makeCPT_X_Trials(config);
      return { trials };
    },
    score: (trialResults) => scoreCPT_X(trialResults),
  },

  SST: {
    id: "SST",
    name: "快停反应赛",
    durationHint: "约 4 分钟",
    instructions: [
      "看到 ← 按左边，看到 → 按右边。",
      "有时候会突然出现“停！”，这时要立刻忍住，不要按。",
      "大多数时候正常按，只有看到“停！”才停下。",
      "先来一小段练习，再进入正式挑战。",
    ],
    config: {
      practiceTrials: 12,
      practiceStopProb: 0.25,
      nTrials: 160,
      stopProb: 0.25,
      stimMs: 1500,
      isiMs: 700,
      initialSSD: 250,
      ssdStep: 50,
      minSSD: 100,
      maxSSD: 600,
    },
    init: (config) => {
      const { practiceTrials, trials, initialSSD } = makeSST_Trials(config);
      return {
        practiceTrials,
        trials,
        meta: {
          currentSSD: initialSSD,
        },
      };
    },
    score: (trialResults) => scoreSST(trialResults),
  },

  STROOP: {
    id: "STROOP",
    name: "颜色大作战",
    durationHint: "约 3–4 分钟",
    instructions: [
      "看清楚字是用什么颜色写的。",
      "不要读这个字的意思，只要判断颜色。",
      "看到红色点“红”，黄色点“黄”，绿色点“绿”，蓝色点“蓝”。",
      "先练习，再开始正式挑战。",
    ],
    config: {
      practiceTrials: 6,
      nTrialsPerCond: 24, // 共 72 个正式试次
      stimMs: 2000,
      isiMs: 800,
    },
    init: (config) => {
      const { practiceTrials, trials } = makeStroopTrials(config);
      return { practiceTrials, trials };
    },
    score: (trialResults) => scoreStroop(trialResults),
  },

  WCST: {
    id: "WCST",
    name: "卡片找规律",
    durationHint: "约 4–6 分钟",
    instructions: [
      "看一看下面的卡片应该配到上面的哪一张。",
      "不用猜提示，系统只会告诉你对不对。",
      "当你找到规律后，规律可能会悄悄改变。",
      "请根据反馈不断调整方法。",
    ],
    config: {
      maxTrials: 72,
      categoriesToComplete: 3,
      correctStreakToShift: 6,
      stimMs: 2000,
      isiMs: 800,
    },
    init: (config) => {
      return makeWCSTTrials(config);
    },
    score: (trialResults) => scoreWCST(trialResults),
  },

  NBACK: {
    id: "NBACK",
    name: "记忆小侦探",
    durationHint: "约 3–4 分钟",
    instructions: [
      "看看现在的字母，是不是和前面第 N 个一样。",
      "一样就点一下，不一样就等下一个。",
      "要一直记住前面的字母哦。",
      "先练习，再开始正式挑战。",
    ],
    config: {
      n: 2,
      practiceTrials: 12,
      nTrials: 60,
      targetRate: 0.25,
      stimMs: 1200,
      isiMs: 800,
    },
    init: (config) => {
      return makeNBackTrials(config);
    },
    score: (trialResults, meta) => scoreNBack(trialResults, meta?.n ?? 2),
  },
};

export function listTasks() {
  return Object.values(TASK_BANK).map(({ id, name, durationHint }) => ({
    id,
    name,
    durationHint,
  }));
}

export function getTask(taskId) {
  const t = TASK_BANK[taskId];
  if (!t) throw new Error(`未知任务：${taskId}`);
  return t;
}
