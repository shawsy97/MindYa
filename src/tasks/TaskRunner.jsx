// src/tasks/TaskRunner.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { getTask } from "./taskBank";

const envApiBase = import.meta.env.VITE_API_BASE || "";
const API_BASE =
  envApiBase ||
  (typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:8080`
    : "");

const apiPost = async (path, body) => {
  const resp = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const err = new Error(data?.error || "Request failed");
    err.status = resp.status;
    err.code = data?.error || "";
    throw err;
  }
  return data;
};

export default function TaskRunner({ username, taskId, onBack }) {
  const task = useMemo(() => {
    try {
      return getTask(taskId);
    } catch {
      return null;
    }
  }, [taskId]);

  const [phase, setPhase] = useState("intro");
  // intro | practiceReady | practiceRunning | practiceDone | running | done

  const [trialIndex, setTrialIndex] = useState(0);
  const [stimulus, setStimulus] = useState("");
  const [stopSignalVisible, setStopSignalVisible] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const [feedback, setFeedback] = useState("");
  const [practiceHint, setPracticeHint] = useState("");
  const [trialFeedback, setTrialFeedback] = useState("");
  const [selectedNBack, setSelectedNBack] = useState(() => task?.config?.n ?? 2);

  const sessionRef = useRef(null);
  const stimStartRef = useRef(0);
  const responseRef = useRef(null);
  const wcstProcessingRef = useRef(false);
  const feedbackTimerRef = useRef(null);
  const hintTimerRef = useRef(null);

  useEffect(() => {
    setSelectedNBack(task?.config?.n ?? 2);
  }, [taskId]);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    };
  }, []);

  const currentTrials = useMemo(() => {
    if (!sessionRef.current) return [];
    if (phase === "practiceRunning") return sessionRef.current.practiceTrials || [];
    if (phase === "running") return sessionRef.current.trials || [];
    return [];
  }, [phase, trialIndex]);

  const start = () => {
    if (!task) return;
    setErr("");

    const startedAt = new Date().toISOString();
    const effectiveConfig =
      task.id === "NBACK" ? { ...task.config, n: selectedNBack } : task.config;
    const initResult = task.init(effectiveConfig);

    sessionRef.current = {
      startedAt,
      practiceTrials: initResult.practiceTrials || [],
      trials: initResult.trials || [],
      practiceResults: [],
      trialResults: [],
      meta: { ...(initResult.meta || {}), n: effectiveConfig?.n },
    };

    setTrialIndex(0);
    setStimulus("");
    setStopSignalVisible(false);

    if ((task.id === "SST" || task.id === "STROOP" || task.id === "NBACK") && (initResult.practiceTrials || []).length > 0) {
      setPhase("practiceReady");
    } else {
      setPhase("running");
    }
  };

  const recordResponse = (key) => {
    if (phase !== "practiceRunning" && phase !== "running") return;
    if (responseRef.current) return;

    responseRef.current = {
      key,
      rtMs: Date.now() - stimStartRef.current,
    };
  };

  const processWcstSelection = (selectedIndex) => {
    if (phase !== "practiceRunning" && phase !== "running") return;
    if (task?.id !== "WCST") return;
    if (wcstProcessingRef.current) return;

    const sess = sessionRef.current;
    const isPractice = phase === "practiceRunning";
    const trials = isPractice ? sess?.practiceTrials || [] : sess?.trials || [];
    if (trialIndex >= trials.length) return;

    wcstProcessingRef.current = true;

    const t = trials[trialIndex];
    const rule = sess.meta.currentRule;
    const refCards = t.referenceCards;

    const targetIndex = refCards.findIndex((card) => {
      if (rule === "color") return card.color === t.stimulus.color;
      if (rule === "shape") return card.shape === t.stimulus.shape;
      return card.number === t.stimulus.number;
    });

    const correct = selectedIndex === targetIndex;
    setTrialFeedback(correct ? "答对了" : "再试试");

    const previousRule =
      sess.meta.currentRuleIndex > 0
        ? sess.meta.ruleSequence[sess.meta.currentRuleIndex - 1]
        : null;

    let matchedPreviousRule = false;
    if (previousRule) {
      const prevTargetIndex = refCards.findIndex((card) => {
        if (previousRule === "color") return card.color === t.stimulus.color;
        if (previousRule === "shape") return card.shape === t.stimulus.shape;
        return card.number === t.stimulus.number;
      });
      matchedPreviousRule = selectedIndex === prevTargetIndex;
    }

    let categoryCompleted = false;

    if (correct) {
      sess.meta.currentStreak += 1;
    } else {
      sess.meta.currentStreak = 0;
    }

    if (sess.meta.currentStreak >= sess.meta.correctStreakToShift) {
      categoryCompleted = true;
      sess.meta.completedCategories += 1;
      sess.meta.currentStreak = 0;

      if (sess.meta.completedCategories < sess.meta.categoriesToComplete) {
        sess.meta.currentRuleIndex += 1;
        sess.meta.currentRule = sess.meta.ruleSequence[sess.meta.currentRuleIndex];
      }
    }

    const targetStore = isPractice ? sess.practiceResults : sess.trialResults;
    targetStore.push({
      i: trialIndex,
      phase: "main",
      mode: "wcst",
      categoryIndex: sess.meta.currentRuleIndex,
      activeRule: rule,
      stimulus: t.stimulus,
      selectedIndex,
      targetIndex,
      responded: true,
      correct,
      feedback: correct ? "correct" : "wrong",
      matchedPreviousRule,
      isPerseverativeError: !correct && matchedPreviousRule,
      categoryCompleted,
      rtMs: Date.now() - stimStartRef.current,
      ts: new Date().toISOString(),
    });

    if (sess.meta.completedCategories >= sess.meta.categoriesToComplete) {
      wcstProcessingRef.current = false;
      setTrialIndex(trials.length);
      return;
    }

    setStimulus("");
    setStopSignalVisible(false);

    const delayMs = typeof t.isiMs === "number" ? t.isiMs : 600;
    setTimeout(() => {
      setTrialFeedback("");
      wcstProcessingRef.current = false;
      setTrialIndex((x) => x + 1);
    }, delayMs);
  };

  const triggerFeedback = (isCorrect, isPracticePhase) => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);

    setFeedback(isCorrect ? "correct" : "incorrect");
    feedbackTimerRef.current = setTimeout(() => setFeedback(""), 220);

    if (!isCorrect && isPracticePhase && task?.id === "STROOP") {
      setPracticeHint("要看颜色，不要读字哦");
      hintTimerRef.current = setTimeout(() => setPracticeHint(""), 1200);
    }
  };
  const renderWCSTCard = (card, small = false) => {
    const colorMeta = {
      red: "#D94A4A",
      green: "#4FAE6A",
      yellow: "#D9B43B",
      blue: "#4A78D9",
    };

    const shapeMap = {
      triangle: "▲",
      star: "★",
      cross: "✚",
      circle: "●",
    };

    const count = card.number;
    const symbol = shapeMap[card.shape] || "●";
    const sizeClass = small ? "text-xl" : "text-3xl";

    return (
      <div className="flex flex-wrap items-center justify-center gap-2">
        {Array.from({ length: count }).map((_, idx) => (
          <span
            key={idx}
            className={`${sizeClass} font-bold`}
            style={{ color: colorMeta[card.color] }}
          >
            {symbol}
          </span>
        ))}
      </div>
    );
  };

  useEffect(() => {
    if ((phase !== "practiceRunning" && phase !== "running") || !task) return;

    const onKeyDown = (e) => {
      if (task.id === "CPT_X") {
        if (e.code !== "Space") return;
        recordResponse("Space");
        return;
      }

      if (task.id === "SST") {
        if (e.code !== "ArrowLeft" && e.code !== "ArrowRight") return;
        recordResponse(e.code);
      }
      if (task.id === "STROOP") {
        const map = {
          KeyR: "red",
          KeyY: "yellow",
          KeyG: "green",
          KeyB: "blue",
        };
        if (!map[e.code]) return;
        recordResponse(map[e.code]);
      }
      if (task.id === "NBACK") {
        if (e.code !== "Space") return;
        recordResponse("match");
        return;
      }
      if (task.id === "WCST") {
        const map = {
          Digit1: 0,
          Digit2: 1,
          Digit3: 2,
          Digit4: 3,
          Numpad1: 0,
          Numpad2: 1,
          Numpad3: 2,
          Numpad4: 3,
        };
        if (map[e.code] === undefined) return;
        processWcstSelection(map[e.code]);
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, task]);

  useEffect(() => {
    if ((phase !== "practiceRunning" && phase !== "running") || !task) return;

    const sess = sessionRef.current;
    const isPractice = phase === "practiceRunning";
    const trials = isPractice ? sess?.practiceTrials || [] : sess?.trials || [];

    if (trialIndex >= trials.length) {
      if (isPractice) {
        setStimulus("");
        setStopSignalVisible(false);
        setPhase("practiceDone");
        return;
      }

      const finishedAt = new Date().toISOString();
      const scored = task.score(sess.trialResults, sess.meta);

      const payload = {
        taskId: task.id,
        startedAt: sess.startedAt,
        finishedAt,
        config: task.config,
        practiceTrials: sess.practiceResults,
        ...scored,
        trials: sess.trialResults,
      };

      apiPost("/api/results", { username, type: "task", data: payload })
        .then(() => setResult(payload))
        .catch((e) => setErr(e?.message || "提交失败"))
        .finally(() => setPhase("done"));

      return;
    }

    const t = trials[trialIndex];
    responseRef.current = null;
    const nextStim =
      typeof t.stim === "string"
        ? t.stim
        : typeof t.text === "string"
        ? t.text
        : "";
    setStimulus(nextStim);
    setStopSignalVisible(false);
    stimStartRef.current = Date.now();

    if (task.id === "WCST") {
      return;
    }

    let stopTimer = null;
    let stimTimer = null;
    let isiTimer = null;

    if (task.id === "SST" && t.trialType === "stop") {
      stopTimer = setTimeout(() => {
        setStopSignalVisible(true);
      }, t.stopSignalDelayMs);
    }

    stimTimer = setTimeout(() => {
      const resp = responseRef.current;
      const responded = !!resp;
      const rtMs = resp?.rtMs ?? null;
      const pressedKey = resp?.key ?? null;
      const targetStore = isPractice ? sess.practiceResults : sess.trialResults;

      if (task.id === "CPT_X") {
        const correct = t.isTarget ? responded : !responded;

        targetStore.push({
          i: trialIndex,
          phase: t.phase || "main",
          stim: t.stim,
          isTarget: t.isTarget,
          responded,
          correct,
          rtMs,
          ts: new Date().toISOString(),
        });
      }

      if (task.id === "SST") {
        if (t.trialType === "go") {
          const correct = responded && pressedKey === t.expectedKey;

          targetStore.push({
            i: trialIndex,
            phase: t.phase || (isPractice ? "practice" : "main"),
            trialType: "go",
            stim: t.stim,
            expectedKey: t.expectedKey,
            pressedKey,
            responded,
            correct,
            rtMs,
            stopSignalDelayMs: null,
            ts: new Date().toISOString(),
          });
        } else {
          const stopSuccess = !responded;

          targetStore.push({
            i: trialIndex,
            phase: t.phase || (isPractice ? "practice" : "main"),
            trialType: "stop",
            stim: t.stim,
            expectedKey: t.expectedKey,
            pressedKey,
            responded,
            correct: stopSuccess,
            stopSuccess,
            rtMs,
            stopSignalDelayMs: t.stopSignalDelayMs,
            ts: new Date().toISOString(),
          });

          // 只有正式阶段更新 SSD，练习阶段固定
          if (!isPractice) {
            const nextSSD = stopSuccess
              ? Math.min(
                  t.maxSSD,
                  (sess.meta.currentSSD ?? t.stopSignalDelayMs) + t.ssdStep
                )
              : Math.max(
                  t.minSSD,
                  (sess.meta.currentSSD ?? t.stopSignalDelayMs) - t.ssdStep
                );

            sess.meta.currentSSD = nextSSD;

            for (let k = trialIndex + 1; k < sess.trials.length; k++) {
              if (sess.trials[k].trialType === "stop") {
                sess.trials[k].stopSignalDelayMs = nextSSD;
                break;
              }
            }
          }
        }
      }
      if (task.id === "STROOP") {
        const correct = responded && pressedKey === t.expectedKey;
        triggerFeedback(correct, isPractice);

        targetStore.push({
          i: trialIndex,
          phase: t.phase || (isPractice ? "practice" : "main"),
          mode: "stroop",
          condition: t.condition,
          text: t.text,
          colorKey: t.colorKey,
          colorLabel: t.colorLabel,
          expectedKey: t.expectedKey,
          pressedKey,
          responded,
          correct,
          rtMs,
          ts: new Date().toISOString(),
        });
      }
      if (task.id === "NBACK") {
        const analyzable = trialIndex >= t.n;
        const correct = analyzable
          ? (t.isTarget ? responded : !responded)
          : !responded;

        targetStore.push({
          i: trialIndex,
          phase: t.phase || (isPractice ? "practice" : "main"),
          mode: "nback",
          stim: t.stim,
          n: t.n,
          isTarget: t.isTarget,
          analyzable,
          responded,
          pressedKey,
          correct,
          rtMs,
          ts: new Date().toISOString(),
        });
      }

      setStimulus("");
      setStopSignalVisible(false);

      isiTimer = setTimeout(() => {
        setTrialIndex((x) => x + 1);
      }, t.isiMs);
    }, t.stimMs);

    return () => {
      if (stopTimer) clearTimeout(stopTimer);
      if (stimTimer) clearTimeout(stimTimer);
      if (isiTimer) clearTimeout(isiTimer);
    };
  }, [phase, trialIndex, task, username]);


  if (!task) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="text-sm text-[#8B7A6A]">
          ← 返回任务列表
        </button>
        <div className="rounded-2xl bg-white border border-[#EFE7DE] p-4 shadow-sm">
          <div className="text-sm text-[#D56B4B]">任务加载失败，请返回重试。</div>
        </div>
      </div>
    );
  }

  if (phase === "intro") {
    const isNBack = task.id === "NBACK";
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="text-sm text-[#8B7A6A]">
          ← 返回任务列表
        </button>

        <div className="rounded-2xl bg-white border border-[#EFE7DE] p-4 shadow-sm space-y-2">
          <div className="text-[#4B3425] font-semibold text-lg">{task.name}</div>
          <div className="text-xs text-[#8B7A6A]">预计时长：{task.durationHint}</div>
          <div className="mt-2 space-y-1 text-sm text-[#4B3425]">
            {task.instructions.map((line, i) => (
              <div key={i}>• {line}</div>
            ))}
          </div>
        </div>

        {isNBack && (
          <div className="rounded-2xl bg-white border border-[#EFE7DE] p-4 shadow-sm space-y-3">
            <div className="text-sm text-[#4B3425] font-semibold">选择难度</div>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setSelectedNBack(1)}
                className={`rounded-xl py-2 text-sm font-semibold ${
                  selectedNBack === 1
                    ? "bg-[#4B342C] text-white"
                    : "bg-[#F4EFE8] text-[#4B3425]"
                }`}
              >
                低（1-back）
              </button>
              <button
                onClick={() => setSelectedNBack(2)}
                className={`rounded-xl py-2 text-sm font-semibold ${
                  selectedNBack === 2
                    ? "bg-[#4B342C] text-white"
                    : "bg-[#F4EFE8] text-[#4B3425]"
                }`}
              >
                中（2-back）
              </button>
              <button
                onClick={() => setSelectedNBack(3)}
                className={`rounded-xl py-2 text-sm font-semibold ${
                  selectedNBack === 3
                    ? "bg-[#4B342C] text-white"
                    : "bg-[#F4EFE8] text-[#4B3425]"
                }`}
              >
                高（3-back）
              </button>
            </div>
          </div>
        )}

        <button
          onClick={start}
          className="w-full rounded-full bg-[#4B342C] text-white py-3 font-semibold"
        >
          开始
        </button>
      </div>
    );
  }

  if (phase === "practiceReady") {
    const isSST = task.id === "SST";
    const isStroop = task.id === "STROOP";
    const isNBack = task.id === "NBACK";

    return (
      <div className="space-y-4">
        <button onClick={onBack} className="text-sm text-[#8B7A6A]">
          ← 返回任务列表
        </button>

        <div className="rounded-2xl bg-white border border-[#EFE7DE] p-4 shadow-sm space-y-2">
          <div className="text-[#4B3425] font-semibold text-lg">先来热身一下</div>

          {isSST && (
            <div className="text-sm text-[#4B3425] space-y-1">
              <div>• 看到 ← 按左边，看到 → 按右边</div>
              <div>• 看到“停！”时，要忍住不按</div>
              <div>• 这一段只是练习，不计入正式成绩</div>
            </div>
          )}

          {isStroop && (
            <div className="text-sm text-[#4B3425] space-y-1">
              <div>• 只看字的颜色，不读字的意思</div>
              <div>• 红色点“红”，黄色点“黄”，绿色点“绿”，蓝色点“蓝”</div>
              <div>• 这一段只是练习，不计入正式成绩</div>
            </div>
          )}
          {isNBack && (
            <div className="text-sm text-[#4B3425] space-y-1">
              <div>• 看当前字母是不是和前 {selectedNBack} 个位置前的一样</div>
              <div>• 一样就按按钮，不一样就不按</div>
              <div>• 这一段只是练习，不计入正式成绩</div>
            </div>
          )}
        </div>

        <button
          onClick={() => {
            setTrialIndex(0);
            setPhase("practiceRunning");
          }}
          className="w-full rounded-full bg-[#9BB05A] text-white py-3 font-semibold"
        >
          开始练习
        </button>
      </div>
    );
  }

  if (phase === "practiceDone") {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl bg-white border border-[#EFE7DE] p-4 shadow-sm space-y-2">
          <div className="text-[#4B3425] font-semibold text-lg">练习完成</div>
          <div className="text-sm text-[#4B3425]">
            很好，已经熟悉规则啦，接下来进入正式挑战。
          </div>
        </div>

        <button
          onClick={() => {
            setTrialIndex(0);
            setPhase("running");
          }}
          className="w-full rounded-full bg-[#4B342C] text-white py-3 font-semibold"
        >
          进入正式挑战
        </button>
      </div>
    );
  }

  if (phase === "done") {
    const s = result?.summary;

    return (
      <div className="space-y-4">
        <button onClick={onBack} className="text-sm text-[#8B7A6A]">
          ← 返回任务列表
        </button>

        <div className="rounded-2xl bg-white border border-[#EFE7DE] p-4 shadow-sm space-y-2">
          <div className="text-[#4B3425] font-semibold text-lg">
            {task.name} 结果
          </div>

          {err && <div className="text-xs text-[#D56B4B]">{err}</div>}

          {task.id === "CPT_X" && s ? (
            <div className="text-sm text-[#4B3425] space-y-1">
              <div>试次数：{s.n}</div>
              <div>正确率：{s.accuracy}</div>
              <div>命中（X按下）：{s.hits}</div>
              <div>漏报（X没按）：{s.omissions}</div>
              <div>误报（非X按了）：{s.commissions}</div>
              <div>平均反应时：{s.meanRT} ms</div>
              <div>反应时波动：{s.sdRT} ms</div>
            </div>
          ) : task.id === "SST" && s ? (
            <div className="text-sm text-[#4B3425] space-y-1">
              <div>正式试次数：{s.n}</div>
              <div>Go试次：{s.goN}</div>
              <div>Stop试次：{s.stopN}</div>
              <div>Go正确率：{s.goAccuracy}</div>
              <div>Go平均反应时：{s.meanGoRT} ms</div>
              <div>Go反应时波动：{s.sdGoRT} ms</div>
              <div>成功停下次数：{s.stopSuccess}</div>
              <div>未停下次数：{s.stopFail}</div>
              <div>停止成功率：{s.stopSuccessRate}</div>
              <div>平均停止延迟（SSD）：{s.meanSSD} ms</div>
              <div>停止反应时（SSRT）：{s.ssrt} ms</div>
            </div>
          ) : task.id === "STROOP" && s ? (
            <div className="text-sm text-[#4B3425] space-y-1">
              <div>正式试次数：{s.n}</div>
              <div>总正确率：{s.accuracy}</div>
              <div>总平均反应时：{s.meanRT} ms</div>
              <div>总反应时波动：{s.sdRT} ms</div>

              <div className="pt-2 font-semibold">一致条件</div>
              <div>正确率：{s.congruent.accuracy}</div>
              <div>平均反应时：{s.congruent.meanRT} ms</div>

              <div className="pt-2 font-semibold">冲突条件</div>
              <div>正确率：{s.incongruent.accuracy}</div>
              <div>平均反应时：{s.incongruent.meanRT} ms</div>

              <div className="pt-2 font-semibold">中性条件</div>
              <div>正确率：{s.neutral.accuracy}</div>
              <div>平均反应时：{s.neutral.meanRT} ms</div>

              <div className="pt-2 font-semibold">Stroop 干扰</div>
              <div>反应时干扰值：{s.interferenceRT} ms</div>
              <div>正确率下降：{s.interferenceAcc}</div>
            </div>
          ) : task.id === "WCST" && s ? (
            <div className="text-sm text-[#4B3425] space-y-1">
              <div>总试次数：{s.n}</div>
              <div>总正确率：{s.accuracy}</div>
              <div>正确次数：{s.correctN}</div>
              <div>错误次数：{s.totalErrors}</div>
              <div>完成类别数：{s.categoriesCompleted}</div>
              <div>持续性错误：{s.perseverativeErrors}</div>
              <div>达到第一个规律所用试次：{s.trialsToFirstCategory ?? "-"}</div>
            </div>
          ) : task.id === "NBACK" && s ? (
            <div className="text-sm text-[#4B3425] space-y-1">
              <div>正式试次数：{s.n}</div>
              <div>难度：{s.level}</div>
              <div>总正确率：{s.accuracy}</div>
              <div>命中：{s.hits}</div>
              <div>漏报：{s.misses}</div>
              <div>误报：{s.falseAlarms}</div>
              <div>正确拒绝：{s.correctRejections}</div>
              <div>平均反应时：{s.meanRT} ms</div>
              <div>反应时波动：{s.sdRT} ms</div>
              <div>命中率：{s.hitRate}</div>
              <div>误报率：{s.falseAlarmRate}</div>
              <div>d′：{s.dPrime}</div>
            </div>
          ) : (
            <pre className="text-xs">{JSON.stringify(result, null, 2)}</pre>
          )}
        </div>
      </div>
    );
  }

  const totalTrials = currentTrials.length;
  const currentTrial = currentTrials[trialIndex];
  const feedbackClass =
    feedback === "correct"
      ? "task-flash"
      : feedback === "incorrect"
      ? "task-shake task-warn"
      : "";

  return (
    <div className="space-y-4">
      <style>{`
        @keyframes taskFlash {
          0% { box-shadow: 0 0 0 0 rgba(155, 176, 90, 0.6); }
          100% { box-shadow: 0 0 0 12px rgba(155, 176, 90, 0); }
        }
        @keyframes taskClickFlash {
          0% { transform: scale(1); filter: brightness(1); }
          100% { transform: scale(0.98); filter: brightness(1.08); }
        }
        @keyframes taskShake {
          0% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          50% { transform: translateX(4px); }
          75% { transform: translateX(-3px); }
          100% { transform: translateX(0); }
        }
        .task-flash { animation: taskFlash 0.22s ease-out; }
        .task-shake { animation: taskShake 0.22s ease-in-out; }
        .task-warn { border: 2px solid rgba(217, 74, 74, 0.6); }
        .task-click:active { animation: taskClickFlash 0.12s ease-out; }
      `}</style>
      <div className="rounded-2xl bg-white border border-[#EFE7DE] p-4 shadow-sm">
        <div className="text-xs text-[#8B7A6A]">
          {phase === "practiceRunning" ? "练习中" : task.name} · {trialIndex + 1}/{totalTrials}
        </div>
      </div>

      {task.id !== "WCST" && (
        <div className={`aspect-square rounded-3xl bg-[#F7F2EA] flex flex-col items-center justify-center shadow-sm relative border border-transparent ${feedbackClass}`}>
          <div
            className="text-6xl font-bold select-none"
            style={{
              color:
                task.id === "STROOP"
                  ? (currentTrial?.colorHex || "#4B342C")
                  : "#4B342C",
            }}
          >
            {stimulus || " "}
          </div>

          {task.id === "SST" && stopSignalVisible && (
            <div className="absolute bottom-8 text-3xl font-bold text-[#D56B4B] animate-pulse">
              停！
            </div>
          )}
        </div>
      )}

      {task.id === "CPT_X" && (
        <>
          <button
            onClick={() => recordResponse("Space")}
            className="w-full rounded-full bg-[#9BB05A] text-white py-3 font-semibold shadow-sm active:scale-[0.98] task-click"
          >
            点一下
          </button>

          <div className="text-xs text-[#8B7A6A] text-center">
            看到 “X” 点击按钮；其他不点（电脑也可按空格）
          </div>
        </>
      )}

      {task.id === "SST" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => recordResponse("ArrowLeft")}
              className="rounded-2xl bg-[#9BB05A] text-white py-4 text-2xl font-bold shadow-sm active:scale-[0.98] task-click"
            >
              ←
            </button>
            <button
              onClick={() => recordResponse("ArrowRight")}
              className="rounded-2xl bg-[#9BB05A] text-white py-4 text-2xl font-bold shadow-sm active:scale-[0.98] task-click"
            >
              →
            </button>
          </div>

          <div className="text-xs text-[#8B7A6A] text-center space-y-1">
            <div>看到 ← 按左边，看到 → 按右边</div>
            <div>电脑也可以直接按键盘左右方向键</div>
            <div>如果出现“停！”，要立刻忍住不按</div>
          </div>
        </>
      )}
      {task.id === "STROOP" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => recordResponse("red")}
              className="rounded-2xl text-white py-4 text-xl font-bold shadow-sm active:scale-[0.98] task-click"
              style={{ backgroundColor: "#D94A4A" }}
            >
              红
            </button>
            <button
              onClick={() => recordResponse("yellow")}
              className="rounded-2xl text-white py-4 text-xl font-bold shadow-sm active:scale-[0.98] task-click"
              style={{ backgroundColor: "#D9B43B" }}
            >
              黄
            </button>
            <button
              onClick={() => recordResponse("green")}
              className="rounded-2xl text-white py-4 text-xl font-bold shadow-sm active:scale-[0.98] task-click"
              style={{ backgroundColor: "#4FAE6A" }}
            >
              绿
            </button>
            <button
              onClick={() => recordResponse("blue")}
              className="rounded-2xl text-white py-4 text-xl font-bold shadow-sm active:scale-[0.98] task-click"
              style={{ backgroundColor: "#4A78D9" }}
            >
              蓝
            </button>
          </div>

          <div className="text-xs text-[#8B7A6A] text-center space-y-1">
            <div>只看颜色，不读字义</div>
            <div>电脑可按：R=红，Y=黄，G=绿，B=蓝</div>
            {phase === "practiceRunning" && practiceHint && (
              <div className="text-[#D56B4B] font-medium">{practiceHint}</div>
            )}
          </div>
        </>
      )}
      {task.id === "NBACK" && (
        <>
          <button
            onClick={() => recordResponse("match")}
            className="w-full rounded-full bg-[#9BB05A] text-white py-3 font-semibold shadow-sm active:scale-[0.98] task-click"
          >
            一样
          </button>

          <div className="text-xs text-[#8B7A6A] text-center space-y-1">
            <div>如果当前字母和前 {selectedNBack} 个位置前的一样，就按“一样”</div>
            <div>电脑也可以按空格键</div>
          </div>
        </>
      )}
      {task.id === "WCST" && currentTrial?.stimulus && (
        <div className="space-y-4 relative">
          <div className="grid grid-cols-2 gap-3">
            {currentTrial.referenceCards.map((card, idx) => (
              <button
                key={idx}
                onClick={() => processWcstSelection(idx)}
                className="rounded-2xl bg-white border border-[#E8DED2] p-4 shadow-sm active:scale-[0.98] task-click"
              >
                <div className="text-xs text-[#8B7A6A] mb-2">卡片 {idx + 1}</div>
                <div className="h-20 flex items-center justify-center">
                  {renderWCSTCard(card, true)}
                </div>
              </button>
            ))}
          </div>

          <div className="rounded-3xl bg-[#F7F2EA] border border-[#EFE7DE] p-6 shadow-sm">
            <div className="text-xs text-[#8B7A6A] text-center mb-3">把下面这张配到上面最合适的一张</div>
            <div className="h-28 flex items-center justify-center">
              {renderWCSTCard(currentTrial.stimulus, false)}
            </div>
          </div>

          <div className="text-xs text-[#8B7A6A] text-center space-y-1">
            <div>系统不会告诉你规律是什么，只会告诉你对不对</div>
            <div>电脑也可以按数字键 1 / 2 / 3 / 4</div>
          </div>
          {trialFeedback ? (
            <>
              <div className="text-center text-sm font-semibold text-[#8B7A6A]">
                {trialFeedback}
              </div>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div
                  className={`h-16 w-16 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-lg ${
                    trialFeedback === "答对了" ? "bg-[#4FAE6A]" : "bg-[#D94A4A]"
                  }`}
                >
                  {trialFeedback === "答对了" ? "✓" : "✕"}
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
