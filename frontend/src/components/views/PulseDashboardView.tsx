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
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAppStore } from '../../store/useAppStore';
import type { HierarchyTree, WorkspaceReportData, ActivityItem, TimeEntry } from '../../types/flowforge';

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
  const [loading, setLoading] = useState(false);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    setLoading(true);
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
      .catch(() => {})
      .finally(() => setLoading(false));
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
              <FileText className="w-6 h-6 text-indigo-400" />
              <span>Workspace Bilimlar Bazasi (Docs & Wiki Hub)</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Barcha loyihalardagi texnik topshiriqlar (PRD), arxitektura standartlari va jamoa qoidalari
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {hierarchy?.all_projects.map((proj) => (
            <div
              key={proj.id}
              onClick={() => openProject(proj.id, 'docs')}
              className="p-5 rounded-2xl bg-slate-900/90 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-500/40 cursor-pointer transition group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: proj.color || '#6366f1' }}
                  />
                  <span className="text-sm font-bold text-white group-hover:text-indigo-300">
                    {proj.name}
                  </span>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                  {proj.project_key}
                </span>
              </div>
              <p className="text-xs text-slate-400 line-clamp-2 mb-4">
                {proj.description || 'Loyiha hujjatlari va Wiki sahifalarini ko‘rish hamda tahrirlash uchun bosing.'}
              </p>
              <div className="flex items-center justify-between text-xs text-indigo-400 font-medium">
                <span>Wiki sahifalarini ochish</span>
                <ArrowUpRight className="w-4 h-4" />
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
            <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
              <Clock className="w-6 h-6 text-emerald-400" />
              <span>Vaqt Hisobi va Tabel (Time Sheets)</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Workspace bo‘yicha qayd etilgan barcha ish soatlari va vazifalar kesimidagi sarflar
            </p>
          </div>
          <div className="px-4 py-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-right">
            <div className="text-[11px] text-emerald-300">Jami qayd etilgan vaqt</div>
            <div className="text-lg font-bold text-white">
              {(totalMins / 60).toFixed(1)} soat ({totalMins} daqiqa)
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 bg-slate-950/60">
                <th className="py-3 px-4">Sana</th>
                <th className="py-3 px-4">Xodim</th>
                <th className="py-3 px-4">Loyiha & Vazifa</th>
                <th className="py-3 px-4">Bajarilgan ish tavsifi</th>
                <th className="py-3 px-4 text-right">Davomiyligi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-xs">
              {timeEntries.map((te) => (
                <tr
                  key={te.id}
                  onClick={() => openTaskDrawer(te.task_id)}
                  className="hover:bg-slate-800/50 cursor-pointer transition"
                >
                  <td className="py-3 px-4 font-mono text-slate-400">{te.logged_date}</td>
                  <td className="py-3 px-4 font-medium text-white">
                    {te.user?.full_name || 'A’zo'}
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-mono font-bold text-indigo-400 mr-2">{te.task_key}</span>
                    <span className="text-slate-200">{te.task_title}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-300">{te.description}</td>
                  <td className="py-3 px-4 text-right font-semibold text-emerald-400">
                    {te.duration_minutes} daq. ({(te.duration_minutes / 60).toFixed(1)} s.)
                  </td>
                </tr>
              ))}
              {timeEntries.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
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
      {/* Top Greeting & Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-indigo-400 font-semibold mb-1">
            <Sparkles className="w-4 h-4" />
            <span>
              {activeWorkspace?.name} · Rolingiz: {activeWorkspace?.my_role.toUpperCase()}
            </span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white">
            Xayrli kun, {user?.profile?.full_name}!
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Joriy ish holatingiz:{' '}
            <span className="text-slate-200 font-medium">
              {user?.profile?.availability_status?.toUpperCase()}
            </span>
            {user?.profile?.availability_note ? ` — "${user.profile.availability_note}"` : ''}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => openModal('create_project')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 transition"
          >
            <Rocket className="w-4 h-4 text-indigo-400" />
            <span>Yangi Loyiha</span>
          </button>
          <button
            onClick={() => openModal('create_task')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-lg shadow-indigo-600/25 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Yangi Vazifa</span>
          </button>
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
                {pendingInvitations[0].workspace_name} jamoasiga ({pendingInvitations[0].role}) sifatida taklif qilindingiz.
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

      {/* KPI Metrics Row */}
      {report && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span>Faol vazifalar</span>
              <Layers className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-bold text-white">{report.metrics.active_tasks}</div>
            <div className="text-[11px] text-slate-500 mt-1">
              Jami {report.metrics.total_tasks} tadan ({report.metrics.in_progress_tasks} tasi jarayonda)
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span>Yakunlangan (Done)</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400">
              {report.metrics.completed_tasks}{' '}
              <span className="text-sm font-normal text-slate-400">
                ({report.metrics.completion_rate}%)
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${report.metrics.completion_rate}%` }}
              />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span>Kechikkan (Overdue)</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-bold text-rose-400">{report.metrics.overdue_tasks}</div>
            <div className="text-[11px] text-slate-500 mt-1">
              Kelasi 7 kunda muddati: {report.metrics.upcoming_deadlines} ta
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span>Sarflangan Ish Vaqti</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-white">
              {(report.metrics.total_logged_minutes / 60).toFixed(1)} s.
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Reja: {(report.metrics.total_estimated_minutes / 60).toFixed(1)} soat
            </div>
          </div>
        </div>
      )}

      {/* Main Two-Column Grid: My Focus Tasks & Active Projects */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 cols: My Focus Tasks & Projects */}
        <div className="lg:col-span-7 space-y-6">
          {/* My Assigned Tasks */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-bold text-white">
                  Menga Biriktirilgan Muhim Vazifalar ({myTasks.filter((t) => !t.completed_at).length})
                </h2>
              </div>
              <button
                onClick={() => navigateRail('my_work')}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
              >
                Barchasini ko‘rish ➔
              </button>
            </div>

            <div className="space-y-2">
              {myTasks
                .filter((t) => !t.completed_at)
                .slice(0, 6)
                .map((t) => (
                  <div
                    key={t.id}
                    onClick={() => openTaskDrawer(t.id)}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800/80 cursor-pointer transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-mono font-bold text-indigo-400 shrink-0">
                        {t.task_key}
                      </span>
                      <span className="text-xs font-medium text-slate-200 truncate">{t.title}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded uppercase ${
                          t.priority === 'urgent'
                            ? 'bg-rose-500/20 text-rose-300'
                            : t.priority === 'high'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {t.priority}
                      </span>
                      {t.status && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded font-medium text-white"
                          style={{ backgroundColor: `${t.status.color}33`, color: t.status.color }}
                        >
                          {t.status.name}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Projects Health Overview */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Loyihalar Holati (Project Portfolio)</h2>
              <button
                onClick={() => openModal('create_project')}
                className="text-xs text-indigo-400 hover:text-indigo-300"
              >
                + Loyiha qo‘shish
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {report?.projects.map((p) => (
                <div
                  key={p.id}
                  onClick={() => openProject(p.id, 'board')}
                  className="p-4 rounded-xl bg-slate-950/70 hover:bg-slate-800/70 border border-slate-800 cursor-pointer transition"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: p.color }}
                      />
                      <span className="text-xs font-bold text-white">{p.name}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">{p.project_key}</span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                    <span>
                      Bajarildi: {p.completed_tasks}/{p.total_tasks}
                    </span>
                    <span className="font-semibold text-emerald-400">{p.progress_percent}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500"
                      style={{ width: `${p.progress_percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 5 cols: Invite Code Box & Live Activity Stream */}
        <div className="lg:col-span-5 space-y-6">
          {/* Accept Invitation by Code */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Taklifnoma Kodi Orqali Qo‘shilish
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={inviteCodeInput}
                onChange={(e) => setInviteCodeInput(e.target.value)}
                placeholder="Masalan: FF-INV-DEVOPS2026"
                className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white"
              />
              <button
                onClick={() => inviteCodeInput && handleAcceptInvite(inviteCodeInput)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white"
              >
                Qo‘shilish
              </button>
            </div>
          </div>

          {/* Live Activity Feed */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-400" />
              <h2 className="text-sm font-bold text-white">So‘nggi Faoliyat Tarixi (Activity Stream)</h2>
            </div>

            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {activities.slice(0, 12).map((act) => (
                <div
                  key={act.id}
                  onClick={() => act.task_id && openTaskDrawer(act.task_id)}
                  className={`p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs ${
                    act.task_id ? 'cursor-pointer hover:border-slate-700' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-indigo-300">
                      {act.actor?.full_name || 'Foydalanuvchi'}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {act.created_at.slice(0, 16).replace('T', ' ')}
                    </span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">{act.summary}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
