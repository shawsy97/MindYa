// src/tasks/TaskRunner.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { getTask } from "./taskBank";
const envApiBase = import.meta.env.VITE_API_BASE || "";
const API_BASE =
  envApiBase ||
  (typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:3001`
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

  const [phase, setPhase] = useState("intro"); // intro | running | done
  const [trialIndex, setTrialIndex] = useState(0);
  const [stimulus, setStimulus] = useState("");
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");

  const sessionRef = useRef(null);
  const stimStartRef = useRef(0);
  const respondedRef = useRef(false);
  const rtRef = useRef(null);

  const start = () => {
    if (!task) return;
    setErr("");
    const startedAt = new Date().toISOString();
    const { trials } = task.init(task.config);
    sessionRef.current = {
      startedAt,
      trials,
      trialResults: [],
    };
    setTrialIndex(0);
    setPhase("running");
  };

  // 键盘监听（空格）
  useEffect(() => {
    if (phase !== "running" || !task) return;

    const onKeyDown = (e) => {
      if (e.code !== "Space") return;
      handleRespond();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase]);

  const handleRespond = () => {
    if (respondedRef.current) return;
    respondedRef.current = true;
    const rt = Date.now() - stimStartRef.current;
    rtRef.current = rt;
  };

  // 驱动试次
  useEffect(() => {
    if (phase !== "running" || !task) return;

    const sess = sessionRef.current;
    const trials = sess.trials;

    if (trialIndex >= trials.length) {
      // done
      const finishedAt = new Date().toISOString();
      const scored = task.score(sess.trialResults);

      const payload = {
        taskId: task.id,
        startedAt: sess.startedAt,
        finishedAt,
        config: task.config,
        ...scored,
        trials: sess.trialResults,
      };

      // 提交（最小改动：仍然用 type=scale，或者你后端加 type=task）
      // 推荐：后端加 type==="task" 分支。你现在想先跑通的话，用 scale 也能存进去。
      apiPost("/api/results", { username, type: "task", data: payload })
        .then(() => setResult(payload))
        .catch((e) => setErr(e?.message || "提交失败"))
        .finally(() => setPhase("done"));

      return;
    }

    const t = trials[trialIndex];
    respondedRef.current = false;
    rtRef.current = null;

    // 显示刺激
    setStimulus(t.stim);
    stimStartRef.current = Date.now();

    // 刺激结束后记录
    const stimTimer = setTimeout(() => {
      const responded = respondedRef.current;
      const rtMs = responded ? rtRef.current : null;

      const correct = t.isTarget ? responded : !responded;

      sess.trialResults.push({
        i: trialIndex,
        stim: t.stim,
        isTarget: t.isTarget,
        responded,
        correct,
        rtMs,
        ts: new Date().toISOString(),
      });

      // ISI 空屏
      setStimulus("");
      const isiTimer = setTimeout(() => setTrialIndex((x) => x + 1), t.isiMs);

      // cleanup isi
      return () => clearTimeout(isiTimer);
    }, t.stimMs);

    return () => clearTimeout(stimTimer);
  }, [phase, trialIndex, task, username]);

  // —— UI —— //
  if (!task) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="text-sm text-[#8B7A6A]">← 返回任务列表</button>
        <div className="rounded-2xl bg-white border border-[#EFE7DE] p-4 shadow-sm">
          <div className="text-sm text-[#D56B4B]">任务加载失败，请返回重试。</div>
        </div>
      </div>
    );
  }

  if (phase === "intro") {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="text-sm text-[#8B7A6A]">← 返回任务列表</button>

        <div className="rounded-2xl bg-white border border-[#EFE7DE] p-4 shadow-sm space-y-2">
          <div className="text-[#4B3425] font-semibold text-lg">{task.name}</div>
          <div className="text-xs text-[#8B7A6A]">预计时长：{task.durationHint}</div>
          <div className="mt-2 space-y-1 text-sm text-[#4B3425]">
            {task.instructions.map((line, i) => <div key={i}>• {line}</div>)}
          </div>
        </div>

        <button
          onClick={start}
          className="w-full rounded-full bg-[#4B342C] text-white py-3 font-semibold"
        >
          开始
        </button>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="text-sm text-[#8B7A6A]">← 返回任务列表</button>

        <div className="rounded-2xl bg-white border border-[#EFE7DE] p-4 shadow-sm space-y-2">
          <div className="text-[#4B3425] font-semibold text-lg">{task.name} 结果</div>

          {err && <div className="text-xs text-[#D56B4B]">{err}</div>}

          {result?.summary ? (
            <div className="text-sm text-[#4B3425] space-y-1">
              <div>试次数：{result.summary.n}</div>
              <div>正确率：{result.summary.accuracy}</div>
              <div>命中（X按下）：{result.summary.hits}</div>
              <div>漏报（X没按）：{result.summary.omissions}</div>
              <div>误报（非X按了）：{result.summary.commissions}</div>
              <div>平均反应时：{result.summary.meanRT} ms</div>
              <div>反应时波动：{result.summary.sdRT} ms</div>
            </div>
          ) : (
            <pre className="text-xs">{JSON.stringify(result, null, 2)}</pre>
          )}
        </div>
      </div>
    );
  }

  // running
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white border border-[#EFE7DE] p-4 shadow-sm">
        <div className="text-xs text-[#8B7A6A]">
          {task.name} · {trialIndex + 1}/{sessionRef.current?.trials?.length ?? 0}
        </div>
      </div>

      <div className="aspect-square rounded-3xl bg-[#F7F2EA] flex items-center justify-center shadow-sm">
        <div className="text-6xl font-bold text-[#4B342C] select-none">
          {stimulus || " "}
        </div>
      </div>

      <button
        onClick={handleRespond}
        className="w-full rounded-full bg-[#9BB05A] text-white py-3 font-semibold shadow-sm"
      >
        点一下
      </button>

      <div className="text-xs text-[#8B7A6A] text-center">
        看到 “X” 点击按钮；其他不点（电脑也可按空格）
      </div>
    </div>
  );
}
