import React, { useEffect, useState } from 'react';
import { ArrowLeft, FileText, Download, Save, RefreshCcw } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || '';

function formatDate(ts) {
  if (!ts) return '未知时间';
  return new Date(ts).toLocaleString('zh-CN');
}

export default function UserReport({ user, onBack }) {
  const [reports, setReports] = useState([]);
  const [activeReport, setActiveReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadReports = async () => {
    setLoading(true);
    setError('');
    try {
      const resp = await fetch(`${API_BASE}/api/admin/report/user/${user.username}`);
      const data = await resp.json();
      setReports(data.reports || []);
    } catch (e) {
      setError('加载报告列表失败');
    } finally {
      setLoading(false);
    }
  };

  const openReport = async (id) => {
    setLoading(true);
    setError('');
    try {
      const resp = await fetch(`${API_BASE}/api/admin/report/${id}`);
      const data = await resp.json();
      setActiveReport(data);
    } catch (e) {
      setError('加载报告失败');
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async () => {
    setLoading(true);
    setError('');
    try {
      const resp = await fetch(`${API_BASE}/api/admin/report/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.username }),
      });
      const data = await resp.json();
      setActiveReport(data);
      await loadReports();
    } catch (e) {
      setError('生成报告失败');
    } finally {
      setLoading(false);
    }
  };

  const saveReport = async () => {
    if (!activeReport) return;
    setSaving(true);
    setError('');
    try {
      const resp = await fetch(`${API_BASE}/api/admin/report/${activeReport.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: activeReport.content }),
      });
      const data = await resp.json();
      setActiveReport(data);
      await loadReports();
    } catch (e) {
      setError('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const exportPdf = async () => {
    if (!activeReport) return;
    setLoading(true);
    setError('');
    try {
      const resp = await fetch(`${API_BASE}/api/admin/report/${activeReport.id}/pdf-url`);
      const data = await resp.json();
      if (!resp.ok || !data?.url) {
        throw new Error(data?.error || 'No url');
      }
      window.open(data.url, '_blank');
    } catch (e) {
      setError('导出失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [user.username]);

  const updateContent = (path, value) => {
    if (!activeReport) return;
    setActiveReport((prev) => {
      const next = { ...prev, content: { ...(prev.content || {}) } };
      next.content.overallConclusion = next.content.overallConclusion || {
        stableAreas: "",
        attentionAreas: "",
        highRiskAreas: "",
      };
      next.content.themeSummaries = next.content.themeSummaries || {};
      next.content.scaleInterpretations = next.content.scaleInterpretations || {};
      next.content.interventions = next.content.interventions || {
        daily: "",
        homeSchool: "",
        professional: "",
      };
      if (path === 'overall.stable') next.content.overallConclusion.stableAreas = value;
      if (path === 'overall.attention') next.content.overallConclusion.attentionAreas = value;
      if (path === 'overall.highRisk') next.content.overallConclusion.highRiskAreas = value;
      if (path.startsWith('theme.')) {
        const key = path.split('.')[1];
        next.content.themeSummaries = { ...(next.content.themeSummaries || {}), [key]: value };
      }
      if (path.startsWith('scale.')) {
        const key = path.split('.')[1];
        next.content.scaleInterpretations = { ...(next.content.scaleInterpretations || {}), [key]: value };
      }
      if (path === 'riskWarnings') next.content.riskWarnings = value;
      if (path === 'comprehensiveAnalysis') next.content.comprehensiveAnalysis = value;
      if (path === 'interventions.daily') next.content.interventions.daily = value;
      if (path === 'interventions.homeSchool') next.content.interventions.homeSchool = value;
      if (path === 'interventions.professional') next.content.interventions.professional = value;
      if (path === 'notes') next.content.notes = value;
      return next;
    });
  };

  const scaleMeta = {
    DASS21: { name: 'DASS-21 抑郁焦虑压力量表', abbr: 'DASS-21', threshold: '分级：抑郁 0–9/10–13/14–20/21–27/≥28；焦虑 0–7/8–9/10–14/15–19/≥20；压力 0–14/15–18/19–25/26–33/≥34' },
    ANHEDONIA: { name: '快感缺失量表', abbr: 'Anhedonia', threshold: '当前仅做描述性展示' },
    ERQ: { name: '情绪调节（ERQ）', abbr: 'ERQ', threshold: '当前仅做描述性展示' },
    PHQ9_CHILD: { name: 'PHQ-9 抑郁量表', abbr: 'PHQ-9', threshold: '0–4 无/极轻；5–9 轻度；10–14 中度；15–19 中重度；20–27 重度；第9题需单独关注' },
    SELF_HARM: { name: '自伤问卷（非自杀性自伤筛查）', abbr: 'NSSI', threshold: '任一题 ≥1 视为风险信号' },
    SUICIDE: { name: '自杀问卷（风险筛查）', abbr: 'Suicide Screen', threshold: '任一题=有 视为风险信号' },
    NET_ADDICT: { name: '网络成瘾量表（IAT）', abbr: 'IAT', threshold: '总分>45 达到筛查阈值' },
    ACADEMIC_BURNOUT: { name: '学业倦怠量表', abbr: 'Academic Burnout', threshold: '当前仅做描述性展示' },
    SCHOOL_AVERSION: { name: '厌学量表', abbr: 'School Aversion', threshold: '均分≥3 轻度；≥4 重度' },
    BULLYING: { name: '霸凌主动&被动（含网络欺凌）', abbr: 'Bullying', threshold: '出现任一维度高频提示需关注' },
    BULLYING_SIMPLE: { name: '霸凌主动&被动（含网络欺凌）', abbr: 'Bullying-4', threshold: '任一题≥2 视为卷入；分类：受害/施暴/双方' },
    SRSS: { name: '睡眠量表（SRSS）', abbr: 'SRSS', threshold: '≥23 轻度；≥30 中度；≥40 重度' },
  };

  const renderScaleScore = (scaleId, scale) => {
    const score = scale?.score || {};
    if (scaleId === 'DASS21') {
      return `抑郁 ${score.depression ?? '-'}；焦虑 ${score.anxiety ?? '-'}；压力 ${score.stress ?? '-'}`;
    }
    if (scaleId === 'PHQ9_CHILD') {
      return `总分 ${score.total ?? '-'}；第9题 ${score.item9 ?? '-'}`;
    }
    if (scaleId === 'SELF_HARM') {
      return `自伤想法 ${score.ideation ?? '-'}；自伤行为 ${score.behavior ?? '-'}`;
    }
    if (scaleId === 'SUICIDE') {
      return `想法 ${score.ideation ?? '-'}；计划 ${score.plan ?? '-'}；企图 ${score.attempt ?? '-'}；次数 ${score.attemptCount ?? '-'}`;
    }
    if (scaleId === 'ANHEDONIA') {
      return `总分 ${score.total ?? '-'}；均分 ${score.mean ?? '-'}`;
    }
    if (scaleId === 'ERQ') {
      return `认知重评 ${score.reappraisal_mean ?? '-'}；表达抑制 ${score.suppression_mean ?? '-'}`;
    }
    if (scaleId === 'NET_ADDICT') {
      return `总分 ${score.total ?? '-'}；症状 ${score.symptom ?? '-'}；诱因 ${score.cause ?? '-'}`;
    }
    if (scaleId === 'ACADEMIC_BURNOUT') {
      return `总分 ${score.total ?? '-'}；均分 ${score.mean ?? '-'}`;
    }
    if (scaleId === 'SCHOOL_AVERSION') {
      return `总分 ${score.total ?? '-'}；均分 ${score.mean ?? '-'}`;
    }
    if (scaleId === 'BULLYING' || scaleId === 'BULLYING_SIMPLE') {
      return `总分 ${score.total ?? '-'}；受害 ${score.victim_sum ?? '-'}；施暴 ${score.bully_sum ?? '-'}`;
    }
    if (scaleId === 'SRSS') {
      return `总分 ${score.total ?? '-'}`;
    }
    return `总分 ${score.total ?? '-'}`;
  };

  const scaleOrder = [
    'DASS21',
    'PHQ9_CHILD',
    'SELF_HARM',
    'SUICIDE',
    'ANHEDONIA',
    'ERQ',
    'NET_ADDICT',
    'ACADEMIC_BURNOUT',
    'SCHOOL_AVERSION',
    'BULLYING',
    'BULLYING_SIMPLE',
    'SRSS',
  ];

  const getScaleIdsForReport = () => {
    const present = Object.keys(activeReport?.scales || {});
    const merged = [...scaleOrder];
    present.forEach((id) => {
      if (!merged.includes(id)) merged.push(id);
    });
    return merged;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="bg-white px-4 py-3 flex items-center border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mr-3">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-lg font-semibold text-gray-900">成长探索测量结果</h2>
        <button
          onClick={generateReport}
          className="ml-auto px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg flex items-center gap-1"
          disabled={loading}
        >
          <RefreshCcw size={16} />
          生成新报告
        </button>
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-2">
          <div className="text-sm text-gray-600">用户：{user.username}</div>
          <div className="text-xs text-gray-500">报告列表</div>
          <div className="flex flex-wrap gap-2">
            {reports.map((r) => (
              <button
                key={r.id}
                onClick={() => openReport(r.id)}
                className={`px-3 py-1.5 rounded-lg text-xs border ${
                  activeReport?.id === r.id
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-200'
                }`}
              >
                {formatDate(r.createdAt)}
              </button>
            ))}
            {reports.length === 0 && <div className="text-xs text-gray-400">暂无报告</div>}
          </div>
        </div>

        {error && <div className="text-sm text-red-500">{error}</div>}

        {activeReport && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3">
              <FileText size={18} className="text-blue-600" />
              <div className="text-sm text-gray-700">报告生成：{formatDate(activeReport.createdAt)}</div>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={saveReport}
                  className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs flex items-center gap-1"
                  disabled={saving}
                >
                  <Save size={14} />
                  {saving ? '保存中...' : '保存修改'}
                </button>
                <button
                  onClick={exportPdf}
                  className="px-3 py-1.5 rounded-lg bg-gray-800 text-white text-xs flex items-center gap-1"
                >
                  <Download size={14} />
                  导出 PDF
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
              <div className="text-sm font-semibold text-gray-900">总体结论</div>
              <div className="text-xs text-gray-500">稳定领域</div>
              <textarea
                className="w-full border rounded-lg p-2 text-sm"
                rows={2}
                value={activeReport.content?.overallConclusion?.stableAreas || ''}
                onChange={(e) => updateContent('overall.stable', e.target.value)}
                placeholder="相对稳定领域"
              />
              <div className="text-xs text-gray-500">建议关注领域</div>
              <textarea
                className="w-full border rounded-lg p-2 text-sm"
                rows={2}
                value={activeReport.content?.overallConclusion?.attentionAreas || ''}
                onChange={(e) => updateContent('overall.attention', e.target.value)}
                placeholder="建议关注领域"
              />
              <div className="text-xs text-gray-500">重点关注领域</div>
              <textarea
                className="w-full border rounded-lg p-2 text-sm"
                rows={2}
                value={activeReport.content?.overallConclusion?.highRiskAreas || ''}
                onChange={(e) => updateContent('overall.highRisk', e.target.value)}
                placeholder="重点关注领域"
              />
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
              <div className="text-sm font-semibold text-gray-900">主题总结</div>
              {[
                { key: 'emotion_forest', label: '情绪森林' },
                { key: 'digital_island', label: '数字小岛' },
                { key: 'stress_sea', label: '学海破浪/鸭梨海' },
                { key: 'confidence_garden', label: '自信花园' },
                { key: 'sleep_planet', label: '睡眠星球' },
              ].map((item) => (
                <div key={item.key} className="space-y-1">
                  <div className="text-xs text-gray-500">{item.label}</div>
                  <textarea
                    className="w-full border rounded-lg p-2 text-sm"
                    rows={2}
                    value={activeReport.content?.themeSummaries?.[item.key] || ''}
                    onChange={(e) => updateContent(`theme.${item.key}`, e.target.value)}
                    placeholder={`${item.label} 总结`}
                  />
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
              <div className="text-sm font-semibold text-gray-900">量表解释</div>
              {getScaleIdsForReport().map((scaleId) => {
                const scaleData = activeReport.scales?.[scaleId];
                const label = scaleMeta[scaleId]?.name || scaleData?.scaleName || scaleId;
                return (
                  <div key={scaleId} className="border rounded-xl p-3 space-y-2">
                    <div className="text-sm font-semibold text-gray-900">
                      {label}
                      <span className="text-xs text-gray-500 ml-2">{scaleMeta[scaleId]?.abbr || scaleId}</span>
                    </div>
                    <div className="text-xs text-gray-500">阈值说明：{scaleMeta[scaleId]?.threshold || '—'}</div>
                    <div className="text-xs text-gray-600">
                      本次结果：{scaleData ? renderScaleScore(scaleId, scaleData) : '未测评'}
                    </div>
                    <textarea
                      className="w-full border rounded-lg p-2 text-sm"
                      rows={3}
                      value={activeReport.content?.scaleInterpretations?.[scaleId] || ''}
                      onChange={(e) => updateContent(`scale.${scaleId}`, e.target.value)}
                      placeholder={scaleData ? "AI 解释或人工补充" : "未测评，可补充说明"}
                    />
                  </div>
                );
              })}
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
              <div className="text-sm font-semibold text-gray-900">风险预警</div>
              <div className="text-xs text-gray-500">当前自动识别到的风险信号与跟进建议</div>
              <textarea
                className="w-full border rounded-lg p-2 text-sm"
                rows={3}
                value={activeReport.content?.riskWarnings || ''}
                onChange={(e) => updateContent('riskWarnings', e.target.value)}
              />
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
              <div className="text-sm font-semibold text-gray-900">综合分析</div>
              <div className="text-xs text-gray-500">可由 AI 生成后再人工微调</div>
              <textarea
                className="w-full border rounded-lg p-2 text-sm"
                rows={4}
                value={activeReport.content?.comprehensiveAnalysis || ''}
                onChange={(e) => updateContent('comprehensiveAnalysis', e.target.value)}
              />
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
              <div className="text-sm font-semibold text-gray-900">干预建议</div>
              <div className="text-xs text-gray-500">日常支持建议</div>
              <textarea
                className="w-full border rounded-lg p-2 text-sm"
                rows={3}
                value={activeReport.content?.interventions?.daily || ''}
                onChange={(e) => updateContent('interventions.daily', e.target.value)}
                placeholder="日常支持建议"
              />
              <div className="text-xs text-gray-500">家校协同建议</div>
              <textarea
                className="w-full border rounded-lg p-2 text-sm"
                rows={3}
                value={activeReport.content?.interventions?.homeSchool || ''}
                onChange={(e) => updateContent('interventions.homeSchool', e.target.value)}
                placeholder="家校协同建议"
              />
              <div className="text-xs text-gray-500">专业支持建议</div>
              <textarea
                className="w-full border rounded-lg p-2 text-sm"
                rows={3}
                value={activeReport.content?.interventions?.professional || ''}
                onChange={(e) => updateContent('interventions.professional', e.target.value)}
                placeholder="专业支持建议"
              />
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
              <div className="text-sm font-semibold text-gray-900">报告尾注</div>
              <div className="text-xs text-gray-500">免责声明与提示说明</div>
              <textarea
                className="w-full border rounded-lg p-2 text-sm"
                rows={2}
                value={activeReport.content?.notes || ''}
                onChange={(e) => updateContent('notes', e.target.value)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
