import React, { useState, useEffect } from 'react';
import {
  Users,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  MessageCircle,
  Home,
  LogOut,
  Gamepad
} from 'lucide-react';
import logoImg from '../assets/logo.png';
import ConversationsTab from './ConversationsTab';
import ConversationDetail from './ConversationDetail';
import UserDetail from './UserDetail';
import ScaleDetail from './ScaleDetail'; // 新增：量表详情组件
import TaskDetail from './TaskDetail'; // 新增：任务详情组件
export default function AdminDashboard({ admin, onLogout }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [data, setData] = useState({
    users: [],
    scales: [],
    tasks: [], // 修改：将 highRisk 改为 tasks
    conversations: []
  });
  const [loading, setLoading] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedScale, setSelectedScale] = useState(null); // 新增：选中的量表ID
  const [selectedTask, setSelectedTask] = useState(null); // 新增：选中的游戏ID
  // 在 AdminDashboard 组件的 useEffect 中修改，添加新的数据获取
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // 原有数据获取
        const usersRes = await fetch(`${import.meta.env.VITE_API_BASE || ''}/api/admin/users`);
        const usersData = await usersRes.json();

        const scalesRes = await fetch(`${import.meta.env.VITE_API_BASE || ''}/api/admin/scales`);
        const scalesData = await scalesRes.json();

        // 修改：获取游戏数据而不是高危预警数据
        const tasksRes = await fetch(`${import.meta.env.VITE_API_BASE || ''}/api/admin/tasks`);
        const tasksData = await tasksRes.json();

        const conversationsRes = await fetch(`${import.meta.env.VITE_API_BASE || ''}/api/admin/conversations`);
        const conversationsData = await conversationsRes.json();

        // 新增：获取统计数据和活动日志
        const statsRes = await fetch(`${import.meta.env.VITE_API_BASE || ''}/api/admin/overview/stats`);
        const statsData = await statsRes.json();

        const activitiesRes = await fetch(`${import.meta.env.VITE_API_BASE || ''}/api/admin/overview/activities`);
        const activitiesData = await activitiesRes.json();

        setData({
          users: usersData,
          scales: scalesData,
          tasks: tasksData,
          conversations: conversationsData,
          stats: statsData, // 新增统计数据
          activities: activitiesData // 新增活动数据
        });
      } catch (error) {
        console.error('获取数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // 计算统计数据
  const stats = {
    totalStudents: data.users.filter(u => u.role === 'student').length,
    activeStudents: data.users.filter(u =>
      u.profile &&
      new Date(u.lastLoginAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    ).length,
    totalScales: data.scales.length,
    totalTasks: data.tasks.length, // 新增：游戏总数

  };

  // 渲染内容区域
  const renderContent = () => {
    // 如果选择了量表详情，显示量表详情页面
    if (selectedScale) {
      return <ScaleDetail scaleId={selectedScale} onBack={() => setSelectedScale(null)} />;
    }
    // 如果选择了游戏详情，显示游戏详情页面
    if (selectedTask) {
      return <TaskDetail taskId={selectedTask} onBack={() => setSelectedTask(null)} />;
    }
    // 如果选择了对话，显示对话详情
    if (selectedConversation) {
      return <ConversationDetail
        conversation={selectedConversation}
        onBack={() => setSelectedConversation(null)}
      />;
    }

    // 如果选择了用户，显示用户详情
    if (selectedUser) {
      return <UserDetail
        user={selectedUser}
        conversations={data.conversations}
        onBack={() => setSelectedUser(null)}
        onSelectConversation={setSelectedConversation}
      />;
    }

    // 否则显示当前标签页的内容
    switch (activeTab) {
      case 'overview':
        return <OverviewTab
          stats={data.stats}
          activities={data.activities}
          dailyStats={data.stats?.dailyStats || []}
        />;
      case 'students':
        return <UsersTab
          users={data.users}
          loading={loading}
          onSelectUser={setSelectedUser}
        />;
      case 'scales':
        return <ScalesTab
          scales={data.scales}
          loading={loading}
          onSelectScale={setSelectedScale} // 传递新的回调函数
        />;
      case 'conversations':
        return <ConversationsTab
          loading={loading}
          conversations={data.conversations}
          onSelectConversation={setSelectedConversation}
        />;
      case 'tasks': // 修改：将 highRisk 改为 tasks
        return <TasksTab 
          tasks={data.tasks} 
          loading={loading} 
          onSelectTask={setSelectedTask}
        />;
      default:
        return <OverviewTab stats={stats} />;
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 max-w-md mx-auto">
      {/* 顶部导航栏 */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <img src={logoImg} alt="Logo" className="w-8 h-8 rounded-full" />
          <h2 className="font-semibold text-[#4B3425] text-base">心芽管理后台</h2>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-[#8B7A6A]">{admin.username}</span>
          <button
            onClick={onLogout}
            className="flex items-center gap-1 text-sm text-[#D56B4B] hover:text-[#D56B4B]/80"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">退出</span>
          </button>
        </div>
      </div>

      {/* 主内容区 */}
      <div className={`flex-1 overflow-y-auto ${selectedConversation || selectedUser || selectedScale ? 'pb-4' : 'pb-16'}`}>
        {renderContent()}
      </div>

      {/* 移动端底部导航栏 - 只在没有选中用户或对话或量表或游戏时显示 */}
      {!selectedConversation && !selectedUser && !selectedScale && !selectedTask && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 shadow-lg max-w-md mx-auto">
          <div className="flex justify-around items-center h-16">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex flex-col items-center justify-center flex-1 h-full ${activeTab === 'overview' ? 'text-[#9BB05A]' : 'text-gray-500'}`}
            >
              <Home size={22} />
              <span className="text-xs mt-1">概览</span>
            </button>
            <button
              onClick={() => setActiveTab('students')}
              className={`flex flex-col items-center justify-center flex-1 h-full ${activeTab === 'students' ? 'text-[#9BB05A]' : 'text-gray-500'}`}
            >
              <Users size={22} />
              <span className="text-xs mt-1">用户</span>
            </button>
            <button
              onClick={() => setActiveTab('scales')}
              className={`flex flex-col items-center justify-center flex-1 h-full ${activeTab === 'scales' ? 'text-[#9BB05A]' : 'text-gray-500'}`}
            >
              <BarChart3 size={22} />
              <span className="text-xs mt-1">量表</span>
            </button>
            <button
              onClick={() => setActiveTab('conversations')}
              className={`flex flex-col items-center justify-center flex-1 h-full ${activeTab === 'conversations' ? 'text-[#9BB05A]' : 'text-gray-500'}`}
            >
              <MessageCircle size={22} />
              <span className="text-xs mt-1">对话</span>
            </button>
             <button
              onClick={() => setActiveTab('tasks')} // 修改：将 highRisk 改为 tasks
              className={`flex flex-col items-center justify-center flex-1 h-full ${activeTab === 'tasks' ? 'text-[#9BB05A]' : 'text-gray-500'}`}
            >
              <Gamepad size={22} /> {/* 修改：使用游戏图标 */}
              <span className="text-xs mt-1">游戏</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// OverviewTab 概览组件 - 完全重写
function OverviewTab({ stats, activities, dailyStats }) {
  // 如果没有数据，使用默认值
  const safeStats = stats || {
    users: { total: 0, todayLogin: 0, todayRegister: 0, withProfile: 0 },
    scales: { total: 0, today: 0, byType: {} },
    tasks: { total: 0, today: 0, byType: {} }
  };

  const safeActivities = activities || [];
  const safeDailyStats = dailyStats || [];

  // 获取图标组件
  const getIcon = (iconName) => {
    switch (iconName) {
      case 'UserPlus': return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>;
      case 'LogIn': return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>;
      case 'UserCheck': return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>;
      case 'BarChart3': return <BarChart3 className="w-4 h-4" />;
      case 'Gamepad': return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
      case 'Activity': return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>;
      default: return <Users className="w-4 h-4" />;
    }
  };
  // 获取颜色类
  const getColorClass = (color) => {
    switch (color) {
      case 'green': return 'bg-green-100 text-green-700';
      case 'blue': return 'bg-blue-100 text-blue-700';
      case 'purple': return 'bg-purple-100 text-purple-700';
      case 'orange': return 'bg-orange-100 text-orange-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  // 计算用户活跃度
  const userActivityRate = safeStats.users.total > 0
    ? Math.round((safeStats.users.withProfile / safeStats.users.total) * 100)
    : 0;

  // 计算量表完成率
  const scaleCompletionRate = safeStats.users.total > 0
    ? Math.round((safeStats.scales.total / safeStats.users.total) * 100)
    : 0;

  // 计算游戏参与率
  const taskCompletionRate = safeStats.users.total > 0
    ? Math.round((safeStats.tasks.total / safeStats.users.total) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-4 space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">数据概览</h2>

      {/* 统计卡片网格布局 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 用户统计卡片 */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-xl flex items-center justify-center">
                <Users className="text-blue-600" size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">用户统计</h3>
                <p className="text-sm text-gray-500">平台用户数据</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">今日新增</div>
              <div className="text-lg font-bold text-green-600">+{safeStats.users.todayRegister}</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">总用户</div>
              <div className="text-2xl font-bold text-gray-900">{safeStats.users.total}</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">今日登录</div>
              <div className="text-2xl font-bold text-gray-900">{safeStats.users.todayLogin}</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">今日注册</div>
              <div className="text-2xl font-bold text-gray-900">{safeStats.users.todayRegister}</div>
            </div>
          </div>

          <div className="mb-2">
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>今日活跃率</span>
              <span>{userActivityRate}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${userActivityRate}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* 量表统计卡片 */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl flex items-center justify-center">
                <BarChart3 className="text-purple-600" size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">量表统计</h3>
                <p className="text-sm text-gray-500">测评完成情况</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">今日新增</div>
              <div className="text-lg font-bold text-green-600">+{safeStats.scales.today}</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">总量表</div>
              <div className="text-2xl font-bold text-gray-900">{safeStats.scales.total}</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">DASS-21</div>
              <div className="text-2xl font-bold text-gray-900">{safeStats.scales.byType?.DASS21 || 0}</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">PHQ-9</div>
              <div className="text-2xl font-bold text-gray-900">{safeStats.scales.byType?.PHQ9_CHILD || 0}</div>
            </div>
          </div>

          <div className="mb-2">
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>量表完成率</span>
              <span>{scaleCompletionRate}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${scaleCompletionRate}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* 游戏统计卡片 */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">游戏统计</h3>
                <p className="text-sm text-gray-500">认知训练参与</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">今日新增</div>
              <div className="text-lg font-bold text-green-600">+{safeStats.tasks.today}</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">总游戏</div>
              <div className="text-2xl font-bold text-gray-900">{safeStats.tasks.total}</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">CPT-X</div>
              <div className="text-2xl font-bold text-gray-900">{safeStats.tasks.byType?.CPT_X || 0}</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">其他</div>
              <div className="text-2xl font-bold text-gray-900">{safeStats.tasks.byType?.OTHER || 0}</div>
            </div>
          </div>

          <div className="mb-2">
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>游戏参与率</span>
              <span>{taskCompletionRate}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${taskCompletionRate}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* 趋势图表 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 最近7天趋势 */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4">最近7天趋势</h3>
          <div className="h-64">
            {safeDailyStats.length > 0 ? (
              <div className="flex items-end justify-between h-48 gap-2">
                {safeDailyStats.map((day, index) => {
                  const maxValue = Math.max(
                    ...safeDailyStats.map(d => Math.max(d.users, d.scales, d.tasks))
                  );
                  const scale = maxValue > 0 ? 150 / maxValue : 0;

                  return (
                    <div key={index} className="flex flex-col items-center flex-1">
                      <div className="text-xs text-gray-500 mb-1">
                        {new Date(day.date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                      </div>
                      <div className="flex items-end justify-center w-full gap-1 mb-2">
                        <div
                          className="w-1/3 bg-gradient-to-t from-blue-500 to-cyan-500 rounded-t"
                          style={{ height: `${day.users * scale}px` }}
                          title={`用户: ${day.users}`}
                        ></div>
                        <div
                          className="w-1/3 bg-gradient-to-t from-purple-500 to-pink-500 rounded-t"
                          style={{ height: `${day.scales * scale}px` }}
                          title={`量表: ${day.scales}`}
                        ></div>
                        <div
                          className="w-1/3 bg-gradient-to-t from-green-500 to-emerald-500 rounded-t"
                          style={{ height: `${day.tasks * scale}px` }}
                          title={`游戏: ${day.tasks}`}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-500">
                <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p>暂无趋势数据</p>
              </div>
            )}

            {/* 图例 */}
            <div className="flex justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded"></div>
                <span className="text-xs text-gray-600">用户活动</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded"></div>
                <span className="text-xs text-gray-600">量表提交</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-gradient-to-r from-green-500 to-emerald-500 rounded"></div>
                <span className="text-xs text-gray-600">游戏完成</span>
              </div>
            </div>
          </div>
        </div>

        {/* 最近活动 */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">最近活动</h3>
            <span className="text-sm text-gray-500">
              共 {safeActivities.length} 条
            </span>
          </div>

          <div className="space-y-4 max-h-96 overflow-y-auto">
            {safeActivities.length > 0 ? (
              safeActivities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getColorClass(activity.color)}`}>
                    {getIcon(activity.icon)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800">{activity.detail}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500">
                        {activity.username}
                      </span>
                      <span className="text-xs text-gray-400">•</span>
                      <span className="text-xs text-gray-500">
                        {activity.timeAgo}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p>暂无活动记录</p>
                <p className="text-sm mt-1">用户活动将在此显示</p>
              </div>
            )}
          </div>

          {safeActivities.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-center text-xs text-gray-500">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>显示最近20条活动</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 系统状态卡片 */}
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl p-6 border border-blue-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">系统状态</h3>
              <p className="text-sm text-gray-600">当前系统运行正常</p>
            </div>
          </div>
          <div className="text-right">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-full text-sm font-medium">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              正常运行
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-white/80 p-3 rounded-lg border border-blue-100">
            <div className="text-xs text-gray-600">API响应</div>
            <div className="text-lg font-bold text-gray-900">正常</div>
          </div>
          <div className="bg-white/80 p-3 rounded-lg border border-blue-100">
            <div className="text-xs text-gray-600">数据库</div>
            <div className="text-lg font-bold text-gray-900">文件存储</div>
          </div>
          <div className="bg-white/80 p-3 rounded-lg border border-blue-100">
            <div className="text-xs text-gray-600">AI服务</div>
            <div className="text-lg font-bold text-gray-900">正常</div>
          </div>
          <div className="bg-white/80 p-3 rounded-lg border border-blue-100">
            <div className="text-xs text-gray-600">存储空间</div>
            <div className="text-lg font-bold text-gray-90">充足</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// UsersTab组件 - UI优化版
function UsersTab({ users, loading, onSelectUser }) {
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-4 space-y-4">
        {/* 标题骨架 */}
        <div className="bg-white rounded-2xl shadow-sm p-5 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gray-200 rounded-xl"></div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-32"></div>
                <div className="h-3 bg-gray-200 rounded w-40"></div>
              </div>
            </div>
            <div className="h-8 bg-gray-200 rounded-full w-20"></div>
          </div>
        </div>

        {/* 用户卡片骨架 */}
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-2xl shadow-sm p-5 animate-pulse">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                  <div className="flex gap-2">
                    <div className="h-3 bg-gray-200 rounded w-12"></div>
                    <div className="h-3 bg-gray-200 rounded w-12"></div>
                    <div className="h-3 bg-gray-200 rounded w-12"></div>
                  </div>
                </div>
              </div>
              <div className="h-4 bg-gray-200 rounded w-20"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const filteredUsers = users.filter(u => u.role === 'student');

  // 获取用户头像颜色
  const getAvatarColor = (username) => {
    if (!username) return 'from-blue-500 to-cyan-500';
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

  // 格式化注册时间
  const formatRegisterTime = (timestamp) => {
    if (!timestamp) return '未知';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return '今天注册';
    if (diffDays === 1) return '昨天注册';
    if (diffDays < 7) return `${diffDays}天前注册`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前注册`;
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  // 计算统计数据
  const stats = {
    total: filteredUsers.length,
    active: filteredUsers.filter(u =>
      u.lastLoginAt && new Date(u.lastLoginAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    ).length,
    hasProfile: filteredUsers.filter(u => u.profile).length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-4 space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-xs font-bold text-white">总</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500">总用户数</p>
              <p className="text-xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                <span className="text-xs font-bold text-white">活</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500">活跃用户</p>
              <p className="text-xl font-bold text-gray-900">{stats.active}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
              <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                <span className="text-xs font-bold text-white">档</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500">有档案用户</p>
              <p className="text-xl font-bold text-gray-900">{stats.hasProfile}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 标题区域 */}
      <div className="bg-white rounded-2xl shadow-lg p-5 border border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-2xl flex items-center justify-center shadow-sm">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5 0h-15" />
              </svg>
            </div>
            <div>
              <h2 className="font-bold text-xl text-gray-900">用户列表</h2>
              <p className="text-sm text-gray-500">所有注册的用户信息</p>
            </div>
          </div>
          <div className="bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-2 rounded-full shadow-sm">
            <span className="text-sm font-medium text-white">{filteredUsers.length} 名用户</span>
          </div>
        </div>
      </div>

      {/* 用户列表 */}
      <div className="space-y-4">
        {filteredUsers.length > 0 ? (
          filteredUsers.map((user) => (
            <div
              key={user._id || user.username}
              onClick={() => onSelectUser(user)}
              className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100 hover:border-blue-300 hover:shadow-lg transition-all duration-200 cursor-pointer group"
            >
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    {/* 用户头像 */}
                    <div className="relative">
                      <div className={`w-14 h-14 bg-gradient-to-br ${getAvatarColor(user.username)} rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-md`}>
                        {getInitial(user.username)}
                      </div>
                      {/* 在线状态 */}
                      <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white ${user.lastLoginAt && new Date(user.lastLoginAt) > new Date(Date.now() - 5 * 60 * 1000)
                        ? 'bg-green-500'
                        : 'bg-gray-300'
                        }`}></div>
                    </div>

                    {/* 用户信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-gray-900 text-lg truncate">{user.username}</h3>
                        <div className="flex items-center gap-2">
                          {user.profile?.gender && (
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${user.profile.gender === '男生' ? 'bg-blue-100 text-blue-700' :
                              user.profile.gender === '女生' ? 'bg-pink-100 text-pink-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                              {user.profile.gender}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {user.profile?.age && (
                          <span className="px-3 py-1 bg-amber-50 text-amber-700 text-xs font-medium rounded-full border border-amber-100">
                            {user.profile.age}
                          </span>
                        )}
                        {user.profile?.grade && (
                          <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-full border border-indigo-100">
                            {user.profile.grade}
                          </span>
                        )}
                        {user.profile?.scaleResult && (
                          <span className="px-3 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-100">
                            已评估
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 注册时间 */}
                  <div className="text-right">
                    <div className="text-xs text-gray-500 mb-1">注册时间</div>
                    <div className="text-sm font-medium text-gray-900">
                      {formatRegisterTime(user.createdAt)}
                    </div>
                    <div className={`text-xs mt-1 ${user.lastLoginAt ? 'text-green-600' : 'text-gray-500'
                      }`}>
                      {user.lastLoginAt ? '最近登录过' : '从未登录'}
                    </div>
                  </div>
                </div>

                {/* 底部信息栏 */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>点击查看详情</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5 0h-15" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">暂无用户数据</h3>
            <p className="text-gray-500 text-sm mb-4">系统当前没有用户数据，用户注册后将在此显示</p>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm">等待用户注册</span>
            </div>
          </div>
        )}
      </div>

      {/* 底部提示 */}
      {filteredUsers.length > 0 && (
        <div className="text-center pt-4">
          <p className="text-xs text-gray-500 flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>共 {filteredUsers.length} 名用户 • 点击任意用户卡片查看详情</span>
          </p>
        </div>
      )}
    </div>
  );
}

// ScalesTab组件 (修复总分为0的bug)
function ScalesTab({ scales, loading, onSelectScale }) {
  if (loading) return <div className="text-center py-10 text-gray-500">加载中...</div>;

  // 获取实际总分的函数
  const getActualTotalScore = (scale) => {
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

  // 获取量表的分数范围
  const getScoreRange = (scale) => {
    if (scale.scaleId) {
      const scaleRanges = {
        'DASS21': 63,
        'PHQ9_CHILD': 27,
        'SRSS': 50,
        'ERQ': 70,
        'SELF_HARM': 6,
        'SUICIDE': 4,
        'ACADEMIC_BURNOUT': 80,
        'SCHOOL_AVERSION': 85,
        'ANHEDONIA': 42,
        'BULLYING': 24
      };
      return scaleRanges[scale.scaleId] || 100;
    }
    return 100;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-4 space-y-6">
      {/* 标题区域 */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-xl flex items-center justify-center shadow-sm">
              <BarChart3 className="text-blue-600" size={24} />
            </div>
            <div>
              <h2 className="font-bold text-xl text-gray-900">量表数据</h2>
              <p className="text-sm text-gray-500">用户提交的量表评估结果</p>
            </div>
          </div>
          <div className="bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-2 rounded-full shadow-sm">
            <span className="text-sm font-medium text-white">{scales.length} 条记录</span>
          </div>
        </div>
      </div>

      {/* 量表数据列表 */}
      <div className="space-y-4">
        {scales.length > 0 ? scales.map((scale) => {
          // 计算实际总分
          const actualTotalScore = getActualTotalScore(scale);
          const scoreRange = getScoreRange(scale);

          // 确定风险等级样式
          const riskConfig = {
            high: {
              bg: 'bg-red-50',
              text: 'text-red-700',
              border: 'border-red-100',
              label: '高风险',
              gradient: 'from-red-500 to-orange-500'
            },
            medium: {
              bg: 'bg-yellow-50',
              text: 'text-yellow-700',
              border: 'border-yellow-100',
              label: '中风险',
              gradient: 'from-yellow-500 to-amber-500'
            },
            low: {
              bg: 'bg-green-50',
              text: 'text-green-700',
              border: 'border-green-100',
              label: '低风险',
              gradient: 'from-green-500 to-emerald-500'
            }
          };
          const config = riskConfig[scale.riskLevel] || riskConfig.low;

          return (
            <div
              key={scale._id || scale.username + scale.submittedAt}
              onClick={() => onSelectScale?.(scale._id)}
              className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100 hover:border-blue-300 hover:shadow-lg transition-all duration-200 cursor-pointer group"
            >
              {/* 卡片头部 */}
              <div className="p-5 border-b border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full flex items-center justify-center shadow-sm">
                      <Users className="text-purple-600" size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{scale.username}</h3>
                      <p className="text-xs text-gray-500 truncate">{scale.scaleName || '未知量表'}</p>
                    </div>
                  </div>
                  <div className={`px-3 py-1.5 rounded-full ${config.bg} ${config.text} border ${config.border} text-xs font-medium shadow-sm`}>
                    {config.label}
                  </div>
                </div>

                {/* 总分显示 */}
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-gray-500">总分</p>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">范围: 0-{scoreRange}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`h-2.5 rounded-full bg-gradient-to-r ${config.gradient}`}
                          style={{
                            width: `${Math.min((actualTotalScore / scoreRange) * 100, 100)}%`
                          }}
                        ></div>
                      </div>
                      <span className="text-xl font-bold text-gray-900 min-w-[60px] text-right">
                        {actualTotalScore}
                      </span>
                    </div>

                    {/* 分数百分比 */}
                    <div className="mt-1">
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>0</span>
                        <span className="font-medium">
                          {Math.round((actualTotalScore / scoreRange) * 100)}%
                        </span>
                        <span>{scoreRange}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 卡片底部 */}
              <div className="p-4 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-xs text-gray-600">
                      {new Date(scale.submittedAt).toLocaleString('zh-CN', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-blue-600 group-hover:text-blue-800 transition-colors">
                    <span className="text-xs font-medium group-hover:underline">查看详情</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          );
        }) : (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
              <BarChart3 className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">暂无量表数据</h3>
            <p className="text-gray-500 text-sm mb-4">用户提交量表后，数据将在此显示</p>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm">等待量表提交</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// TasksTab组件 (替换原来的HighRiskTab)
function TasksTab({ tasks, loading, onSelectTask }) {
  if (loading) return <div className="text-center py-10 text-gray-500">加载中...</div>;
  
  // 获取游戏性能颜色
  const getPerformanceColor = (score) => {
    if (score >= 80) return { bg: 'from-green-500 to-emerald-500', text: 'text-green-700', label: '优秀' };
    if (score >= 60) return { bg: 'from-yellow-500 to-amber-500', text: 'text-yellow-700', label: '良好' };
    if (score >= 40) return { bg: 'from-orange-500 to-red-500', text: 'text-orange-700', label: '一般' };
    return { bg: 'from-red-500 to-pink-500', text: 'text-red-700', label: '需练习' };
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-4 space-y-6">
      {/* 标题区域 */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl flex items-center justify-center">
              <Gamepad className="text-purple-600" size={24} />
            </div>
            <div>
              <h2 className="font-bold text-xl text-gray-900">游戏记录</h2>
              <p className="text-sm text-gray-500">认知训练游戏完成情况</p>
            </div>
          </div>
          <div className="bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-2 rounded-full shadow-sm">
            <span className="text-sm font-medium text-white">{tasks.length} 次记录</span>
          </div>
        </div>
      </div>

      {/* 游戏记录列表 */}
      <div className="space-y-4">
        {tasks.length > 0 ? tasks.map((task) => {
          const performanceScore = task.performanceScore || 0;
          const perfConfig = getPerformanceColor(performanceScore);
          
          return (
            <div 
              key={task._id || task.username + task.submittedAt} 
              onClick={() => onSelectTask?.(task._id)}
              className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100 hover:border-purple-300 hover:shadow-lg transition-all duration-200 cursor-pointer group"
            >
              {/* 卡片头部 */}
              <div className="p-5 border-b border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full flex items-center justify-center">
                      <Gamepad className="text-purple-600" size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{task.username}</h3>
                      <p className="text-xs text-gray-500 truncate">{task.taskName}</p>
                    </div>
                  </div>
                  <div className={`px-3 py-1.5 rounded-full bg-gradient-to-r ${perfConfig.bg} text-white text-xs font-medium shadow-sm`}>
                    {perfConfig.label}
                  </div>
                </div>
                
                {/* 性能指标 */}
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="bg-gray-50 p-2 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">准确率</p>
                    <p className="text-lg font-bold text-gray-900">
                      {task.summary?.accuracy ? Math.round(task.summary.accuracy * 100) : 0}%
                    </p>
                  </div>
                  <div className="bg-gray-50 p-2 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">反应时间</p>
                    <p className="text-lg font-bold text-gray-900">
                      {task.summary?.meanRT || 0}ms
                    </p>
                  </div>
                  <div className="bg-gray-50 p-2 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">综合评分</p>
                    <p className="text-lg font-bold text-gray-900">
                      {performanceScore}/100
                    </p>
                  </div>
                </div>
                
                {/* 性能进度条 */}
                <div className="mb-1">
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>0</span>
                    <span className="font-medium">性能评分</span>
                    <span>100</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full bg-gradient-to-r ${perfConfig.bg}`}
                      style={{ width: `${performanceScore}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              
              {/* 卡片底部 */}
              <div className="p-4 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-xs text-gray-600">
                      {new Date(task.submittedAt).toLocaleString('zh-CN', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-purple-600 group-hover:text-purple-800 transition-colors">
                    <span className="text-xs font-medium group-hover:underline">查看详情</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          );
        }) : (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
              <Gamepad className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">暂无游戏记录</h3>
            <p className="text-gray-500 text-sm mb-4">用户完成认知训练游戏后，记录将在此显示</p>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 rounded-lg">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm">等待游戏完成记录</span>
            </div>
          </div>
        )}
      </div>
      
      {/* 底部提示 */}
      {tasks.length > 0 && (
        <div className="text-center pt-4">
          <p className="text-xs text-gray-500 flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>共 {tasks.length} 次游戏记录 • 点击任意卡片查看详情</span>
          </p>
        </div>
      )}
    </div>
  );
}