// ScaleDetail.jsx
import React, { useState, useEffect } from 'react';
import { ArrowLeft, BarChart3, User, Calendar, AlertTriangle, CheckCircle, XCircle, FileText, ChevronDown, ChevronUp, Heart, Brain, Shield, Target, Users as UsersIcon } from 'lucide-react';
import { SCALE_BANK } from '../scales/scaleBank';

function ScaleDetail({ scaleId, onBack }) {
    const [scale, setScale] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedQuestions, setExpandedQuestions] = useState({});

    useEffect(() => {
        const fetchScaleDetail = async () => {
            try {
                setLoading(true);
                const response = await fetch(`${import.meta.env.VITE_API_BASE || ''}/api/admin/scale/${scaleId}`);
                if (!response.ok) {
                    throw new Error('获取量表详情失败');
                }
                const data = await response.json();
                setScale(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (scaleId) {
            fetchScaleDetail();
        }
    }, [scaleId]);

    // 获取风险等级配置
    const getRiskConfig = (riskLevel) => {
        switch (riskLevel) {
            case 'high':
                return {
                    color: 'from-red-500 to-orange-500',
                    bgColor: 'bg-red-100',
                    textColor: 'text-red-700',
                    icon: <AlertTriangle className="text-red-600" size={20} />,
                    label: '高风险',
                    description: '需要立即关注和干预'
                };
            case 'medium':
                return {
                    color: 'from-yellow-500 to-amber-500',
                    bgColor: 'bg-yellow-100',
                    textColor: 'text-yellow-700',
                    icon: <AlertTriangle className="text-yellow-600" size={20} />,
                    label: '中风险',
                    description: '建议关注和定期评估'
                };
            case 'low':
                return {
                    color: 'from-green-500 to-emerald-500',
                    bgColor: 'bg-green-100',
                    textColor: 'text-green-700',
                    icon: <CheckCircle className="text-green-600" size={20} />,
                    label: '低风险',
                    description: '当前状况良好'
                };
            default:
                return {
                    color: 'from-gray-500 to-gray-600',
                    bgColor: 'bg-gray-100',
                    textColor: 'text-gray-700',
                    icon: <XCircle className="text-gray-600" size={20} />,
                    label: '未知',
                    description: '无法评估风险等级'
                };
        }
    };

    // 获取量表定义
    const getScaleDefinition = () => {
        if (!scale || !scale.scaleId) return null;
        return SCALE_BANK[scale.scaleId] || SCALE_BANK[Object.keys(SCALE_BANK).find(key => key === scale.scaleId || key.toLowerCase() === scale.scaleId.toLowerCase())];
    };

    // 获取题目的选项文本
    const getOptionLabel = (scaleDef, item, answerValue) => {
        if (answerValue === undefined || answerValue === null) return '未作答';

        // 优先使用题目的特定选项
        if (item.options && item.options.length > 0) {
            const option = item.options.find(opt => opt.value == answerValue);
            return option ? option.label : answerValue;
        }

        // 使用量表的默认选项
        if (scaleDef.options && scaleDef.options.length > 0) {
            const option = scaleDef.options.find(opt => opt.value == answerValue);
            return option ? option.label : answerValue;
        }

        return answerValue;
    };

    // 获取选项颜色样式
    const getOptionStyle = (scaleDef, item, answerValue) => {
        if (answerValue === undefined || answerValue === null) {
            return {
                bg: 'bg-gray-100',
                text: 'text-gray-700',
                border: 'border-gray-200',
                iconBg: 'bg-gray-200',
                iconColor: 'text-gray-600'
            };
        }

        // 获取最大值用于计算百分比
        const maxValue = getMaxValue(scaleDef, item);
        const percentage = answerValue / maxValue;

        if (percentage >= 0.8) {
            return {
                bg: 'bg-gradient-to-r from-red-50 to-orange-50',
                text: 'text-red-700',
                border: 'border-red-200',
                iconBg: 'bg-gradient-to-r from-red-500 to-orange-500',
                iconColor: 'text-white',
                shadow: 'shadow-sm'
            };
        }
        if (percentage >= 0.6) {
            return {
                bg: 'bg-gradient-to-r from-orange-50 to-amber-50',
                text: 'text-orange-700',
                border: 'border-orange-200',
                iconBg: 'bg-gradient-to-r from-orange-500 to-amber-500',
                iconColor: 'text-white',
                shadow: 'shadow-sm'
            };
        }
        if (percentage >= 0.4) {
            return {
                bg: 'bg-gradient-to-r from-yellow-50 to-lime-50',
                text: 'text-yellow-700',
                border: 'border-yellow-200',
                iconBg: 'bg-gradient-to-r from-yellow-500 to-lime-500',
                iconColor: 'text-white',
                shadow: 'shadow-sm'
            };
        }
        if (percentage >= 0.2) {
            return {
                bg: 'bg-gradient-to-r from-blue-50 to-cyan-50',
                text: 'text-blue-700',
                border: 'border-blue-200',
                iconBg: 'bg-gradient-to-r from-blue-500 to-cyan-500',
                iconColor: 'text-white',
                shadow: 'shadow-sm'
            };
        }

        return {
            bg: 'bg-gradient-to-r from-green-50 to-emerald-50',
            text: 'text-green-700',
            border: 'border-green-200',
            iconBg: 'bg-gradient-to-r from-green-500 to-emerald-500',
            iconColor: 'text-white',
            shadow: 'shadow-sm'
        };
    };

    // 获取答案的最大值（用于计算百分比）
    const getMaxValue = (scaleDef, item) => {
        // 优先使用题目的特定选项
        if (item.options && item.options.length > 0) {
            const values = item.options.map(opt => opt.value).filter(v => !isNaN(v));
            return Math.max(...values, 0);
        }

        // 使用量表的默认选项
        if (scaleDef.options && scaleDef.options.length > 0) {
            const values = scaleDef.options.map(opt => opt.value).filter(v => !isNaN(v));
            return Math.max(...values, 0);
        }

        return 5; // 默认最大值
    };

    // 获取维度图标
    const getDimensionIcon = (dimension) => {
        switch (dimension) {
            case 'stress':
                return <Brain className="w-4 h-4" />;
            case 'anxiety':
                return <AlertTriangle className="w-4 h-4" />;
            case 'depression':
                return <Heart className="w-4 h-4" />;
            case 'reappraisal':
                return <Shield className="w-4 h-4" />;
            case 'suppression':
                return <Target className="w-4 h-4" />;
            case 'victim':
                return <UsersIcon className="w-4 h-4" />;
            case 'bully':
                return <UsersIcon className="w-4 h-4" />;
            default:
                return <FileText className="w-4 h-4" />;
        }
    };

    // 获取维度颜色
    const getDimensionColor = (dimension) => {
        switch (dimension) {
            case 'stress':
                return 'bg-gradient-to-r from-orange-500 to-red-500';
            case 'anxiety':
                return 'bg-gradient-to-r from-yellow-500 to-amber-500';
            case 'depression':
                return 'bg-gradient-to-r from-blue-500 to-indigo-500';
            case 'reappraisal':
                return 'bg-gradient-to-r from-green-500 to-emerald-500';
            case 'suppression':
                return 'bg-gradient-to-r from-purple-500 to-pink-500';
            case 'victim':
                return 'bg-gradient-to-r from-rose-500 to-red-500';
            case 'bully':
                return 'bg-gradient-to-r from-violet-500 to-purple-500';
            default:
                return 'bg-gradient-to-r from-gray-500 to-gray-600';
        }
    };

    // 获取维度名称
    const getDimensionName = (dimension) => {
        switch (dimension) {
            case 'stress': return '压力';
            case 'anxiety': return '焦虑';
            case 'depression': return '抑郁';
            case 'reappraisal': return '认知重评';
            case 'suppression': return '表达抑制';
            case 'victim': return '被动欺凌';
            case 'bully': return '主动欺凌';
            default: return dimension;
        }
    };

    // 获取维度中文名称
    const getDimensionChineseName = (key) => {
        const translations = {
            'depression': '抑郁得分',
            'anxiety': '焦虑得分',
            'stress': '压力得分',
            'reappraisal_mean': '认知重评均分',
            'suppression_mean': '表达抑制均分',
            'reappraisal_sum': '认知重评总分',
            'suppression_sum': '表达抑制总分',
            'victim_sum': '被动欺凌总分',
            'bully_sum': '主动欺凌总分',
            'ideation': '自伤想法频次',
            'behavior': '自伤行为频次',
            'plan': '自杀计划',
            'attempt': '自杀企图',
            'attemptCount': '自杀企图次数',
            'total': '总分',
            'mean': '平均分',
            'items': '题目数量',
            'reversedItems': '反向计分题数',
            'victim_mean': '被动欺凌均分',
            'bully_mean': '主动欺凌均分',
            'range': '评分范围',
            'severity': '严重程度',
            'strategy': '策略倾向',
            'summary': '总结'
        };

        return translations[key] || key;
    };

    // 获取实际总分 - 修复bug
    const getActualTotalScore = () => {
        if (!scale) return 0;

        // 优先使用scoreDetails中的total
        if (scale.scoreDetails?.total !== undefined) {
            return scale.scoreDetails.total;
        }

        // 其次使用fullData中的totalScore
        if (scale.fullData?.totalScore !== undefined) {
            return scale.fullData.totalScore;
        }

        // 再次使用scale.totalScore
        if (scale.totalScore !== undefined) {
            return scale.totalScore;
        }

        // 最后计算answers的总和
        if (scale.answers) {
            const answerValues = Object.values(scale.answers)
                .map(v => {
                    const num = Number(v);
                    return isNaN(num) ? 0 : num;
                });

            if (answerValues.length > 0) {
                return answerValues.reduce((a, b) => a + b, 0);
            }
        }

        return 0;
    };

    // 切换题目展开状态
    const toggleQuestion = (questionKey) => {
        setExpandedQuestions(prev => ({
            ...prev,
            [questionKey]: !prev[questionKey]
        }));
    };

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

    // 获取所有选项列表
    const getAllOptions = (scaleDef, item) => {
        return item.options || scaleDef.options || [];
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-4">
                <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                    <p className="text-gray-600 mt-4">加载量表详情中...</p>
                </div>
            </div>
        );
    }

    if (error || !scale) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-4">
                <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <XCircle className="w-10 h-10 text-red-500" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">加载失败</h3>
                    <p className="text-gray-500 text-sm mb-4">{error || '量表数据不存在'}</p>
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

    const riskConfig = getRiskConfig(scale.riskLevel);
    const answers = scale.answers || {};
    const scoreDetails = scale.scoreDetails || scale.fullData?.score || {};
    const level = scale.level || {};
    const scaleDef = getScaleDefinition();
    const actualTotalScore = getActualTotalScore();

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
                    <h2 className="text-lg font-semibold text-gray-900">量表详情</h2>
                </div>
            </div>

            {/* 基本信息卡片 */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-xl flex items-center justify-center">
                                <BarChart3 className="text-blue-600" size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-gray-900">{scale.scaleName}</h3>
                                <p className="text-sm text-gray-500">{scale.scaleId} • 量表评估结果</p>
                            </div>
                        </div>
                        <div className={`px-4 py-2 ${riskConfig.bgColor} ${riskConfig.textColor} rounded-full flex items-center gap-2`}>
                            {riskConfig.icon}
                            <span className="font-medium">{riskConfig.label}</span>
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
                                <p className="font-medium text-gray-900">{scale.username}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-gray-600">提交时间</p>
                            <p className="font-medium text-gray-900">{formatDate(scale.submittedAt)}</p>
                        </div>
                    </div>

                    {/* 总分展示 */}
                    <div className={`p-4 bg-gradient-to-r ${riskConfig.color} rounded-xl text-white shadow-md`}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm opacity-90">量表总分</p>
                                <p className="text-3xl font-bold mt-1">{actualTotalScore}</p>
                                {scoreDetails.range && (
                                    <p className="text-sm opacity-80 mt-1">评分范围: {scoreDetails.range}</p>
                                )}
                            </div>
                            <div className="text-right">
                                <p className="text-sm opacity-90">风险等级</p>
                                <p className="text-xl font-bold mt-1">{riskConfig.label}</p>
                                <p className="text-xs opacity-80 mt-1">{riskConfig.description}</p>
                            </div>
                        </div>

                        {/* 总分进度条 */}
                        <div className="mt-4">
                            <div className="flex justify-between text-xs opacity-90 mb-1">
                                <span>0</span>
                                <span>{scoreDetails.range ? scoreDetails.range.split('-')[1] : '100'}</span>
                            </div>
                            <div className="w-full bg-white/30 rounded-full h-2.5">
                                <div
                                    className="h-2.5 bg-white rounded-full shadow-sm"
                                    style={{
                                        width: `${Math.min((actualTotalScore / (scoreDetails.range ? parseInt(scoreDetails.range.split('-')[1]) : 100)) * 100, 100)}%`
                                    }}
                                ></div>
                            </div>
                        </div>
                    </div>

                    {/* 量表描述 */}
                    {scaleDef && (
                        <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <FileText className="text-indigo-600" size={18} />
                                <h4 className="font-medium text-indigo-800">量表信息</h4>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div className="bg-white p-2 rounded-lg border border-gray-100">
                                    <p className="text-xs text-gray-500">名称</p>
                                    <p className="font-medium text-gray-900">{scaleDef.name}</p>
                                </div>
                                <div className="bg-white p-2 rounded-lg border border-gray-100">
                                    <p className="text-xs text-gray-500">评估周期</p>
                                    <p className="font-medium text-gray-900">{scaleDef.period}</p>
                                </div>
                                <div className="bg-white p-2 rounded-lg border border-gray-100">
                                    <p className="text-xs text-gray-500">适用年龄</p>
                                    <p className="font-medium text-gray-900">{scaleDef.ageRange?.min || '不限'} - {scaleDef.ageRange?.max || '不限'}岁</p>
                                </div>
                                <div className="bg-white p-2 rounded-lg border border-gray-100">
                                    <p className="text-xs text-gray-500">题目数量</p>
                                    <p className="font-medium text-gray-900">{scaleDef.items?.length || 0}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 题目详情 */}
            {scaleDef && scaleDef.items && (
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-gray-100">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-semibold text-gray-900">题目详情</h3>
                                <p className="text-sm text-gray-500 mt-1">用户的具体选择和评分</p>
                            </div>
                            <div className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                                共 {scaleDef.items.length} 题
                            </div>
                        </div>
                    </div>

                    <div className="p-5 space-y-4">
                        {scaleDef.items.map((item, index) => {
                            const answerValue = answers[item.key];
                            const optionLabel = getOptionLabel(scaleDef, item, answerValue);
                            const optionStyle = getOptionStyle(scaleDef, item, answerValue);
                            const maxValue = getMaxValue(scaleDef, item);
                            const isExpanded = expandedQuestions[item.key];
                            const allOptions = getAllOptions(scaleDef, item);

                            return (
                                <div key={item.key} className="border border-gray-200 rounded-xl overflow-hidden hover:border-blue-300 transition-colors">
                                    {/* 题目头部 */}
                                    <div
                                        className="p-4 bg-white hover:bg-gray-50 cursor-pointer transition-colors"
                                        onClick={() => toggleQuestion(item.key)}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-start gap-3 flex-1">
                                                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm">
                                                    {index + 1}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-medium text-gray-900 leading-relaxed">{item.text}</h4>
                                                    <div className="flex flex-wrap gap-2 mt-2">
                                                        {item.sub && (
                                                            <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${getDimensionColor(item.sub)} text-white`}>
                                                                {getDimensionIcon(item.sub)}
                                                                <span>{getDimensionName(item.sub)}</span>
                                                            </div>
                                                        )}
                                                        {item.reverse && (
                                                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 text-xs rounded-full border border-amber-200">
                                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                                                </svg>
                                                                反向计分
                                                            </span>
                                                        )}
                                                        <span className="text-xs text-gray-500 px-2 py-1 bg-gray-50 rounded">
                                                            题号: {item.key}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 ml-3">
                                                {/* 用户答案 */}
                                                <div className={`min-w-[100px] px-4 py-2 rounded-lg ${optionStyle.bg} ${optionStyle.border} border ${optionStyle.shadow} transition-all duration-200 hover:scale-105`}>
                                                    <div className="flex flex-col items-center">
                                                        <div className={`w-10 h-10 rounded-full ${optionStyle.iconBg} flex items-center justify-center ${optionStyle.iconColor} text-lg font-bold mb-1`}>
                                                            {answerValue !== undefined && answerValue !== null ? answerValue : '?'}
                                                        </div>
                                                        <span className={`text-sm font-medium ${optionStyle.text} truncate max-w-[80px]`}>
                                                            {optionLabel}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="text-gray-400">
                                                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 展开的内容 */}
                                    {isExpanded && (
                                        <div className="p-4 border-t border-gray-200 bg-gray-50/50">
                                            <div className="space-y-4">
                                                {/* 答案详情 */}
                                                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {/* 用户选择详情 */}
                                                        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-4 rounded-lg border border-blue-100">
                                                            <p className="text-sm font-medium text-blue-800 mb-3 flex items-center gap-2">
                                                                <User className="w-4 h-4" />
                                                                用户选择详情
                                                            </p>
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-16 h-16 rounded-2xl ${optionStyle.iconBg} flex items-center justify-center ${optionStyle.iconColor} text-2xl font-bold shadow-md`}>
                                                                    {answerValue !== undefined && answerValue !== null ? answerValue : '?'}
                                                                </div>
                                                                <div>
                                                                    <p className="text-lg font-bold text-gray-900">{optionLabel}</p>
                                                                    <p className="text-sm text-gray-600 mt-1">数值: {answerValue !== undefined && answerValue !== null ? answerValue : '未作答'}</p>
                                                                    <p className="text-xs text-gray-500 mt-1">得分: {answerValue || 0}/{maxValue}</p>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* 分数进度 */}
                                                        <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-4 rounded-lg border border-purple-100">
                                                            <p className="text-sm font-medium text-purple-800 mb-3 flex items-center gap-2">
                                                                <BarChart3 className="w-4 h-4" />
                                                                分数进度
                                                            </p>
                                                            <div className="space-y-3">
                                                                <div className="flex items-center justify-between text-xs text-gray-600">
                                                                    <span>0</span>
                                                                    <span className="font-medium">当前得分</span>
                                                                    <span>{maxValue}</span>
                                                                </div>
                                                                <div className="h-3 bg-gradient-to-r from-green-400 via-yellow-400 to-red-500 rounded-full overflow-hidden">
                                                                    <div
                                                                        className="h-3 bg-gray-900 rounded-full transition-all duration-500"
                                                                        style={{ width: `${((answerValue || 0) / maxValue) * 100}%` }}
                                                                    ></div>
                                                                </div>
                                                                <div className="text-center">
                                                                    <span className="text-sm font-bold text-gray-900">
                                                                        {Math.round(((answerValue || 0) / maxValue) * 100)}%
                                                                    </span>
                                                                    <span className="text-xs text-gray-600 ml-2">
                                                                        ({answerValue || 0}/{maxValue})
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* 所有选项 */}
                                                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                                    <p className="text-sm font-medium text-gray-800 mb-3 flex items-center gap-2">
                                                        <FileText className="w-4 h-4" />
                                                        所有可用选项
                                                    </p>
                                                    {/* 修改这里：从网格布局改为垂直排列 */}
                                                    <div className="space-y-2">
                                                        {allOptions.map((option) => {
                                                            const isSelected = option.value == answerValue;
                                                            return (
                                                                <div
                                                                    key={option.value}
                                                                    className={`p-3 rounded-xl border transition-all duration-200 ${isSelected ? 'border-blue-500 bg-gradient-to-r from-blue-50 to-cyan-50 shadow-md' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}
                                                                >
                                                                    <div className="flex items-center gap-3">
                                                                        <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${isSelected ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                                                                            {option.value}
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className={`text-sm font-medium ${isSelected ? 'text-blue-700' : 'text-gray-700'} break-words`}>
                                                                                {option.label}
                                                                            </div>
                                                                            <div className="text-xs text-gray-500 mt-1">
                                                                                数值: {option.value}
                                                                            </div>
                                                                        </div>
                                                                        {isSelected && (
                                                                            <div className="w-6 h-6 flex-shrink-0 bg-blue-500 rounded-full flex items-center justify-center">
                                                                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                                                                </svg>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 得分详情 */}
            {scoreDetails && Object.keys(scoreDetails).length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-gray-100">
                        <h3 className="font-semibold text-gray-900">得分详情</h3>
                        <p className="text-sm text-gray-500 mt-1">各个维度的得分情况</p>
                    </div>

                    <div className="p-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {Object.entries(scoreDetails).map(([key, value]) => {
                                // 跳过total和range，因为已经在上面显示了
                                if (key === 'total' || key === 'range') return null;

                                // 获取中文名称
                                const chineseName = getDimensionChineseName(key);
                                const isTotalScore = key.includes('_sum') || key === 'totalScore';

                                return (
                                    <div key={key} className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-xl border border-gray-200 hover:border-blue-300 transition-colors">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-lg flex items-center justify-center">
                                                        <BarChart3 className="text-blue-600" size={18} />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-gray-900">{chineseName}</p>
                                                        <p className="text-sm text-gray-600">维度评分</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-2xl font-bold text-gray-900">
                                                    {typeof value === 'number' ? value.toFixed(1) : value}
                                                </p>
                                                {isTotalScore && (
                                                    <p className="text-xs text-gray-500 mt-1">总分</p>
                                                )}
                                            </div>
                                        </div>
                                        {typeof value === 'number' && (
                                            <div className="mt-3">
                                                <div className="flex justify-between text-xs text-gray-500 mb-1">
                                                    <span>0</span>
                                                    <span>100</span>
                                                </div>
                                                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-2 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-500"
                                                        style={{ width: `${Math.min(value, 100)}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
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
                                const jsonStr = JSON.stringify(scale.fullData, null, 2);
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
                            {JSON.stringify(scale.fullData, null, 2)}
                        </pre>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ScaleDetail;