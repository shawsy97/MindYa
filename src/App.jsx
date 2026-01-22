import React, { useState, useEffect, useRef } from 'react';
import {
  Heart,
  MessageCircle,
  Gamepad2,
  LayoutGrid,
  Send,
  AlertCircle,
  BookOpen,
} from 'lucide-react';
import logoImg from './assets/logo.png';
import welcomeImg from './assets/welcome.png';
import onboard1Img from './assets/onboard1.png';
import onboard2Img from './assets/onboard2.png';
import onboard3Img from './assets/onboard3.png';
import maleImg from './assets/male.png';
import femaleImg from './assets/female.png';

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

// --- 主要组件 ---
export default function MindYaApp() {
  const [view, setView] = useState('splash'); // splash, welcome, onboarding, login, profile, main
  const [user, setUser] = useState({ age: '', grade: '', gender: '', riskLevel: 'low' });
  const [messages, setMessages] = useState([]);

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
      case 'onboarding': return <OnboardingScreen onComplete={() => setView('login')} />;
      case 'login': return <LoginScreen onLogin={() => setView('profile')} />;
      case 'profile': return <ProfileScreen onComplete={(data) => { setUser({ ...user, ...data }); setView('main'); }} />;
      case 'main': return <MainInterface user={user} messages={messages} setMessages={setMessages} />;
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

function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

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

      <button
        onClick={onLogin}
        className="mt-10 w-full rounded-full bg-[#4B342C] py-3 text-white text-base font-semibold"
      >
        登录 →
      </button>

      <p className="mt-6 text-center text-xs text-[#A89A8E]">
        还没有账号？<span className="text-[#D56B4B]">去注册</span>
      </p>
    </div>
  );
}

function ProfileScreen({ onComplete }) {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({ gender: '', age: '18', grade: '初中' });
  const ageOptions = ['<8岁', ...Array.from({ length: 11 }, (_, i) => String(i + 8)), '>18岁'];
  const ageItemHeight = 48;
  const ageListRef = useRef(null);

  const next = () => {
    if (step < 2) {
      setStep(step + 1);
    } else {
      onComplete(formData);
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
            className={`w-full overflow-hidden rounded-2xl border ${
              formData.gender === '男生' ? 'border-[#4B342C] bg-white' : 'border-[#E5DED6] bg-[#FBF9F7]'
            }`}
          >
            <img src={maleImg} alt="我是男生" className="w-full h-full object-cover" />
          </button>
          <button
            onClick={() => setFormData({ ...formData, gender: '女生' })}
            className={`w-full overflow-hidden rounded-2xl border ${
              formData.gender === '女生' ? 'border-[#4B342C] bg-white' : 'border-[#E5DED6] bg-[#FBF9F7]'
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
                  className={`h-12 snap-center flex items-center justify-center text-3xl font-semibold ${
                    formData.age === age ? 'text-white' : 'text-[#C9C0B6]'
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
                className={`w-full rounded-2xl border px-4 py-3 text-left ${
                  formData.grade === grade ? 'border-[#4B342C] bg-[#9BB05A] text-white' : 'border-[#E5DED6] bg-white text-[#4B3425]'
                }`}
              >
                {grade}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={next}
        className="mt-auto w-full rounded-full bg-[#4B342C] py-3 text-white text-base font-semibold"
      >
        继续 →
      </button>
    </div>
  );
}

function MainInterface({ user }) {
  const [activeTab, setActiveTab] = useState('chat');
  const [menuOpen, setMenuOpen] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, text: "嘿！我是你的心理小助手，今天过得怎么样？", sender: 'ai' }
  ]);
  const [input, setInput] = useState('');
  const scrollRef = useRef(null);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMsg = { id: Date.now(), text: input, sender: "user" };
    setMessages(prev => [...prev, userMsg]);
    setInput("");

    // 把你 UI 消息结构转成 API 消息结构
    const apiMessages = [...messages, userMsg].map(m => ({
      role: m.sender === "user" ? "user" : "assistant",
      content: m.text,
    }));

    const resp = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: apiMessages,
        userProfile: user,          // 你已有 user（age/grade/gender）:contentReference[oaicite:8]{index=8}
        role: "日常陪伴",
      }),
    });

    const data = await resp.json();
    const aiText = data?.text || "我这边有点卡住了，我们稍后再试试。";

    const aiMsg = { id: Date.now() + 1, text: aiText, sender: "ai" };
    setMessages(prev => [...prev, aiMsg]);
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
          <div
            className="absolute inset-0 bg-[#4B3425]/20"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute left-4 top-14 w-64 rounded-2xl bg-[#F7F2EA] p-4 shadow-lg">
            <button className="w-full flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-[#4B3425]">
              <span className="h-6 w-6 rounded-full bg-[#9BB05A] inline-flex items-center justify-center text-white">+</span>
              新聊天
            </button>
            <div className="mt-4 text-sm text-[#8B7A6A]">历史聊天</div>
            <div className="mt-2 space-y-2">
              <div className="rounded-xl bg-white px-3 py-2 text-sm text-[#4B3425]">最近对话 1</div>
              <div className="rounded-xl bg-white px-3 py-2 text-sm text-[#4B3425]">最近对话 2</div>
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
                  {m.text}
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
        
        {activeTab === 'scale' && <ScalePlaceholder />}
        {activeTab === 'games' && <GamesPlaceholder />}
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
        <NavBtn icon={<MessageCircle/>} label="聊天" active={activeTab==='chat'} onClick={()=>setActiveTab('chat')} activeColor="text-[#4B342C]" />
        <NavBtn icon={<BookOpen/>} label="测测" active={activeTab==='scale'} onClick={()=>setActiveTab('scale')} activeColor="text-[#4B342C]" />
        <NavBtn icon={<Gamepad2/>} label="游戏" active={activeTab==='games'} onClick={()=>setActiveTab('games')} activeColor="text-[#4B342C]" />
        <NavBtn icon={<LayoutGrid/>} label="更多" active={activeTab==='more'} onClick={()=>setActiveTab('more')} activeColor="text-[#4B342C]" />
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

// --- 占位组件 ---
function ScalePlaceholder() {
  const [selected, setSelected] = useState('经常这样');

  return (
    <div className="p-4 text-center bg-[#ffffff]">
      <h4 className="text-xl font-bold text-[#4B3425] mb-4">轻量心情自测</h4>
      <div className="bg-[#F7F2EA] p-6 rounded-2xl border border-[#E5D8CC] shadow-[0_6px_18px_rgba(120,98,84,0.25)]">
        <p className="text-[#6C5B50] mb-4 text-left">最近你感到很有压力吗？</p>
        <div className="space-y-3">
          {['完全没有', '偶尔会', '经常这样'].map((opt) => {
            const isSelected = selected === opt;
            return (
              <button
                key={opt}
                onClick={() => setSelected(opt)}
                className={`w-full py-3 rounded-xl font-medium border ${
                  isSelected
                    ? 'bg-[#9BB05A] text-white border-[#9BB05A]'
                    : 'bg-white text-[#4B3425] border-[#E5D8CC]'
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function GamesPlaceholder() {
  return (
    <div className="grid grid-cols-2 gap-4">
      {['情绪气球', '压力切碎机', '呼吸森林'].map(game => (
        <div key={game} className="aspect-square bg-[#F7F2EA] rounded-3xl flex flex-col items-center justify-center p-4 text-center shadow-sm">
          <Gamepad2 className="w-10 h-10 text-[#4B342C] mb-2" />
          <span className="font-bold text-[#6C5B50] text-sm">{game} [cite: 54]</span>
        </div>
      ))}
    </div>
  );
}
