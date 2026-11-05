import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Eye,
  EyeOff,
  Trash2,
  GitBranch,
  CheckSquare,
  Clock,
  Link2,
  Paperclip,
  MessageSquare,
  History,
  Play,
  Square,
  Pin,
  Send,
  Tag,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  CheckCircle2,
  Lock,
  Upload,
  ExternalLink,
  Edit3,
  Flag,
  Check,
  MoreHorizontal,
  Copy,
  Share2,
  Columns,
  User,
  Calendar,
  Star,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAppStore } from '../../store/useAppStore';
import type { Task, WorkspaceMember, Label, Sprint } from '../../types/flowforge';

interface TaskDetailDrawerProps {
  members: WorkspaceMember[];
  workspaceLabels: Label[];
  onTaskMutated: () => void;
}

export const TaskDetailDrawer: React.FC<TaskDetailDrawerProps> = ({
  members,
  workspaceLabels,
  onTaskMutated,
}) => {
  const {
    selectedTaskId,
    openTaskDrawer,
    activeTimer,
    startTimer,
    stopTimer,
    addToast,
  } = useAppStore();

  const [task, setTask] = useState<Task | null>(null);
  const [projectStatuses, setProjectStatuses] = useState<any[]>([]);
  const [projectSprints, setProjectSprints] = useState<Sprint[]>([]);
  const [projectTasks, setProjectTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState<'comments' | 'history' | 'time'>('comments');

  // Inline editable states
  const [titleEdit, setTitleEdit] = useState('');
  const [descEdit, setDescEdit] = useState('');
  const [isEditingDesc, setIsEditingDesc] = useState(false);

  // Subtask & Checklist & Dependency & Time & Comment inputs
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newChecklistTitle, setNewChecklistTitle] = useState('');
  const [newItemTexts, setNewItemTexts] = useState<Record<number, string>>({});
  const [selectedBlockerId, setSelectedBlockerId] = useState<number | ''>('');
  const [timeMinutes, setTimeMinutes] = useState('');
  const [timeDesc, setTimeDesc] = useState('');
  const [newAttachmentName, setNewAttachmentName] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Comments & inline edit
  const [commentBody, setCommentBody] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');

  // Custom Interactive Selectors & More Actions Popover
  const [activePicker, setActivePicker] = useState<'status' | 'priority' | 'assignee' | 'sprint' | 'actions' | null>(null);
  const [assigneeSearchQ, setAssigneeSearchQ] = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close custom pickers on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setActivePicker(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const loadTaskDetails = async (id: number) => {
    setLoading(true);
    try {
      const res = await api.getTask(id);
      setTask(res.task);
      setTitleEdit(res.task.title);
      setDescEdit(res.task.description || '');

      const projRes = await api.getProject(res.task.project_id);
      setProjectStatuses(projRes.project.statuses || []);
      setProjectSprints(projRes.project.sprints || []);

      const tasksRes = await api.getProjectTasks(res.task.project_id);
      setProjectTasks(tasksRes.tasks || []);
    } catch (err: any) {
      addToast({ type: 'error', title: 'Vazifani yuklashda xatolik', message: err.message });
      openTaskDrawer(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedTaskId) {
      loadTaskDetails(selectedTaskId);
    } else {
      setTask(null);
    }
  }, [selectedTaskId]);

  if (!selectedTaskId) return null;

  const handleFieldUpdate = async (fields: Record<string, any>) => {
    if (!task) return;
    try {
      const res = await api.updateTask(task.id, fields);
      setTask(res.task);
      onTaskMutated();
      addToast({ type: 'success', title: `${task.task_key} yangilandi` });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Saqlash xatoligi', message: err.message });
    }
  };

  const handleToggleLabel = async (labelId: number) => {
    if (!task) return;
    const currentIds = task.labels.map((l) => l.id);
    const nextIds = currentIds.includes(labelId)
      ? currentIds.filter((id) => id !== labelId)
      : [...currentIds, labelId];
    try {
      const res = await api.syncTaskLabels(task.id, nextIds);
      setTask(res.task);
      onTaskMutated();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Teg xatoligi', message: err.message });
    }
  };

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !newSubtaskTitle.trim()) return;
    try {
      await api.createTask(task.project_id, {
        title: newSubtaskTitle.trim(),
        parent_task_id: task.id,
        priority: 'medium',
      });
      setNewSubtaskTitle('');
      await loadTaskDetails(task.id);
      onTaskMutated();
      addToast({ type: 'success', title: 'Subtask qo‘shildi' });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Subtask xatoligi', message: err.message });
    }
  };

  const handleAddChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !newChecklistTitle.trim()) return;
    try {
      const res = await api.createChecklist(task.id, newChecklistTitle.trim());
      setTask(res.task);
      setNewChecklistTitle('');
      onTaskMutated();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Checklist xatoligi', message: err.message });
    }
  };

  const handleAddChecklistItem = async (checklistId: number) => {
    const text = (newItemTexts[checklistId] || '').trim();
    if (!text) return;
    try {
      const res = await api.addChecklistItem(checklistId, text);
      setTask(res.task);
      setNewItemTexts((prev) => ({ ...prev, [checklistId]: '' }));
      onTaskMutated();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Xatolik', message: err.message });
    }
  };

  const handleToggleChecklistItem = async (itemId: number, current: boolean) => {
    try {
      const res = await api.updateChecklistItem(itemId, { is_completed: !current });
      setTask(res.task);
      onTaskMutated();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Xatolik', message: err.message });
    }
  };

  const handleAddDependency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !selectedBlockerId) return;
    try {
      const res = await api.addDependency(task.id, Number(selectedBlockerId), 'blocked_by');
      setTask(res.task);
      setSelectedBlockerId('');
      onTaskMutated();
      addToast({ type: 'success', title: 'Bog‘liqlik (Blocker) qo‘shildi' });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Bog‘liqlik rad etildi', message: err.message });
    }
  };

  const handleFileUploadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !task) return;
    if (file.size > 10 * 1024 * 1024) {
      addToast({ type: 'error', title: 'Fayl juda katta', message: 'Maksimal hajm: 10 MB' });
      return;
    }

    setUploadingFile(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Faylni o‘qib bo‘lmadi'));
        reader.readAsDataURL(file);
      });

      const res = await api.addAttachment(task.id, {
        original_name: file.name,
        mime_type: file.type || 'application/octet-stream',
        size_bytes: file.size,
        file_content_base64: base64,
      });
      setTask(res.task);
      addToast({ type: 'success', title: 'Fayl serverga yuklandi!', message: file.name });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Fayl yuklash xatoligi', message: err.message });
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleLogTime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !timeMinutes) return;
    try {
      const res = await api.addTimeEntry(task.id, {
        duration_minutes: Number(timeMinutes),
        description: timeDesc || 'Vazifa ustida ishlash',
      });
      setTask(res.task);
      setTimeMinutes('');
      setTimeDesc('');
      onTaskMutated();
      addToast({ type: 'success', title: `${timeMinutes} daqiqa ish vaqti saqlandi` });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Vaqt yozish xatoligi', message: err.message });
    }
  };

  const handleToggleStopwatch = async () => {
    if (!task) return;
    if (activeTimer && activeTimer.taskId === task.id) {
      const stopped = stopTimer();
      if (stopped) {
        const elapsedMins = Math.max(1, Math.round((Date.now() - stopped.startedAt) / 60000));
        const res = await api.addTimeEntry(task.id, {
          duration_minutes: elapsedMins,
          description: 'Jonli sekundomer orqali yozildi',
        });
        setTask(res.task);
        onTaskMutated();
        addToast({
          type: 'success',
          title: 'Sekundomer to‘xtatildi',
          message: `${elapsedMins} daqiqa avtomatik qayd etildi.`,
        });
      }
    } else {
      startTimer({
        taskId: task.id,
        taskKey: task.task_key,
        taskTitle: task.title,
      });
      addToast({
        type: 'info',
        title: `Sekundomer ishga tushdi: ${task.task_key}`,
        message: 'To‘xtatganingizda vaqt bazaga saqlanadi.',
      });
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !commentBody.trim()) return;
    try {
      const res = await api.addComment(task.id, commentBody.trim());
      setTask(res.task);
      setCommentBody('');
      onTaskMutated();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Izoh xatoligi', message: err.message });
    }
  };

  const isRunningThisTask = activeTimer?.taskId === task?.id;

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs flex justify-end">
      <div className="flex-1" onClick={() => openTaskDrawer(null)} />
      <div className="w-full max-w-3xl bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl overflow-hidden">
        {loading || !task ? (
          <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
            Vazifa pasporti yuklanmoqda...
          </div>
        ) : (
          <>
            {/* Top Drawer Header */}
            <div className="px-6 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2 text-xs">
                {task.parent_task && (
                  <>
                    <button
                      onClick={() => openTaskDrawer(task.parent_task!.id)}
                      className="font-mono text-slate-400 hover:text-indigo-400 transition"
                    >
                      {task.parent_task.task_key}
                    </button>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                  </>
                )}
                <span className="px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/30 font-mono font-bold text-indigo-300">
                  {task.task_key}
                </span>
                {task.unresolved_blockers_count > 0 && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 font-semibold">
                    <Lock className="w-3 h-3" />
                    Blocked ({task.unresolved_blockers_count})
                  </span>
                )}
                <button
                  onClick={() => handleFieldUpdate({ is_milestone: !task.is_milestone })}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-semibold transition ${
                    task.is_milestone
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                      : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                  }`}
                  title="Milestone sifatida belgilash"
                >
                  <Flag className="w-3 h-3" />
                  <span>{task.is_milestone ? 'Milestone ★' : 'Milestone'}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                {/* Live Stopwatch button */}
                <button
                  onClick={handleToggleStopwatch}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    isRunningThisTask
                      ? 'bg-rose-600 text-white animate-pulse'
                      : 'bg-slate-800 hover:bg-slate-700 text-emerald-400'
                  }`}
                >
                  {isRunningThisTask ? (
                    <>
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>To‘xtatish</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Vaqt o‘lchash</span>
                    </>
                  )}
                </button>

                {/* Watch / Unwatch */}
                <button
                  onClick={async () => {
                    const res = await api.toggleWatchTask(task.id);
                    setTask(res.task);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition ${
                    task.is_watching
                      ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                  title="Vazifani kuzatish"
                >
                  {task.is_watching ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  <span>{task.watcher_ids?.length || 1}</span>
                </button>

                {/* More Actions Dropdown ('•••') */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setActivePicker((v) => (v === 'actions' ? null : 'actions'))}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                    title="Qo‘shimcha amallar"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>

                  {activePicker === 'actions' && (
                    <div
                      ref={pickerRef}
                      className="absolute right-0 mt-1.5 w-52 rounded-2xl bg-[#141824] border border-white/[0.1] shadow-2xl p-1.5 z-50 animate-popover text-left"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(`${task.task_key}: ${task.title}`);
                          addToast({ type: 'success', title: 'Vazifa ma’lumoti nusxalandi' });
                          setActivePicker(null);
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg hover:bg-white/[0.06] flex items-center gap-2 text-xs text-slate-200"
                      >
                        <Copy className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Kodni nusxalash</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}?task=${task.id}`);
                          addToast({ type: 'success', title: 'Havola nusxalandi' });
                          setActivePicker(null);
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg hover:bg-white/[0.06] flex items-center gap-2 text-xs text-slate-200"
                      >
                        <Share2 className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Havolani nusxalash</span>
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          setActivePicker(null);
                          await handleFieldUpdate({ is_milestone: !task.is_milestone });
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg hover:bg-white/[0.06] flex items-center gap-2 text-xs text-slate-200"
                      >
                        <Star className={`w-3.5 h-3.5 ${task.is_milestone ? 'text-amber-400 fill-current' : 'text-slate-400'}`} />
                        <span>{task.is_milestone ? 'Milestoneni bekor qilish' : '★ Milestone qilish'}</span>
                      </button>

                      <div className="my-1 border-t border-white/[0.06]" />

                      <button
                        type="button"
                        onClick={async () => {
                          setActivePicker(null);
                          try {
                            await api.deleteTask(task.id);
                            addToast({ type: 'info', title: `${task.task_key} savatga o‘tkazildi` });
                            openTaskDrawer(null);
                            onTaskMutated();
                          } catch (err: any) {
                            addToast({ type: 'error', title: 'Ruxsat yo‘q', message: err.message });
                          }
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg hover:bg-rose-500/20 text-rose-400 flex items-center gap-2 text-xs"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Savatga yuborish</span>
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => openTaskDrawer(null)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Title */}
              <div>
                <input
                  type="text"
                  value={titleEdit}
                  onChange={(e) => setTitleEdit(e.target.value)}
                  onBlur={() => {
                    if (titleEdit.trim() && titleEdit.trim() !== task.title) {
                      handleFieldUpdate({ title: titleEdit.trim() });
                    }
                  }}
                  className="w-full text-xl font-bold text-white bg-transparent border border-transparent hover:border-slate-800 focus:border-indigo-500 rounded-xl px-2.5 py-1.5 -ml-2.5 focus:outline-none focus:bg-slate-950"
                />
              </div>

              {/* Attributes Grid (9 fields with custom animated dropdown selectors) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80">
                {/* 1. Custom Status Picker */}
                <div className="relative">
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Status</label>
                  <button
                    type="button"
                    onClick={() => setActivePicker((v) => (v === 'status' ? null : 'status'))}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-indigo-500/50 flex items-center justify-between text-xs font-semibold text-white transition"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{
                          backgroundColor:
                            projectStatuses.find((s) => s.id === task.status_id)?.color || '#6366f1',
                        }}
                      />
                      <span className="truncate">
                        {projectStatuses.find((s) => s.id === task.status_id)?.name || 'Status'}
                      </span>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </button>

                  {activePicker === 'status' && (
                    <div
                      ref={pickerRef}
                      className="absolute left-0 mt-1.5 w-56 rounded-2xl bg-[#141824] border border-white/[0.1] shadow-2xl p-1.5 z-50 animate-popover"
                    >
                      <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-white/[0.06] mb-1">
                        Statusni tanlang
                      </div>
                      <div className="max-h-52 overflow-y-auto space-y-0.5">
                        {projectStatuses.map((st) => (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => {
                              handleFieldUpdate({ status_id: st.id });
                              setActivePicker(null);
                            }}
                            className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-xs transition ${
                              task.status_id === st.id
                                ? 'bg-indigo-600/20 text-white font-bold border border-indigo-500/30'
                                : 'text-slate-300 hover:bg-white/[0.06]'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: st.color }} />
                              <span className="truncate">{st.name}</span>
                            </div>
                            {task.status_id === st.id && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Custom Priority Picker */}
                <div className="relative">
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Ustuvorlik</label>
                  <button
                    type="button"
                    onClick={() => setActivePicker((v) => (v === 'priority' ? null : 'priority'))}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-indigo-500/50 flex items-center justify-between text-xs font-semibold text-white transition"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <Flag className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="capitalize">{task.priority}</span>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </button>

                  {activePicker === 'priority' && (
                    <div
                      ref={pickerRef}
                      className="absolute left-0 mt-1.5 w-52 rounded-2xl bg-[#141824] border border-white/[0.1] shadow-2xl p-1.5 z-50 animate-popover"
                    >
                      <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-white/[0.06] mb-1">
                        Ustuvorlik darajasi
                      </div>
                      {[
                        { key: 'urgent', label: '🔥 Urgent (Shoshilinch)', color: 'text-rose-400' },
                        { key: 'high', label: '⬆️ High (Yuqori)', color: 'text-amber-400' },
                        { key: 'medium', label: '⏺ Medium (O‘rta)', color: 'text-indigo-400' },
                        { key: 'low', label: '⬇️ Low (Past)', color: 'text-sky-400' },
                        { key: 'none', label: '⚪ Belgilanmagan', color: 'text-slate-400' },
                      ].map((prio) => (
                        <button
                          key={prio.key}
                          type="button"
                          onClick={() => {
                            handleFieldUpdate({ priority: prio.key });
                            setActivePicker(null);
                          }}
                          className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-xs transition ${
                            task.priority === prio.key
                              ? 'bg-white/[0.08] text-white font-bold'
                              : 'text-slate-300 hover:bg-white/[0.06]'
                          }`}
                        >
                          <span className={prio.color}>{prio.label}</span>
                          {task.priority === prio.key && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. Custom Assignee Picker */}
                <div className="relative">
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Mas’ul (Assignee)</label>
                  <button
                    type="button"
                    onClick={() => {
                      setActivePicker((v) => (v === 'assignee' ? null : 'assignee'));
                      setAssigneeSearchQ('');
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-indigo-500/50 flex items-center justify-between text-xs font-semibold text-white transition"
                  >
                    <div className="flex items-center gap-2 truncate">
                      {task.assignee ? (
                        <>
                          <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                            {task.assignee.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                          </div>
                          <span className="truncate">{task.assignee.full_name}</span>
                        </>
                      ) : (
                        <span className="text-slate-500">Tayinlanmagan</span>
                      )}
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </button>

                  {activePicker === 'assignee' && (
                    <div
                      ref={pickerRef}
                      className="absolute left-0 mt-1.5 w-60 rounded-2xl bg-[#141824] border border-white/[0.1] shadow-2xl p-2 z-50 animate-popover"
                    >
                      <input
                        type="text"
                        autoFocus
                        value={assigneeSearchQ}
                        onChange={(e) => setAssigneeSearchQ(e.target.value)}
                        placeholder="A’zoni qidiring..."
                        className="w-full px-2.5 py-1 rounded-lg bg-black/40 border border-white/[0.08] text-xs text-white mb-1.5 focus:outline-none focus:border-indigo-500"
                      />
                      <div className="max-h-52 overflow-y-auto space-y-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            handleFieldUpdate({ assignee_id: null });
                            setActivePicker(null);
                          }}
                          className={`w-full px-2 py-1.5 rounded-lg flex items-center justify-between text-xs transition ${
                            !task.assignee_id ? 'bg-white/[0.08] text-white font-semibold' : 'text-slate-400 hover:bg-white/[0.06]'
                          }`}
                        >
                          <span>Tayinlanmagan</span>
                          {!task.assignee_id && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                        </button>
                        {members
                          .filter((m) =>
                            !assigneeSearchQ ||
                            m.full_name.toLowerCase().includes(assigneeSearchQ.toLowerCase())
                          )
                          .map((m) => (
                            <button
                              key={m.user_id}
                              type="button"
                              onClick={() => {
                                handleFieldUpdate({ assignee_id: m.user_id });
                                setActivePicker(null);
                              }}
                              className={`w-full px-2 py-1.5 rounded-lg flex items-center justify-between text-xs transition ${
                                task.assignee_id === m.user_id
                                  ? 'bg-indigo-600/20 text-white font-bold border border-indigo-500/30'
                                  : 'text-slate-300 hover:bg-white/[0.06]'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                                  {m.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                                </div>
                                <div className="text-left truncate">
                                  <div className="truncate">{m.full_name}</div>
                                  <div className="text-[10px] text-slate-500">{m.role}</div>
                                </div>
                              </div>
                              {task.assignee_id === m.user_id && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Custom Sprint Picker */}
                <div className="relative">
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Sprint / Sikl</label>
                  <button
                    type="button"
                    onClick={() => setActivePicker((v) => (v === 'sprint' ? null : 'sprint'))}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-indigo-500/50 flex items-center justify-between text-xs font-semibold text-white transition"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span className="truncate">
                        {projectSprints.find((sp) => sp.id === task.sprint_id)?.name || 'Sprintsiz (Backlog)'}
                      </span>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </button>

                  {activePicker === 'sprint' && (
                    <div
                      ref={pickerRef}
                      className="absolute left-0 mt-1.5 w-60 rounded-2xl bg-[#141824] border border-white/[0.1] shadow-2xl p-1.5 z-50 animate-popover"
                    >
                      <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-white/[0.06] mb-1">
                        Sprintni tanlang
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          handleFieldUpdate({ sprint_id: null });
                          setActivePicker(null);
                        }}
                        className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-xs transition ${
                          !task.sprint_id ? 'bg-white/[0.08] text-white font-semibold' : 'text-slate-400 hover:bg-white/[0.06]'
                        }`}
                      >
                        <span>Sprintsiz (Backlog)</span>
                        {!task.sprint_id && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                      </button>
                      {projectSprints.map((sp) => (
                        <button
                          key={sp.id}
                          type="button"
                          onClick={() => {
                            handleFieldUpdate({ sprint_id: sp.id });
                            setActivePicker(null);
                          }}
                          className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-xs transition ${
                            task.sprint_id === sp.id
                              ? 'bg-indigo-600/20 text-white font-bold border border-indigo-500/30'
                              : 'text-slate-300 hover:bg-white/[0.06]'
                          }`}
                        >
                          <div className="truncate text-left">
                            <div className="font-semibold">{sp.name}</div>
                            <div className="text-[10px] text-slate-400 uppercase">{sp.status}</div>
                          </div>
                          {task.sprint_id === sp.id && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Boshlanish sanasi (Start Date)
                  </label>
                  <input
                    type="date"
                    value={task.start_date ? task.start_date.slice(0, 10) : ''}
                    onChange={(e) => handleFieldUpdate({ start_date: e.target.value || null })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Muddat (Due Date)
                  </label>
                  <input
                    type="date"
                    value={task.due_at ? task.due_at.slice(0, 10) : ''}
                    onChange={(e) =>
                      handleFieldUpdate({ due_at: e.target.value ? `${e.target.value}T18:00:00Z` : null })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Story Points</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={task.story_points ?? ''}
                    onChange={(e) =>
                      handleFieldUpdate({ story_points: e.target.value !== '' ? Number(e.target.value) : null })
                    }
                    placeholder="0"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Reja vaqti (Estimate daq.)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={task.estimate_minutes ?? ''}
                    onChange={(e) =>
                      handleFieldUpdate({
                        estimate_minutes: e.target.value !== '' ? Number(e.target.value) : null,
                      })
                    }
                    placeholder="120"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Sarflangan vaqt (Logged)
                  </label>
                  <div className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs flex items-center justify-between">
                    <span className="text-emerald-400 font-semibold">{task.logged_minutes} daq.</span>
                    <span className="text-slate-500">
                      ({(task.logged_minutes / 60).toFixed(1)} soat)
                    </span>
                  </div>
                </div>
              </div>

              {/* Labels */}
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-2">
                  <Tag className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Teglar (Labels)</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {workspaceLabels.map((lbl) => {
                    const active = task.labels.some((l) => l.id === lbl.id);
                    return (
                      <button
                        key={lbl.id}
                        type="button"
                        onClick={() => handleToggleLabel(lbl.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition flex items-center gap-1.5 ${
                          active
                            ? 'bg-slate-800 border-white/40 text-white'
                            : 'bg-slate-950/60 border-slate-800 text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: lbl.color }} />
                        <span>{lbl.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Description */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-400">Vazifa tavsifi</span>
                  {!isEditingDesc && (
                    <button
                      onClick={() => setIsEditingDesc(true)}
                      className="text-xs text-indigo-400 hover:text-indigo-300"
                    >
                      Tahrirlash
                    </button>
                  )}
                </div>
                {isEditingDesc ? (
                  <div className="space-y-2">
                    <textarea
                      rows={4}
                      value={descEdit}
                      onChange={(e) => setDescEdit(e.target.value)}
                      className="w-full p-3 rounded-xl bg-slate-950 border border-indigo-500 text-sm text-slate-200 focus:outline-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setDescEdit(task.description || '');
                          setIsEditingDesc(false);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-300"
                      >
                        Bekor qilish
                      </button>
                      <button
                        onClick={async () => {
                          await handleFieldUpdate({ description: descEdit });
                          setIsEditingDesc(false);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 text-xs font-semibold text-white"
                      >
                        Saqlash
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => setIsEditingDesc(true)}
                    className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-sm text-slate-300 whitespace-pre-wrap cursor-pointer hover:border-slate-700"
                  >
                    {task.description || 'Tavsif kiritilmagan. Qo‘shish uchun bosing...'}
                  </div>
                )}
              </div>

              {/* Subtasks */}
              <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                    <GitBranch className="w-4 h-4 text-indigo-400" />
                    <span>
                      Ichki Vazifalar (Subtasks) — {task.subtasks?.filter((s) => s.completed_at).length || 0}/
                      {task.subtasks?.length || 0}
                    </span>
                  </div>
                </div>

                {task.subtasks && task.subtasks.length > 0 && (
                  <div className="space-y-1.5">
                    {task.subtasks.map((st) => (
                      <div
                        key={st.id}
                        onClick={() => openTaskDrawer(st.id)}
                        className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800/80 cursor-pointer transition"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <CheckCircle2
                            className={`w-4 h-4 shrink-0 ${
                              st.completed_at ? 'text-emerald-400' : 'text-slate-600'
                            }`}
                          />
                          <span className="text-xs font-mono text-indigo-400">{st.task_key}</span>
                          <span
                            className={`text-xs truncate ${
                              st.completed_at ? 'line-through text-slate-500' : 'text-slate-200'
                            }`}
                          >
                            {st.title}
                          </span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 shrink-0">
                          {st.status?.name || 'Todo'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <form onSubmit={handleAddSubtask} className="flex gap-2">
                  <input
                    type="text"
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    placeholder="Yangi subtask qo‘shish..."
                    className="flex-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs font-medium transition"
                  >
                    + Subtask
                  </button>
                </form>
              </div>

              {/* Checklists */}
              <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800/80 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                    <CheckSquare className="w-4 h-4 text-emerald-400" />
                    <span>Checklistlar ({task.checklists_summary.done}/{task.checklists_summary.total})</span>
                  </div>
                </div>

                {task.checklists?.map((cl) => {
                  const total = cl.items.length;
                  const done = cl.items.filter((i) => i.is_completed).length;
                  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                  return (
                    <div key={cl.id} className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{cl.title}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-emerald-400 font-semibold">{pct}%</span>
                          <button
                            onClick={async () => {
                              const res = await api.deleteChecklist(cl.id);
                              setTask(res.task);
                              onTaskMutated();
                            }}
                            className="text-slate-500 hover:text-rose-400 text-xs"
                          >
                            O‘chirish
                          </button>
                        </div>
                      </div>

                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      <div className="space-y-1.5">
                        {cl.items.map((item) => (
                          <div key={item.id} className="flex items-center justify-between group">
                            <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-200">
                              <input
                                type="checkbox"
                                checked={item.is_completed}
                                onChange={() => handleToggleChecklistItem(item.id, item.is_completed)}
                                className="rounded border-slate-700 bg-slate-950 text-indigo-600"
                              />
                              <span className={item.is_completed ? 'line-through text-slate-500' : ''}>
                                {item.title}
                              </span>
                            </label>
                            <button
                              onClick={async () => {
                                const res = await api.deleteChecklistItem(item.id);
                                setTask(res.task);
                                onTaskMutated();
                              }}
                              className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 text-xs"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2 pt-1">
                        <input
                          type="text"
                          value={newItemTexts[cl.id] || ''}
                          onChange={(e) =>
                            setNewItemTexts((prev) => ({ ...prev, [cl.id]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddChecklistItem(cl.id);
                            }
                          }}
                          placeholder="Yangi band qo‘shish..."
                          className="flex-1 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddChecklistItem(cl.id)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200"
                        >
                          Qo‘shish
                        </button>
                      </div>
                    </div>
                  );
                })}

                <form onSubmit={handleAddChecklist} className="flex gap-2">
                  <input
                    type="text"
                    value={newChecklistTitle}
                    onChange={(e) => setNewChecklistTitle(e.target.value)}
                    placeholder="Yangi checklist nomi (masalan: Deploy oldidan tekshiruv)..."
                    className="flex-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs font-medium transition"
                  >
                    + Checklist
                  </button>
                </form>
              </div>

              {/* Dependencies (Blocked By / Blocking) */}
              <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                    <Link2 className="w-4 h-4 text-amber-400" />
                    <span>Vazifa Bog‘liqliklari (Dependencies & Blockers)</span>
                  </div>
                  {task.unresolved_blockers_count > 0 && !task.completed_at && (
                    <button
                      onClick={() => {
                        const doneStatus = projectStatuses.find((s) => s.category === 'done');
                        if (doneStatus) {
                          handleFieldUpdate({ status_id: doneStatus.id, force: true });
                        }
                      }}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold"
                    >
                      Blokerga qaramay yakunlash (Force Done)
                    </button>
                  )}
                </div>

                {task.dependencies?.blocked_by && task.dependencies.blocked_by.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] text-rose-400 font-medium">
                      To‘sib turgan vazifalar (Blocked By):
                    </div>
                    {task.dependencies.blocked_by.map((dep) => (
                      <div
                        key={dep.id}
                        className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs"
                      >
                        <div
                          onClick={() => openTaskDrawer(dep.task_id)}
                          className="flex items-center gap-2 cursor-pointer hover:text-indigo-300"
                        >
                          <span className="font-mono font-bold text-rose-400">{dep.task_key}</span>
                          <span className={dep.is_resolved ? 'line-through text-slate-500' : 'text-slate-200'}>
                            {dep.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                            {dep.status_name}
                          </span>
                          <button
                            onClick={async () => {
                              const res = await api.removeDependency(dep.id);
                              setTask(res.task);
                              onTaskMutated();
                            }}
                            className="text-slate-500 hover:text-rose-400"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {task.dependencies?.blocking && task.dependencies.blocking.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] text-amber-400 font-medium">
                      Ushbu vazifa to‘sib turgan vazifalar (Blocking):
                    </div>
                    {task.dependencies.blocking.map((dep) => (
                      <div
                        key={dep.id}
                        onClick={() => openTaskDrawer(dep.task_id)}
                        className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs cursor-pointer hover:border-slate-700"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-amber-400">{dep.task_key}</span>
                          <span className="text-slate-200">{dep.title}</span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                          {dep.status_name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <form onSubmit={handleAddDependency} className="flex gap-2">
                  <select
                    value={selectedBlockerId}
                    onChange={(e) => setSelectedBlockerId(e.target.value ? Number(e.target.value) : '')}
                    className="flex-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white"
                  >
                    <option value="">Bloker vazifani tanlang (sikl avtomatik tekshiriladi)...</option>
                    {projectTasks
                      .filter((pt) => pt.id !== task.id)
                      .map((pt) => (
                        <option key={pt.id} value={pt.id}>
                          {pt.task_key}: {pt.title}
                        </option>
                      ))}
                  </select>
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-xl bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/30 text-xs font-medium transition"
                  >
                    Bog‘lash
                  </button>
                </form>
              </div>

              {/* Real File Upload & Attachments */}
              <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                    <Paperclip className="w-4 h-4 text-sky-400" />
                    <span>Biriktirilgan Fayllar ({task.attachments?.length || 0})</span>
                  </div>

                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileUploadChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={uploadingFile}
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-sky-600/20 hover:bg-sky-600 text-sky-300 hover:text-white border border-sky-500/30 text-xs font-semibold transition"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploadingFile ? 'Yuklanmoqda...' : 'Kompyuterdan fayl yuklash'}</span>
                    </button>
                  </div>
                </div>

                {task.attachments && task.attachments.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {task.attachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          {att.file_url && att.file_url !== '#' ? (
                            <a
                              href={att.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1.5 text-sky-400 hover:underline truncate font-medium"
                            >
                              <span className="truncate">{att.original_name}</span>
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          ) : (
                            <span className="truncate text-slate-200 block">{att.original_name}</span>
                          )}
                          <span className="text-[10px] text-slate-500">
                            {(att.size_bytes / 1024).toFixed(1)} KB
                          </span>
                        </div>
                        <button
                          onClick={async () => {
                            const res = await api.deleteAttachment(att.id);
                            setTask(res.task);
                          }}
                          className="text-slate-500 hover:text-rose-400 ml-2"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newAttachmentName.trim()) return;
                    const res = await api.addAttachment(task.id, {
                      original_name: newAttachmentName.trim(),
                      file_url: newAttachmentName.startsWith('http') ? newAttachmentName.trim() : '#',
                      mime_type: 'application/octet-stream',
                      size_bytes: 12800,
                    });
                    setTask(res.task);
                    setNewAttachmentName('');
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={newAttachmentName}
                    onChange={(e) => setNewAttachmentName(e.target.value)}
                    placeholder="Yoki hujjat/Figma havolasini kiriting..."
                    className="flex-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-200"
                  >
                    Qo‘shish
                  </button>
                </form>
              </div>

              {/* Bottom Tabs: Comments | Time Tracking | Audit History */}
              <div className="border-t border-slate-800 pt-4">
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setActiveBottomTab('comments')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                      activeBottomTab === 'comments'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Izohlar ({task.comments?.length || 0})</span>
                  </button>
                  <button
                    onClick={() => setActiveBottomTab('time')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                      activeBottomTab === 'time'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Vaqt Jurnali ({task.time_entries?.length || 0})</span>
                  </button>
                  <button
                    onClick={() => setActiveBottomTab('history')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                      activeBottomTab === 'history'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>O‘zgarishlar Tarixi ({task.activities?.length || 0})</span>
                  </button>
                </div>

                {/* Tab 1: Comments */}
                {activeBottomTab === 'comments' && (
                  <div className="space-y-4">
                    <form onSubmit={handleAddComment} className="space-y-2">
                      <textarea
                        rows={2}
                        value={commentBody}
                        onChange={(e) => setCommentBody(e.target.value)}
                        placeholder="Izoh yozing... (@username orqali jamoa a’zosini chaqiring, masalan @malika yoki @javohir)"
                        className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">
                          Maslahat: @mention yozilganda foydalanuvchi Inbox markaziga xabar boradi.
                        </span>
                        <button
                          type="submit"
                          className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Yuborish</span>
                        </button>
                      </div>
                    </form>

                    <div className="space-y-3">
                      {task.comments?.map((c) => (
                        <div
                          key={c.id}
                          className={`p-3.5 rounded-2xl border ${
                            c.is_pinned
                              ? 'bg-indigo-950/20 border-indigo-500/40'
                              : 'bg-slate-950/70 border-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">
                                {c.author?.full_name || 'A’zo'}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                @{c.author?.username}
                              </span>
                              {c.edited_at && (
                                <span className="text-[10px] text-slate-500 italic">(tahrirlangan)</span>
                              )}
                              {c.is_pinned && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-semibold flex items-center gap-1">
                                  <Pin className="w-2.5 h-2.5" /> Qadalgan
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setEditingCommentId(c.id);
                                  setEditingCommentText(c.body);
                                }}
                                className="text-slate-500 hover:text-sky-400"
                                title="Izohni tahrirlash"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={async () => {
                                  const res = await api.updateComment(c.id, { is_pinned: !c.is_pinned });
                                  setTask(res.task);
                                }}
                                className="text-slate-500 hover:text-indigo-400"
                                title="Izohni qadash (Pin)"
                              >
                                <Pin className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={async () => {
                                  const res = await api.deleteComment(c.id);
                                  setTask(res.task);
                                }}
                                className="text-slate-500 hover:text-rose-400 text-xs"
                              >
                                ×
                              </button>
                            </div>
                          </div>

                          {editingCommentId === c.id ? (
                            <div className="space-y-2 my-2">
                              <textarea
                                rows={2}
                                value={editingCommentText}
                                onChange={(e) => setEditingCommentText(e.target.value)}
                                className="w-full p-2.5 rounded-xl bg-slate-900 border border-indigo-500 text-xs text-white"
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => setEditingCommentId(null)}
                                  className="px-2.5 py-1 rounded bg-slate-800 text-[11px] text-slate-300"
                                >
                                  Bekor
                                </button>
                                <button
                                  onClick={async () => {
                                    try {
                                      const res = await api.updateComment(c.id, {
                                        body: editingCommentText,
                                      });
                                      setTask(res.task);
                                      setEditingCommentId(null);
                                    } catch (err: any) {
                                      addToast({ type: 'error', title: 'Xatolik', message: err.message });
                                    }
                                  }}
                                  className="px-2.5 py-1 rounded bg-indigo-600 text-[11px] font-semibold text-white"
                                >
                                  Saqlash
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap mb-2.5">
                              {c.body}
                            </p>
                          )}

                          {/* Emoji reactions */}
                          <div className="flex items-center gap-1.5">
                            {['👍', '🔥', '✅', '🚀'].map((emoji) => {
                              const users = c.reactions?.[emoji] || [];
                              return (
                                <button
                                  key={emoji}
                                  onClick={async () => {
                                    const res = await api.reactComment(c.id, emoji);
                                    setTask(res.task);
                                  }}
                                  className={`px-2 py-0.5 rounded-lg text-[11px] border transition ${
                                    users.length > 0
                                      ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-200'
                                      : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                                  }`}
                                >
                                  {emoji} {users.length > 0 && users.length}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tab 2: Time Tracking */}
                {activeBottomTab === 'time' && (
                  <div className="space-y-4">
                    <form onSubmit={handleLogTime} className="flex flex-wrap gap-2">
                      <input
                        type="number"
                        min={1}
                        required
                        value={timeMinutes}
                        onChange={(e) => setTimeMinutes(e.target.value)}
                        placeholder="Daqiqa (masalan: 60)"
                        className="w-36 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                      />
                      <input
                        type="text"
                        value={timeDesc}
                        onChange={(e) => setTimeDesc(e.target.value)}
                        placeholder="Bajarilgan ish tavsifi..."
                        className="flex-1 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                      />
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white"
                      >
                        + Vaqt Qo‘shish
                      </button>
                    </form>

                    <div className="space-y-2">
                      {task.time_entries?.map((te) => (
                        <div
                          key={te.id}
                          className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs"
                        >
                          <div>
                            <div className="font-semibold text-white">
                              {te.duration_minutes} daqiqa — {te.user?.full_name}
                            </div>
                            <div className="text-slate-400">{te.description}</div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-slate-500">{te.logged_date}</span>
                            <button
                              onClick={async () => {
                                const res = await api.deleteTimeEntry(te.id);
                                setTask(res.task);
                                onTaskMutated();
                              }}
                              className="text-slate-500 hover:text-rose-400"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tab 3: Activity History */}
                {activeBottomTab === 'history' && (
                  <div className="space-y-2.5">
                    {task.activities?.map((act) => (
                      <div
                        key={act.id}
                        className="flex items-start justify-between px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs"
                      >
                        <div className="space-y-0.5">
                          <span className="font-semibold text-indigo-300">
                            {act.actor?.full_name || 'Tizim'}:{' '}
                          </span>
                          <span className="text-slate-300">{act.summary}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 shrink-0 ml-3">
                          {act.created_at.slice(0, 16).replace('T', ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
