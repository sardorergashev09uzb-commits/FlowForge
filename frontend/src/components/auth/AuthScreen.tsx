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
  Eye,
  EyeOff,
  Kanban,
  Clock,
  ArrowLeft,
  Check,
} from 'lucide-react';
import { api, setStoredToken } from '../../lib/api';
import { useAppStore } from '../../store/useAppStore';

interface AuthScreenProps {
  onAuthenticated: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newResetPassword, setNewResetPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const addToast = useAppStore((s) => s.addToast);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    // Client-side validations
    if (mode === 'login') {
      if (!email.trim() || !password) {
        setError('Iltimos, email (yoki username) va parolni kiriting.');
        return;
      }
    } else if (mode === 'register') {
      if (!fullName.trim()) {
        setError('Iltimos, to‘liq ism-sharifingizni kiriting.');
        return;
      }
      if (!email.trim() || !email.includes('@')) {
        setError('Iltimos, to‘g‘ri formatdagi email manzilini kiriting.');
        return;
      }
      if (password.length < 8) {
        setError('Parol kamida 8 ta belgidan iborat bo‘lishi shart.');
        return;
      }
    } else if (mode === 'forgot') {
      if (!resetToken) {
        if (!email.trim() || !email.includes('@')) {
          setError('Iltimos, ro‘yxatdan o‘tgan email manzilingizni kiriting.');
          return;
        }
      } else {
        if (newResetPassword.length < 8) {
          setError('Yangi parol kamida 8 ta belgidan iborat bo‘lishi lozim.');
          return;
        }
      }
    }

    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await api.login({ email: email.trim(), password });
        setStoredToken(res.token);
        addToast({
          type: 'success',
          title: 'Xush kelibsiz!',
          message: `${res.user.profile?.full_name || res.user.username} sifatida tizimga kirdingiz.`,
        });
        onAuthenticated();
      } else if (mode === 'register') {
        const res = await api.register({
          full_name: fullName.trim(),
          email: email.trim(),
          password,
          workspace_name: workspaceName.trim() || undefined,
          job_title: jobTitle.trim() || undefined,
        });
        setStoredToken(res.token);
        addToast({
          type: 'success',
          title: 'Hisob muvaffaqiyatli yaratildi!',
          message: 'FlowForge platformasiga xush kelibsiz.',
        });
        onAuthenticated();
      } else {
        // Forgot password workflow
        if (resetToken && newResetPassword) {
          const res = await api.resetPassword({
            reset_token: resetToken.trim(),
            new_password: newResetPassword,
          });
          addToast({ type: 'success', title: 'Parol yangilandi!', message: res.message });
          setResetToken('');
          setNewResetPassword('');
          setPassword(newResetPassword);
          setMode('login');
        } else {
          const res = await api.forgotPassword(email.trim());
          setInfoMessage(res.message);
          if (res.reset_token) {
            setResetToken(res.reset_token);
          } else {
            setError('Ushbu email manzili bilan faol foydalanuvchi topilmadi.');
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Xatolik yuz berdi. Qayta urinib ko‘ring.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#090b10] text-slate-100 flex flex-col lg:flex-row overflow-y-auto select-none">
      {/* =====================================================================
          LEFT HERO & FEATURE SHOWCASE
         ===================================================================== */}
      <div className="lg:w-7/12 p-8 lg:p-14 flex flex-col justify-between bg-gradient-to-br from-[#0c0f17] via-[#0f1422] to-indigo-950/40 border-b lg:border-b-0 lg:border-r border-white/[0.08] relative overflow-hidden">
        {/* Subtle ambient lighting */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center shadow-xl shadow-indigo-600/30">
              <Layers className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-extrabold tracking-tight text-white">FlowForge</span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                  Enterprise v2.0
                </span>
              </div>
              <p className="text-xs text-slate-400">Zamonaviy Jamoaviy Boshqaruv va Multi-Tenant SaaS</p>
            </div>
          </div>

          <h1 className="text-3xl lg:text-5xl font-extrabold text-white leading-tight max-w-2xl mb-4 tracking-tight">
            Loyiha, Jamoa va Ish Oqimlarini{' '}
            <span className="bg-gradient-to-r from-indigo-400 via-violet-300 to-emerald-400 bg-clip-text text-transparent">
              Yuqori Darajada
            </span>{' '}
            Boshqaring
          </h1>
          <p className="text-slate-400 text-sm lg:text-base max-w-2xl mb-8 leading-relaxed">
            Linear va ClickUp darajasidagi tezkor interfeys, 9 xil loyiha ko‘rinishi, YouTube Studio uslubidagi
            ichma-ich navigatsiya hamda server darajasidagi qat’iy Multi-Tenant xavfsizlik.
          </p>

          {/* Key Feature Highlights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.07] hover:border-indigo-500/40 transition">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-2.5">
                <Kanban className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-white mb-1">9 Xil Loyiha Ko‘rinishi</h3>
              <p className="text-[11px] text-slate-400 leading-normal">
                Kanban (Swimlanes bilan), Ro‘yxat, Kalendar, Gantt/Timeline, Sprintlar va Wiki Docs.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.07] hover:border-violet-500/40 transition">
              <div className="w-8 h-8 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center mb-2.5">
                <Layers className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-white mb-1">Ichma-ich (Drill-Down) Navigatsiya</h3>
              <p className="text-[11px] text-slate-400 leading-normal">
                Interaktiv Breadcrumbs, qatlamli filtrlar va vazifa kartalaridagi tezkor <code>•••</code> amallar.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.07] hover:border-emerald-500/40 transition">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-2.5">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-white mb-1">Qat’iy RBAC va Izolyatsiya</h3>
              <p className="text-[11px] text-slate-400 leading-normal">
                Owner, Admin, Member va Viewer rollari. IDOR himoyasi va faol sessiyalar nazorati.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.07] hover:border-amber-500/40 transition">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-2.5">
                <Clock className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-white mb-1">Jonli Taymer & Timesheet</h3>
              <p className="text-[11px] text-slate-400 leading-normal">
                Vazifalar ustida ishlash vaqtini jonli o‘lchash va avtomatlashtirilgan hisobotlar.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Trust Badges */}
        <div className="relative z-10 mt-8 pt-6 border-t border-white/[0.07] flex flex-wrap items-center gap-6 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Yii2 REST API & 28+ Jadval</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>React 19 & TypeScript SPA</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>JWT & Multi-Session Guard</span>
          </div>
        </div>
      </div>

      {/* =====================================================================
          RIGHT AUTHENTICATION FORM (SIGN IN / SIGN UP / FORGOT)
         ===================================================================== */}
      <div className="lg:w-5/12 p-8 lg:p-14 flex items-center justify-center bg-[#090b10]">
        <div className="w-full max-w-md">
          {/* Segmented Mode Switcher */}
          {mode !== 'forgot' ? (
            <div className="flex rounded-2xl bg-[#121622] p-1 border border-white/[0.08] mb-6 shadow-inner">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                  setInfoMessage(null);
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
                  mode === 'login'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Kirish (Sign In)
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(null);
                  setInfoMessage(null);
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
                  mode === 'register'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Ro‘yxatdan o‘tish (Sign Up)
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
                setInfoMessage(null);
              }}
              className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-400 hover:text-indigo-300 mb-6 transition group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" />
              <span>Kirish oynasiga qaytish</span>
            </button>
          )}

          {/* Form Header */}
          <div className="mb-6">
            <h2 className="text-2xl font-extrabold text-white mb-1.5 tracking-tight">
              {mode === 'login' && 'Hisobingizga kiring'}
              {mode === 'register' && 'Yangi hisob va Workspace ochish'}
              {mode === 'forgot' && 'Parolni qayta tiklash'}
            </h2>
            <p className="text-xs text-slate-400">
              {mode === 'login' && 'Elektron pochta (yoki username) va parolingizni kiriting.'}
              {mode === 'register' &&
                'Ro‘yxatdan o‘tishingiz bilan shaxsiy Workspace va ilk loyihangiz avtomatik yaratiladi.'}
              {mode === 'forgot' && 'Ro‘yxatdan o‘tgan email manzilingizga tiklash kodi yuboriladi.'}
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-rose-300 text-xs animate-popover">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <div className="flex-1 leading-relaxed">{error}</div>
              <button
                type="button"
                onClick={() => setError(null)}
                className="text-rose-400 hover:text-rose-200"
              >
                ✕
              </button>
            </div>
          )}

          {/* Info Alert */}
          {infoMessage && (
            <div className="mb-4 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2.5 text-emerald-300 text-xs animate-popover">
              <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              <div className="flex-1 leading-relaxed">{infoMessage}</div>
              <button
                type="button"
                onClick={() => setInfoMessage(null)}
                className="text-emerald-400 hover:text-emerald-200"
              >
                ✕
              </button>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* REGISTER-ONLY FIELDS */}
            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    To‘liq ism-sharifingiz <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Masalan: Sardorbek Alimov"
                      className="w-full pl-10 pr-4 py-2.5 bg-[#121622] border border-white/[0.09] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Workspace / Kompaniya
                    </label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        value={workspaceName}
                        onChange={(e) => setWorkspaceName(e.target.value)}
                        placeholder="Acme Studio"
                        className="w-full pl-10 pr-3 py-2.5 bg-[#121622] border border-white/[0.09] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Lavozimingiz
                    </label>
                    <div className="relative">
                      <Briefcase className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        placeholder="Team Lead / Dasturchi"
                        className="w-full pl-10 pr-3 py-2.5 bg-[#121622] border border-white/[0.09] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* EMAIL (ALL MODES) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Email manzili {mode === 'login' && 'yoki foydalanuvchi nomi'}{' '}
                <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type={mode === 'login' ? 'text' : 'email'}
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={mode === 'login' ? 'name@company.uz yoki username' : 'name@company.uz'}
                  className="w-full pl-10 pr-4 py-2.5 bg-[#121622] border border-white/[0.09] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition"
                />
              </div>
            </div>

            {/* PASSWORD (LOGIN & REGISTER) */}
            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Parol <span className="text-rose-400">*</span>
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot');
                        setError(null);
                        setInfoMessage(null);
                      }}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition"
                    >
                      Parolni unutdingizmi?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-10 py-2.5 bg-[#121622] border border-white/[0.09] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3.5 top-3 text-slate-400 hover:text-white transition"
                    title={showPassword ? 'Parolni yashirish' : 'Parolni ko‘rsatish'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {mode === 'register' && (
                  <p className="mt-1 text-[11px] text-slate-500">Kamida 8 ta belgidan iborat bo‘lishi lozim.</p>
                )}
              </div>
            )}

            {/* FORGOT PASSWORD RESET TOKEN & NEW PASSWORD */}
            {mode === 'forgot' && resetToken && (
              <div className="space-y-3.5 p-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/30 animate-popover">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-indigo-300 mb-1">
                    Tasdiqlash Tokeni
                  </label>
                  <input
                    type="text"
                    required
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    className="w-full px-3 py-2 bg-black/40 border border-white/[0.08] rounded-xl text-xs font-mono text-slate-300 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white mb-1.5">
                    Yangi parolni kiriting (kamida 8 ta belgi) <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={newResetPassword}
                      onChange={(e) => setNewResetPassword(e.target.value)}
                      placeholder="Yangi parol..."
                      className="w-full pl-10 pr-10 py-2.5 bg-black/40 border border-indigo-500/60 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((v) => !v)}
                      className="absolute right-3.5 top-3 text-slate-400 hover:text-white transition"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* SUBMIT BUTTON */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition active:scale-[0.99] cursor-pointer"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Tekshirilmoqda...</span>
                </div>
              ) : (
                <>
                  <span>
                    {mode === 'login' && 'Tizimga kirish'}
                    {mode === 'register' && 'Hisob yaratish va Boshlash'}
                    {mode === 'forgot' && (resetToken ? 'Yangi parolni saqlash' : 'Tiklash kodini olish')}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* BOTTOM HELPER SWITCH LINKS */}
            <div className="pt-2 text-center text-xs text-slate-400">
              {mode === 'login' ? (
                <div>
                  Hisobingiz yo‘qmi?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setError(null);
                      setInfoMessage(null);
                    }}
                    className="font-bold text-indigo-400 hover:text-indigo-300 transition"
                  >
                    Ro‘yxatdan o‘tish
                  </button>
                </div>
              ) : mode === 'register' ? (
                <div>
                  Allaqachon hisobingiz bormi?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError(null);
                      setInfoMessage(null);
                    }}
                    className="font-bold text-indigo-400 hover:text-indigo-300 transition"
                  >
                    Kirish
                  </button>
                </div>
              ) : null}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
