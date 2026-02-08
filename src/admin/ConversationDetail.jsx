import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, MessageCircle, User, Bot, Clock } from 'lucide-react';

function ConversationDetail({ conversation, onBack }) {
  const [messages, setMessages] = useState([]);
  const [username, setUsername] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (conversation) {
      // 处理不同的数据结构
      let messagesData = [];
      if (conversation.messages) {
        messagesData = conversation.messages;
      } else if (Array.isArray(conversation)) {
        // 如果整个conversation是一个消息数组
        messagesData = conversation;
      }
      
      // 确定用户名
      const userName = conversation.username || conversation.user || '未知用户';
      setUsername(userName);
      
      // 智能识别消息角色
      const processedMessages = messagesData.map((msg, index) => {
        // 首先尝试从已有字段判断角色
        let role = null;
        
        if (msg.role) {
          role = msg.role;
        } else if (msg.isUser !== undefined) {
          role = msg.isUser ? 'user' : 'assistant';
        } else if (msg.sender) {
          role = msg.sender === 'user' ? 'user' : 'assistant';
        } else if (msg.type) {
          role = msg.type === 'user' ? 'user' : 'assistant';
        }
        
        // 如果没有明确的角色标识，根据内容特征判断
        const content = msg.content || msg.text || msg.message || '';
        if (!role) {
          // AI消息的特征：包含问候语、心芽、AI等关键词
          const aiKeywords = ['你好', '很高兴', '心芽', 'AI', '我是', '欢迎', '哈喽', 'hi', 'hello'];
          const isAIContent = aiKeywords.some(keyword => 
            content.toLowerCase().includes(keyword.toLowerCase())
          );
          
          // 用户消息的特征：通常是提问、陈述、表达感受
          const userKeywords = ['我', '你', '吗', '？', '?', '感觉', '心情', '今天'];
          const isUserContent = userKeywords.some(keyword => 
            content.includes(keyword)
          );
          
          // 根据长度和内容特征判断
          if (isAIContent && content.length > 10) {
            role = 'assistant';
          } else if (isUserContent) {
            role = 'user';
          }
        }
        
        return {
          ...msg,
          role: role || 'user', // 默认为用户消息
          content: content,
          timestamp: msg.timestamp || msg.time || msg.createdAt || new Date().toISOString(),
          id: msg.id || msg._id || `msg-${index}`
        };
      });
      
      // 后处理：确保消息交替，并且修复可能的角色错误
      const correctedMessages = ensureAlternatingRoles(processedMessages);
      setMessages(correctedMessages);
    }
  }, [conversation]);

  // 确保消息角色交替的函数
  const ensureAlternatingRoles = (messages) => {
    if (messages.length === 0) return messages;
    
    // 深拷贝消息数组
    const correctedMessages = [...messages];
    
    // 统计每种角色的消息数
    const aiCount = correctedMessages.filter(m => m.role === 'assistant').length;
    const userCount = correctedMessages.filter(m => m.role === 'user').length;
    
    // 如果AI消息明显多于用户消息，可能AI被误判为首条消息
    if (aiCount > userCount * 2 && aiCount > 2) {
      // 重新检查第一条消息，如果看起来像AI消息但用户数很少，可能第一条就是AI
      console.log('AI消息明显多于用户消息，可能第一条就是AI消息');
    }
    
    // 修复连续的相同角色消息
    for (let i = 1; i < correctedMessages.length; i++) {
      const prevRole = correctedMessages[i-1].role;
      const currentRole = correctedMessages[i].role;
      
      // 如果前后消息角色相同，修正当前消息角色
      if (prevRole === currentRole) {
        correctedMessages[i].role = prevRole === 'user' ? 'assistant' : 'user';
        console.log(`修复第 ${i+1} 条消息的角色：${prevRole} → ${correctedMessages[i].role}`);
      }
    }
    
    // 如果修正后第一条消息是AI，验证是否合理
    if (correctedMessages[0].role === 'assistant') {
      const firstContent = correctedMessages[0].content || '';
      const hasAIIntroduction = firstContent.includes('心芽') || 
                               firstContent.includes('你好') || 
                               firstContent.includes('欢迎');
      
      // 如果第一条是AI消息但没有AI自我介绍，可能应该是用户消息
      if (!hasAIIntroduction && correctedMessages.length > 1) {
        // 检查第二条消息，如果看起来像AI回复第一条，则交换角色
        const secondContent = correctedMessages[1].content || '';
        const secondIsAIReply = secondContent.includes('你好') || 
                               secondContent.includes('很高兴') ||
                               secondContent.length > 20; // AI回复通常较长
                               
        if (secondIsAIReply) {
          // 交换前两条消息的角色
          correctedMessages[0].role = 'user';
          correctedMessages[1].role = 'assistant';
          console.log('交换前两条消息的角色');
        }
      }
    }
    
    return correctedMessages;
  };

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 生成用户头像
  const generateUserAvatar = (name) => {
    if (!name || name === '未知用户') return '匿';
    
    // 如果是中文名，取最后两个字符
    if (/^[\u4e00-\u9fa5]+$/.test(name)) {
      return name.length > 2 ? name.slice(-2) : name;
    }
    
    // 如果是英文名，取首字母
    return name.charAt(0).toUpperCase();
  };

  // 生成AI头像
  const generateAIAvatar = () => {
    return (
      <div className="relative">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-full flex items-center justify-center">
          <Bot className="text-blue-600" size={18} />
        </div>
        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-500 border-2 border-white rounded-full flex items-center justify-center">
          <span className="text-[8px] text-white">AI</span>
        </div>
      </div>
    );
  };

  // 格式化时间
  const formatMessageTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  // 格式化日期
  const formatMessageDate = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return '今天';
    }
    
    const isYesterday = new Date(now.setDate(now.getDate() - 1)).toDateString() === date.toDateString();
    if (isYesterday) {
      return '昨天';
    }
    
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  // 分组消息按日期
  const groupedMessages = messages.reduce((groups, message) => {
    const date = formatMessageDate(message.timestamp);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {});

  // 获取对话统计信息
  const getConversationStats = () => {
    const userMessages = messages.filter(msg => msg.role === 'user').length;
    const aiMessages = messages.filter(msg => msg.role === 'assistant').length;
    
    return {
      userMessages,
      aiMessages,
      totalMessages: messages.length,
      firstMessageTime: messages.length > 0 ? messages[0].timestamp : null,
      lastMessageTime: messages.length > 0 ? messages[messages.length - 1].timestamp : null
    };
  };

  const stats = getConversationStats();

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-gray-50 to-gray-100">
      {/* 顶部导航栏 */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                {generateUserAvatar(username)}
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">与 {username} 的对话</h2>
              <p className="text-xs text-gray-500">
                {stats.userMessages} 条用户消息 • {stats.aiMessages} 条AI回复
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <Clock size={12} />
            {stats.firstMessageTime && formatMessageDate(stats.firstMessageTime)}
          </div>
        </div>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length > 0 ? (
          <div className="max-w-3xl mx-auto space-y-6">
            {Object.entries(groupedMessages).map(([date, dateMessages]) => (
              <div key={date}>
                {/* 日期分隔线 */}
                <div className="flex items-center justify-center my-6">
                  <div className="h-px bg-gray-200 flex-1"></div>
                  <span className="px-3 py-1 bg-white text-xs text-gray-500 rounded-full shadow-sm">
                    {date}
                  </span>
                  <div className="h-px bg-gray-200 flex-1"></div>
                </div>
                
                {/* 消息列表 */}
                <div className="space-y-6">
                  {dateMessages.map((msg) => (
                    <div key={msg.id} className="message-container">
                      {msg.role === 'assistant' ? (
                        // AI消息 - 左侧
                        <div className="flex items-start gap-3 max-w-[85%]">
                          {/* AI头像 */}
                          <div className="flex-shrink-0">
                            {generateAIAvatar()}
                          </div>
                          
                          {/* 消息气泡 */}
                          <div className="flex flex-col items-start flex-1">
                            <div className="bg-white rounded-2xl rounded-tl-none px-4 py-3 shadow-sm border border-gray-100 min-w-[120px]">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-medium text-blue-600">心芽 AI</span>
                                <span className="text-xs text-gray-400">•</span>
                                <span className="text-xs text-gray-500">
                                  {formatMessageTime(msg.timestamp)}
                                </span>
                              </div>
                              <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                                {msg.content}
                              </p>
                            </div>
                            
                            {/* AI消息指示器 */}
                            <div className="flex items-center gap-1 mt-1 ml-1">
                              <div className="w-1 h-1 bg-blue-400 rounded-full"></div>
                              <div className="text-xs text-gray-400">AI回复</div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        // 用户消息 - 右侧
                        <div className="flex items-start gap-3 justify-end max-w-[85%] ml-auto">
                          {/* 消息气泡 */}
                          <div className="flex flex-col items-end flex-1">
                            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl rounded-tr-none px-4 py-3 shadow-sm min-w-[120px]">
                              <div className="flex items-center gap-2 mb-2 justify-end">
                                <span className="text-xs text-gray-300">
                                  {formatMessageTime(msg.timestamp)}
                                </span>
                                <span className="text-xs text-gray-300">•</span>
                                <span className="text-xs font-medium text-white">{username}</span>
                              </div>
                              <p className="text-white whitespace-pre-wrap leading-relaxed">
                                {msg.content}
                              </p>
                            </div>
                            
                            {/* 用户消息指示器 */}
                            <div className="flex items-center gap-1 mt-1 mr-1">
                              <div className="text-xs text-gray-400">用户消息</div>
                              <div className="w-1 h-1 bg-purple-400 rounded-full"></div>
                            </div>
                          </div>
                          
                          {/* 用户头像 */}
                          <div className="flex-shrink-0">
                            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                              {generateUserAvatar(username)}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            
            <div ref={messagesEndRef} />
            
            {/* 对话总结 */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-5 border border-blue-100 mt-8">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <MessageCircle className="text-blue-600" size={18} />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">对话总结</h4>
                  <p className="text-sm text-gray-600">本次对话分析</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1">用户消息</p>
                  <p className="text-xl font-bold text-purple-600">{stats.userMessages} 条</p>
                </div>
                <div className="bg-white rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1">AI回复</p>
                  <p className="text-xl font-bold text-blue-600">{stats.aiMessages} 条</p>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-blue-100">
                <p className="text-sm text-gray-700">
                  {stats.userMessages > stats.aiMessages 
                    ? '用户在此对话中更加活跃，分享了较多内容。'
                    : 'AI在此对话中回复较多，积极为用户提供心理支持。'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          // 空状态
          <div className="h-full flex flex-col items-center justify-center p-8 text-center">
            <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mb-6">
              <MessageCircle className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">暂无对话记录</h3>
            <p className="text-gray-600 mb-6 max-w-sm">
              当前对话中没有消息记录。用户与心芽AI的对话将在此显示。
            </p>
            <div className="space-y-4 text-sm text-gray-500">
              <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-gray-200">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <Bot className="text-blue-600" size={14} />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900">AI回复</p>
                  <p className="text-xs">显示在左侧，蓝色主题</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-gray-200">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-medium">
                  {generateUserAvatar(username)}
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900">用户消息</p>
                  <p className="text-xs">显示在右侧，紫色主题</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 底部信息栏 */}
      <div className="bg-white border-t border-gray-200 px-4 py-3">
        <div className="max-w-3xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 gap-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center">
                  <Bot className="text-blue-500" size={14} />
                </div>
                <div>
                  <p className="font-medium text-gray-700">心芽 AI</p>
                  <p className="text-gray-400">心理健康陪伴伙伴</p>
                </div>
              </div>
              
              <div className="hidden sm:block text-gray-300">|</div>
              
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-medium">
                  {generateUserAvatar(username)}
                </div>
                <div>
                  <p className="font-medium text-gray-700">{username}</p>
                  <p className="text-gray-400">用户</p>
                </div>
              </div>
            </div>
            
            <div className="text-center">
              <p className="text-gray-400">管理员视图</p>
              <p className="text-amber-600 font-medium">仅可查看，无法回复</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConversationDetail;