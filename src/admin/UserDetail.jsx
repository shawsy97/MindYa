// UserDetail.jsx
import React from 'react';
import { ArrowLeft, Users, Calendar, MessageCircle, Clock, ChevronRight } from 'lucide-react';

function UserDetail({ user, conversations, onBack, onSelectConversation }) {
  const userConversations = conversations.filter(c => c.username === user.username);
  
  // 解析用户信息
  const userInfo = {
    username: user.username || '未知用户',
    gender: user.profile?.gender || user.gender || '未知',
    age: user.profile?.age || user.age || '未知',
    grade: user.profile?.grade || user.grade || '未知',
    createdAt: user.createdAt ? new Date(user.createdAt).toLocaleString() : '未知',
    lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : '从未登录'
  };

  // 获取用户头像颜色
  const getAvatarColor = (username) => {
    if (!username) return 'bg-gradient-to-br from-blue-500 to-cyan-500';
    const colors = [
      'from-blue-500 to-cyan-500',
      'from-purple-500 to-pink-500',
      'from-green-500 to-emerald-500',
      'from-amber-500 to-orange-500',
      'from-rose-500 to-red-500',
      'from-indigo-500 to-violet-500'
    ];
    const charCode = username.charCodeAt(0) || 0;
    return colors[charCode % colors.length];
  };

  // 获取用户首字母
  const getInitial = (username) => {
    if (!username) return '?';
    if (/^[\u4e00-\u9fa5]/.test(username)) {
      return username.charAt(0);
    }
    return username.charAt(0).toUpperCase();
  };

  // 格式化对话时间
  const formatConversationTime = (timestamp) => {
    if (!timestamp) return '未知时间';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return `今天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    } else if (diffDays === 1) {
      return `昨天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    } else if (diffDays < 7) {
      return `${diffDays}天前`;
    } else {
      return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      {/* 顶部导航栏 */}
      <div className="bg-white px-4 py-3 flex items-center border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mr-3"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-lg font-semibold text-gray-900">用户详情</h2>
      </div>

      <div className="p-4 space-y-4">
        {/* 用户基本信息卡片 */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* 卡片头部 */}
          <div className="p-5 bg-gradient-to-r from-gray-50 to-gray-100">
            <div className="flex items-center gap-4">
              {/* 用户头像 */}
              <div className="relative">
                <div className={`w-16 h-16 ${getAvatarColor(userInfo.username)} rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg`}>
                  {getInitial(userInfo.username)}
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 border-2 border-white rounded-full flex items-center justify-center">
                  <Users className="w-3 h-3 text-white" />
                </div>
              </div>
              
              {/* 用户信息 */}
              <div className="flex-1">
                <h3 className="font-bold text-xl text-gray-900 mb-1">{userInfo.username}</h3>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                    {userInfo.gender}
                  </span>
                  <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                    {userInfo.age}
                  </span>
                  <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                    {userInfo.grade}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          {/* 卡片内容 */}
          <div className="p-5 space-y-4">
            {/* 注册时间 */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Calendar className="text-blue-500" size={18} />
                </div>
                <div>
                  <p className="text-sm text-gray-600">注册时间</p>
                  <p className="font-medium text-gray-900">{userInfo.createdAt}</p>
                </div>
              </div>
            </div>
            
            {/* 最后登录 */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                  <Clock className="text-green-500" size={18} />
                </div>
                <div>
                  <p className="text-sm text-gray-600">最后登录</p>
                  <p className="font-medium text-gray-900">{userInfo.lastLoginAt}</p>
                </div>
              </div>
            </div>
            
            {/* 对话统计 */}
            <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <MessageCircle className="text-indigo-600" size={18} />
                </div>
                <div>
                  <p className="text-sm text-indigo-600 font-medium">对话记录</p>
                  <p className="text-lg font-bold text-indigo-700">{userConversations.length} 条对话</p>
                </div>
              </div>
              <div className="px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-medium rounded-full">
                查看全部
              </div>
            </div>
          </div>
        </div>

        {/* 对话记录标题 */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">对话记录</h3>
          <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            {userConversations.length} 条
          </span>
        </div>

        {/* 对话记录列表 */}
        <div className="space-y-3">
          {userConversations.length > 0 ? (
            userConversations.map((conversation, index) => {
              const preview = conversation.preview || 
                (conversation.messages && conversation.messages.length > 0 ? 
                 conversation.messages[0].content.substring(0, 80) + '...' : 
                 '暂无对话内容');
              
              const messageCount = conversation.messages ? conversation.messages.length : 0;
              
              const updatedAt = conversation.updatedAt || 
                (conversation.messages && conversation.messages.length > 0 ? 
                 conversation.messages[conversation.messages.length - 1].timestamp : null);
              
              return (
                <div 
                  key={conversation._id || conversation.sessionId || index}
                  onClick={() => onSelectConversation(conversation)}
                  className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100 hover:border-indigo-200 hover:shadow-md transition-all duration-200 cursor-pointer group"
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      {/* 对话预览 */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 line-clamp-2 mb-2 group-hover:text-gray-900">
                          {preview}
                        </p>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <MessageCircle size={12} />
                            <span>{messageCount} 条消息</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Clock size={12} />
                            <span>{formatConversationTime(updatedAt)}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* 跳转箭头 */}
                      <div className="flex-shrink-0 ml-3">
                        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-500 transition-colors" />
                      </div>
                    </div>
                    
                    {/* 标签 */}
                    <div className="flex items-center gap-2">
                      <div className="px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded-full">
                        与AI对话
                      </div>
                      {conversation.riskLevel && (
                        <div className={`px-2 py-1 text-xs rounded-full ${
                          conversation.riskLevel === 'high' ? 'bg-red-100 text-red-700' :
                          conversation.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {conversation.riskLevel === 'high' ? '高风险' : 
                           conversation.riskLevel === 'medium' ? '中风险' : '低风险'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-10 h-10 text-gray-400" />
              </div>
              <h4 className="text-lg font-medium text-gray-900 mb-2">暂无对话记录</h4>
              <p className="text-gray-500 text-sm mb-4">
                用户 {userInfo.username} 尚未与AI进行对话
              </p>
              <div className="inline-flex items-center gap-2 text-sm text-gray-400">
                <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                <span>对话开始后，记录将在此显示</span>
              </div>
            </div>
          )}
        </div>
        
        {/* 底部提示 */}
        {userConversations.length > 0 && (
          <div className="text-center pt-4">
            <p className="text-xs text-gray-500">
              点击对话记录可查看完整对话内容
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default UserDetail;