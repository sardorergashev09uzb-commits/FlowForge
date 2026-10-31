import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  GitBranch,
  CheckSquare,
  MessageSquare,
  Lock,
  Star,
  Calendar as CalendarIcon,
  FileText,
  Trash2,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Flag,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Archive,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAppStore } from '../../store/useAppStore';
import type { Project, Task, WorkspaceMember, Label, ProjectDoc } from '../../types/flowforge';

interface ProjectWorkspaceViewProps {
  projectId: number;
  members: WorkspaceMember[];
  labels: Label[];
  refreshTrigger: number;
  onRefreshHierarchy: () => void;
}

export const ProjectWorkspaceView: React.FC<ProjectWorkspaceViewProps> = ({
  projectId,
  members,
  labels,
  refreshTrigger,
  onRefreshHierarchy,
}) => {
  const {
    activeWorkspaceId,
    projectTab,
    setProjectTab,
    openTaskDrawer,
    openModal,
    addToast,
    navigateRail,
  } = useAppStore();

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [searchQ, setSearchQ] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterSprint, setFilterSprint] = useState('');
  const [filterLabel, setFilterLabel] = useState('');
  const [swimlaneBy, setSwimlaneBy] = useState<'none' | 'priority' | 'assignee'>('none');

  // Kanban Drag-and-Drop state
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
  const [dragOverStatusId, setDragOverStatusId] = useState<number | null>(null);
  const [quickAddStatusId, setQuickAddStatusId] = useState<number | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState('');

  // Calendar Month navigation & Drag state
  const [calendarMonthOffset, setCalendarMonthOffset] = useState(0);
  const [calendarDragTaskId, setCalendarDragTaskId] = useState<number | null>(null);

  // List View Bulk selection
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);

  // Docs state
  const [activeDoc, setActiveDoc] = useState<ProjectDoc | null>(null);
  const [docTitleEdit, setDocTitleEdit] = useState('');
  const [docContentEdit, setDocContentEdit] = useState('');
  const [newDocTitle, setNewDocTitle] = useState('');

  // Sprint creation state
  const [newSprintName, setNewSprintName] = useState('');
  const [newSprintGoal, setNewSprintGoal] = useState('');
  const [newSprintStart, setNewSprintStart] = useState('');
  const [newSprintEnd, setNewSprintEnd] = useState('');

  // Project Settings & Custom Status creation/editing
  const [projNameEdit, setProjNameEdit] = useState('');
  const [projDescEdit, setProjDescEdit] = useState('');
  const [projStatusEdit, setProjStatusEdit] = useState('on_track');
  const [projColorEdit, setProjColorEdit] = useState('#6366f1');
  const [projStartEdit, setProjStartEdit] = useState('');
  const [projDueEdit, setProjDueEdit] = useState('');

  const [newStatusName, setNewStatusName] = useState('');
  const [newStatusCategory, setNewStatusCategory] = useState('in_progress');
  const [newStatusColor, setNewStatusColor] = useState('#6366f1');
  const [newStatusWip, setNewStatusWip] = useState('');

  const [editingStatusId, setEditingStatusId] = useState<number | null>(null);
  const [editStatusName, setEditStatusName] = useState('');
  const [editStatusColor, setEditStatusColor] = useState('#6366f1');
  const [editStatusCategory, setEditStatusCategory] = useState('todo');
  const [editStatusWip, setEditStatusWip] = useState('');

  const loadProjectAndTasks = async () => {
    setLoading(true);
    try {
      const [projRes, tasksRes] = await Promise.all([
        api.getProject(projectId),
        api.getProjectTasks(projectId, {
          q: searchQ || undefined,
          priority: filterPriority || undefined,
          assignee_id: filterAssignee || undefined,
          sprint_id: filterSprint || undefined,
          label_id: filterLabel || undefined,
        }),
      ]);
      const p: Project = projRes.project;
      setProject(p);
      setTasks(tasksRes.tasks || []);

      setProjNameEdit(p.name);
      setProjDescEdit(p.description || '');
      setProjStatusEdit(p.status);
      setProjColorEdit(p.color || '#6366f1');
      setProjStartEdit(p.start_date || '');
      setProjDueEdit(p.due_date || '');

      if (p.docs && p.docs.length > 0) {
        const currentDoc = p.docs.find((d) => d.id === activeDoc?.id) || p.docs[0];
        setActiveDoc(currentDoc);
        setDocTitleEdit(currentDoc.title);
        setDocContentEdit(currentDoc.content_md || '');
      } else {
        setActiveDoc(null);
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Loyihani yuklashda xatolik', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedTaskIds([]);
    loadProjectAndTasks();
  }, [projectId, searchQ, filterPriority, filterAssignee, filterSprint, filterLabel, refreshTrigger]);

  if (!project) {
    return (
      <div className="p-8 text-center text-sm text-slate-400">
        {loading ? 'Loyiha ma’lumotlari yuklanmoqda...' : 'Loyiha topilmadi.'}
      </div>
    );
  }

  const statuses = project.statuses || [];

  // Kanban Drag & Drop handlers with optimistic UI + server persistence + optional swimlane attribute update
  const handleDropOnColumn = async (
    targetStatusId: number,
    beforeTaskId?: number | null,
    swimlaneExtra?: { priority?: string; assignee_id?: number | null }
  ) => {
    if (!draggedTaskId) return;
    const movingTask = tasks.find((t) => t.id === draggedTaskId);
    setDraggedTaskId(null);
    setDragOverStatusId(null);
    if (!movingTask) return;

    const prevTasks = [...tasks];
    const targetStatusObj = statuses.find((s) => s.id === targetStatusId) || movingTask.status;
    setTasks((curr) =>
      curr.map((t) =>
        t.id === movingTask.id
          ? {
              ...t,
              status_id: targetStatusId,
              status: targetStatusObj || null,
              ...(swimlaneExtra?.priority ? { priority: swimlaneExtra.priority as any } : {}),
              ...(swimlaneExtra?.assignee_id !== undefined
                ? { assignee_id: swimlaneExtra.assignee_id }
                : {}),
            }
          : t
      )
    );

    try {
      await api.moveTask(movingTask.id, {
        status_id: targetStatusId,
        before_task_id: beforeTaskId || null,
      });
      if (
        swimlaneExtra &&
        ((swimlaneExtra.priority && swimlaneExtra.priority !== movingTask.priority) ||
          (swimlaneExtra.assignee_id !== undefined &&
            swimlaneExtra.assignee_id !== movingTask.assignee_id))
      ) {
        await api.updateTask(movingTask.id, swimlaneExtra);
      }
      await loadProjectAndTasks();
      onRefreshHierarchy();
    } catch (err: any) {
      setTasks(prevTasks);
      addToast({ type: 'error', title: 'Ko‘chirish rad etildi', message: err.message });
    }
  };

  const handleQuickCreateCard = async (statusId: number) => {
    if (!quickAddTitle.trim()) return;
    try {
      const res = await api.createTask(project.id, {
        title: quickAddTitle.trim(),
        status_id: statusId,
        priority: 'medium',
      });
      setQuickAddTitle('');
      setQuickAddStatusId(null);
      await loadProjectAndTasks();
      onRefreshHierarchy();
      addToast({ type: 'success', title: `${res.task.task_key} yaratildi` });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Xatolik', message: err.message });
    }
  };

  const handleBulkAction = async (action: string, value?: any) => {
    if (!activeWorkspaceId || selectedTaskIds.length === 0) return;
    try {
      await api.bulkUpdateTasks(activeWorkspaceId, {
        task_ids: selectedTaskIds,
        action,
        value,
      });
      setSelectedTaskIds([]);
      await loadProjectAndTasks();
      onRefreshHierarchy();
      addToast({ type: 'success', title: 'Ommaviy amal bajarildi' });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Xatolik', message: err.message });
    }
  };

  const renderPriorityBadge = (prio: string) => {
    const colors: Record<string, string> = {
      urgent: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
      high: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      medium: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
      low: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
      none: 'bg-slate-800 text-slate-400 border-slate-700',
    };
    return (
      <span
        className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${
          colors[prio] || colors.medium
        }`}
      >
        {prio}
      </span>
    );
  };

  const renderKanbanCard = (
    task: Task,
    statusId: number,
    swimlaneExtra?: { priority?: string; assignee_id?: number | null }
  ) => {
    const isOverdue =
      !task.completed_at &&
      task.due_at &&
      task.due_at.slice(0, 10) < new Date().toISOString().slice(0, 10);

    const totalChecks = task.subtasks_summary.total + task.checklists_summary.total;
    const doneChecks = task.subtasks_summary.done + task.checklists_summary.done;
    const checkPct = totalChecks > 0 ? Math.round((doneChecks / totalChecks) * 100) : null;

    return (
      <div
        key={task.id}
        draggable
        onDragStart={() => setDraggedTaskId(task.id)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.stopPropagation();
          handleDropOnColumn(statusId, task.id, swimlaneExtra);
        }}
        onClick={() => openTaskDrawer(task.id)}
        className={`p-4 rounded-2xl bg-[#131826] hover:bg-[#171d2e] border border-white/[0.08] hover:border-indigo-500/50 cursor-grab active:cursor-grabbing shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all duration-150 group ${
          draggedTaskId === task.id ? 'opacity-40 scale-95' : ''
        }`}
      >
        {/* Top Row: Task Key, Milestone/Blocker & Priority */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 border border-indigo-500/25 text-[10px] font-mono font-bold text-indigo-300">
              {task.task_key}
            </span>
            {task.is_milestone && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-semibold">
                ★ Milestone
              </span>
            )}
            {task.unresolved_blockers_count > 0 && (
              <span
                className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-md bg-rose-500/20 text-rose-300 font-semibold"
                title="Bloker vazifa hal qilinmagan"
              >
                <Lock className="w-2.5 h-2.5" /> Blocked
              </span>
            )}
          </div>
          {renderPriorityBadge(task.priority)}
        </div>

        {/* Title */}
        <h4 className="text-[13px] font-bold text-slate-100 group-hover:text-white leading-snug mb-2.5">
          {task.title}
        </h4>

        {/* Labels */}
        {task.labels.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {task.labels.map((lbl) => (
              <span
                key={lbl.id}
                className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                style={{
                  backgroundColor: `${lbl.color}22`,
                  color: lbl.color,
                  border: `1px solid ${lbl.color}40`,
                }}
              >
                {lbl.name}
              </span>
            ))}
          </div>
        )}

        {/* Mini Progress Bar if Subtasks or Checklists exist */}
        {checkPct !== null && (
          <div className="mb-3 space-y-1">
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>Jarayon</span>
              <span className="font-mono font-semibold text-slate-300">
                {doneChecks}/{totalChecks} ({checkPct}%)
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-950 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-400"
                style={{ width: `${checkPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Footer Badges: Subtasks, Checklists, Comments, Due Date & Assignee */}
        <div className="flex items-center justify-between pt-2.5 border-t border-white/[0.06] text-[11px] text-slate-400">
          <div className="flex items-center gap-2.5">
            {task.subtasks_summary.total > 0 && (
              <span className="flex items-center gap-1" title="Subtasklar">
                <GitBranch className="w-3 h-3 text-indigo-400" />
                {task.subtasks_summary.done}/{task.subtasks_summary.total}
              </span>
            )}
            {task.checklists_summary.total > 0 && (
              <span className="flex items-center gap-1" title="Checklist">
                <CheckSquare className="w-3 h-3 text-emerald-400" />
                {task.checklists_summary.done}/{task.checklists_summary.total}
              </span>
            )}
            {task.comments_count > 0 && (
              <span className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3 text-slate-400" />
                {task.comments_count}
              </span>
            )}
            {task.due_at && (
              <span
                className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
                  isOverdue
                    ? 'bg-rose-500/20 text-rose-300 font-bold'
                    : 'bg-white/[0.04] text-slate-300'
                }`}
              >
                {task.due_at.slice(5, 10)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {task.story_points !== null && (
              <span className="px-1.5 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.08] text-[10px] font-mono text-slate-300">
                {task.story_points}p
              </span>
            )}
            {task.assignee ? (
              <div
                className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-[10px] font-bold text-white shadow"
                title={`Mas’ul: ${task.assignee.full_name}`}
              >
                {task.assignee.full_name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)}
              </div>
            ) : (
              <div
                className="w-6 h-6 rounded-full bg-white/[0.04] border border-dashed border-slate-700 flex items-center justify-center text-[10px] text-slate-500"
                title="Tayinlanmagan"
              >
                ?
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Compute Swimlanes when swimlaneBy !== 'none'
  const swimlaneGroups =
    swimlaneBy === 'priority'
      ? [
          { key: 'urgent', title: '🔥 Urgent (Shoshilinch)', extra: { priority: 'urgent' } },
          { key: 'high', title: '⬆️ High (Yuqori)', extra: { priority: 'high' } },
          { key: 'medium', title: '⏺ Medium (O‘rta)', extra: { priority: 'medium' } },
          { key: 'low', title: '⬇️ Low (Past)', extra: { priority: 'low' } },
        ]
      : swimlaneBy === 'assignee'
      ? [
          ...members.map((m) => ({
            key: String(m.user_id),
            title: `👤 ${m.full_name} (${m.title_in_workspace || m.role})`,
            extra: { assignee_id: m.user_id },
          })),
          {
            key: 'unassigned',
            title: '❔ Tayinlanmagan (Unassigned)',
            extra: { assignee_id: null },
          },
        ]
      : [];

  // Calendar Month Calculation
  const now = new Date();
  const calViewDate = new Date(now.getFullYear(), now.getMonth() + calendarMonthOffset, 1);
  const calYear = calViewDate.getFullYear();
  const calMonth = calViewDate.getMonth();
  const monthNamesUz = [
    'Yanvar',
    'Fevral',
    'Mart',
    'Aprel',
    'May',
    'Iyun',
    'Iyul',
    'Avgust',
    'Sentabr',
    'Oktabr',
    'Noyabr',
    'Dekabr',
  ];
  const firstDayWeekIdx = (new Date(calYear, calMonth, 1).getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const totalCalCells = Math.ceil((firstDayWeekIdx + daysInMonth) / 7) * 7;

  // Timeline Real Date Window Calculation
  const todayMs = new Date(new Date().toISOString().slice(0, 10)).getTime();
  const dayMs = 86400000;
  const taskDatesMs: number[] = [todayMs - 5 * dayMs, todayMs + 21 * dayMs];
  tasks.forEach((t) => {
    if (t.start_date) {
      const sm = new Date(t.start_date.slice(0, 10)).getTime();
      if (!isNaN(sm)) taskDatesMs.push(sm);
    }
    if (t.due_at) {
      const dm = new Date(t.due_at.slice(0, 10)).getTime();
      if (!isNaN(dm)) taskDatesMs.push(dm);
    }
  });
  const timelineMinMs = Math.min(...taskDatesMs) - 2 * dayMs;
  const timelineMaxMs = Math.max(...taskDatesMs, timelineMinMs + 14 * dayMs) + 3 * dayMs;
  const timelineSpanMs = Math.max(dayMs * 7, timelineMaxMs - timelineMinMs);
  const todayOffsetPct = Math.max(
    0,
    Math.min(100, ((todayMs - timelineMinMs) / timelineSpanMs) * 100)
  );

  const timelineTicks = Array.from({ length: 8 }).map((_, i) => {
    const tickMs = timelineMinMs + (timelineSpanMs * i) / 7;
    return new Date(tickMs).toISOString().slice(5, 10);
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Shared Filter & Search Bar for Board / List / Calendar / Timeline */}
      {['board', 'list', 'calendar', 'timeline'].includes(projectTab) && (
        <div className="px-6 py-3 bg-slate-900/60 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Vazifa qidirish (FF-1)..."
                className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500 w-48"
              />
            </div>

            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300"
            >
              <option value="">Barcha ustuvorliklar</option>
              <option value="urgent">🔥 Urgent</option>
              <option value="high">⬆️ High</option>
              <option value="medium">⏺ Medium</option>
              <option value="low">⬇️ Low</option>
            </select>

            <select
              value={filterAssignee}
              onChange={(e) => setFilterAssignee(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300"
            >
              <option value="">Barcha mas’ullar</option>
              <option value="unassigned">Tayinlanmagan</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.full_name}
                </option>
              ))}
            </select>

            <select
              value={filterSprint}
              onChange={(e) => setFilterSprint(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300"
            >
              <option value="">Barcha Sprintlar</option>
              {project.sprints?.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.name} ({sp.status})
                </option>
              ))}
            </select>

            <select
              value={filterLabel}
              onChange={(e) => setFilterLabel(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300"
            >
              <option value="">Barcha Teglar</option>
              {labels.map((l) => (
                <option key={l.id} value={l.id}>
                  🏷 {l.name}
                </option>
              ))}
            </select>

            {(searchQ || filterPriority || filterAssignee || filterSprint || filterLabel) && (
              <button
                onClick={() => {
                  setSearchQ('');
                  setFilterPriority('');
                  setFilterAssignee('');
                  setFilterSprint('');
                  setFilterLabel('');
                }}
                className="text-xs text-rose-400 hover:text-rose-300 px-2"
              >
                Tozalash ×
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {projectTab === 'board' && (
              <select
                value={swimlaneBy}
                onChange={(e) => setSwimlaneBy(e.target.value as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                  swimlaneBy !== 'none'
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                    : 'bg-slate-950 border-slate-800 text-slate-300'
                }`}
              >
                <option value="none">Swimlanes: O‘chiq (Oddiy ustunlar)</option>
                <option value="priority">Swimlanes: Ustuvorlik (Priority) bo‘yicha</option>
                <option value="assignee">Swimlanes: Mas’ul shaxs (Assignee) bo‘yicha</option>
              </select>
            )}
            <button
              onClick={() => openModal('create_task', { project_id: project.id })}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Yangi Vazifa</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 1: OVERVIEW (Project Passport, Milestones, Active Sprint, Summary) */}
      {projectTab === 'overview' && (
        <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-6">
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: project.color }}
                    />
                    <h2 className="text-xl font-bold text-white">{project.name}</h2>
                    <span className="px-2.5 py-0.5 rounded bg-slate-800 font-mono text-xs text-indigo-400">
                      {project.project_key}
                    </span>
                    {project.status === 'archived' && (
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase">
                        Arxivlangan
                      </span>
                    )}
                  </div>
                  <button
                    onClick={async () => {
                      await api.toggleFavoriteProject(project.id);
                      await loadProjectAndTasks();
                      onRefreshHierarchy();
                    }}
                    className={`p-2 rounded-xl border ${
                      project.is_favorite
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <Star className="w-4 h-4 fill-current" />
                  </button>
                </div>

                <p className="text-sm text-slate-300 leading-relaxed">
                  {project.description || 'Loyiha tavsifi kiritilmagan.'}
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-[11px] text-slate-400">Holati (Status)</div>
                    <div className="text-xs font-bold uppercase text-emerald-400 mt-1">
                      {project.status.replace('_', ' ')}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-[11px] text-slate-400">Boshlanish sanasi</div>
                    <div className="text-xs font-mono text-white mt-1">
                      {project.start_date || '—'}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-[11px] text-slate-400">Maqsadli muddat</div>
                    <div className="text-xs font-mono text-white mt-1">
                      {project.due_date || '—'}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-[11px] text-slate-400">Vazifalar</div>
                    <div className="text-xs font-bold text-white mt-1">
                      {tasks.filter((t) => t.completed_at).length} / {tasks.length} bajarildi
                    </div>
                  </div>
                </div>
              </div>

              {/* Milestones */}
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Flag className="w-4 h-4 text-amber-400" />
                  <span>Muhim Bosqichlar (Project Milestones)</span>
                </h3>
                <div className="space-y-2">
                  {project.milestones?.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => openTaskDrawer(m.id)}
                      className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/40 cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2
                          className={`w-4 h-4 ${
                            m.completed_at ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        />
                        <span className="text-xs font-mono text-indigo-400">{m.task_key}</span>
                        <span className="text-xs font-semibold text-white">{m.title}</span>
                      </div>
                      <span className="text-xs font-mono text-slate-400">
                        {m.due_at ? m.due_at.slice(0, 10) : 'Muddatsiz'}
                      </span>
                    </div>
                  ))}
                  {(!project.milestones || project.milestones.length === 0) && (
                    <div className="text-xs text-slate-500">Hozircha milestone belgilanmagan.</div>
                  )}
                </div>
              </div>
            </div>

            {/* Right 4 cols: Quick Navigation to Sprints & Wiki */}
            <div className="lg:col-span-4 space-y-6">
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-white">Faol Sprintlar ({project.sprints?.length || 0})</h3>
                {project.sprints?.map((sp) => (
                  <div
                    key={sp.id}
                    onClick={() => setProjectTab('sprints')}
                    className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-indigo-500/40"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-white">{sp.name}</span>
                      <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-semibold">
                        {sp.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2">{sp.goal}</p>
                  </div>
                ))}
              </div>

              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-white">Loyiha Hujjatlari (Wiki)</h3>
                {project.docs?.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => {
                      setActiveDoc(d);
                      setProjectTab('docs');
                    }}
                    className="w-full flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left text-xs text-slate-200 transition"
                  >
                    <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span className="truncate">{d.title}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: KANBAN BOARD (WITH STANDARD COLUMNS OR HORIZONTAL SWIMLANES) */}
      {projectTab === 'board' && (
        <div className="flex-1 overflow-auto p-6">
          {swimlaneBy === 'none' ? (
            <div className="flex gap-4 h-full min-w-max">
              {statuses.map((st) => {
                const colTasks = tasks
                  .filter((t) => t.status_id === st.id && !t.parent_task_id)
                  .sort((a, b) => a.position - b.position);

                const isOverWip = st.wip_limit && colTasks.length > st.wip_limit;

                return (
                  <div
                    key={st.id}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverStatusId(st.id);
                    }}
                    onDragLeave={() => setDragOverStatusId(null)}
                    onDrop={() => handleDropOnColumn(st.id)}
                    style={{ borderTopColor: st.color, borderTopWidth: '3px' }}
                    className={`w-80 flex flex-col rounded-2xl bg-[#0e121c]/95 border transition shadow-xl ${
                      dragOverStatusId === st.id
                        ? 'border-indigo-500 bg-indigo-950/20'
                        : isOverWip
                        ? 'border-rose-500/60'
                        : 'border-white/[0.07]'
                    }`}
                  >
                    {/* Column Header */}
                    <div className="p-3.5 border-b border-slate-800/80 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: st.color }}
                        />
                        <span className="text-xs font-bold text-white">{st.name}</span>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                          {colTasks.length}
                          {st.wip_limit ? `/${st.wip_limit}` : ''}
                        </span>
                        {isOverWip && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold"
                            title="WIP Limit oshib ketdi!"
                          >
                            WIP!
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => {
                          setQuickAddStatusId(st.id);
                          setQuickAddTitle('');
                        }}
                        className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                        title="Shu ustunga vazifa qo‘shish"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Quick inline add */}
                    {quickAddStatusId === st.id && (
                      <div className="p-3 border-b border-slate-800 bg-slate-950/80 space-y-2">
                        <input
                          type="text"
                          autoFocus
                          value={quickAddTitle}
                          onChange={(e) => setQuickAddTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleQuickCreateCard(st.id);
                            if (e.key === 'Escape') setQuickAddStatusId(null);
                          }}
                          placeholder="Vazifa nomini yozib Enter bosing..."
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-indigo-500 text-xs text-white focus:outline-none"
                        />
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => setQuickAddStatusId(null)}
                            className="px-2.5 py-1 rounded bg-slate-800 text-[11px] text-slate-400"
                          >
                            Bekor
                          </button>
                          <button
                            onClick={() => handleQuickCreateCard(st.id)}
                            className="px-2.5 py-1 rounded bg-indigo-600 text-[11px] font-semibold text-white"
                          >
                            Qo‘shish
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Column Cards */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                      {colTasks.map((task) => renderKanbanCard(task, st.id))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* HORIZONTAL SWIMLANES MODE (Priority or Assignee) */
            <div className="space-y-6 min-w-max">
              {swimlaneGroups.map((lane) => {
                const laneTasks = tasks.filter((t) => {
                  if (t.parent_task_id) return false;
                  if (swimlaneBy === 'priority') return t.priority === lane.key;
                  if (swimlaneBy === 'assignee') {
                    return lane.key === 'unassigned'
                      ? !t.assignee_id
                      : String(t.assignee_id) === lane.key;
                  }
                  return true;
                });

                return (
                  <div
                    key={lane.key}
                    className="rounded-2xl bg-slate-900/50 border border-slate-800/90 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{lane.title}</span>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-indigo-300">
                          {laneTasks.length} ta vazifa
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      {statuses.map((st) => {
                        const cellTasks = laneTasks
                          .filter((t) => t.status_id === st.id)
                          .sort((a, b) => a.position - b.position);

                        return (
                          <div
                            key={st.id}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => handleDropOnColumn(st.id, null, lane.extra)}
                            className="w-76 min-h-[140px] rounded-xl bg-slate-950/60 border border-slate-800/80 p-2.5 flex flex-col gap-2"
                          >
                            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: st.color }}
                                />
                                <span className="font-semibold text-slate-300">{st.name}</span>
                              </div>
                              <span className="font-mono">{cellTasks.length}</span>
                            </div>
                            <div className="space-y-2">
                              {cellTasks.map((task) => renderKanbanCard(task, st.id, lane.extra))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: LIST / TABLE VIEW WITH BULK ACTIONS */}
      {projectTab === 'list' && (
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {selectedTaskIds.length > 0 && (
            <div className="p-3 rounded-2xl bg-indigo-950/80 border border-indigo-500/50 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-bold text-white">
                {selectedTaskIds.length} ta vazifa tanlandi — Ommaviy amal (Bulk Action):
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  onChange={(e) => e.target.value && handleBulkAction('status', Number(e.target.value))}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Statusni o‘zgartirish...
                  </option>
                  {statuses.map((s) => (
                    <option key={s.id} value={s.id}>
                      ➔ {s.name}
                    </option>
                  ))}
                </select>

                <select
                  onChange={(e) => e.target.value && handleBulkAction('priority', e.target.value)}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Ustuvorlikni o‘zgartirish...
                  </option>
                  <option value="urgent">🔥 Urgent</option>
                  <option value="high">⬆️ High</option>
                  <option value="medium">⏺ Medium</option>
                  <option value="low">⬇️ Low</option>
                </select>

                <select
                  onChange={(e) =>
                    e.target.value !== '' &&
                    handleBulkAction(
                      'assignee',
                      e.target.value === 'none' ? null : Number(e.target.value)
                    )
                  }
                  className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Mas’ul biriktirish...
                  </option>
                  <option value="none">Tayinlanmagan</option>
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.full_name}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => handleBulkAction('delete')}
                  className="px-3 py-1 rounded-lg bg-rose-600 text-xs font-semibold text-white"
                >
                  Savatga o‘tkazish
                </button>
              </div>
            </div>
          )}

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase text-[11px]">
                  <th className="py-3 px-4 w-8">
                    <input
                      type="checkbox"
                      checked={tasks.length > 0 && selectedTaskIds.length === tasks.length}
                      onChange={(e) =>
                        setSelectedTaskIds(e.target.checked ? tasks.map((t) => t.id) : [])
                      }
                      className="rounded border-slate-700 bg-slate-950"
                    />
                  </th>
                  <th className="py-3 px-3">Kod</th>
                  <th className="py-3 px-4">Vazifa Nomi</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Ustuvorlik</th>
                  <th className="py-3 px-3">Mas’ul</th>
                  <th className="py-3 px-3">Muddat</th>
                  <th className="py-3 px-3 text-right">Vaqt / Pts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {tasks.map((t) => {
                  const checked = selectedTaskIds.includes(t.id);
                  return (
                    <tr key={t.id} className="hover:bg-slate-800/50 transition">
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setSelectedTaskIds((prev) =>
                              checked ? prev.filter((id) => id !== t.id) : [...prev, t.id]
                            )
                          }
                          className="rounded border-slate-700 bg-slate-950"
                        />
                      </td>
                      <td
                        onClick={() => openTaskDrawer(t.id)}
                        className="py-3 px-3 font-mono font-bold text-indigo-400 cursor-pointer"
                      >
                        {t.task_key}
                      </td>
                      <td
                        onClick={() => openTaskDrawer(t.id)}
                        className="py-3 px-4 font-medium text-white cursor-pointer"
                      >
                        {t.parent_task_id && <span className="text-slate-500 mr-1">↳</span>}
                        {t.title}
                      </td>
                      <td className="py-3 px-3">
                        <select
                          value={t.status_id}
                          onChange={async (e) => {
                            try {
                              await api.updateTask(t.id, { status_id: Number(e.target.value) });
                              await loadProjectAndTasks();
                              onRefreshHierarchy();
                            } catch (err: any) {
                              addToast({ type: 'error', title: 'Xatolik', message: err.message });
                            }
                          }}
                          className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
                        >
                          {statuses.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-3">{renderPriorityBadge(t.priority)}</td>
                      <td className="py-3 px-3 text-slate-300">
                        {t.assignee ? t.assignee.full_name : '—'}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-400">
                        {t.due_at ? t.due_at.slice(0, 10) : '—'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-400">
                        {t.logged_minutes}m / {t.story_points || 0}p
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: FULL INTERACTIVE MONTH CALENDAR VIEW WITH DRAG-AND-DROP RESCHEDULING */}
      {projectTab === 'calendar' && (
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 p-4 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-2.5">
              <CalendarIcon className="w-5 h-5 text-indigo-400" />
              <h3 className="text-base font-bold text-white">
                {calYear}-yil, {monthNamesUz[calMonth]}
              </h3>
              <span className="text-xs text-slate-400 ml-2">
                (Vazifani boshqa kunga sichqoncha bilan tortib o‘tkazishingiz mumkin)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCalendarMonthOffset((n) => n - 1)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Oldingi oy
              </button>
              <button
                onClick={() => setCalendarMonthOffset(0)}
                className="px-3 py-1.5 rounded-xl bg-indigo-600/20 border border-indigo-500/40 text-xs font-semibold text-indigo-300"
              >
                Bugun
              </button>
              <button
                onClick={() => setCalendarMonthOffset((n) => n + 1)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300"
              >
                Keyingi oy <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Unscheduled tasks bar */}
          {tasks.some((t) => !t.due_at) && (
            <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400 mr-1">
                Muddati belgilanmagan vazifalar (Kalendarga tortib tashlang):
              </span>
              {tasks
                .filter((t) => !t.due_at)
                .map((t) => (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={() => setCalendarDragTaskId(t.id)}
                    onClick={() => openTaskDrawer(t.id)}
                    className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-indigo-500/50 text-[11px] cursor-grab flex items-center gap-1.5"
                  >
                    <span className="font-mono font-bold text-indigo-400">{t.task_key}</span>
                    <span className="text-slate-200 truncate max-w-[160px]">{t.title}</span>
                  </div>
                ))}
            </div>
          )}

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-bold uppercase text-slate-400">
            {['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'].map(
              (day) => (
                <div key={day} className="py-1.5 rounded-xl bg-slate-900/80 border border-slate-800/80">
                  {day}
                </div>
              )
            )}
          </div>

          {/* Month Days Grid */}
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: totalCalCells }).map((_, cellIdx) => {
              const dayOffset = cellIdx - firstDayWeekIdx + 1;
              const cellDate = new Date(calYear, calMonth, dayOffset);
              const isCurrentMonth = cellDate.getMonth() === calMonth;
              const yyyy = cellDate.getFullYear();
              const mm = String(cellDate.getMonth() + 1).padStart(2, '0');
              const dd = String(cellDate.getDate()).padStart(2, '0');
              const dateIso = `${yyyy}-${mm}-${dd}`;
              const isToday = dateIso === new Date().toISOString().slice(0, 10);
              const dayTasks = tasks.filter((t) => t.due_at && t.due_at.slice(0, 10) === dateIso);

              return (
                <div
                  key={dateIso}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={async () => {
                    if (!calendarDragTaskId) return;
                    const tId = calendarDragTaskId;
                    setCalendarDragTaskId(null);
                    try {
                      await api.updateTask(tId, { due_at: dateIso });
                      await loadProjectAndTasks();
                      addToast({
                        type: 'success',
                        title: `Vazifa muddati ${dateIso} ga ko‘chirildi`,
                      });
                    } catch (err: any) {
                      addToast({ type: 'error', title: 'Xatolik', message: err.message });
                    }
                  }}
                  className={`min-h-[125px] p-2.5 rounded-2xl border flex flex-col justify-between transition ${
                    isToday
                      ? 'bg-indigo-950/30 border-indigo-500'
                      : isCurrentMonth
                      ? 'bg-slate-900/75 border-slate-800/80'
                      : 'bg-slate-950/40 border-slate-900 opacity-50'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between text-[11px] mb-2">
                      <span
                        className={
                          isToday
                            ? 'font-bold text-indigo-300'
                            : isCurrentMonth
                            ? 'text-slate-300 font-medium'
                            : 'text-slate-600'
                        }
                      >
                        {cellDate.getDate()}
                      </span>
                      {isToday && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-600 text-white font-bold">
                          BUGUN
                        </span>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      {dayTasks.map((t) => (
                        <div
                          key={t.id}
                          draggable
                          onDragStart={() => setCalendarDragTaskId(t.id)}
                          onClick={() => openTaskDrawer(t.id)}
                          className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[11px] cursor-grab truncate"
                          style={{
                            borderLeftWidth: '3px',
                            borderLeftColor: t.status?.color || '#6366f1',
                          }}
                        >
                          <span className="font-mono font-bold text-indigo-400 mr-1">
                            {t.task_key}
                          </span>
                          <span className="text-slate-200">{t.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      openModal('create_task', { project_id: project.id, due_at: dateIso })
                    }
                    className="text-[10px] text-slate-500 hover:text-indigo-400 text-left pt-2"
                  >
                    + Vazifa
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 5: REAL DATE-DRIVEN TIMELINE / ROADMAP (GANTT) VIEW */}
      {projectTab === 'timeline' && (
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white">
                  Loyiha Vaqt Chizig‘i va Vazifalar Ketma-ketligi (Real-Date Gantt Timeline)
                </h3>
                <p className="text-[11px] text-slate-400">
                  Har bir vazifaning haqiqiy Boshlanish (`start_date`) va Yakuniy (`due_at`) sanalari asosida hisoblangan diagramma
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-rose-400 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-rose-500" /> Bugungi sana chizig‘i
                </span>
              </div>
            </div>

            {/* Timeline Date Ruler Header */}
            <div className="grid grid-cols-12 items-center gap-4 px-2.5 pb-2 border-b border-slate-800 text-[11px] font-mono text-slate-400">
              <div className="col-span-5 flex items-center justify-between pr-2">
                <span>Vazifa</span>
                <span>Boshlanish ➔ Muddat</span>
              </div>
              <div className="col-span-7 flex justify-between px-1">
                {timelineTicks.map((tick, idx) => (
                  <span key={idx}>{tick}</span>
                ))}
              </div>
            </div>

            <div className="space-y-2.5 relative">
              {tasks.map((t) => {
                const startIso = (t.start_date || t.created_at || new Date().toISOString()).slice(
                  0,
                  10
                );
                const endIso = t.due_at
                  ? t.due_at.slice(0, 10)
                  : new Date(new Date(startIso).getTime() + Math.max(2, t.story_points || 3) * dayMs)
                      .toISOString()
                      .slice(0, 10);

                const sMs = new Date(startIso).getTime();
                const eMs = Math.max(sMs + dayMs, new Date(endIso).getTime());

                const leftPct = Math.max(
                  0,
                  Math.min(92, ((sMs - timelineMinMs) / timelineSpanMs) * 100)
                );
                const widthPct = Math.max(
                  6,
                  Math.min(100 - leftPct, ((eMs - sMs) / timelineSpanMs) * 100)
                );

                return (
                  <div
                    key={t.id}
                    className="grid grid-cols-12 items-center gap-4 p-2.5 rounded-xl bg-slate-950/70 hover:bg-slate-800/40 border border-slate-800/80"
                  >
                    <div className="col-span-5 flex items-center justify-between gap-2 min-w-0">
                      <div
                        onClick={() => openTaskDrawer(t.id)}
                        className="flex items-center gap-2 min-w-0 cursor-pointer"
                      >
                        <span className="font-mono text-xs font-bold text-indigo-400 shrink-0">
                          {t.task_key}
                        </span>
                        <span className="text-xs text-white truncate">{t.title}</span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          type="date"
                          value={t.start_date ? t.start_date.slice(0, 10) : ''}
                          onChange={async (e) => {
                            await api.updateTask(t.id, { start_date: e.target.value || null });
                            await loadProjectAndTasks();
                          }}
                          title="Boshlanish sanasi"
                          className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-300 w-27"
                        />
                        <input
                          type="date"
                          value={t.due_at ? t.due_at.slice(0, 10) : ''}
                          onChange={async (e) => {
                            await api.updateTask(t.id, { due_at: e.target.value || null });
                            await loadProjectAndTasks();
                          }}
                          title="Muddat (Due date)"
                          className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-300 w-27"
                        />
                      </div>
                    </div>

                    <div
                      onClick={() => openTaskDrawer(t.id)}
                      className="col-span-7 relative h-8 bg-slate-900 rounded-lg overflow-hidden flex items-center cursor-pointer"
                    >
                      {/* Vertical Today Marker Line */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-rose-500/70 z-10 pointer-events-none"
                        style={{ left: `${todayOffsetPct}%` }}
                        title="Bugun"
                      />

                      <div
                        className="h-5 rounded-md flex items-center justify-between px-2 text-[10px] font-semibold text-white whitespace-nowrap shadow"
                        style={{
                          marginLeft: `${leftPct}%`,
                          width: `${widthPct}%`,
                          backgroundColor: t.status?.color || '#6366f1',
                        }}
                      >
                        <span className="truncate">
                          {startIso.slice(5)} ➔ {endIso.slice(5)}
                        </span>
                        {t.is_milestone && <span>★</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: SPRINTS / CYCLES */}
      {projectTab === 'sprints' && (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newSprintName.trim()) return;
              await api.createSprint(project.id, {
                name: newSprintName.trim(),
                goal: newSprintGoal,
                start_date: newSprintStart || undefined,
                end_date: newSprintEnd || undefined,
                status: 'active',
              });
              setNewSprintName('');
              setNewSprintGoal('');
              setNewSprintStart('');
              setNewSprintEnd('');
              await loadProjectAndTasks();
              addToast({ type: 'success', title: 'Yangi Sprint yaratildi' });
            }}
            className="p-5 rounded-2xl bg-slate-900 border border-slate-800 grid grid-cols-1 sm:grid-cols-6 gap-3 items-end"
          >
            <div className="sm:col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Sprint nomi *</label>
              <input
                type="text"
                required
                value={newSprintName}
                onChange={(e) => setNewSprintName(e.target.value)}
                placeholder="Masalan: Sprint 3 — Mobile Release"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Sprint maqsadi (Goal)</label>
              <input
                type="text"
                value={newSprintGoal}
                onChange={(e) => setNewSprintGoal(e.target.value)}
                placeholder="Asosiy natija..."
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Boshlanish sanasi</label>
              <input
                type="date"
                value={newSprintStart}
                onChange={(e) => setNewSprintStart(e.target.value)}
                className="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Yakunlanish sanasi</label>
              <input
                type="date"
                value={newSprintEnd}
                onChange={(e) => setNewSprintEnd(e.target.value)}
                className="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
              />
            </div>
            <button
              type="submit"
              className="py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white"
            >
              + Sprint Ochish
            </button>
          </form>

          <div className="space-y-4">
            {project.sprints?.map((sp) => {
              const spTasks = tasks.filter((t) => t.sprint_id === sp.id);
              const unassignedSprintTasks = tasks.filter((t) => t.sprint_id !== sp.id);
              const spDone = spTasks.filter((t) => t.completed_at).length;
              const pct = spTasks.length > 0 ? Math.round((spDone / spTasks.length) * 100) : 0;

              return (
                <div
                  key={sp.id}
                  className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-base font-bold text-white">{sp.name}</h3>
                        <select
                          value={sp.status}
                          onChange={async (e) => {
                            await api.updateSprint(sp.id, { status: e.target.value });
                            await loadProjectAndTasks();
                            addToast({ type: 'success', title: 'Sprint statusi yangilandi' });
                          }}
                          className="text-[11px] uppercase font-bold px-2.5 py-1 rounded-lg bg-indigo-500/20 border border-indigo-500/40 text-indigo-300"
                        >
                          <option value="planned">PLANNED</option>
                          <option value="active">ACTIVE</option>
                          <option value="completed">COMPLETED</option>
                        </select>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {sp.goal || 'Maqsad kiritilmagan'} • ({sp.start_date || '—'} ➔{' '}
                        {sp.end_date || '—'})
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <select
                        defaultValue=""
                        onChange={async (e) => {
                          if (!e.target.value) return;
                          await api.updateTask(Number(e.target.value), { sprint_id: sp.id });
                          e.target.value = '';
                          await loadProjectAndTasks();
                          addToast({ type: 'success', title: 'Vazifa sprintga qo‘shildi' });
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300"
                      >
                        <option value="">+ Vazifa biriktirish...</option>
                        {unassignedSprintTasks.map((ut) => (
                          <option key={ut.id} value={ut.id}>
                            {ut.task_key} — {ut.title}
                          </option>
                        ))}
                      </select>

                      <span className="text-xs font-bold text-emerald-400">
                        {spDone}/{spTasks.length} ({pct}%)
                      </span>

                      <button
                        onClick={async () => {
                          await api.deleteSprint(sp.id);
                          await loadProjectAndTasks();
                          addToast({ type: 'info', title: 'Sprint o‘chirildi' });
                        }}
                        className="p-1.5 rounded-lg bg-slate-950 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400"
                        title="Sprintni o‘chirish"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                  </div>

                  <div className="divide-y divide-slate-800/70">
                    {spTasks.map((t) => (
                      <div
                        key={t.id}
                        className="py-2.5 flex items-center justify-between text-xs"
                      >
                        <div
                          onClick={() => openTaskDrawer(t.id)}
                          className="cursor-pointer hover:text-indigo-300"
                        >
                          <span className="font-mono font-bold text-indigo-400 mr-2">
                            {t.task_key}
                          </span>
                          <span className="text-slate-200">{t.title}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-400">{t.status?.name}</span>
                          <button
                            onClick={async () => {
                              await api.updateTask(t.id, { sprint_id: null });
                              await loadProjectAndTasks();
                            }}
                            className="text-[11px] text-slate-500 hover:text-rose-400"
                          >
                            Sprintdan chiqarish
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 7: PROJECT DOCS & WIKI */}
      {projectTab === 'docs' && (
        <div className="flex-1 flex overflow-hidden">
          {/* Left Doc List */}
          <div className="w-72 border-r border-slate-800 bg-slate-900/60 p-4 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Loyiha Wiki Sahifalari
              </div>
              {project.docs?.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => {
                    setActiveDoc(doc);
                    setDocTitleEdit(doc.title);
                    setDocContentEdit(doc.content_md || '');
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-left text-xs font-medium transition ${
                    activeDoc?.id === doc.id
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <FileText className="w-4 h-4 shrink-0" />
                  <span className="truncate">{doc.title}</span>
                </button>
              ))}
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newDocTitle.trim()) return;
                await api.createDoc(project.id, {
                  title: newDocTitle.trim(),
                  content_md: `# ${newDocTitle.trim()}\n\nLoyiha hujjati matnini shu yerga kiriting...`,
                });
                setNewDocTitle('');
                await loadProjectAndTasks();
                addToast({ type: 'success', title: 'Yangi Wiki hujjat yaratildi' });
              }}
              className="space-y-2 pt-4 border-t border-slate-800"
            >
              <input
                type="text"
                value={newDocTitle}
                onChange={(e) => setNewDocTitle(e.target.value)}
                placeholder="Yangi sahifa nomi..."
                className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
              />
              <button
                type="submit"
                className="w-full py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white"
              >
                + Hujjat Yaratish
              </button>
            </form>
          </div>

          {/* Right Doc Editor */}
          <div className="flex-1 p-6 overflow-y-auto space-y-4">
            {activeDoc ? (
              <>
                <div className="flex items-center justify-between gap-4">
                  <input
                    type="text"
                    value={docTitleEdit}
                    onChange={(e) => setDocTitleEdit(e.target.value)}
                    className="flex-1 text-xl font-bold text-white bg-slate-900 border border-slate-800 rounded-xl px-4 py-2"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        await api.updateDoc(activeDoc.id, {
                          title: docTitleEdit,
                          content_md: docContentEdit,
                        });
                        await loadProjectAndTasks();
                        addToast({ type: 'success', title: 'Wiki hujjat saqlandi' });
                      }}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white"
                    >
                      Saqlash
                    </button>
                    <button
                      onClick={async () => {
                        await api.deleteDoc(activeDoc.id);
                        await loadProjectAndTasks();
                      }}
                      className="p-2 rounded-xl bg-slate-900 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <textarea
                  rows={18}
                  value={docContentEdit}
                  onChange={(e) => setDocContentEdit(e.target.value)}
                  className="w-full p-4 rounded-2xl bg-slate-900 border border-slate-800 font-mono text-xs text-slate-200 leading-relaxed focus:outline-none focus:border-indigo-500"
                />
              </>
            ) : (
              <div className="py-12 text-center text-sm text-slate-500">
                Chap menyudan hujjat tanlang yoki yangi Wiki sahifa yarating.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 8: PROJECT TIME & WORKLOAD */}
      {projectTab === 'time' && (
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white">
              Loyiha Vazifalari Bo‘yicha Vaqt Sarfi (Estimated vs Logged)
            </h3>
            <div className="space-y-2.5">
              {tasks.map((t) => (
                <div
                  key={t.id}
                  onClick={() => openTaskDrawer(t.id)}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-indigo-500/40 text-xs"
                >
                  <div>
                    <span className="font-mono font-bold text-indigo-400 mr-2">{t.task_key}</span>
                    <span className="text-white font-medium">{t.title}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-slate-400">{t.assignee?.full_name || '—'}</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {t.logged_minutes} daq. / {t.estimate_minutes || 0} daq.
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 9: PROJECT SETTINGS, CUSTOM KANBAN STATUS BUILDER & ARCHIVE/TRASH */}
      {projectTab === 'settings' && (
        <div className="flex-1 overflow-y-auto p-6 lg:p-8 max-w-4xl space-y-6">
          {/* General Project Settings */}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api.updateProject(project.id, {
                  name: projNameEdit,
                  description: projDescEdit,
                  status: projStatusEdit,
                  color: projColorEdit,
                  start_date: projStartEdit || null,
                  due_date: projDueEdit || null,
                });
                await loadProjectAndTasks();
                onRefreshHierarchy();
                addToast({ type: 'success', title: 'Loyiha sozlamalari saqlandi' });
              } catch (err: any) {
                addToast({ type: 'error', title: 'Xatolik', message: err.message });
              }
            }}
            className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4"
          >
            <h3 className="text-base font-bold text-white">Loyiha Pasportini Tahrirlash</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Loyiha nomi *</label>
                <input
                  type="text"
                  required
                  value={projNameEdit}
                  onChange={(e) => setProjNameEdit(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Loyiha Holati (Health Status)</label>
                <select
                  value={projStatusEdit}
                  onChange={(e) => setProjStatusEdit(e.target.value as any)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
                >
                  <option value="on_track">🟢 On Track (Reja bo‘yicha)</option>
                  <option value="at_risk">🟡 At Risk (Xavf ostida)</option>
                  <option value="off_track">🔴 Off Track (Kechikmoqda)</option>
                  <option value="on_hold">⏸ On Hold (To‘xtatilgan)</option>
                  <option value="completed">✅ Completed (Yakunlangan)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Boshlanish sanasi</label>
                <input
                  type="date"
                  value={projStartEdit}
                  onChange={(e) => setProjStartEdit(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Maqsadli muddat (Due Date)</label>
                <input
                  type="date"
                  value={projDueEdit}
                  onChange={(e) => setProjDueEdit(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Tavsif</label>
              <textarea
                rows={3}
                value={projDescEdit}
                onChange={(e) => setProjDescEdit(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-400">Loyiha Rangi:</label>
                <input
                  type="color"
                  value={projColorEdit}
                  onChange={(e) => setProjColorEdit(e.target.value)}
                  className="w-10 h-8 rounded bg-slate-950 border border-slate-800 cursor-pointer"
                />
              </div>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white"
              >
                Saqlash
              </button>
            </div>
          </form>

          {/* Custom Kanban Status Columns Builder + Inline Editor */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-white">
              Kanban Ustunlari (Statuslar) va WIP Limitlarini Boshqarish
            </h3>

            <div className="space-y-2">
              {statuses.map((st, idx) => (
                <div
                  key={st.id}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: st.color }} />
                      <span className="font-bold text-white">{st.name}</span>
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 uppercase text-[10px]">
                        {st.category}
                      </span>
                      {st.wip_limit && (
                        <span className="text-amber-400">WIP Limit: {st.wip_limit}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setEditingStatusId(editingStatusId === st.id ? null : st.id);
                          setEditStatusName(st.name);
                          setEditStatusColor(st.color);
                          setEditStatusCategory(st.category);
                          setEditStatusWip(st.wip_limit ? String(st.wip_limit) : '');
                        }}
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                        title="Tahrirlash"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      {idx > 0 && (
                        <button
                          onClick={async () => {
                            const ids = statuses.map((s) => s.id);
                            [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
                            await api.reorderStatuses(project.id, ids);
                            await loadProjectAndTasks();
                          }}
                          className="p-1 rounded bg-slate-800 text-slate-300"
                          title="Chapga/Tepaga surish"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {idx < statuses.length - 1 && (
                        <button
                          onClick={async () => {
                            const ids = statuses.map((s) => s.id);
                            [ids[idx + 1], ids[idx]] = [ids[idx], ids[idx + 1]];
                            await api.reorderStatuses(project.id, ids);
                            await loadProjectAndTasks();
                          }}
                          className="p-1 rounded bg-slate-800 text-slate-300"
                          title="O‘ngga/Pastga surish"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {statuses.length > 1 && (
                        <button
                          onClick={async () => {
                            await api.deleteStatus(project.id, st.id);
                            await loadProjectAndTasks();
                          }}
                          className="text-rose-400 hover:text-rose-300 ml-2"
                        >
                          O‘chirish
                        </button>
                      )}
                    </div>
                  </div>

                  {editingStatusId === st.id && (
                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 pt-2 border-t border-slate-800">
                      <input
                        type="text"
                        value={editStatusName}
                        onChange={(e) => setEditStatusName(e.target.value)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                      />
                      <select
                        value={editStatusCategory}
                        onChange={(e) => setEditStatusCategory(e.target.value)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                      >
                        <option value="backlog">Backlog</option>
                        <option value="todo">Todo</option>
                        <option value="in_progress">In Progress</option>
                        <option value="review">Review</option>
                        <option value="done">Done</option>
                      </select>
                      <input
                        type="number"
                        min={1}
                        placeholder="WIP Limit"
                        value={editStatusWip}
                        onChange={(e) => setEditStatusWip(e.target.value)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                      />
                      <input
                        type="color"
                        value={editStatusColor}
                        onChange={(e) => setEditStatusColor(e.target.value)}
                        className="w-full h-8 rounded-lg bg-slate-900 border border-slate-700 cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          await api.updateStatus(project.id, st.id, {
                            name: editStatusName,
                            category: editStatusCategory,
                            color: editStatusColor,
                            wip_limit: editStatusWip ? Number(editStatusWip) : null,
                          });
                          setEditingStatusId(null);
                          await loadProjectAndTasks();
                          addToast({ type: 'success', title: 'Ustun yangilandi' });
                        }}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 text-xs font-semibold text-white"
                      >
                        Saqlash
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newStatusName.trim()) return;
                await api.createStatus(project.id, {
                  name: newStatusName.trim(),
                  category: newStatusCategory,
                  color: newStatusColor,
                  wip_limit: newStatusWip ? Number(newStatusWip) : null,
                });
                setNewStatusName('');
                setNewStatusWip('');
                await loadProjectAndTasks();
                addToast({ type: 'success', title: 'Yangi Kanban ustuni qo‘shildi' });
              }}
              className="grid grid-cols-1 sm:grid-cols-6 gap-2.5 pt-2"
            >
              <input
                type="text"
                required
                value={newStatusName}
                onChange={(e) => setNewStatusName(e.target.value)}
                placeholder="Ustun nomi (masalan: Security Audit)"
                className="sm:col-span-2 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
              />
              <select
                value={newStatusCategory}
                onChange={(e) => setNewStatusCategory(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
              >
                <option value="backlog">Backlog</option>
                <option value="todo">Todo</option>
                <option value="in_progress">In Progress</option>
                <option value="review">Review</option>
                <option value="done">Done</option>
              </select>
              <input
                type="number"
                min={1}
                value={newStatusWip}
                onChange={(e) => setNewStatusWip(e.target.value)}
                placeholder="WIP Limit"
                className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
              />
              <input
                type="color"
                value={newStatusColor}
                onChange={(e) => setNewStatusColor(e.target.value)}
                className="w-full h-9 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white"
              >
                + Ustun
              </button>
            </form>
          </div>

          {/* Project Lifecycle & Danger Zone (Archive / Move to Trash) */}
          <div className="p-6 rounded-2xl bg-rose-950/20 border border-rose-500/30 space-y-4">
            <h3 className="text-sm font-bold text-rose-300">
              Loyiha Hayotiy Sikli va Xavfli Hudud (Archive / Recycle Bin)
            </h3>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="text-xs text-slate-400">
                Loyihani arxivlash yoki Savatga (Recycle Bin) o‘tkazish (keyinchalik Savatdan tiklash mumkin).
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    const nextStatus = project.status === 'archived' ? 'on_track' : 'archived';
                    await api.updateProject(project.id, { status: nextStatus });
                    await loadProjectAndTasks();
                    onRefreshHierarchy();
                    addToast({
                      type: 'info',
                      title:
                        project.status === 'archived'
                          ? 'Loyiha arxivdan chiqarildi'
                          : 'Loyiha arxivlandi',
                    });
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-xs font-semibold text-amber-300"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>
                    {project.status === 'archived' ? 'Arxivdan chiqarish' : 'Loyihani Arxivlash'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await api.deleteProject(project.id);
                      onRefreshHierarchy();
                      navigateRail('pulse');
                      addToast({ type: 'info', title: 'Loyiha Savatga o‘tkazildi' });
                    } catch (err: any) {
                      addToast({ type: 'error', title: 'Xatolik', message: err.message });
                    }
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Savatga o‘tkazish</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
