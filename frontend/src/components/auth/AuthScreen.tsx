import React, { useState } from 'react';
import {
  Layers,
  Lock,
  Mail,
  User as UserIcon,
  Building2,
  Briefcase,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { api, setStoredToken } from '../../lib/api';
import { useAppStore } from '../../store/useAppStore';

interface AuthScreenProps {
  onAuthenticated: () => void;
}

const DEMO_ACCOUNTS = [
  {
    label: 'Owner (To‘liq huquq)',
    name: 'Sardorbek Alimov',
    email: 'sardorbek@flowforge.uz',
    roleBadge: 'OWNER',
    badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    desc: '2 ta Workspace, barcha Space, Loyiha va Xavfsizlik sozlamalariga to‘liq ruxsat',
  },
  {
    label: 'Admin (Boshqaruvchi)',
    name: 'Malika Karimova',
    email: 'malika@flowforge.uz',
    roleBadge: 'ADMIN',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    desc: 'A’zolarni taklif qilish, jamoa va loyihalarni boshqarish (Egani o‘chira olmaydi)',
  },
  {
    label: 'Member (Dasturchi)',
    name: 'Javohir Rustamov',
    email: 'javohir@flowforge.uz',
    roleBadge: 'MEMBER',
    badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
    desc: 'Vazifalar, Kanban, Subtask, Vaqt hisobi va Izohlar bilan ishlash',
  },
  {
    label: 'Viewer (Faqat ko‘rish)',
    name: 'Nilufar Saidova',
    email: 'nilufar@flowforge.uz',
    roleBadge: 'VIEWER',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    desc: 'Faqat ko‘rish rejimi (Read-only). Tahrirlash so‘rovlari serverda rad etiladi',
  },
  {
    label: 'Boshqa Tenant (Izolyatsiya)',
    name: 'Azizbek Toshmatov',
    email: 'aziz@othercompany.uz',
    roleBadge: 'ISOLATED',
    badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    desc: 'Alohida kompaniya workspace egasi (FlowForge Tech ma’lumotlarini ko‘ra olmaydi)',
  },
];

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('sardorbek@flowforge.uz');
  const [password, setPassword] = useState('FlowForge!2026');
  const [fullName, setFullName] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newResetPassword, setNewResetPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const addToast = useAppStore((s) => s.addToast);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await api.login({ email, password });
        setStoredToken(res.token);
        addToast({
          type: 'success',
          title: 'Xush kelibsiz!',
          message: `${res.user.profile.full_name} sifatida tizimga kirdingiz.`,
        });
        onAuthenticated();
      } else if (mode === 'register') {
        const res = await api.register({
          full_name: fullName,
          email,
          password,
          workspace_name: workspaceName,
          job_title: jobTitle,
        });
        setStoredToken(res.token);
        addToast({
          type: 'success',
          title: 'Hisob va Workspace yaratildi!',
          message: 'FlowForge platformasiga xush kelibsiz.',
        });
        onAuthenticated();
      } else {
        if (resetToken && newResetPassword) {
          const res = await api.resetPassword({
            reset_token: resetToken,
            new_password: newResetPassword,
          });
          addToast({ type: 'success', title: 'Parol yangilandi!', message: res.message });
          setResetToken('');
          setNewResetPassword('');
          setPassword(newResetPassword);
          setMode('login');
        } else {
          const res = await api.forgotPassword(email);
          setInfoMessage(res.message);
          if (res.reset_token) {
            setResetToken(res.reset_token);
          } else {
            setError('Ushbu email manzili bilan faol foydalanuvchi topilmadi.');
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = async (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('FlowForge!2026');
    setError(null);
    setLoading(true);
    try {
      const res = await api.login({ email: demoEmail, password: 'FlowForge!2026' });
      setStoredToken(res.token);
      addToast({
        type: 'success',
        title: 'Tezkor kirish bajarildi',
        message: `${res.user.profile.full_name} hisobi faollashtirildi.`,
      });
      onAuthenticated();
    } catch (err: any) {
      setError(err.message || 'Login xatoligi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col lg:flex-row overflow-y-auto">
      {/* Left Brand & Architecture Showcase */}
      <div className="lg:w-7/12 p-8 lg:p-14 flex flex-col justify-between bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/50 border-b lg:border-b-0 lg:border-r border-slate-800/80 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Layers className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight text-white">FlowForge</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Enterprise v2.0
                </span>
              </div>
              <p className="text-xs text-slate-400">Multi-Tenant SaaS · Yii2 REST API + React TypeScript</p>
            </div>
          </div>

          <h1 className="text-3xl lg:text-4xl font-bold text-white leading-tight max-w-2xl mb-4">
            Jamoalar, Loyihalar va Murakkab Ish Oqimlarini Boshqarish Tizimi
          </h1>
          <p className="text-slate-400 text-sm lg:text-base max-w-2xl mb-8 leading-relaxed">
            4-qatlamli ichma-ich navigatsiya (<span className="text-slate-200">Workspace ➔ Space ➔ Folder ➔ Project ➔ Sprint ➔ Task ➔ Subtask</span>),
            server tomonidan himoyalangan RBAC ruxsatlar, Kanban Fractional Indexing, Vaqt hisobi va Loyiha Wiki hujjatlari.
          </p>

          {/* 1-Click Role Verification Cards */}
          <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl p-5 max-w-2xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Real Database Rollari — 1-Click Tekshirish (Parol: FlowForge!2026)
                </span>
              </div>
              <span className="text-[11px] text-slate-500">Bosib darhol kiring</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  disabled={loading}
                  onClick={() => quickLogin(acc.email)}
                  className="text-left p-3 rounded-xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800/90 hover:border-indigo-500/50 transition group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-white group-hover:text-indigo-300 transition">
                      {acc.name}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${acc.badgeColor}`}>
                      {acc.roleBadge}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono mb-1">{acc.email}</div>
                  <p className="text-[11px] text-slate-500 line-clamp-2">{acc.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-8 pt-6 border-t border-slate-800/80 flex flex-wrap items-center gap-6 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Yii2 ActiveRecord & 24-Jadval Migratsiya</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>JWT Sessiya & Qurilmalar Nazorati</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Qat’iy Tenant Isolation (IDOR Himoyasi)</span>
          </div>
        </div>
      </div>

      {/* Right Authentication Form */}
      <div className="lg:w-5/12 p-8 lg:p-14 flex items-center justify-center bg-slate-950">
        <div className="w-full max-w-md">
          <div className="flex rounded-xl bg-slate-900 p-1 border border-slate-800 mb-6">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(null); setInfoMessage(null); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${
                mode === 'login' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Kirish (Login)
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(null); setInfoMessage(null); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${
                mode === 'register' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Ro‘yxatdan o‘tish
            </button>
            <button
              type="button"
              onClick={() => { setMode('forgot'); setError(null); setInfoMessage(null); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${
                mode === 'forgot' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Parolni tiklash
            </button>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white mb-1">
              {mode === 'login' && 'Hisobingizga kiring'}
              {mode === 'register' && 'Yangi hisob va Workspace ochish'}
              {mode === 'forgot' && 'Parolni qayta tiklash'}
            </h2>
            <p className="text-xs text-slate-400">
              {mode === 'login' && 'Email (yoki username) hamda parolingizni kiriting.'}
              {mode === 'register' && 'Ro‘yxatdan o‘tishingiz bilan shaxsiy Workspace va ilk loyihangiz avtomatik yaratiladi.'}
              {mode === 'forgot' && 'Ro‘yxatdan o‘tgan email manzilingizni kiriting.'}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {infoMessage && (
            <div className="mb-4 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2.5 text-emerald-300 text-xs">
              <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              <span>{infoMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    To‘liq ism-sharifingiz *
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Masalan: Sardorbek Alimov"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Kompaniya / Workspace nomi
                    </label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        value={workspaceName}
                        onChange={(e) => setWorkspaceName(e.target.value)}
                        placeholder="Acme Studio"
                        className="w-full pl-10 pr-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Lavozimingiz
                    </label>
                    <div className="relative">
                      <Briefcase className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        placeholder="Team Lead"
                        className="w-full pl-10 pr-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Email manzili {mode === 'login' && '(yoki username)'} *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.uz"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Parol *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            )}

            {mode === 'forgot' && resetToken && (
              <div className="space-y-3 p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-500/40">
                <div>
                  <label className="block text-[11px] font-semibold text-indigo-300 mb-1">
                    Tasdiqlash Tokeni (Avto-to‘ldirildi)
                  </label>
                  <input
                    type="text"
                    required
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white mb-1">
                    Yangi parolni kiriting (kamida 8 ta belgi) *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={newResetPassword}
                    onChange={(e) => setNewResetPassword(e.target.value)}
                    placeholder="Yangi parol..."
                    className="w-full px-3.5 py-2 bg-slate-950 border border-indigo-500 rounded-xl text-sm text-white"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition"
            >
              <span>
                {loading
                  ? 'Bajarilmoqda...'
                  : mode === 'login'
                  ? 'Tizimga kirish'
                  : mode === 'register'
                  ? 'Hisob yaratish va Boshlash'
                  : resetToken
                  ? 'Yangi parolni saqlash'
                  : 'Tiklash kodini olish'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
