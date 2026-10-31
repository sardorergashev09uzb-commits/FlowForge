import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Rocket,
  ArrowUpRight,
  Plus,
  MailCheck,
  Activity,
  FileText,
  Layers,
  Flame,
  Kanban,
  GitMerge,
  Calendar,
  TrendingUp,
  Users,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAppStore } from '../../store/useAppStore';
import type {
  HierarchyTree,
  WorkspaceReportData,
  ActivityItem,
  TimeEntry,
} from '../../types/flowforge';

interface PulseDashboardViewProps {
  mode: 'pulse' | 'docs' | 'timesheets';
  hierarchy: HierarchyTree | null;
  onRefreshAll: () => void;
}

export const PulseDashboardView: React.FC<PulseDashboardViewProps> = ({
  mode,
  hierarchy,
  onRefreshAll,
}) => {
  const {
    user,
    workspaces,
    activeWorkspaceId,
    pendingInvitations,
    openProject,
    openTaskDrawer,
    openModal,
    navigateRail,
    addToast,
  } = useAppStore();

  const [report, setReport] = useState<WorkspaceReportData | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [myTasks, setMyTasks] = useState<any[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [inviteCodeInput, setInviteCodeInput] = useState('');

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    Promise.all([
      api.getReports(activeWorkspaceId),
      api.getWorkspaceActivity(activeWorkspaceId),
      api.getMyTasks(activeWorkspaceId, 'assigned'),
      api.getWorkspaceTimeEntries(activeWorkspaceId),
    ])
      .then(([repRes, actRes, myRes, timeRes]) => {
        setReport(repRes);
        setActivities(actRes.activities || []);
        setMyTasks(myRes.tasks || []);
        setTimeEntries(timeRes.time_entries || []);
      })
      .catch(() => {});
  }, [activeWorkspaceId, mode]);

  const handleAcceptInvite = async (code: string) => {
    try {
      await api.acceptInvitation(code);
      addToast({ type: 'success', title: 'Taklifnoma qabul qilindi!' });
      setInviteCodeInput('');
      onRefreshAll();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Taklifnoma xatoligi', message: err.message });
    }
  };

  if (mode === 'docs') {
    return (
      <div className="p-6 lg:p-8 space-y-6 overflow-y-auto h-full">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-white flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <FileText className="w-5 h-5" />
              </div>
              <span>Workspace Bilimlar Bazasi (Docs & Wiki Hub)</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Barcha loyihalardagi texnik topshiriqlar (PRD), arxitektura standartlari va jamoa qoidalari
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {hierarchy?.all_projects.map((proj) => (
            <div
              key={proj.id}
              onClick={() => openProject(proj.id, 'docs')}
              className="p-5 rounded-2xl bg-[#111520] hover:bg-[#161b2a] border border-white/[0.08] hover:border-indigo-500/50 cursor-pointer transition-all duration-200 group shadow-lg"
            >
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white shadow"
                    style={{ backgroundColor: proj.color || '#6366f1' }}
                  >
                    {proj.project_key}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white group-hover:text-indigo-300 transition">
                      {proj.name}
                    </div>
                    <div className="text-[10px] text-slate-400 uppercase font-medium">
                      Wiki & Texnik hujjatlar
                    </div>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition" />
              </div>
              <p className="text-xs text-slate-400 line-clamp-2 mb-4 leading-relaxed">
                {proj.description ||
                  'Loyiha hujjatlari va Wiki sahifalarini ko‘rish hamda tahrirlash uchun bosing.'}
              </p>
              <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-indigo-400 font-semibold">
                <span>Hujjatlar muharririni ochish</span>
                <span>➔</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (mode === 'timesheets') {
    const totalMins = timeEntries.reduce((acc, t) => acc + t.duration_minutes, 0);
    return (
      <div className="p-6 lg:p-8 space-y-6 overflow-y-auto h-full">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-white flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Clock className="w-5 h-5" />
              </div>
              <span>Vaqt Hisobi va Tabel (Time Sheets)</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Workspace bo‘yicha qayd etilgan barcha ish soatlari va vazifalar kesimidagi sarflar
            </p>
          </div>
          <div className="px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-500/15 to-teal-500/10 border border-emerald-500/30 text-right">
            <div className="text-[11px] text-emerald-300 font-medium">Jami qayd etilgan vaqt</div>
            <div className="text-xl font-extrabold text-white">
              {(totalMins / 60).toFixed(1)} soat{' '}
              <span className="text-xs font-normal text-slate-400">({totalMins} daqiqa)</span>
            </div>
          </div>
        </div>

        <div className="bg-[#111520] border border-white/[0.08] rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/[0.07] text-[11px] uppercase tracking-wider text-slate-400 bg-white/[0.02]">
                <th className="py-3.5 px-4">Sana</th>
                <th className="py-3.5 px-4">Xodim</th>
                <th className="py-3.5 px-4">Loyiha & Vazifa</th>
                <th className="py-3.5 px-4">Bajarilgan ish tavsifi</th>
                <th className="py-3.5 px-4 text-right">Davomiyligi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05] text-xs">
              {timeEntries.map((te) => (
                <tr
                  key={te.id}
                  onClick={() => openTaskDrawer(te.task_id)}
                  className="hover:bg-white/[0.04] cursor-pointer transition"
                >
                  <td className="py-3.5 px-4 font-mono text-slate-400">{te.logged_date}</td>
                  <td className="py-3.5 px-4 font-semibold text-white">
                    {te.user?.full_name || 'A’zo'}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-mono font-bold text-indigo-400 mr-2">{te.task_key}</span>
                    <span className="text-slate-200">{te.task_title}</span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-300">{te.description}</td>
                  <td className="py-3.5 px-4 text-right font-bold text-emerald-400">
                    {te.duration_minutes} daq. ({(te.duration_minutes / 60).toFixed(1)} s.)
                  </td>
                </tr>
              ))}
              {timeEntries.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500">
                    Hozircha vaqt qaydlari kiritilmagan. Istalgan vazifani ochib sekundomerni yoqing!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 overflow-y-auto h-full">
      {/* Studio Hero Banner */}
      <div className="relative rounded-3xl bg-gradient-to-r from-[#131829] via-[#151a2d] to-[#111522] border border-white/[0.09] p-6 lg:p-7 overflow-hidden shadow-2xl">
        <div className="absolute -right-12 -top-12 w-64 h-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-[11px] font-semibold text-indigo-300">
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {activeWorkspace?.name} • Rol: {activeWorkspace?.my_role.toUpperCase()}
              </span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
              Xush kelibsiz, {user?.profile?.full_name}!
            </h1>
            <p className="text-xs text-slate-400">
              Loyihalar portfeli, bugungi ustuvor vazifalar va jamoa faoliyati boshqaruv studiyasi
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => navigateRail('reports')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.09] text-xs font-semibold text-slate-200 transition"
            >
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>Analitika</span>
            </button>
            <button
              onClick={() => openModal('create_project')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.09] text-xs font-semibold text-slate-200 transition"
            >
              <Rocket className="w-4 h-4 text-indigo-400" />
              <span>Yangi Loyiha</span>
            </button>
            <button
              onClick={() => openModal('create_task')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Yangi Vazifa</span>
            </button>
          </div>
        </div>
      </div>

      {/* Pending Invitations Banner */}
      {pendingInvitations.length > 0 && (
        <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/40 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <MailCheck className="w-5 h-5 text-indigo-400" />
            <div>
              <div className="text-sm font-bold text-white">
                Sizda yangi Workspace taklifnomasi bor!
              </div>
              <div className="text-xs text-slate-300">
                {pendingInvitations[0].workspace_name} jamoasiga ({pendingInvitations[0].role})
                sifatida taklif qilindingiz.
              </div>
            </div>
          </div>
          <button
            onClick={() => handleAcceptInvite(pendingInvitations[0].invite_code)}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white"
          >
            Taklifni qabul qilish
          </button>
        </div>
      )}

      {/* 4 High-Craft KPI Cards */}
      {report && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-[#111520] border border-white/[0.08] flex items-start justify-between shadow-lg">
            <div>
              <div className="text-xs font-medium text-slate-400">Faol Vazifalar</div>
              <div className="text-3xl font-extrabold text-white mt-1.5">
                {report.metrics.active_tasks}
              </div>
              <div className="text-[11px] text-indigo-400 font-medium mt-2">
                {report.metrics.in_progress_tasks} tasi ayni damda jarayonda
              </div>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Layers className="w-5 h-5" />
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[#111520] border border-white/[0.08] flex items-start justify-between shadow-lg">
            <div className="flex-1 pr-3">
              <div className="text-xs font-medium text-slate-400">Bajarilish Ko‘rsatkichi</div>
              <div className="text-3xl font-extrabold text-emerald-400 mt-1.5">
                {report.metrics.completion_rate}%
              </div>
              <div className="w-full h-1.5 bg-slate-950 rounded-full mt-2.5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                  style={{ width: `${report.metrics.completion_rate}%` }}
                />
              </div>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[#111520] border border-white/[0.08] flex items-start justify-between shadow-lg">
            <div>
              <div className="text-xs font-medium text-slate-400">Muddati O‘tgan / Xavfli</div>
              <div className="text-3xl font-extrabold text-rose-400 mt-1.5">
                {report.metrics.overdue_tasks}
              </div>
              <div className="text-[11px] text-slate-400 mt-2">
                Kelasi 7 kunda muddati: <b className="text-white">{report.metrics.upcoming_deadlines}</b> ta
              </div>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[#111520] border border-white/[0.08] flex items-start justify-between shadow-lg">
            <div>
              <div className="text-xs font-medium text-slate-400">Ish Vaqti Balansi</div>
              <div className="text-3xl font-extrabold text-white mt-1.5">
                {(report.metrics.total_logged_minutes / 60).toFixed(1)}
                <span className="text-sm font-normal text-slate-400 ml-1">soat</span>
              </div>
              <div className="text-[11px] text-amber-400 font-medium mt-2">
                Reja: {(report.metrics.total_estimated_minutes / 60).toFixed(1)} soat
              </div>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </div>
      )}

      {/* Project Portfolio Studio Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">
              Faol Loyihalar Portfeli ({report?.projects.length || 0})
            </h2>
            <p className="text-xs text-slate-400">
              Istalgan loyiha ustiga bosib uning Kanban, Gantt Timeline yoki Kalendar oynasiga kiring
            </p>
          </div>
          <button
            onClick={() => openModal('create_project')}
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300"
          >
            + Yangi loyiha ochish
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {report?.projects.map((p) => (
            <div
              key={p.id}
              onClick={() => openProject(p.id, 'board')}
              className="p-5 rounded-2xl bg-[#111520] hover:bg-[#151a28] border border-white/[0.08] hover:border-indigo-500/40 cursor-pointer transition-all duration-200 flex flex-col justify-between gap-4 shadow-lg group"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-extrabold text-white shadow-md shrink-0"
                      style={{ backgroundColor: p.color }}
                    >
                      {p.project_key}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-white group-hover:text-indigo-300 truncate transition">
                        {p.name}
                      </h3>
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        {p.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  <span className="text-xs font-mono font-bold text-white bg-white/[0.06] px-2.5 py-1 rounded-lg">
                    {p.progress_percent}%
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${p.progress_percent}%`,
                        backgroundColor: p.color || '#6366f1',
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>
                      Bajarildi: <b className="text-slate-200">{p.completed_tasks}</b> /{' '}
                      {p.total_tasks} vazifa
                    </span>
                    {p.due_date && <span className="font-mono">Muddat: {p.due_date}</span>}
                  </div>
                </div>
              </div>

              {/* Quick Sub-view Jump Buttons */}
              <div
                onClick={(e) => e.stopPropagation()}
                className="pt-3 border-t border-white/[0.06] flex items-center justify-between gap-1.5"
              >
                <button
                  onClick={() => openProject(p.id, 'board')}
                  className="flex-1 py-1.5 px-2 rounded-lg bg-white/[0.04] hover:bg-indigo-600/20 hover:text-indigo-300 text-[11px] font-medium text-slate-300 flex items-center justify-center gap-1 transition"
                >
                  <Kanban className="w-3 h-3" /> Kanban
                </button>
                <button
                  onClick={() => openProject(p.id, 'timeline')}
                  className="flex-1 py-1.5 px-2 rounded-lg bg-white/[0.04] hover:bg-indigo-600/20 hover:text-indigo-300 text-[11px] font-medium text-slate-300 flex items-center justify-center gap-1 transition"
                >
                  <GitMerge className="w-3 h-3" /> Timeline
                </button>
                <button
                  onClick={() => openProject(p.id, 'calendar')}
                  className="flex-1 py-1.5 px-2 rounded-lg bg-white/[0.04] hover:bg-indigo-600/20 hover:text-indigo-300 text-[11px] font-medium text-slate-300 flex items-center justify-center gap-1 transition"
                >
                  <Calendar className="w-3 h-3" /> Kalendar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Two-Column Grid: My Focus Tasks & Live Activity Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 cols: My Focus Tasks */}
        <div className="lg:col-span-7 p-5 rounded-2xl bg-[#111520] border border-white/[0.08] space-y-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Flame className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">
                  Mening Diqqat Markazimdagi Vazifalar (
                  {myTasks.filter((t) => !t.completed_at).length})
                </h2>
                <p className="text-[11px] text-slate-400">
                  Sizga biriktirilgan va bajarilishi kutilayotgan vazifalar
                </p>
              </div>
            </div>
            <button
              onClick={() => navigateRail('my_work')}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
            >
              Barchasi ➔
            </button>
          </div>

          <div className="space-y-2">
            {myTasks
              .filter((t) => !t.completed_at)
              .slice(0, 7)
              .map((t) => (
                <div
                  key={t.id}
                  onClick={() => openTaskDrawer(t.id)}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-[#0c0f17] hover:bg-white/[0.04] border border-white/[0.06] hover:border-indigo-500/40 cursor-pointer transition group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="px-2 py-0.5 rounded bg-indigo-500/15 border border-indigo-500/30 text-[11px] font-mono font-bold text-indigo-300 shrink-0">
                      {t.task_key}
                    </span>
                    <span className="text-xs font-semibold text-slate-200 group-hover:text-white truncate">
                      {t.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {t.due_at && (
                      <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
                        {t.due_at.slice(5, 10)}
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        t.priority === 'urgent'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : t.priority === 'high'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-white/[0.06] text-slate-300'
                      }`}
                    >
                      {t.priority}
                    </span>
                    {t.status && (
                      <span
                        className="text-[10px] px-2 py-0.5 rounded font-semibold"
                        style={{
                          backgroundColor: `${t.status.color}25`,
                          color: t.status.color,
                        }}
                      >
                        {t.status.name}
                      </span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Right 5 cols: Live Activity Stream & Invite Box */}
        <div className="lg:col-span-5 space-y-5">
          {/* Live Activity Feed */}
          <div className="p-5 rounded-2xl bg-[#111520] border border-white/[0.08] space-y-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Jonli Jamoa Faoliyati</h2>
                  <p className="text-[11px] text-slate-400">So‘nggi o‘zgarishlar va harakatlar</p>
                </div>
              </div>
            </div>

            <div className="space-y-3 max-h-[310px] overflow-y-auto pr-1">
              {activities.slice(0, 10).map((act) => (
                <div
                  key={act.id}
                  onClick={() => act.task_id && openTaskDrawer(act.task_id)}
                  className={`p-3 rounded-xl bg-[#0c0f17] border border-white/[0.06] text-xs flex items-start gap-3 ${
                    act.task_id ? 'cursor-pointer hover:border-indigo-500/40' : ''
                  }`}
                >
                  <div className="w-7 h-7 rounded-full bg-indigo-600/25 border border-indigo-500/40 flex items-center justify-center text-[10px] font-bold text-indigo-200 shrink-0 mt-0.5">
                    {(act.actor?.full_name || 'U')
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="font-semibold text-white truncate">
                        {act.actor?.full_name || 'Foydalanuvchi'}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 shrink-0">
                        {act.created_at.slice(11, 16)}
                      </span>
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">{act.summary}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Accept Invitation by Code */}
          <div className="p-4 rounded-2xl bg-[#111520] border border-white/[0.08] space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
              <Users className="w-3.5 h-3.5 text-indigo-400" />
              <span>Taklifnoma kodi orqali jamoaga qo‘shilish</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={inviteCodeInput}
                onChange={(e) => setInviteCodeInput(e.target.value)}
                placeholder="Kod: FF-INV-..."
                className="flex-1 px-3 py-2 rounded-xl bg-[#0c0f17] border border-white/[0.08] text-xs font-mono text-white"
              />
              <button
                onClick={() => inviteCodeInput && handleAcceptInvite(inviteCodeInput)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white"
              >
                Qo‘shilish
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
