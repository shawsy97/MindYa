import React, { useState, useEffect } from 'react';
import { MessageCircle, Calendar, User, MessageSquare } from 'lucide-react';

function ConversationsTab({ loading, conversations: propConversations, onSelectConversation }) {
  const [conversations, setConversations] = useState([]);
  const [filteredConversations, setFilteredConversations] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // 如果父组件传递了conversations，则使用它，否则从API获取
  useEffect(() => {
    if (propConversations) {
      setConversations(propConversations);
      setFilteredConversations(propConversations);
    } else {
      const fetchData = async () => {
        try {
          // 获取对话数据
          const convResponse = await fetch(`${import.meta.env.VITE_API_BASE || ''}/api/admin/conversations`);
          const convData = await convResponse.json();
          
          // 如果API不存在，使用本地数据
          if (!convResponse.ok || convData.error) {
            // 从本地获取对话数据
            const localConvData = await getLocalConversations();
            setConversations(localConvData);
            setFilteredConversations(localConvData);
          } else {
            setConversations(convData);
            setFilteredConversations(convData);
          }
        } catch (error) {
          console.error('获取对话数据失败:', error);
          // 出错时尝试获取本地数据
          const localConvData = await getLocalConversations();
          setConversations(localConvData);
          setFilteredConversations(localConvData);
        }
      };

      fetchData();
    }
  }, [propConversations]);

  // 搜索过滤
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredConversations(conversations);
    } else {
      const filtered = conversations.filter(conv => 
        conv.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        conv.preview?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (conv.messages && conv.messages.some(msg => 
          msg.content?.toLowerCase().includes(searchTerm.toLowerCase())
        ))
      );
      setFilteredConversations(filtered);
    }
  }, [searchTerm, conversations]);

  // 从本地获取对话数据
  const getLocalConversations = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE || ''}/api/admin/conversations`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('获取本地对话数据失败:', error);
      return [];
    }
  };

  // 格式化时间显示
  const formatTime = (timestamp) => {
    if (!timestamp) return '未知时间';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return `今天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return `昨天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays < 7) {
      return `${diffDays}天前`;
    } else {
      return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    }
  };

  // 处理对话点击事件
  const handleConversationClick = (conversation) => {
    if (onSelectConversation) {
      onSelectConversation(conversation);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
          <div className="animate-pulse">
            <div className="w-20 h-20 bg-gray-200 rounded-full mx-auto mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/3 mx-auto mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/4 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 space-y-6">
      {/* 标题区域 */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
              <MessageCircle className="text-indigo-600" size={24} />
            </div>
            <div>
              <h2 className="font-bold text-xl text-gray-900">对话记录</h2>
              <p className="text-sm text-gray-500">用户与AI的心理咨询对话</p>
            </div>
          </div>
          <div className="bg-indigo-100 px-3 py-1 rounded-full">
            <span className="text-sm font-medium text-indigo-700">{conversations.length} 条记录</span>
          </div>
        </div>
      </div>

      {/* 搜索框 */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜索用户名或对话内容..."
            className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
          />
        </div>
      </div>

      {/* 对话列表 */}
      <div className="space-y-4">
        {filteredConversations.length > 0 ? filteredConversations.map((conversation, index) => {
          // 获取对话预览
          const preview = conversation.preview || 
            (conversation.messages && conversation.messages.length > 0 ? 
             conversation.messages[0].content.substring(0, 80) + (conversation.messages[0].content.length > 80 ? '...' : '') : 
             '暂无对话内容');
          
          // 获取消息数量
          const messageCount = conversation.messages ? conversation.messages.length : 0;
          
          // 获取最后更新时间
          const lastUpdated = conversation.updatedAt || 
            (conversation.messages && conversation.messages.length > 0 ? 
             conversation.messages[conversation.messages.length - 1].timestamp : null);
          
          return (
            <div 
              key={conversation._id || conversation.sessionId || index}
              onClick={() => handleConversationClick(conversation)}
              className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100 hover:border-indigo-200 hover:shadow-md transition-all duration-200 cursor-pointer group"
            >
              <div className="p-5">
                <div className="flex items-start gap-4 mb-4">
                  {/* 用户头像 */}
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl flex items-center justify-center group-hover:from-indigo-200 group-hover:to-purple-200 transition-colors">
                      <User className="text-indigo-600" size={20} />
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    {/* 用户名和时间 */}
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {conversation.username || '匿名用户'}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-gray-500 whitespace-nowrap">
                        <Calendar size={12} />
                        <span>{formatTime(lastUpdated)}</span>
                      </div>
                    </div>
                    
                    {/* 对话预览 */}
                    <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                      {preview}
                    </p>
                    
                    {/* 消息数量和状态标签 */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                          <MessageSquare size={12} />
                          <span>{messageCount} 条消息</span>
                        </div>
                        {conversation.riskLevel && (
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            conversation.riskLevel === 'high' ? 'bg-red-100 text-red-700' :
                            conversation.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {conversation.riskLevel === 'high' ? '高风险' : 
                             conversation.riskLevel === 'medium' ? '中风险' : '低风险'}
                          </span>
                        )}
                      </div>
                      
                      <div className="text-indigo-600 group-hover:text-indigo-800 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        }) : (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="w-10 h-10 text-gray-400" />
            </div>
            <p className="text-gray-700 font-medium mb-2">
              {searchTerm ? '未找到匹配的对话记录' : '暂无对话数据'}
            </p>
            <p className="text-gray-500 text-sm mb-4">
              {searchTerm ? '请尝试其他搜索关键词' : '用户开始对话后，记录将在此显示'}
            </p>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-200 transition-colors"
              >
                清空搜索
              </button>
            )}
          </div>
        )}
      </div>

      {/* 统计信息卡片 */}
      {filteredConversations.length > 0 && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl shadow-sm p-5 border border-indigo-100">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/80 rounded-xl p-4">
              <p className="text-xs text-gray-600 mb-1">对话总数</p>
              <p className="text-2xl font-bold text-gray-900">{filteredConversations.length}</p>
            </div>
            <div className="bg-white/80 rounded-xl p-4">
              <p className="text-xs text-gray-600 mb-1">平均消息数</p>
              <p className="text-2xl font-bold text-gray-900">
                {conversations.length > 0 
                  ? Math.round(conversations.reduce((sum, conv) => sum + (conv.messages?.length || 0), 0) / conversations.length) 
                  : 0}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ConversationsTab;