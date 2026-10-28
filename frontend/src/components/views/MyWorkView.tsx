import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  Calendar,
  AlertCircle,
  Clock,
  Eye,
  UserCheck,
  Plus,
  Lock,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAppStore } from '../../store/useAppStore';
import type { Task } from '../../types/flowforge';

export const MyWorkView: React.FC = () => {
  const { activeWorkspaceId, openTaskDrawer, openModal } = useAppStore();
  const [scope, setScope] = useState<'assigned' | 'created' | 'watching'>('assigned');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    setLoading(true);
    api
      .getMyTasks(activeWorkspaceId, scope)
      .then((res) => setTasks(res.tasks || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeWorkspaceId, scope]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const nextWeekStr = new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10);

  const activeTasks = tasks.filter((t) => !t.completed_at);
  const completedTasks = tasks.filter((t) => !!t.completed_at);

  const overdue = activeTasks.filter((t) => t.due_at && t.due_at.slice(0, 10) < todayStr);
  const dueToday = activeTasks.filter((t) => t.due_at && t.due_at.slice(0, 10) === todayStr);
  const upcoming = activeTasks.filter(
    (t) => t.due_at && t.due_at.slice(0, 10) > todayStr && t.due_at.slice(0, 10) <= nextWeekStr
  );
  const laterOrUnscheduled = activeTasks.filter(
    (t) => !t.due_at || t.due_at.slice(0, 10) > nextWeekStr
  );

  const renderSection = (title: string, badgeColor: string, list: Task[]) => (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden">
      <div className="px-5 py-3 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${badgeColor}`} />
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">{title}</h3>
        </div>
        <span className="text-xs font-mono text-slate-400">{list.length} ta vazifa</span>
      </div>

      <div className="divide-y divide-slate-800/70">
        {list.map((t) => (
          <div
            key={t.id}
            onClick={() => openTaskDrawer(t.id)}
            className="px-5 py-3 hover:bg-slate-800/60 flex flex-wrap items-center justify-between gap-3 cursor-pointer transition"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xs font-mono font-bold text-indigo-400 shrink-0">
                {t.task_key}
              </span>
              <span className="text-xs font-medium text-white truncate">{t.title}</span>
              {t.unresolved_blockers_count > 0 && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-semibold">
                  <Lock className="w-2.5 h-2.5" /> Blocked
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5 text-xs shrink-0">
              {t.project && (
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px]">
                  {t.project.name}
                </span>
              )}
              {t.due_at && (
                <span className="text-[11px] font-mono text-slate-400">
                  📅 {t.due_at.slice(0, 10)}
                </span>
              )}
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
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
                  className="text-[10px] px-2.5 py-0.5 rounded-full font-semibold"
                  style={{ backgroundColor: `${t.status.color}30`, color: t.status.color }}
                >
                  {t.status.name}
                </span>
              )}
            </div>
          </div>
        ))}
        {list.length === 0 && (
          <div className="py-5 text-center text-xs text-slate-500">Ushbu guruhda vazifalar yo‘q.</div>
        )}
      </div>
    </div>
  );

  return (
    <div className="p-6 lg:p-8 space-y-6 overflow-y-auto h-full">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <CheckSquare className="w-6 h-6 text-indigo-400" />
            <span>Mening Ishim (My Work & Shaxsiy Kun Tartibi)</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Workspace ichidagi barcha loyihalardan sizga tegishli vazifalarning yagona markazi
          </p>
        </div>

        <button
          onClick={() => openModal('create_task')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white"
        >
          <Plus className="w-4 h-4" />
          <span>Yangi Vazifa</span>
        </button>
      </div>

      {/* Scope Switcher */}
      <div className="flex gap-2">
        {[
          { id: 'assigned', label: 'Menga Biriktirilgan (Assigned to Me)', icon: UserCheck },
          { id: 'created', label: 'Men Yaratgan (Created by Me)', icon: Clock },
          { id: 'watching', label: 'Men Kuzatayotgan (Watching)', icon: Eye },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setScope(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
                scope === tab.id
                  ? 'bg-indigo-600 text-white shadow'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-slate-400">Yuklanmoqda...</div>
      ) : (
        <div className="space-y-5">
          {renderSection('🔥 Muddati O‘tgan (Overdue)', 'bg-rose-500', overdue)}
          {renderSection('⚡ Bugun Bajarilishi Kerak (Due Today)', 'bg-amber-500', dueToday)}
          {renderSection('📅 Kelasi 7 Kun Ichida (Upcoming)', 'bg-indigo-500', upcoming)}
          {renderSection('🗂 Keyingi / Muddati Belgilanmagan', 'bg-slate-500', laterOrUnscheduled)}
          {renderSection('✅ Yakunlangan (Completed)', 'bg-emerald-500', completedTasks)}
        </div>
      )}
    </div>
  );
};
