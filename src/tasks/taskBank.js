// src/tasks/taskBank.js

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

// —— CPT X-type ——
// trial: { stim, isTarget, stimMs, isiMs }
function makeCPT_X_Trials({ nTrials = 120, targetProb = 0.2, stimMs = 500, isiMs = 500 }) {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const trials = [];
  for (let i = 0; i < nTrials; i++) {
    const isTarget = Math.random() < targetProb;
    const stim = isTarget ? "X" : letters[Math.floor(Math.random() * letters.length)];
    trials.push({ stim, isTarget, stimMs, isiMs });
  }
  return trials;
}

function scoreCPT_X(trialResults) {
  // trialResults: [{isTarget, responded, correct, rtMs}]
  const targets = trialResults.filter((t) => t.isTarget);
  const nontargets = trialResults.filter((t) => !t.isTarget);

  const hits = targets.filter((t) => t.responded && t.correct).length;
  const omissions = targets.filter((t) => !t.responded).length; // 目标不按
  const commissions = nontargets.filter((t) => t.responded).length; // 非目标按了

  const acc = trialResults.filter((t) => t.correct).length / trialResults.length;

  const hitRTs = targets.filter((t) => t.responded && t.correct && typeof t.rtMs === "number").map((t) => t.rtMs);

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

export const TASK_BANK = {
  CPT_X: {
    id: "CPT_X",
    name: "专注力评估（CPT：X-type）",
    durationHint: "约 3 分钟",
    instructions: [
      "屏幕会连续出现字母。",
      "当出现字母 “X” 时，请尽快按 空格键。",
      "出现其他字母时不要按键。",
      "请尽量又快又准。",
    ],
    config: { nTrials: 180, targetProb: 0.2, stimMs: 500, isiMs: 500 },
    init: (config) => {
      const trials = makeCPT_X_Trials(config);
      return { trials };
    },
    score: (trialResults) => scoreCPT_X(trialResults),
  },

  // 先占位：后续你要我再逐个补实现
  SST:   { id: "SST",   name: "停止信号任务（SST）", durationHint: "待接入", instructions: ["开发中"], init: () => ({ trials: [] }), score: () => ({ summary: {} }) },
  STROOP:{ id: "STROOP",name: "Stroop 干扰任务",     durationHint: "待接入", instructions: ["开发中"], init: () => ({ trials: [] }), score: () => ({ summary: {} }) },
  WCST:  { id: "WCST",  name: "WCST 卡片分类任务",   durationHint: "待接入", instructions: ["开发中"], init: () => ({ trials: [] }), score: () => ({ summary: {} }) },
  NBACK: { id: "NBACK", name: "工作记忆任务（N-back）",durationHint:"待接入", instructions:["开发中"], init: () => ({ trials: [] }), score: () => ({ summary: {} }) },
};

export function listTasks() {
  return Object.values(TASK_BANK).map(({ id, name, durationHint }) => ({ id, name, durationHint }));
}
export function getTask(taskId) {
  const t = TASK_BANK[taskId];
  if (!t) throw new Error(`未知任务：${taskId}`);
  return t;
}
