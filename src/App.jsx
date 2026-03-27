import React, { useState, useEffect, useRef } from 'react';
import {
  Heart,
  MessageCircle,
  Gamepad2,
  LayoutGrid,
  Send,
  AlertCircle,
  BookOpen,
  Star,
  Share2,
} from 'lucide-react';
import Hls from 'hls.js';
import logoImg from './assets/logo.png';
import welcomeImg from './assets/welcome.png';
import onboard1Img from './assets/onboard1.png';
import onboard2Img from './assets/onboard2.png';
import onboard3Img from './assets/onboard3.png';
import maleImg from './assets/male.png';
import femaleImg from './assets/female.png';
import growthMapImg from './assets/growth-map.png';
import courageSceneImg from './assets/theme-courage-mountain.png';
import emotionSceneImg from './assets/theme-emotion-forest.png';
import stressSceneImg from './assets/theme-stress-sea.png';
import confidenceSceneImg from './assets/theme-confidence-garden.png';
import sleepSceneImg from './assets/theme-sleep-planet.png';
import relaxChildImg from './assets/relax/relax-child.png';
import relaxSleepImg from './assets/relax/relax-sleep.png';
import relaxBreathingImg from './assets/relax/relax-breathing.png';
import relaxBinauralImg from './assets/relax/relax-binaural.png';
import waveAlphaImg from './assets/relax/wave-alpha.png';
import waveBetaImg from './assets/relax/wave-beta.png';
import waveGammaImg from './assets/relax/wave-gamma.png';
import waveDeltaImg from './assets/relax/wave-delta.png';
import waveThetaImg from './assets/relax/wave-theta.png';
import { getScale } from "./scales/scaleBank";
import ScaleRunner from "./scales/scaleRunner.jsx";
import { listTasks } from "./tasks/taskBank";
import TaskRunner from "./tasks/TaskRunner";
import AdminLogin from './admin/AdminLogin';
import AdminDashboard from './admin/AdminDashboard';

// --- 模拟配置文件 ---
const CONFIG = {
  themeColor: "text-emerald-500",
  bgColor: "bg-emerald-50",
  roles: {
    COMPANION: "日常陪伴",
    SUPPORT: "情绪疏导",
    WARNING: "风险引导"
  }
};
const envApiBase = import.meta.env.VITE_API_BASE || "";
const API_BASE =
  envApiBase ||
  (typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:8080`
    : "");

const apiPost = async (path, body) => {
  const resp = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const err = new Error(data?.error || 'Request failed');
    err.status = resp.status;
    err.code = data?.error || '';
    throw err;
  }
  return data;
};

const apiGet = async (path) => {
  const resp = await fetch(`${API_BASE}${path}`);
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const err = new Error(data?.error || 'Request failed');
    err.status = resp.status;
    err.code = data?.error || '';
    throw err;
  }
  return data;
};

// --- 主要组件 ---
export default function MindYaApp() {
  const [view, setView] = useState('splash'); // splash, welcome, onboarding, login, register, profile, main, admin-login, admin-dashboard
  const [user, setUser] = useState({ age: '', grade: '', gender: '', riskLevel: 'low' });
  const [currentUser, setCurrentUser] = useState('');
  const [messages, setMessages] = useState([]);
  const [admin, setAdmin] = useState(null);

  useEffect(() => {
    const restoreSession = async () => {
      const savedUser = localStorage.getItem('mindya_current_user');
      if (!savedUser) return;

      setCurrentUser(savedUser);
      try {
        const profile = await apiGet(`/api/profile/${savedUser}`);
        setUser({ ...user, ...profile });
        setView('main');
      } catch (err) {
        if (err.status === 404) {
          setView('profile');
        }
      }
    };

    restoreSession();
  }, []);

  // 1. 加载动画 [cite: 28]
  useEffect(() => {
    if (view === 'splash') {
      const timer = setTimeout(() => setView('welcome'), 2000);
      return () => clearTimeout(timer);
    }
  }, [view]);

  // 2. 核心功能切换
  const renderView = () => {
    switch (view) {
      case 'splash': return <SplashScreen />;
      case 'welcome': return <WelcomeScreen onStart={() => setView('onboarding')} onSkip={() => setView('login')} />;
      case 'onboarding': return <OnboardingScreen onComplete={() => setView('register')} />;
      case 'login':
        return (
          <LoginScreen
            onLogin={async (username, password) => {
              await apiPost('/api/login', { username, password });
              setCurrentUser(username);
              localStorage.setItem('mindya_current_user', username);
              try {
                const profile = await apiGet(`/api/profile/${username}`);
                setUser({ ...user, ...profile });
                setView('main');
              } catch (err) {
                setView('profile');
              }
            }}
            onRegister={() => setView('register')}
            onAdminLogin={() => setView('admin-login')}
          />
        );
      case 'register':
        return (
          <RegisterScreen
            onRegister={async (username, password) => {
              await apiPost('/api/register', { username, password });
              setCurrentUser(username);
              localStorage.setItem('mindya_current_user', username);
              setView('profile');
            }}
            onLogin={() => setView('login')}
          />
        );
      case 'profile':
        return (
          <ProfileScreen
            onComplete={async (data) => {
              await apiPost('/api/profile', { username: currentUser, ...data });
              const profile = { ...user, ...data };
              setUser(profile);
              localStorage.setItem('mindya_user_profile', JSON.stringify(profile));
              setView('main');
            }}
          />
        );
      case 'main':
        return (
          <MainInterface
            user={user}
            username={currentUser}
            messages={messages}
            setMessages={setMessages}
            onUpdateProfile={(profile) => {
              setUser(profile);
              localStorage.setItem('mindya_user_profile', JSON.stringify(profile));
            }}
            onLogout={() => {
              localStorage.removeItem('mindya_current_user');
              localStorage.removeItem('mindya_user_profile');
              setCurrentUser('');
              setUser({ age: '', grade: '', gender: '', riskLevel: 'low' });
              setMessages([]);
              setView('login');
            }}
          />
        );
      case 'admin-dashboard': return <AdminDashboard admin={admin} onLogout={() => { setAdmin(null); setView('login'); }} />;
      case 'admin-login':
        return <AdminLogin
          onLogin={(adminData) => {
            setAdmin(adminData);
            setView('admin-dashboard');
          }}
          onBackToLogin={() => setView('login')}  // 确保这行存在
        />;
      default: return <SplashScreen />;
    }
  };

  return (
    <div className="max-w-md mx-auto h-screen bg-white shadow-2xl overflow-hidden font-sans relative">
      {renderView()}
    </div>
  );
}

// --- 视图组件 ---

function SplashScreen() {
  return (
    <div className="h-full flex flex-col items-center justify-center bg-[#F7F4F2]">
      <img src={logoImg} alt="MindYa logo" className="w-40 h-35" />
      <h1 className="mt-4 text-[32px] font-semibold text-gray-900">MindYa</h1>
    </div>
  );
}

function WelcomeScreen({ onStart, onSkip }) {
  return (
    <div className="h-full flex flex-col px-8 pt-24 pb-24 bg-[#F6F1EC] relative">
      <button
        onClick={onSkip}
        className="absolute right-8 top-6 text-sm text-[#8B7A6A]"
      >
        跳过
      </button>
      <div className="flex-1 flex flex-col items-center text-center">
        <img src={logoImg} alt="MindYa logo" className="w-30 h-25" />
        <h2 className="mt-4 text-[30px] font-semibold text-gray-900">陪你认识自己</h2>
        <p className="mt-2 text-[18px] text-gray-500">A safe space to understand yourself 🌿</p>
        <img
          src={welcomeImg}
          alt="Welcome illustration"
          className="mt-6 w-65 h-65 object-contain"
        />
      </div>
      <button
        onClick={onStart}
        className="w-full rounded-full bg-[#4B342C] text-white py-3 font-semibold"
      >
        开始 →
      </button>
      <button
        onClick={onSkip}
        className="text-[10px] text-gray-400 mt-3 text-center"
      >
        已有账号？点击登录
      </button>
    </div>
  );
}

function OnboardingScreen({ onComplete }) {
  const slides = [
    {
      titlePrefix: '和 ',
      titleAccent: 'AI 小助手',
      titleSuffix: '聊聊天',
      subtitle: '你可以随时和我聊聊最近的感受，\n 慢慢说，我陪你一起',
      img: onboard1Img,
      scale: 1.4,
      bg: 'bg-[#E5EAD7]',
      accent: 'text-[#8EA15A]',
    },
    {
      titlePrefix: '玩些',
      titleAccent: '小游戏',
      titleSuffix: '',
      subtitle: '这里有一些轻松的小活动，\n 帮你放松一下',
      img: onboard2Img,
      scale: 2.0,
      bg: 'bg-[#F8BDBE]',
      accent: 'text-[#E0677E]',
    },
    {
      titlePrefix: '心情',
      titleAccent: '自测',
      titleSuffix: '',
      subtitle: '有些小测试，帮你看看最近的\n心情状态',
      img: onboard3Img,
      scale: 1.5,
      bg: 'bg-[#FFEBC2]',
      accent: 'text-[#C88B3A]',
    },
  ];
  const [step, setStep] = useState(0);
  const current = slides[step];

  return (
    <div className={`h-full flex flex-col px-8 pt-16 pb-24 ${current.bg}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {slides.map((_, idx) => (
            <span
              key={idx}
              className={`h-2 w-2 rounded-full ${idx === step ? 'bg-[#4B342C]' : 'bg-[#E3D7CC]'}`}
            />
          ))}
        </div>
        <button onClick={onComplete} className="text-sm text-gray-500">
          跳过
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-start text-center relative pt-6">
        <img
          src={current.img}
          alt={`${current.titlePrefix}${current.titleAccent}${current.titleSuffix}`}
          className="mx-auto w-full h-[110%] object-contain object-center -mt-38 translate-x-[12px]"
          style={{ transform: `scale(${current.scale})`, transformOrigin: 'center' }}
        />
        <div className="pointer-events-none absolute inset-x-0 top-1/2 translate-x-[calc(-135%)] translate-y-[calc(5%)] z-0">
          <div className="mx-auto h-300 w-300 rounded-full bg-white" />
        </div>
      </div>

      <div className="relative z-10 -mt-40 text-center">
        <div className="mx-auto mb-5 inline-flex items-center gap-1 rounded-full border border-[#E9E1D6] bg-[#F4EFE8] px-3 py-1 text-[20px] text-[#8B7A6A]">
          功能介绍
        </div>
        <h3 className="text-[32px] font-semibold text-[#4B3425]">
          {current.titlePrefix}
          <span className={current.accent}>{current.titleAccent}</span>
          {current.titleSuffix}
        </h3>
        <p className="mt-2 text-[16px] text-[#4B3425] leading-relaxed">
          {current.subtitle}
        </p>
      </div>

      <button
        onClick={() => (step < slides.length - 1 ? setStep(step + 1) : onComplete())}
        className="mx-auto mt-6 h-12 w-12 rounded-full bg-[#4B342C] text-white text-lg flex items-center justify-center relative z-20"
        aria-label={step < slides.length - 1 ? '下一步' : '进入主页'}
      >
        →
      </button>
    </div>
  );
}

function LoginScreen({ onLogin, onRegister, onAdminLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="h-full flex flex-col bg-[#F7F4F2] px-8 pt-16 pb-10">
      <div className="flex flex-col items-center text-center">
        <div className="w-24 h-24 rounded-full bg-[#9BB05A] flex items-center justify-center">
          <img src={logoImg} alt="MindYa logo" className="w-12 h-12" />
        </div>
        <h2 className="mt-6 text-[26px] font-semibold text-[#4B3425]">欢迎使用心芽</h2>
      </div>

      <div className="mt-10 space-y-4">
        <label className="block">
          <span className="text-sm text-[#8B7A6A]">用户名</span>
          <div className="mt-2 flex items-center gap-2 rounded-full bg-white px-4 py-3 shadow-sm">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              className="w-full text-sm text-[#4B3425] placeholder:text-[#C1B6AA] focus:outline-none"
            />
          </div>
        </label>
        <label className="block">
          <span className="text-sm text-[#8B7A6A]">密码</span>
          <div className="mt-2 flex items-center gap-2 rounded-full bg-white px-4 py-3 shadow-sm">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              className="w-full text-sm text-[#4B3425] placeholder:text-[#C1B6AA] focus:outline-none"
            />
          </div>
        </label>
      </div>

      {error && <p className="mt-4 text-center text-xs text-[#D56B4B]">{error}</p>}
      <button
        onClick={async () => {
          try {
            setError('');
            setSubmitting(true);
            await onLogin(username, password);
          } catch (e) {
            if (e.status === 401) {
              setError('用户名或密码错误');
            } else {
              setError(e.message || '登录失败');
            }
          } finally {
            setSubmitting(false);
          }
        }}
        className="mt-6 w-full rounded-full bg-[#4B342C] py-3 text-white text-base font-semibold disabled:opacity-60"
        disabled={submitting}
      >
        {submitting ? '登录中...' : '登录 →'}
      </button>

      <button
        onClick={onRegister}
        className="mt-6 text-center text-xs text-[#A89A8E]"
      >
        还没有账号？<span className="text-[#D56B4B]">去注册</span>
      </button>

      {/* 这里是修改的部分 - 管理员按钮 */}
      <div className="mt-auto pt-4">
        <button
          onClick={onAdminLogin}
          className="ml-auto flex items-center gap-2 rounded-full bg-[#4B342C] px-4 py-2 text-xs text-white shadow-md hover:bg-[#3A2922]"
        >
          <span>管理员登录</span>
          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function RegisterScreen({ onRegister, onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="h-full flex flex-col bg-[#F7F4F2] px-8 pt-16 pb-10">
      <div className="flex flex-col items-center text-center">
        <div className="w-24 h-24 rounded-full bg-[#9BB05A] flex items-center justify-center">
          <img src={logoImg} alt="MindYa logo" className="w-12 h-12" />
        </div>
        <h2 className="mt-6 text-[26px] font-semibold text-[#4B3425]">免费注册</h2>
      </div>

      <div className="mt-10 space-y-4">
        <label className="block">
          <span className="text-sm text-[#8B7A6A]">用户名</span>
          <div className="mt-2 flex items-center gap-2 rounded-full bg-white px-4 py-3 shadow-sm">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              className="w-full text-sm text-[#4B3425] placeholder:text-[#C1B6AA] focus:outline-none"
            />
          </div>
        </label>
        <label className="block">
          <span className="text-sm text-[#8B7A6A]">密码</span>
          <div className="mt-2 flex items-center gap-2 rounded-full bg-white px-4 py-3 shadow-sm">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              className="w-full text-sm text-[#4B3425] placeholder:text-[#C1B6AA] focus:outline-none"
            />
          </div>
        </label>
      </div>

      {error && <p className="mt-4 text-center text-xs text-[#D56B4B]">{error}</p>}
      <button
        onClick={async () => {
          try {
            setError('');
            setSubmitting(true);
            await onRegister(username, password);
          } catch (e) {
            if (e.status === 409) {
              setError('用户名已存在');
            } else {
              setError(e.message || '注册失败');
            }
          } finally {
            setSubmitting(false);
          }
        }}
        className="mt-6 w-full rounded-full bg-[#4B342C] py-3 text-white text-base font-semibold disabled:opacity-60"
        disabled={submitting}
      >
        {submitting ? '注册中...' : '注册 →'}
      </button>

      <button
        onClick={onLogin}
        className="mt-6 text-center text-xs text-[#A89A8E]"
      >
        已有账号？<span className="text-[#D56B4B]">去登录</span>
      </button>
    </div>
  );
}

function ProfileScreen({ onComplete }) {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({ gender: '', age: '18', grade: '初中' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const ageOptions = ['<8岁', ...Array.from({ length: 11 }, (_, i) => String(i + 8)), '>18岁'];
  const ageItemHeight = 48;
  const ageListRef = useRef(null);

  const next = async () => {
    if (step < 2) {
      setStep(step + 1);
      return;
    }
    try {
      setError('');
      setSubmitting(true);
      await onComplete(formData);
    } catch (e) {
      setError(e.message || '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#F7F4F2] px-8 pt-14 pb-24">
      <div className="flex items-center justify-between">
        <button className="h-8 w-8 rounded-full border border-[#D9CFC3] text-[#6C5B50]">‹</button>
        <span className="text-sm text-[#A89A8E]">{step + 1} / 3</span>
      </div>

      <h2 className="mt-6 text-center text-xl font-semibold text-[#4B3425]">基本信息</h2>

      {step === 0 && (
        <div className="mt-8 space-y-4">
          <h3 className="text-lg font-semibold text-[#4B3425]">你的性别？</h3>
          <button
            onClick={() => setFormData({ ...formData, gender: '男生' })}
            className={`w-full overflow-hidden rounded-2xl border ${formData.gender === '男生' ? 'border-[#4B342C] bg-white' : 'border-[#E5DED6] bg-[#FBF9F7]'
              }`}
          >
            <img src={maleImg} alt="我是男生" className="w-full h-full object-cover" />
          </button>
          <button
            onClick={() => setFormData({ ...formData, gender: '女生' })}
            className={`w-full overflow-hidden rounded-2xl border ${formData.gender === '女生' ? 'border-[#4B342C] bg-white' : 'border-[#E5DED6] bg-[#FBF9F7]'
              }`}
          >
            <img
              src={femaleImg}
              alt="我是女生"
              className="w-full h-full object-cover"
              style={{ transform: 'scale(1.1)', transformOrigin: 'center' }}
            />
          </button>
          <button
            onClick={() => {
              setFormData({ ...formData, gender: '其他' });
              setStep(1);
            }}
            className="w-full rounded-2xl bg-[#E2EAD0] px-4 py-4 text-[#7D8D5A]"
          >
            想跳过
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="mt-8 flex flex-col items-center">
          <h3 className="text-lg font-semibold text-[#4B3425]">你的年龄？</h3>
          <div className="relative mt-6 h-56 w-full max-w-xs overflow-hidden">
            <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 z-0">
              <div className="mx-auto h-20 w-48 rounded-full bg-[#9BB05A]" />
            </div>
            <div
              ref={ageListRef}
              className="relative z-10 h-full overflow-y-auto scroll-smooth snap-y snap-mandatory"
              onScroll={(e) => {
                const index = Math.round(e.currentTarget.scrollTop / ageItemHeight);
                const clamped = Math.max(0, Math.min(ageOptions.length - 1, index));
                setFormData({ ...formData, age: ageOptions[clamped] });
              }}
            >
              <div className="h-[88px]" />
              {ageOptions.map((age) => (
                <div
                  key={age}
                  className={`h-12 snap-center flex items-center justify-center text-3xl font-semibold ${formData.age === age ? 'text-white' : 'text-[#C9C0B6]'
                    }`}
                >
                  {age}
                </div>
              ))}
              <div className="h-[88px]" />
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-[#4B3425]">你的年级？</h3>
          <div className="mt-6 space-y-3">
            {['小学', '初中', '高中'].map((grade) => (
              <button
                key={grade}
                onClick={() => setFormData({ ...formData, grade })}
                className={`w-full rounded-2xl border px-4 py-3 text-left ${formData.grade === grade ? 'border-[#4B342C] bg-[#9BB05A] text-white' : 'border-[#E5DED6] bg-white text-[#4B3425]'
                  }`}
              >
                {grade}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-full bg-[#F7D6C8] px-4 py-2 text-center text-xs text-[#D56B4B]">
          {error}
        </div>
      )}
      <button
        onClick={next}
        className="mt-auto w-full rounded-full bg-[#4B342C] py-3 text-white text-base font-semibold disabled:opacity-60"
        disabled={submitting}
      >
        {submitting ? '保存中...' : '继续 →'}
      </button>
    </div>
  );
}

function MainInterface({ user, username, onUpdateProfile, onLogout }) {
  const [activeTab, setActiveTab] = useState('chat');
  const [menuOpen, setMenuOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [historyList, setHistoryList] = useState([]); // 存储历史列表
  const [currentConvId, setCurrentConvId] = useState(Date.now().toString()); // 当前对话ID
  const [aiContext, setAiContext] = useState(null);
  const [moreTarget, setMoreTarget] = useState(null);
  const scrollRef = useRef(null);
  const initializedRef = useRef(false);

  // 获取历史列表
  const fetchHistory = async () => {
    const data = await fetch(`${API_BASE}/api/history/${username}`).then(r => r.json());
    setHistoryList(data);
  };

  useEffect(() => { fetchHistory(); }, [username]);

  useEffect(() => {
    if (!username) return;
    const loadContext = async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/ai/context?username=${encodeURIComponent(username)}`);
        const data = await resp.json();
        setAiContext(data);
      } catch {
        setAiContext(null);
      }
    };
    loadContext();
  }, [username]);

  useEffect(() => {
    const applyHash = () => {
      const hash = window.location.hash || "";
      if (hash.startsWith("#relax")) {
        const parts = hash.split("-");
        const target = parts[1] || "home";
        setActiveTab("more");
        setMoreTarget(target);
      }
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  // --- 核心：开启新对话的函数 ---
  const startNewChat = async () => {
    setMessages([]); // 清空当前消息界面
    setCurrentConvId(Date.now().toString()); // 生成新ID
    setMenuOpen(false); // 关闭侧边栏

    // 初始化第一句话（调用你之前的自然开场白逻辑）
    const prompt = buildInitialPrompt();
    try {
      const resp = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          userProfile: { ...user, username },
          username,
          context: aiContext,
          role: '日常陪伴',
        }),
      });
      const data = await resp.json();
      const aiMsg = { id: Date.now(), text: data.text, sender: 'ai' };
      setMessages([aiMsg]);

      // 自动保存这个新开场的预览到历史记录
      await saveToHistory([aiMsg]);
    } catch (e) { console.error(e); }
  };

  // --- 加载历史对话 ---
  const loadHistory = (conv) => {
    setMessages(conv.messages);
    setCurrentConvId(conv.id);
    setMenuOpen(false);
  };

  // 保存到后端的辅助函数
  const saveToHistory = async (msgs) => {
    if (msgs.length === 0) return;
    await fetch(`${API_BASE}/api/history/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        conversationId: currentConvId,
        messages: msgs,
        preview: msgs[0]?.text.substring(0, 15) + "..." // 预览文字
      }),
    });
    fetchHistory(); // 刷新列表
  };

  const formatAge = (age) => {
    if (!age) return '未知年龄';
    if (String(age).includes('岁') || String(age).includes('<') || String(age).includes('>')) {
      return String(age);
    }
    return `${age}岁`;
  };

  const buildInitialPrompt = () => {
    const ageText = formatAge(user?.age);
    const gradeText = user?.grade || '未知年级';
    const genderText = user?.gender || '未知性别';
    return `你好，心芽。我是${ageText}的${genderText}，正在上${gradeText}。我今天想和你随便聊聊。`;
  };

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const initChat = async () => {
      const prompt = buildInitialPrompt();

      try {
        const resp = await fetch(`${API_BASE}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: prompt }],
            userProfile: { ...user, username },
            username,
            context: aiContext,
            role: '日常陪伴',
          }),
        });
        const data = await resp.json();
        const aiText = data?.text || '我这边有点卡住了，我们稍后再试试。';
        const aiMsg = { id: Date.now(), text: aiText, sender: 'ai' };
        setMessages([aiMsg]);
      } catch (e) {
        const aiMsg = { id: Date.now(), text: '我这边有点卡住了，我们稍后再试试。', sender: 'ai' };
        setMessages([aiMsg]);
      }
    };

    initChat();
  }, [user]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMsg = { id: Date.now(), text: input, sender: "user" };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput("");

    // 把你 UI 消息结构转成 API 消息结构
    const apiMessages = [...messages, userMsg].map(m => ({
      role: m.sender === "user" ? "user" : "assistant",
      content: m.text,
    }));

    const resp = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: apiMessages,
        userProfile: { ...user, username },
        username,
        context: aiContext,
        role: "日常陪伴",
      }),
    });

    const data = await resp.json();
    const aiText = data?.text || "我这边有点卡住了，我们稍后再试试。";

    const aiMsg = { id: Date.now() + 1, text: aiText, sender: "ai" };
    const finalMsgs = [...newMsgs, aiMsg];
    setMessages(finalMsgs);
    saveToHistory(finalMsgs); // 每次聊天完保存
  };


  return (
    <div className="h-full flex flex-col bg-gray-50 relative">
      {/* 顶部状态栏 */}
      <div className="bg-white px-4 py-3 flex items-center border-b border-gray-100 relative">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="h-8 w-8 rounded-full border border-[#D9CFC3] text-[#6C5B50] flex items-center justify-center"
          aria-label="打开菜单"
        >
          ≡
        </button>
        <div className="absolute left-1/2 -translate-x-1/2 text-[#4B3425] font-semibold">
          心芽
        </div>
        <div className="ml-auto flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-[#B9ADA2]" />
        </div>
      </div>

      {menuOpen && (
        <div className="absolute inset-0 z-30">
          <div className="absolute inset-0 bg-[#4B3425]/20" onClick={() => setMenuOpen(false)} />
          <div className="absolute left-4 top-14 w-64 rounded-2xl bg-[#F7F2EA] p-4 shadow-lg">
            {/* 点击开启新聊天 */}
            <button
              onClick={startNewChat}
              className="w-full flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-[#4B3425] hover:bg-gray-50 transition"
            >
              <span className="h-6 w-6 rounded-full bg-[#9BB05A] inline-flex items-center justify-center text-white">+</span>
              新聊天
            </button>

            <div className="mt-4 text-sm text-[#8B7A6A]">历史聊天</div>
            <div className="mt-2 space-y-2 overflow-y-auto max-h-60">
              {historyList.length > 0 ? (
                historyList.map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => loadHistory(conv)}
                    className={`w-full text-left rounded-xl px-3 py-2 text-sm transition ${currentConvId === conv.id ? 'bg-[#9BB05A] text-white' : 'bg-white text-[#4B3425]'
                      }`}
                  >
                    {conv.preview || "新对话"}
                  </button>
                ))
              ) : (
                <div className="text-xs text-gray-400 text-center py-4">暂无历史记录</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'chat' && (
          <div className="space-y-4">
            {messages.map(m => (
              <div key={m.id} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.sender === 'ai' && (
                  <div className="mr-2 h-15 w-15 rounded-full bg-[#F4EFE8] flex items-center justify-center">
                    <img src={logoImg} alt="AI" className="h-10 w-13" />
                  </div>
                )}
                <div className={`max-w-[75%] p-4 rounded-2xl shadow-sm ${m.sender === 'user' ? 'bg-[#4B342C] text-white' : 'bg-[#F4EFE8] text-[#4B3425]'}`}>
                  {renderChatText(m.text)}
                </div>
                {m.sender === 'user' && (
                  <div className="ml-2 h-15 w-15 rounded-full bg-[#CBBBAA] flex items-center justify-center text-white text-[20px]">
                    你
                  </div>
                )}
              </div>
            ))}
            <div ref={scrollRef} />
          </div>
        )}

        {activeTab === 'scale' && <ScaleHub username={username} user={user} />}
        {activeTab === 'games' && <GamesHub username={username} />}
        {activeTab === 'more' && (
          <MoreTab
            user={user}
            username={username}
            onUpdateProfile={onUpdateProfile}
            onLogout={onLogout}
            initialTarget={moreTarget}
          />
        )}
      </div>

      {/* 底部输入框或导航 [cite: 70] */}
      {activeTab === 'chat' && (
        <div className="p-4 bg-white border-t border-gray-100 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="说点什么吧..."
            className="flex-1 bg-gray-100 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#4B3425]"
          />
          <button onClick={sendMessage} className="bg-[#4B3425] p-3 rounded-xl text-white">
            <Send className="w-5 h-5" />
          </button>
        </div>
      )}

      <nav className="bg-white border-t border-gray-100 flex justify-around py-3">
        <NavBtn icon={<MessageCircle />} label="聊天" active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} activeColor="text-[#4B342C]" />
        <NavBtn icon={<BookOpen />} label="成长探索" active={activeTab === 'scale'} onClick={() => setActiveTab('scale')} activeColor="text-[#4B342C]" />
        <NavBtn icon={<Gamepad2 />} label="游戏" active={activeTab === 'games' && <GamesHub username={username} />} onClick={() => setActiveTab('games')} activeColor="text-[#4B342C]" />
        <NavBtn icon={<LayoutGrid />} label="更多" active={activeTab === 'more'} onClick={() => setActiveTab('more')} activeColor="text-[#4B342C]" />
      </nav>
    </div>
  );
}

function NavBtn({ icon, label, active, onClick, activeColor = 'text-emerald-600' }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 ${active ? activeColor : 'text-gray-400'}`}>
      {React.cloneElement(icon, { size: 22 })}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

function renderChatText(text) {
  if (!text) return null;
  const parts = text.split(/(#[a-zA-Z0-9_-]+)/g);
  return parts.map((part, idx) => {
    if (/^#[a-zA-Z0-9_-]+$/.test(part)) {
      return (
        <a
          key={`${part}-${idx}`}
          href={part}
          className="underline underline-offset-2 text-[#3B6EA8]"
        >
          {part}
        </a>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

function MoreTab({ user, username, onUpdateProfile, onLogout, initialTarget }) {
  const [view, setView] = useState('menu');
  const [form, setForm] = useState({
    gender: user?.gender || '',
    age: user?.age || '',
    grade: user?.grade || '',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setForm({
      gender: user?.gender || '',
      age: user?.age || '',
      grade: user?.grade || '',
    });
  }, [user]);

  useEffect(() => {
    if (!initialTarget) return;
    if (initialTarget === "meditation") {
      setView("relax");
    } else if (initialTarget === "binaural") {
      setView("relax");
    } else if (initialTarget === "home") {
      setView("relax");
    }
  }, [initialTarget]);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const saveProfile = async () => {
    if (!username) return;
    setSaving(true);
    setMsg('');
    try {
      await apiPost('/api/profile', { username, ...form });
      const nextProfile = { ...user, ...form };
      onUpdateProfile?.(nextProfile);
      setMsg('已保存');
    } catch (e) {
      setMsg('保存失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  if (view === 'relax') {
    return (
      <RelaxSpace
        username={username}
        onBack={() => setView('menu')}
        initialTarget={initialTarget}
      />
    );
  }

  if (view === 'settings') {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setView('menu')}
          className="text-sm text-[#8B7A6A]"
        >
          ← 返回
        </button>

        <div className="rounded-2xl bg-white border border-[#EFE7DE] p-4 shadow-sm space-y-2">
          <div className="text-[#4B3425] font-semibold text-lg">设置</div>
          <div className="text-xs text-[#8B7A6A]">账号：{username || '未登录'}</div>
        </div>

        <div className="rounded-2xl bg-white border border-[#EFE7DE] p-4 shadow-sm space-y-3">
          <div className="text-sm text-[#4B3425] font-semibold">基本信息</div>
          <div className="space-y-2 text-sm text-[#4B3425]">
            <div className="flex items-center justify-between gap-3">
              <label className="text-[#8B7A6A]">性别</label>
              <select
                value={form.gender}
                onChange={(e) => updateField('gender', e.target.value)}
                className="flex-1 rounded-xl border border-[#E8DED2] px-3 py-2 bg-white"
              >
                <option value="">未选择</option>
                <option value="男生">男生</option>
                <option value="女生">女生</option>
                <option value="不便透露">不便透露</option>
              </select>
            </div>
            <div className="flex items-center justify-between gap-3">
              <label className="text-[#8B7A6A]">年龄</label>
              <input
                value={form.age}
                onChange={(e) => updateField('age', e.target.value)}
                className="flex-1 rounded-xl border border-[#E8DED2] px-3 py-2"
                placeholder="如 13"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <label className="text-[#8B7A6A]">年级</label>
              <input
                value={form.grade}
                onChange={(e) => updateField('grade', e.target.value)}
                className="flex-1 rounded-xl border border-[#E8DED2] px-3 py-2"
                placeholder="如 初一"
              />
            </div>
          </div>

          <button
            onClick={saveProfile}
            disabled={saving}
            className="w-full rounded-full bg-[#4B342C] text-white py-3 text-sm font-semibold disabled:opacity-60"
          >
            {saving ? '保存中...' : '保存修改'}
          </button>
          {msg && <div className="text-xs text-[#8B7A6A] text-center">{msg}</div>}
        </div>

        <button
          onClick={onLogout}
          className="w-full rounded-full bg-white border border-[#E8DED2] text-[#4B3425] py-3 text-sm font-semibold"
        >
          退出登录
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white border border-[#EFE7DE] p-4 shadow-sm space-y-2">
        <div className="text-[#4B3425] font-semibold text-lg">更多</div>
        <div className="text-xs text-[#8B7A6A]">选择一个功能进入</div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setView('relax')}
          className="rounded-2xl bg-[#F4EFE8] p-4 text-left shadow-sm border border-[#EFE7DE]"
        >
          <div className="text-sm font-semibold text-[#4B3425]">放松空间</div>
          <div className="text-xs text-[#8B7A6A] mt-1">正念冥想 · 脑波音乐</div>
        </button>
        <button
          onClick={() => setView('settings')}
          className="rounded-2xl bg-white p-4 text-left shadow-sm border border-[#EFE7DE]"
        >
          <div className="text-sm font-semibold text-[#4B3425]">设置</div>
          <div className="text-xs text-[#8B7A6A] mt-1">个人资料 · 退出登录</div>
        </button>
      </div>
    </div>
  );
}

function RelaxSpace({ username, onBack, initialTarget }) {
  const [view, setView] = useState('home');
  const [meditationList, setMeditationList] = useState([]);
  const [activeMeditationCategory, setActiveMeditationCategory] = useState(null);
  const [binauralLists, setBinauralLists] = useState({});
  const [activeWave, setActiveWave] = useState(null);
  const [activeTrack, setActiveTrack] = useState(null);
  const [activePlaylist, setActivePlaylist] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const audioRef = useRef(null);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  const mediaUrl = (path) =>
    `${API_BASE}/api/media/${path}?username=${encodeURIComponent(username || '')}`;

  const listUrl = (path) =>
    `${API_BASE}/api/media/list/${path}?username=${encodeURIComponent(username || '')}`;

  const displayName = (filename) => {
    const base = filename.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ');
    const epMatch = base.match(/^ep\s*(\d+)$/i);
    if (epMatch) return `第 ${epMatch[1]} 集`;
    return base;
  };

  const meditationCategories = [
    {
      id: 'child',
      label: '儿童冥想',
      subtitle: '儿童专注力正念冥想',
      desc: '鼻子的探索',
      color: '#FAF8F1',
      text: '#2F3A62',
      art: relaxChildImg,
      path: 'meditation/child-focus',
      titles: ['儿童专注力正念冥想-鼻子的探索'],
      playerBg: 'linear-gradient(180deg, #D8E5F7 0%, #CFE0F2 100%)',
    },
    {
      id: 'sleep',
      label: '睡前冥想',
      subtitle: '轻柔放松',
      desc: '5分钟身体扫描',
      color: '#1A2752',
      text: '#FFFFFF',
      art: relaxSleepImg,
      path: 'meditation/sleep',
      titles: ['5分钟身体扫描'],
      playerBg: 'linear-gradient(180deg, #F2E0E9 0%, #E7D2E0 100%)',
    },
    {
      id: 'breathing',
      label: '呼吸训练',
      subtitle: '平稳呼吸 · 练习专注',
      desc: '3分钟呼吸训练',
      color: '#C9EBEC',
      text: '#7A4B33',
      art: relaxBreathingImg,
      path: 'meditation/breathing',
      titles: ['3分钟呼吸训练', '做情绪的主人'],
      playerBg: 'linear-gradient(180deg, #F6DCC4 0%, #F3CFAE 100%)',
    },
  ];

  useEffect(() => {
    if (!activeMeditationCategory) {
      setActiveMeditationCategory(meditationCategories[0]);
    }
  }, [activeMeditationCategory]);

  const getMeditationTitle = (index, fallbackName) => {
    const titles = activeMeditationCategory?.titles || [];
    if (titles[index]) return titles[index];
    return displayName(fallbackName);
  };

  const waves = [
    {
      id: 'alpha',
      name: 'α波音乐（Alpha）',
      desc: '清醒放松 · 轻专注',
      color: '#8FB7AC',
      art: waveAlphaImg,
      height: 152,
    },
    {
      id: 'theta',
      name: 'θ波音乐（Theta）',
      desc: '深度放松 · 冥想入门',
      color: '#9C8EB6',
      art: waveThetaImg,
      height: 172,
    },
    {
      id: 'beta',
      name: 'β波音乐（Beta）',
      desc: '专注在线 · 学习状态',
      color: '#C7A27A',
      art: waveBetaImg,
      height: 160,
    },
    {
      id: 'delta',
      name: 'δ波音乐（Delta）',
      desc: '睡前安静 · 深休息',
      color: '#6B7C92',
      art: waveDeltaImg,
      height: 180,
    },
    {
      id: 'gamma',
      name: 'γ波音乐（Gamma）',
      desc: '高唤醒 · 清晰思路',
      color: '#CBB77A',
      art: waveGammaImg,
      height: 148,
    },
  ];

  const loadMeditations = async (categoryPath) => {
    try {
      const resp = await fetch(listUrl(categoryPath));
      const data = await resp.json();
      setMeditationList(Array.isArray(data.files) ? data.files : []);
    } catch {
      setMeditationList([]);
    }
  };

  const loadBinaural = async (waveId) => {
    if (binauralLists[waveId]) return;
    try {
      const resp = await fetch(listUrl(`binaural/${waveId}`));
      const data = await resp.json();
      setBinauralLists((prev) => ({
        ...prev,
        [waveId]: Array.isArray(data.files) ? data.files : [],
      }));
    } catch {
      setBinauralLists((prev) => ({ ...prev, [waveId]: [] }));
    }
  };

  useEffect(() => {
    if (view === 'meditationList' && activeMeditationCategory) {
      loadMeditations(activeMeditationCategory.path);
    }
  }, [view, activeMeditationCategory]);

  useEffect(() => {
    if (!initialTarget) return;
    if (initialTarget === "meditation") {
      if (meditationCategories[0]) {
        setActiveMeditationCategory(meditationCategories[0]);
      }
      setView("meditationList");
    } else if (initialTarget === "binaural") {
      setView("binauralWaves");
    } else if (initialTarget === "home") {
      setView("home");
    }
  }, [initialTarget]);

  const setTrackAt = (index) => {
    const target = activePlaylist[index];
    if (!target) return;
    setActiveIndex(index);
    setActiveTrack(target);
  };

  const openMeditationPlayer = (index) => {
    setActivePlaylist(meditationList);
    setActiveIndex(index);
    setActiveTrack(meditationList[index]);
    setView('meditationPlayer');
  };

  const openBinauralList = (wave) => {
    setActiveWave(wave);
    setView('binauralList');
    loadBinaural(wave.id);
  };

  const openBinauralPlayer = (index) => {
    const list = binauralLists[activeWave.id] || [];
    setActivePlaylist(list);
    setActiveIndex(index);
    setActiveTrack(list[index]);
    setView('binauralPlayer');
  };

  const playNext = () => {
    const nextIndex = activeIndex + 1;
    if (nextIndex >= activePlaylist.length) return;
    setTrackAt(nextIndex);
  };

  const playPrev = () => {
    const prevIndex = activeIndex - 1;
    if (prevIndex < 0) return;
    setTrackAt(prevIndex);
  };

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      audioRef.current.play();
      setIsPlaying(true);
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleVideo = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
    } else {
      videoRef.current.pause();
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: '放松空间', text: '分享一段放松内容' });
    } else {
      alert('已准备分享链接');
    }
  };

  useEffect(() => {
    if (view === 'binauralPlayer' && audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
  }, [activeTrack, view]);

  useEffect(() => {
    if (view !== 'meditationPlayer' || !videoRef.current || !activeTrack) return;
    const videoEl = videoRef.current;
    const src = mediaUrl(activeTrack.path);

    if (Hls.isSupported()) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
      const hls = new Hls();
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(videoEl);
    } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      videoEl.src = src;
    } else {
      videoEl.src = src;
    }

    videoEl.play().catch(() => {});

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [activeTrack, view]);

  if (view === 'home') {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="text-sm text-[#8B7A6A]">
          ← 返回
        </button>
        <div className="rounded-[36px] bg-[linear-gradient(180deg,#FCE2D6_0%,#F8D0C9_50%,#F6C5D3_100%)] p-4 shadow-sm">
          <div className="text-[#4B3425] font-semibold text-lg">放松空间</div>
          <div className="text-xs text-[#8B7A6A] mt-1">今天想做些什么？</div>
          <div className="mt-4 columns-2 gap-3">
            {meditationCategories.map((category) => (
              <button
                key={category.id}
                onClick={() => {
                  setActiveMeditationCategory(category);
                  setView('meditationList');
                }}
                className="mb-3 w-full break-inside-avoid rounded-[28px] p-3 text-left shadow-sm flex flex-col overflow-hidden"
                style={{ backgroundColor: category.color, color: category.text }}
              >
                <div className="text-sm font-semibold">{category.label}</div>
                <div className="text-xs mt-1">{category.subtitle}</div>
                <div className="text-xs opacity-80 mt-1">{category.desc}</div>
                <img
                  src={category.art}
                  alt={`${category.label} 插图`}
                  className="mt-auto w-full h-auto object-cover"
                />
              </button>
            ))}
            <button
              onClick={() => setView('binauralWaves')}
              className="mb-3 w-full break-inside-avoid rounded-[28px] bg-[#FCE3D8] p-3 text-left shadow-sm"
            >
              <div className="text-sm font-semibold text-[#7B4C3B]">脑波音乐</div>
              <div className="text-xs text-[#9B6B58] mt-1">五种频段</div>
              <div className="mt-3 rounded-2xl bg-white/60 p-2">
                <img src={relaxBinauralImg} alt="脑波音乐插画" className="w-full h-auto" />
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'meditationList') {
    return (
      <div className="space-y-4">
        <button onClick={() => setView('home')} className="text-sm text-[#8B7A6A]">
          ← 返回
        </button>
        <div className="text-[#4B3425] font-semibold text-lg">
          {activeMeditationCategory?.label || '冥想'}
        </div>
        <div className="space-y-3">
          {meditationList.map((item, idx) => (
            <button
              key={item.name}
              onClick={() => openMeditationPlayer(idx)}
              className="w-full rounded-2xl bg-white border border-[#EFE7DE] p-4 text-left shadow-sm"
            >
              <div className="text-sm font-semibold text-[#4B3425]">
                {getMeditationTitle(idx, item.name)}
              </div>
              <div className="text-xs text-[#8B7A6A] mt-1">点击播放</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (view === 'meditationPlayer' && activeTrack) {
    const playerTitle = activeMeditationCategory?.label || '冥想';
    const trackTitle = getMeditationTitle(activeIndex, activeTrack.name);
    return (
      <div
        className="rounded-[32px] p-5 min-h-[520px] flex flex-col gap-4"
        style={{ background: activeMeditationCategory?.playerBg || 'linear-gradient(180deg, #FAD7B2 0%, #F7C89A 100%)' }}
      >
        <div className="flex items-center justify-between text-[#4B3425]">
          <button onClick={() => setView('meditationList')} className="h-9 w-9 rounded-full bg-white/70 flex items-center justify-center">
            ←
          </button>
          <div className="text-sm font-semibold">{playerTitle}</div>
          <div className="flex items-center gap-2">
            <button className="h-9 w-9 rounded-full bg-white/70 flex items-center justify-center" title="收藏">
              <Star size={16} />
            </button>
            <button className="h-9 w-9 rounded-full bg-white/70 flex items-center justify-center" title="点赞">
              <Heart size={16} />
            </button>
            <button className="h-9 w-9 rounded-full bg-white/70 flex items-center justify-center" onClick={handleShare} title="分享">
              <Share2 size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <video
            ref={videoRef}
            className="w-full rounded-3xl shadow-lg bg-black"
            onEnded={playNext}
            onPlay={() => setIsVideoPlaying(true)}
            onPause={() => setIsVideoPlaying(false)}
            controls
            playsInline
          />
          <div className="text-sm text-[#6C5B50]">{trackTitle}</div>
          <div className="flex items-center gap-4">
            <button onClick={playPrev} className="h-10 w-10 rounded-full bg-white/80">«</button>
            <button onClick={playNext} className="h-10 w-10 rounded-full bg-white/80">»</button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'binauralWaves') {
    return (
      <div className="space-y-4 rounded-[32px] bg-[#F3E8DA] p-4">
        <button onClick={() => setView('home')} className="text-sm text-[#8B7A6A]">
          ← 返回
        </button>
        <div className="text-[#4B3425] font-semibold text-lg">脑波音乐</div>
        <div className="columns-2 gap-3">
          {waves.map((wave) => (
            <button
              key={wave.id}
              onClick={() => openBinauralList(wave)}
              className="mb-3 w-full break-inside-avoid rounded-2xl p-4 text-left shadow-sm relative overflow-hidden"
              style={{ backgroundColor: wave.color, color: '#fff', minHeight: wave.height }}
            >
              <div className="text-sm font-semibold">{wave.name}</div>
              <div className="text-xs opacity-80 mt-1">{wave.desc}</div>
              <img
                src={wave.art}
                alt={`${wave.name} 插图`}
                className="absolute bottom-0 right-0 w-20 h-auto"
              />
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (view === 'binauralList' && activeWave) {
    const list = binauralLists[activeWave.id] || [];
    return (
      <div className="space-y-4">
        <button onClick={() => setView('binauralWaves')} className="text-sm text-[#8B7A6A]">
          ← 返回
        </button>
        <div className="text-[#4B3425] font-semibold text-lg">{activeWave.name}</div>
        <div className="space-y-3">
          {list.map((item, idx) => (
            <button
              key={item.name}
              onClick={() => openBinauralPlayer(idx)}
              className="w-full rounded-2xl bg-white border border-[#EFE7DE] p-4 text-left shadow-sm"
            >
              <div className="text-sm font-semibold text-[#4B3425]">
                {displayName(item.name)}
              </div>
              <div className="text-xs text-[#8B7A6A] mt-1">点击播放</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (view === 'binauralPlayer' && activeTrack && activeWave) {
    return (
      <div
        className="rounded-[32px] p-5 min-h-[520px] flex flex-col gap-4"
        style={{ background: 'linear-gradient(180deg, #0B1F4B 0%, #0A2C6B 100%)' }}
      >
        <div className="flex items-center justify-between text-white">
          <button onClick={() => setView('binauralList')} className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center">
            ←
          </button>
          <div className="text-sm font-semibold">{activeWave.name}</div>
          <div className="flex items-center gap-2">
            <button className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center" title="收藏">
              <Star size={16} />
            </button>
            <button className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center" title="点赞">
              <Heart size={16} />
            </button>
            <button className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center" onClick={handleShare} title="分享">
              <Share2 size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-white">
          <div className="text-2xl font-semibold">Night Island</div>
          <div className="text-xs opacity-70">SLEEP MUSIC</div>
          <audio
            ref={audioRef}
            src={mediaUrl(activeTrack.path)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={playNext}
          />
          <div className="flex items-center gap-4">
            <button onClick={playPrev} className="h-10 w-10 rounded-full bg-white/10">«</button>
            <button onClick={toggleAudio} className="h-14 w-14 rounded-full bg-white text-[#0B1F4B] font-bold">
              {isPlaying ? "❚❚" : "▶︎"}
            </button>
            <button onClick={playNext} className="h-10 w-10 rounded-full bg-white/10">»</button>
          </div>
          <div className="text-sm opacity-70">{displayName(activeTrack.name)}</div>
        </div>
      </div>
    );
  }

  return null;
}

// --- 量表 ---
function ScaleHub({ username, user }) {
  const [view, setView] = useState("map");
  const [activeZoneId, setActiveZoneId] = useState("emotion_forest");
  const [currentScaleIndex, setCurrentScaleIndex] = useState(0);
  const [followupScaleIndex, setFollowupScaleIndex] = useState(0);
  const [themeResults, setThemeResults] = useState({});
  const ageText = String(user?.age ?? "");
  const numericAge = Number.parseInt(ageText.replace(/[^\d]/g, ""), 10);

  const zones = [
    {
      id: "digital_island",
      label: "数字小岛",
      scaleIds: ["NET_ADDICT"],
      position: { top: "15%", left: "8%" },
      theme: {
        title: "数字小岛",
        bgColor: "#6A8D6F",
        textColor: "#3E2B22",
        sceneImg: courageSceneImg,
        bubbleText: "小狐狸最近有点沉迷屏幕，它想知道如何把节奏找回来。",
        tagline: "一起看看上网节奏是否合适。",
        ctaText: "上岛看看 →",
        bubbleStyle: { top: "10%", left: "44%", width: "46%" },
      },
    },
    {
      id: "sleep_planet",
      label: "睡眠星球",
      scaleIds: ["SRSS"],
      position: { top: "18%", right: "8%" },
      theme: {
        title: "睡眠星球",
        bgColor: "#FED694",
        textColor: "#3E2B22",
        sceneImg: sleepSceneImg,
        bubbleText: "小猫最近懒懒的，它想看看是不是该早点休息。",
        tagline: "睡眠会影响白天的状态。",
        ctaText: "看看星空 →",
        bubbleStyle: { top: "44%", left: "12%", width: "60%" },
      },
    },
    {
      id: "emotion_forest",
      label: "情绪森林",
      scaleIds: ["DASS21", "ANHEDONIA", "ERQ", "PHQ9_CHILD"],
      position: { top: "38%", left: "10%" },
      theme: {
        title: "情绪森林",
        bgColor: "#7EA76C",
        textColor: "#3E2B22",
        sceneImg: emotionSceneImg,
        bubbleText: "熊熊有点没精神，它想知道你最近感觉怎么样。",
        tagline: "一起看看最近的心情状态吧。",
        ctaText: "开始探索 →",
        bubbleStyle: { top: "36%", left: "44%", width: "50%" },
      },
    },
    {
      id: "confidence_garden",
      label: "自信花园",
      scaleIds: ["BULLYING"],
      position: { top: "56%", left: "28%" },
      theme: {
        title: "自信花园",
        bgColor: "#E6AAA4",
        textColor: "#3E2B22",
        sceneImg: confidenceSceneImg,
        bubbleText: "小鹿在人群中有时会紧张，有时也会很自信。",
        tagline: "你最近的感受呢？",
        ctaText: "走进花园 →",
        bubbleStyle: { top: "42%", left: "10%", width: "56%" },
      },
    },
    {
      id: "stress_sea",
      label: "逐浪学海",
      scaleIds: ["ACADEMIC_BURNOUT", "SCHOOL_AVERSION"],
      position: { bottom: "10%", left: "30%" },
      theme: {
        title: "逐浪学海",
        bgColor: "#5B7A8D",
        textColor: "#F7F2EA",
        sceneImg: stressSceneImg,
        bubbleText: "小海龟最近觉得背有点重，它想知道是不是有点累了。",
        tagline: "学习和生活都会有起伏。",
        ctaText: "看看海面 →",
        bubbleStyle: { top: "30%", left: "48%", width: "50%" },
      },
    },
  ];

  const activeZone = zones.find((z) => z.id === activeZoneId) || zones[0];
  const isScaleAllowed = (scale) => {
    if (!scale.ageRange || Number.isNaN(numericAge)) return true;
    return numericAge >= scale.ageRange.min && numericAge <= scale.ageRange.max;
  };
  const allowedScaleIds = activeZone.scaleIds.filter((id) =>
    isScaleAllowed(getScale(id))
  );
  const scopedScaleIds =
    activeZone.id === "emotion_forest" && (numericAge === 8 || numericAge === 9)
      ? ["PHQ9_CHILD"]
      : activeZone.id === "confidence_garden" && (numericAge === 8 || numericAge === 9)
      ? ["BULLYING_SIMPLE"]
      : allowedScaleIds;
  const followupScaleIds = ["SELF_HARM", "SUICIDE"].filter((id) =>
    isScaleAllowed(getScale(id))
  );

  const recordResult = (payload) => {
    if (!payload?.scaleId) return;
    setThemeResults((prev) => ({ ...prev, [payload.scaleId]: payload }));
  };

  const resetTheme = () => {
    setCurrentScaleIndex(0);
    setThemeResults({});
  };

  const colorByRisk = (risk) => {
    if (risk === "high") return "bg-[#D56B4B] text-white";
    if (risk === "medium") return "bg-[#DFA15A] text-white";
    return "bg-[#9BB05A] text-white";
  };

  const getDASSLevel = (score) => {
    if (score <= 9) return "normal";
    if (score <= 13) return "mild";
    if (score <= 20) return "moderate";
    if (score <= 27) return "severe";
    return "extreme";
  };

  const getDASSAnxLevel = (score) => {
    if (score <= 7) return "normal";
    if (score <= 9) return "mild";
    if (score <= 14) return "moderate";
    if (score <= 19) return "severe";
    return "extreme";
  };

  const getDASSStressLevel = (score) => {
    if (score <= 14) return "normal";
    if (score <= 18) return "mild";
    if (score <= 25) return "moderate";
    if (score <= 33) return "severe";
    return "extreme";
  };

  const getEmotionSummary = () => {
    const dass = themeResults.DASS21;
    const anhedonia = themeResults.ANHEDONIA;
    const erq = themeResults.ERQ;
    const phq9 = themeResults.PHQ9_CHILD;
    const dep = dass?.score?.depression ?? 0;
    const anx = dass?.score?.anxiety ?? 0;
    const stress = dass?.score?.stress ?? 0;
    const maxTier = Math.max(
      ["normal", "mild", "moderate", "severe", "extreme"].indexOf(getDASSLevel(dep)),
      ["normal", "mild", "moderate", "severe", "extreme"].indexOf(getDASSAnxLevel(anx)),
      ["normal", "mild", "moderate", "severe", "extreme"].indexOf(getDASSStressLevel(stress))
    );
    const anhedoniaTier = anhedonia?.level?.tier;
    const phqLevel = phq9?.level?.severity || "";
    const phqRisk = phq9?.score?.item9 > 0 || phq9?.score?.total >= 15 || ["中重度", "重度"].includes(phqLevel);
    const needsFollowup = maxTier >= 2 || anhedoniaTier === "持续低落" || phqRisk;
    let risk = "low";
    let title = "今天的森林是多云转晴 🌤";
    let desc = "整体状态比较平稳。\n偶尔的小波动是正常的。";
    if (maxTier >= 2 || anhedoniaTier === "轻度波动") {
      risk = "medium";
      title = "森林里有些小雨 🌧";
      desc = "最近可能有些压力或疲惫。\n给自己一点时间。";
    }
    if (maxTier >= 3 || anhedoniaTier === "持续低落" || phqRisk) {
      risk = "high";
      title = "森林最近有些持续阴天 🌫";
      desc = "如果这种状态持续了一段时间，\n可以考虑和信任的人聊聊。";
    }
    if (erq?.level?.strategy === "更偏向表达抑制") {
      desc = `${desc}\n你可能更习惯把情绪先收起来，慢慢消化。`;
    }
    return { risk, title, desc, needsFollowup };
  };

  const renderSummary = () => {
    if (activeZone.id === "emotion_forest") {
      const { risk, title, desc } = getEmotionSummary();
      return (
        <div className="rounded-2xl bg-white/90 p-4 shadow-sm space-y-2">
          <div className={`inline-flex px-3 py-1 rounded-full text-xs ${colorByRisk(risk)}`}>
            情绪森林
          </div>
          <div className="text-[#4B3425] font-semibold">{title}</div>
          <div className="text-sm text-[#6C5B50] whitespace-pre-line">{desc}</div>
        </div>
      );
    }

    if (activeZone.id === "stress_sea") {
      const burnout = themeResults.ACADEMIC_BURNOUT;
      const aversion = themeResults.SCHOOL_AVERSION;
      const burnoutMean = burnout?.score?.mean ?? 0;
      const aversionMean = aversion?.score?.mean ?? 0;
      let risk = "low";
      let title = "海面比较平静 🌊";
      let desc = "最近的学习节奏还算稳定。";
      if (burnoutMean >= 3 || aversionMean >= 3) {
        risk = "medium";
        title = "海面有些浪 🌊";
        desc = "最近可能有点忙或担心。";
      }
      if (burnoutMean >= 4 || aversionMean >= 4) {
        risk = "high";
        title = "最近的浪有点高 🌪";
        desc = "也许可以调整一下节奏，\n压力不需要一个人承担。";
      }
      return (
        <div className="rounded-2xl bg-white/90 p-4 shadow-sm space-y-2">
          <div className={`inline-flex px-3 py-1 rounded-full text-xs ${colorByRisk(risk)}`}>
            压力海
          </div>
          <div className="text-[#4B3425] font-semibold">{title}</div>
          <div className="text-sm text-[#6C5B50] whitespace-pre-line">{desc}</div>
        </div>
      );
    }

    if (activeZone.id === "confidence_garden") {
      const bullying = themeResults.BULLYING || themeResults.BULLYING_SIMPLE;
      const hasConcern = Boolean(bullying?.flags?.hasConcern);
      const risk = hasConcern ? "medium" : "low";
      const title = hasConcern ? "花园有些地方需要浇水 🌱" : "花园正在生长 🌼";
      const desc = hasConcern
        ? "如果和同学相处有些不舒服，\n可以找老师或家人聊聊。"
        : "你在人群中有自己的位置。";
      return (
        <div className="rounded-2xl bg-white/90 p-4 shadow-sm space-y-2">
          <div className={`inline-flex px-3 py-1 rounded-full text-xs ${colorByRisk(risk)}`}>
            自信花园
          </div>
          <div className="text-[#4B3425] font-semibold">{title}</div>
          <div className="text-sm text-[#6C5B50] whitespace-pre-line">{desc}</div>
        </div>
      );
    }

    if (activeZone.id === "sleep_planet") {
      const sleep = themeResults.SRSS;
      const total = sleep?.score?.total ?? 0;
      let risk = "low";
      let title = "星空清晰 🌌";
      let desc = "最近入睡或精力恢复情况比较稳定。";
      if (total >= 23 && total < 30) {
        risk = "medium";
        title = "星空有些云层 ☁";
        desc = "最近入睡或恢复情况可能有些波动。";
      }
      if (total >= 30) {
        risk = "high";
        title = "星空云层偏厚 ☁";
        desc = "睡眠可能有点被打扰，\n可以试着调整作息。";
      }
      return (
        <div className="rounded-2xl bg-white/90 p-4 shadow-sm space-y-2">
          <div className={`inline-flex px-3 py-1 rounded-full text-xs ${colorByRisk(risk)}`}>
            睡眠星球
          </div>
          <div className="text-[#4B3425] font-semibold">{title}</div>
          <div className="text-sm text-[#6C5B50] whitespace-pre-line">{desc}</div>
        </div>
      );
    }

    if (activeZone.id === "digital_island") {
      const net = themeResults.NET_ADDICT;
      const total = net?.score?.total ?? 0;
      let risk = "low";
      let title = "海风很舒服 🌤";
      let desc = "你的上网节奏目前比较平稳。";
      if (total >= 36 && total <= 45) {
        risk = "medium";
        title = "潮位有点高 🌊";
        desc = "最近线上时间可能有点多，试着给自己留些线下空档。";
      }
      if (total > 45) {
        risk = "high";
        title = "潮位偏高 🌧";
        desc = "线上活动占据了不少注意力，建议逐步调整节奏。";
      }
      return (
        <div className="rounded-2xl bg-white/90 p-4 shadow-sm space-y-2">
          <div className={`inline-flex px-3 py-1 rounded-full text-xs ${colorByRisk(risk)}`}>
            数字小岛
          </div>
          <div className="text-[#4B3425] font-semibold">{title}</div>
          <div className="text-sm text-[#6C5B50] whitespace-pre-line">{desc}</div>
        </div>
      );
    }

    return null;
  };

  if (view === "map") {
    return (
      <div className="space-y-4 rounded-[28px] bg-[#F7EEC9] p-5 min-h-[560px]">
        <div className="text-[#5A4332] font-semibold text-lg">成长探索</div>
        <div className="text-xs text-[#8B7A6A]">点击地图标签，进入对应主题</div>

        <div className="relative w-full max-w-[380px] mx-auto">
          <img src={growthMapImg} alt="成长探索地图" className="w-full h-auto" />
          {zones.map((zone) => (
            <button
              key={zone.id}
              onClick={() => {
                setActiveZoneId(zone.id);
                resetTheme();
                setView("intro");
              }}
              className="absolute rounded-full px-4 py-2 text-sm font-semibold shadow-md bg-[#4B3425] text-white"
              style={zone.position}
            >
              {zone.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (view === "intro") {
    const { theme } = activeZone;
    const canStart = scopedScaleIds.length > 0;
    return (
      <div
        className="rounded-[28px] p-5 min-h-[560px] flex flex-col items-center text-center"
        style={{ backgroundColor: theme.bgColor, color: theme.textColor }}
      >
        <div className="w-full flex items-center gap-2">
          <button
            onClick={() => setView("map")}
            className="h-9 w-9 rounded-full border text-lg flex items-center justify-center"
            style={{ borderColor: `${theme.textColor}99`, color: theme.textColor }}
          >
            ←
          </button>
          <div className="text-sm font-semibold">{theme.title}</div>
        </div>

        <div className="relative w-full flex-1 mt-6">
          <img src={theme.sceneImg} alt={theme.title} className="w-full h-auto" />
          <div
            className="absolute bg-white text-[#4B3425] text-xs rounded-2xl px-3 py-2 shadow-md"
            style={theme.bubbleStyle}
          >
            {theme.bubbleText}
          </div>
        </div>

        <div className="mt-4 text-sm font-semibold">{theme.tagline}</div>
        <button
          onClick={() => setView("scale")}
          disabled={!canStart}
          className="mt-5 w-full rounded-full bg-[#4B3425] text-white py-3 font-semibold disabled:opacity-50"
        >
          {canStart ? theme.ctaText : "当前年龄暂不适用"}
        </button>
      </div>
    );
  }

  if (view === "scale") {
    const scaleId = scopedScaleIds[currentScaleIndex];
    const isLast = currentScaleIndex >= scopedScaleIds.length - 1;
    return (
      <ScaleRunner
        username={username}
        scaleId={scaleId}
        onBack={() => setView("intro")}
        backLabel="← 返回主题"
        onComplete={(payload) => {
          recordResult(payload);
          if (!isLast) {
            setCurrentScaleIndex((idx) => idx + 1);
          } else {
            setView("summary");
          }
        }}
        completeLabel={isLast ? "返回成长地图 →" : "继续下一份 →"}
        autoAdvance
        themeBg={activeZone.theme.bgColor}
        themeTextColor={activeZone.theme.textColor}
      />
    );
  }

  if (view === "summary") {
    const { needsFollowup } = activeZone.id === "emotion_forest" ? getEmotionSummary() : { needsFollowup: false };
    const followupCompleted = followupScaleIds.length > 0 && followupScaleIds.every((id) => themeResults[id]);
    return (
      <div
        className="rounded-[28px] p-5 min-h-[560px] flex flex-col gap-4"
        style={{ backgroundColor: activeZone.theme.bgColor, color: activeZone.theme.textColor }}
      >
        <div className="w-full flex items-center gap-2">
          <button
            onClick={() => setView("map")}
            className="h-9 w-9 rounded-full border text-lg flex items-center justify-center"
            style={{ borderColor: `${activeZone.theme.textColor}99`, color: activeZone.theme.textColor }}
          >
            ←
          </button>
          <div className="text-sm font-semibold">{activeZone.theme.title} · 总结</div>
        </div>
        {renderSummary()}
        {activeZone.id === "emotion_forest" && needsFollowup && !followupCompleted && followupScaleIds.length > 0 ? (
          <div className="rounded-2xl bg-white/90 p-4 shadow-sm space-y-2 text-[#6C5B50]">
            <div className="text-sm font-semibold text-[#4B3425]">情绪有点重时，建议继续完成自杀/自伤量表</div>
            <div className="text-xs leading-relaxed">
              如果你觉得自己情绪真的很差，可以继续完成接下来的量表，帮助我们更准确地理解你的状态。
            </div>
            <button
              onClick={() => {
                setFollowupScaleIndex(0);
                setView("followup");
              }}
              className="mt-2 w-full rounded-full bg-[#4B3425] text-white py-2.5 text-sm font-semibold"
            >
              继续完成自杀/自伤量表 →
            </button>
          </div>
        ) : null}
        <button
          onClick={() => setView("map")}
          className="mt-auto w-full rounded-full bg-[#4B3425] text-white py-3 font-semibold"
        >
          返回成长地图 →
        </button>
      </div>
    );
  }

  if (view === "followup") {
    const scaleId = followupScaleIds[followupScaleIndex];
    if (!scaleId) {
      return (
        <div className="rounded-[28px] p-5 min-h-[560px] flex flex-col gap-4 bg-[#F7EEC9]">
          <div className="text-[#5A4332] font-semibold">当前年龄暂不适用</div>
          <button
            onClick={() => setView("map")}
            className="mt-auto w-full rounded-full bg-[#4B3425] text-white py-3 font-semibold"
          >
            返回成长地图 →
          </button>
        </div>
      );
    }
    const isLast = followupScaleIndex >= followupScaleIds.length - 1;
    return (
      <ScaleRunner
        username={username}
        scaleId={scaleId}
        onBack={() => setView("summary")}
        backLabel="← 返回总结"
        onComplete={(payload) => {
          recordResult(payload);
          if (!isLast) {
            setFollowupScaleIndex((idx) => idx + 1);
          } else {
            setView("summary");
          }
        }}
        completeLabel={isLast ? "完成并返回总结 →" : "继续下一份 →"}
        autoAdvance
        themeBg={activeZone.theme.bgColor}
        themeTextColor={activeZone.theme.textColor}
      />
    );
  }

  return (
    <ScaleRunner
      username={username}
      scaleId={scopedScaleIds[0]}
      onBack={() => setView("map")}
    />
  );
}

function GamesHub({ username }) {
  const [taskId, setTaskId] = useState(null);

  if (!taskId) {
    const tasks = listTasks();
    return (
      <div className="grid grid-cols-2 gap-4">
        {tasks.map((t) => (
          <button
            key={t.id}
            onClick={() => setTaskId(t.id)}
            className="aspect-square bg-[#F7F2EA] rounded-3xl flex flex-col items-center justify-center p-4 text-center shadow-sm"
          >
            <Gamepad2 className="w-10 h-10 text-[#4B342C] mb-2" />
            <span className="font-bold text-[#6C5B50] text-sm">{t.name}</span>
            <span className="text-xs text-[#8B7A6A] mt-1">{t.durationHint}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <TaskRunner
      username={username}
      taskId={taskId}
      onBack={() => setTaskId(null)}
    />
  );
}
