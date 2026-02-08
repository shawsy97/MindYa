// TaskDetail.jsx
import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Gamepad, 
  User, 
  Clock, 
  Target, 
  CheckCircle, 
  XCircle, 
  BarChart3,
  Zap,
  Activity,
  TrendingUp,
  AlertCircle
} from 'lucide-react';

function TaskDetail({ taskId, onBack }) {
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAllTrials, setShowAllTrials] = useState(false);

  useEffect(() => {
    const fetchTaskDetail = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${import.meta.env.VITE_API_BASE || ''}/api/admin/task/${taskId}`);
        if (!response.ok) {
          throw new Error('获取游戏详情失败');
        }
        const data = await response.json();
        setTask(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (taskId) {
      fetchTaskDetail();
    }
  }, [taskId]);

  // 格式化日期
  const formatDate = (dateString) => {
    if (!dateString) return '未知时间';
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 获取游戏难度级别
  const getDifficultyLevel = (config) => {
    if (!config) return '标准';
    const nTrials = config.nTrials || 0;
    if (nTrials >= 200) return '困难';
    if (nTrials >= 150) return '中等';
    return '简单';
  };

  // 获取性能评价
  const getPerformanceComment = (summary) => {
    if (!summary) return '数据不足';
    
    const accuracy = summary.accuracy || 0;
    const hits = summary.hits || 0;
    const omissions = summary.omissions || 0;
    const commissions = summary.commissions || 0;
    
    if (accuracy >= 0.9 && commissions === 0) return '优秀表现';
    if (accuracy >= 0.8 && commissions <= 2) return '良好表现';
    if (accuracy >= 0.7) return '中等表现';
    return '需要练习';
  };

  // 获取反应时间评价
  const getRTComment = (meanRT) => {
    if (!meanRT) return '无数据';
    if (meanRT < 400) return '非常快';
    if (meanRT < 500) return '适中';
    if (meanRT < 600) return '稍慢';
    return '反应偏慢';
  };

  // 计算准确率百分比
  const getAccuracyPercent = (accuracy) => {
    return Math.round((accuracy || 0) * 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-4">
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-gray-600 mt-4">加载游戏详情中...</p>
        </div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-4">
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-10 h-10 text-red-500" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">加载失败</h3>
          <p className="text-gray-500 text-sm mb-4">{error || '游戏数据不存在'}</p>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            返回列表
          </button>
        </div>
      </div>
    );
  }

  const summary = task.summary || {};
  const config = task.config || {};
  const trials = task.trials || [];
  
  // 性能统计
  const performanceStats = {
    accuracy: getAccuracyPercent(summary.accuracy),
    hits: summary.hits || 0,
    omissions: summary.omissions || 0,
    commissions: summary.commissions || 0,
    meanRT: summary.meanRT || 0,
    sdRT: summary.sdRT || 0,
    totalTrials: summary.n || trials.length
  };

  // 正确反应的试次
  const correctTrials = trials.filter(t => t.correct);
  // 错误反应的试次
  const errorTrials = trials.filter(t => !t.correct && t.responded !== undefined);
  // 反应时间数据（只统计正确的目标试次）
  const reactionTimes = trials.filter(t => t.isTarget && t.correct && t.rtMs).map(t => t.rtMs);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-4 space-y-6 pb-20">
      {/* 顶部导航栏 */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="font-medium">返回</span>
          </button>
          <h2 className="text-lg font-semibold text-gray-900">游戏详情</h2>
        </div>
      </div>

      {/* 基本信息卡片 */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl flex items-center justify-center">
                <Gamepad className="text-purple-600" size={24} />
              </div>
              <div>
                <h3 className="font-bold text-lg text-gray-900">{task.taskName}</h3>
                <p className="text-sm text-gray-500">{task.taskId} • 认知训练游戏结果</p>
              </div>
            </div>
            <div className="px-4 py-2 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 rounded-full flex items-center gap-2">
              <Target size={20} />
              <span className="font-medium">{getDifficultyLevel(config)}</span>
            </div>
          </div>
        </div>
        
        <div className="p-5 space-y-4">
          {/* 用户信息 */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                <User className="text-blue-500" size={18} />
              </div>
              <div>
                <p className="text-sm text-gray-600">用户</p>
                <p className="font-medium text-gray-900">{task.username}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">完成时间</p>
              <p className="font-medium text-gray-900">{formatDate(task.submittedAt)}</p>
            </div>
          </div>
          
          {/* 游戏配置信息 */}
          <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-100">
            <div className="flex items-center gap-2 mb-3">
              <Gamepad className="text-blue-600" size={18} />
              <h4 className="font-medium text-blue-800">游戏配置</h4>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white p-2 rounded-lg">
                <p className="text-xs text-gray-500">试次数</p>
                <p className="font-bold text-gray-900">{config.nTrials || 0}</p>
              </div>
              <div className="bg-white p-2 rounded-lg">
                <p className="text-xs text-gray-500">刺激时长</p>
                <p className="font-bold text-gray-900">{config.stimMs || 0}ms</p>
              </div>
              <div className="bg-white p-2 rounded-lg">
                <p className="text-xs text-gray-500">间隔时长</p>
                <p className="font-bold text-gray-900">{config.isiMs || 0}ms</p>
              </div>
              <div className="bg-white p-2 rounded-lg">
                <p className="text-xs text-gray-500">目标概率</p>
                <p className="font-bold text-gray-900">{config.targetProb ? Math.round(config.targetProb * 100) : 0}%</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 性能概览卡片 */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-100 to-emerald-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="text-green-600" size={18} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">性能概览</h3>
                <p className="text-sm text-gray-500">游戏表现分析</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">综合评分</div>
              <div className="text-2xl font-bold text-purple-600">
                {task.performanceScore || 0}/100
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 准确率 */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-xl border border-green-100">
              <div className="flex items-center gap-2 mb-3">
                <Target className="text-green-600" size={18} />
                <span className="font-medium text-green-800">准确率</span>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-3xl font-bold text-gray-900">
                    {performanceStats.accuracy}%
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {getPerformanceComment(summary)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-600">正确/总数</div>
                  <div className="font-medium text-gray-900">
                    {correctTrials.length}/{performanceStats.totalTrials}
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>0%</span>
                  <span>100%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full"
                    style={{ width: `${performanceStats.accuracy}%` }}
                  ></div>
                </div>
              </div>
            </div>
            
            {/* 反应时间 */}
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-4 rounded-xl border border-blue-100">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="text-blue-600" size={18} />
                <span className="font-medium text-blue-800">反应时间</span>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-3xl font-bold text-gray-900">
                    {performanceStats.meanRT}ms
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {getRTComment(performanceStats.meanRT)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-600">标准差</div>
                  <div className="font-medium text-gray-900">
                    {performanceStats.sdRT}ms
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>快</span>
                  <span>慢</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full"
                    style={{ width: `${Math.min(performanceStats.meanRT / 10, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
            
            {/* 错误分析 */}
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-4 rounded-xl border border-orange-100">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="text-orange-600" size={18} />
                <span className="font-medium text-orange-800">错误分析</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/50 p-3 rounded-lg">
                  <div className="text-xs text-gray-600">遗漏错误</div>
                  <div className="text-xl font-bold text-orange-600">
                    {performanceStats.omissions}
                  </div>
                  <div className="text-xs text-gray-600">未按目标</div>
                </div>
                <div className="bg-white/50 p-3 rounded-lg">
                  <div className="text-xs text-gray-600">错误反应</div>
                  <div className="text-xl font-bold text-orange-600">
                    {performanceStats.commissions}
                  </div>
                  <div className="text-xs text-gray-600">误按非目标</div>
                </div>
              </div>
              <div className="mt-3 text-xs text-gray-600">
                总错误数: {performanceStats.omissions + performanceStats.commissions}
              </div>
            </div>
          </div>
          
          {/* 命中率统计 */}
          <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-100">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="text-purple-600" size={18} />
              <h4 className="font-medium text-purple-800">命中与遗漏统计</h4>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-white p-3 rounded-lg">
                <div className="text-xs text-gray-600">命中</div>
                <div className="text-2xl font-bold text-green-600">{performanceStats.hits}</div>
                <div className="text-xs text-gray-600">正确反应</div>
              </div>
              <div className="bg-white p-3 rounded-lg">
                <div className="text-xs text-gray-600">遗漏</div>
                <div className="text-2xl font-bold text-orange-600">{performanceStats.omissions}</div>
                <div className="text-xs text-gray-600">未反应</div>
              </div>
              <div className="bg-white p-3 rounded-lg">
                <div className="text-xs text-gray-600">误报</div>
                <div className="text-2xl font-bold text-red-600">{performanceStats.commissions}</div>
                <div className="text-xs text-gray-600">错误反应</div>
              </div>
              <div className="bg-white p-3 rounded-lg">
                <div className="text-xs text-gray-600">正确拒绝</div>
                <div className="text-2xl font-bold text-blue-600">
                  {performanceStats.totalTrials - performanceStats.hits - performanceStats.omissions - performanceStats.commissions}
                </div>
                <div className="text-xs text-gray-600">正确不反应</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 试次详情 */}
      {trials.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">试次详情</h3>
                <p className="text-sm text-gray-500 mt-1">每个试次的具体表现</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">共 {trials.length} 个试次</span>
                <button
                  onClick={() => setShowAllTrials(!showAllTrials)}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  {showAllTrials ? '收起详情' : '展开全部'}
                </button>
              </div>
            </div>
          </div>
          
          <div className="p-5">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-3 px-4 text-gray-600 font-medium text-sm">试次</th>
                    <th className="text-left py-3 px-4 text-gray-600 font-medium text-sm">刺激</th>
                    <th className="text-left py-3 px-4 text-gray-600 font-medium text-sm">类型</th>
                    <th className="text-left py-3 px-4 text-gray-600 font-medium text-sm">反应</th>
                    <th className="text-left py-3 px-4 text-gray-600 font-medium text-sm">正确</th>
                    <th className="text-left py-3 px-4 text-gray-600 font-medium text-sm">反应时间</th>
                    <th className="text-left py-3 px-4 text-gray-600 font-medium text-sm">时间戳</th>
                  </tr>
                </thead>
                <tbody>
                  {(showAllTrials ? trials : trials.slice(0, 10)).map((trial, index) => (
                    <tr 
                      key={index} 
                      className={`border-t border-gray-100 hover:bg-gray-50 ${trial.correct ? '' : 'bg-red-50/50'}`}
                    >
                      <td className="py-3 px-4 text-gray-900 font-medium">{index + 1}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-block w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                          trial.stim === 'X' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {trial.stim}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          trial.isTarget 
                            ? 'bg-red-100 text-red-700' 
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {trial.isTarget ? '目标' : '非目标'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {trial.responded ? (
                            <>
                              <CheckCircle className="w-4 h-4 text-green-500" />
                              <span className="text-green-600 text-sm">按键</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-4 h-4 text-gray-400" />
                              <span className="text-gray-500 text-sm">未按键</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {trial.correct ? (
                            <>
                              <CheckCircle className="w-4 h-4 text-green-500" />
                              <span className="text-green-600 text-sm">正确</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-4 h-4 text-red-500" />
                              <span className="text-red-600 text-sm">错误</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {trial.rtMs ? (
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-blue-500" />
                            <span className="text-gray-900">{trial.rtMs}ms</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-500 text-sm">
                        {trial.ts ? formatDate(trial.ts) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {!showAllTrials && trials.length > 10 && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => setShowAllTrials(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  显示全部 {trials.length} 个试次
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 原始数据预览 */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">原始数据</h3>
              <p className="text-sm text-gray-500 mt-1">完整的JSON数据</p>
            </div>
            <button 
              onClick={() => {
                const jsonStr = JSON.stringify(task.fullData, null, 2);
                navigator.clipboard.writeText(jsonStr);
                alert('已复制到剪贴板');
              }}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              复制数据
            </button>
          </div>
        </div>
        
        <div className="p-5">
          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto max-h-96">
            <pre className="text-xs whitespace-pre-wrap">
              {JSON.stringify(task.fullData, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TaskDetail;