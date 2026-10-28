import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Users,
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAppStore } from '../../store/useAppStore';
import type { WorkspaceReportData } from '../../types/flowforge';

export const ReportsAnalyticsView: React.FC = () => {
  const { activeWorkspaceId, openProject } = useAppStore();
  const [data, setData] = useState<WorkspaceReportData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    setLoading(true);
    api
      .getReports(activeWorkspaceId)
      .then((res) => setData(res))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeWorkspaceId]);

  if (loading || !data) {
    return (
      <div className="p-8 text-center text-sm text-slate-400">
        Real ma’lumotlar bazasidan hisobotlar hisoblanmoqda...
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 overflow-y-auto h-full">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
          <BarChart3 className="w-6 h-6 text-indigo-400" />
          <span>Analitika, Loyihalar Holati va Jamoa Yuklamasi (Workload)</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Barcha ko‘rsatkichlar haqiqiy database yozuvlaridan real vaqtda hisoblangan
        </p>
      </div>

      {/* Top Executive Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="text-xs text-slate-400">Jami Vazifalar</div>
          <div className="text-2xl font-bold text-white mt-1">{data.metrics.total_tasks}</div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="text-xs text-slate-400">Faol (Jarayonda)</div>
          <div className="text-2xl font-bold text-indigo-400 mt-1">{data.metrics.active_tasks}</div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="text-xs text-slate-400">Bajarilish Ko‘rsatkichi</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">
            {data.metrics.completion_rate}%
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="text-xs text-slate-400">Kechikkan (Overdue)</div>
          <div className="text-2xl font-bold text-rose-400 mt-1">{data.metrics.overdue_tasks}</div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="text-xs text-slate-400">Qayd etilgan vaqt</div>
          <div className="text-2xl font-bold text-amber-400 mt-1">
            {(data.metrics.total_logged_minutes / 60).toFixed(1)} soat
          </div>
        </div>
      </div>

      {/* Priority & Status Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white">Ustuvorlik Bo‘yicha Taqsimot (By Priority)</h3>
          <div className="space-y-3">
            {[
              { key: 'urgent', label: '🔥 Urgent (Shoshilinch)', color: 'bg-rose-500' },
              { key: 'high', label: '⬆️ High (Yuqori)', color: 'bg-amber-500' },
              { key: 'medium', label: '⏺ Medium (O‘rta)', color: 'bg-indigo-500' },
              { key: 'low', label: '⬇️ Low (Past)', color: 'bg-sky-500' },
              { key: 'none', label: '⚪ None', color: 'bg-slate-600' },
            ].map((row) => {
              const count = data.by_priority[row.key] || 0;
              const pct =
                data.metrics.total_tasks > 0
                  ? Math.round((count / data.metrics.total_tasks) * 100)
                  : 0;
              return (
                <div key={row.key} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">{row.label}</span>
                    <span className="font-mono text-slate-400">
                      {count} ta ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                    <div className={`h-full ${row.color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white">Bosqichlar Bo‘yicha Taqsimot (By Stage)</h3>
          <div className="space-y-3">
            {[
              { key: 'backlog', label: 'Backlog', color: 'bg-slate-500' },
              { key: 'todo', label: 'To Do (Rejada)', color: 'bg-blue-500' },
              { key: 'in_progress', label: 'In Progress (Jarayonda)', color: 'bg-amber-500' },
              { key: 'review', label: 'Code Review / QA', color: 'bg-purple-500' },
              { key: 'done', label: 'Done (Yakunlangan)', color: 'bg-emerald-500' },
            ].map((row) => {
              const count = data.by_category[row.key] || 0;
              const pct =
                data.metrics.total_tasks > 0
                  ? Math.round((count / data.metrics.total_tasks) * 100)
                  : 0;
              return (
                <div key={row.key} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">{row.label}</span>
                    <span className="font-mono text-slate-400">
                      {count} ta ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                    <div className={`h-full ${row.color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Team Workload & Capacity Table */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-bold text-white">
            Jamoa A’zolari Yuklamasi va Samaradorligi (Team Workload & Capacity)
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] uppercase text-slate-400">
                <th className="py-3 px-4">A’zo</th>
                <th className="py-3 px-4">Roli & Holati</th>
                <th className="py-3 px-4">Faol Vazifalar</th>
                <th className="py-3 px-4">Yakunlangan</th>
                <th className="py-3 px-4">Kechikkan</th>
                <th className="py-3 px-4">Story Points</th>
                <th className="py-3 px-4">Sarflangan / Haftalik Quvvat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {data.workload.map((m) => {
                const loggedHours = +(m.logged_minutes / 60).toFixed(1);
                const capPct = Math.min(100, Math.round((loggedHours / m.weekly_capacity_hours) * 100));
                return (
                  <tr key={m.user_id} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4">
                      <div className="font-bold text-white">{m.full_name}</div>
                      <div className="text-[11px] text-slate-400">{m.title_in_workspace}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 mr-2">
                        {m.role}
                      </span>
                      <span className="text-[11px] text-emerald-400">{m.availability_status}</span>
                    </td>
                    <td className="py-3 px-4 font-bold text-indigo-400">{m.active_tasks}</td>
                    <td className="py-3 px-4 font-bold text-emerald-400">{m.completed_tasks}</td>
                    <td className="py-3 px-4 font-bold text-rose-400">{m.overdue_tasks}</td>
                    <td className="py-3 px-4 font-mono text-white">{m.story_points} pts</td>
                    <td className="py-3 px-4 w-56">
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-slate-300">{loggedHours} soat</span>
                        <span className="text-slate-500">/ {m.weekly_capacity_hours} s.</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500" style={{ width: `${capPct}%` }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
