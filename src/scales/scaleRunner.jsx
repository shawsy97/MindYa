import { useEffect, useMemo, useState } from "react";
import { getScale } from "./scaleBank";

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

const resolveIntroImage = (imageName) => {
  if (!imageName) return "";
  return new URL(`../assets/${imageName}`, import.meta.url).href;
};

export default function ScaleRunner({
  username,
  scaleId,
  onBack,
  backLabel = "← 返回列表",
  onComplete,
  completeLabel = "继续下一份 →",
  autoAdvance = false,
  themeBg,
  themeTextColor,
}) {
  const scale = useMemo(() => getScale(scaleId), [scaleId]);
  const [answers, setAnswers] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showIntro, setShowIntro] = useState(Boolean(scale?.intro));
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    setAnswers({});
    setCurrentIndex(0);
    setResult(null);
    setErr("");
    setShowIntro(Boolean(scale?.intro));
  }, [scaleId, scale?.intro]);

  useEffect(() => {
    if (scale?.items?.length && currentIndex >= scale.items.length) {
      setCurrentIndex(0);
    }
  }, [scaleId, scale?.items?.length, currentIndex]);

  const setAnswer = (key, value) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const submit = async () => {
    setErr("");
    try {
      const scored = scale.score(answers);
      const payload = {
        scaleId: scale.id,
        submittedAt: new Date().toISOString(),
        answers,
        ...scored,
      };

      await apiPost("/api/results", {
        username,
        type: "scale",
        data: payload,
      });

      if (autoAdvance && onComplete) {
        onComplete(payload);
        return;
      }
      setResult(payload);
    } catch (e) {
      setErr(e?.message || "提交失败");
    }
  };

  if (result) {
    const lines = scale.interpret ? scale.interpret(result) : [];
    return (
      <div className="space-y-3">
        {onBack ? (
          <button onClick={onBack} className="text-sm text-[#8B7A6A]">
            {backLabel}
          </button>
        ) : null}

        <div className="rounded-2xl bg-white border border-[#EFE7DE] p-4 shadow-sm">
          <div className="text-[#4B3425] font-semibold">{scale.name} 结果</div>
          <div className="mt-2 space-y-1 text-sm text-[#4B3425]">
            {lines.map((t, i) => (
              <div key={i}>{t}</div>
            ))}
          </div>

          {result?.flags?.riskLevel && (
            <div className="mt-3 text-xs text-[#8B7A6A]">
              风险标记：{result.flags.riskLevel}
            </div>
          )}
        </div>

        {onComplete ? (
          <button
            onClick={onComplete}
            className="w-full rounded-full bg-[#4B342C] text-white py-3 font-semibold"
          >
            {completeLabel}
          </button>
        ) : null}
      </div>
    );
  }

  if (showIntro && scale?.intro) {
    const { title, paragraphs = [], note, prompt } = scale.intro;
    const introImage = resolveIntroImage(scale.intro.image);
    return (
      <div className="space-y-3">
        {onBack ? (
          <button onClick={onBack} className="text-sm text-[#8B7A6A]">
            {backLabel}
          </button>
        ) : null}

        <div className="rounded-2xl bg-white border border-[#EFE7DE] p-4 shadow-sm space-y-3">
          <div className="text-[#4B3425] font-semibold">{title || scale.name}</div>
          {prompt ? (
            <div className="text-sm text-[#6C5B50]">{prompt}</div>
          ) : null}
          <div className="space-y-2 text-sm text-[#4B3425]">
            {paragraphs.map((p, i) => (
              <div key={i}>{p}</div>
            ))}
          </div>
          {introImage ? (
            <img
              src={introImage}
              alt=""
              className="w-full rounded-xl border border-[#EFE7DE]"
            />
          ) : null}
          {note ? (
            <div className="text-xs text-[#8B7A6A]">{note}</div>
          ) : null}
        </div>

        <button
          onClick={() => setShowIntro(false)}
          className="w-full rounded-full bg-[#4B342C] text-white py-3 font-semibold"
        >
          开始作答 →
        </button>
      </div>
    );
  }

  if (!scale?.items?.length) {
    return (
      <div className="text-sm text-[#8B7A6A]">
        量表内容加载中…
      </div>
    );
  }

  const total = scale.items.length;
  const safeIndex = Math.min(currentIndex, total - 1);
  const currentItem = scale.items[safeIndex];
  const currentValue = answers[currentItem.key];
  const unansweredCount = scale.items.filter((it) => answers[it.key] === undefined).length;
  const canSubmit = unansweredCount === 0;

  const handleSelect = (optValue) => {
    setAnswer(currentItem.key, optValue);
    setErr("");
    if (currentIndex < total - 1) {
      setTimeout(() => setCurrentIndex((i) => Math.min(i + 1, total - 1)), 120);
    }
  };

  return (
    <div
      className={`space-y-3 ${themeBg ? "rounded-[28px] p-5 min-h-[560px]" : ""}`}
      style={themeBg ? { backgroundColor: themeBg, color: themeTextColor } : undefined}
    >
      {onBack ? (
        <button
          onClick={onBack}
          className="text-sm"
          style={themeTextColor ? { color: themeTextColor } : { color: "#8B7A6A" }}
        >
          {backLabel}
        </button>
      ) : null}

      <div className="rounded-2xl bg-white border border-[#EFE7DE] p-4 shadow-sm">
        <div className="text-[#4B3425] font-semibold">{scale.name}</div>
        <div className="mt-1 text-xs text-[#8B7A6A]">时间范围：{scale.period}</div>
      </div>

      <div className="rounded-2xl bg-white border border-[#EFE7DE] p-4 shadow-sm">
        <div className="flex items-center justify-between text-xs text-[#8B7A6A]">
          <span>第 {currentIndex + 1} / {total} 题</span>
          <span>{currentValue !== undefined ? "已选择" : "未选择"}</span>
        </div>
        <div className="mt-2 text-sm text-[#4B3425]">
          {currentIndex + 1}. {currentItem.text}
        </div>
        <div className="mt-4 space-y-3">
          {(currentItem.options || scale.options).map((opt) => {
            const selected = currentValue === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => handleSelect(opt.value)}
                className={`w-full rounded-2xl border px-4 py-3 text-left text-sm font-medium transition ${
                  selected
                    ? "bg-[#9BB05A] text-white border-[#9BB05A]"
                    : "bg-white text-[#4B3425] border-[#EFE7DE]"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={() => setCurrentIndex((i) => Math.max(i - 1, 0))}
            disabled={currentIndex === 0}
            className="text-xs text-[#8B7A6A] disabled:opacity-50"
          >
            ← 上一题
          </button>
          {currentIndex < total - 1 ? (
            <button
              onClick={() => setCurrentIndex((i) => Math.min(i + 1, total - 1))}
              className="text-xs text-[#8B7A6A]"
            >
              下一题 →
            </button>
          ) : null}
        </div>
      </div>

      {err && <div className="text-xs text-[#D56B4B]">{err}</div>}

      <button
        onClick={submit}
        disabled={!canSubmit}
        className="w-full rounded-full bg-[#4B342C] text-white py-3 font-semibold disabled:opacity-60"
      >
        提交量表
      </button>
      {!canSubmit && (
        <div className="text-center text-xs text-[#8B7A6A]">
          还有 {unansweredCount} 题未完成
        </div>
      )}
    </div>
  );
}
