import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  Layers,
  FolderPlus,
  Rocket,
  PlusCircle,
  Building2,
  FileText,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Calendar,
  Flag,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAppStore } from '../../store/useAppStore';
import type { HierarchyTree, WorkspaceMember } from '../../types/flowforge';

interface CreateModalsProps {
  hierarchy: HierarchyTree | null;
  members: WorkspaceMember[];
  onRefreshAll: () => void;
}

export const CreateModals: React.FC<CreateModalsProps> = ({
  hierarchy,
  members,
  onRefreshAll,
}) => {
  const {
    activeWorkspaceId,
    activeProjectId,
    modalType,
    modalContext,
    closeModal,
    isCommandOpen,
    setCommandOpen,
    openProject,
    openTaskDrawer,
    navigateRail,
    openSettings,
    setActiveWorkspaceId,
    addToast,
  } = useAppStore();

  // Command Palette state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ tasks: any[]; projects: any[]; docs: any[] }>({
    tasks: [],
    projects: [],
    docs: [],
  });

  // Form states
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [keyCode, setKeyCode] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [templateType, setTemplateType] = useState<'software' | 'marketing' | 'kanban'>('software');
  const [spaceId, setSpaceId] = useState<number | ''>('');
  const [folderId, setFolderId] = useState<number | ''>('');
  const [priority, setPriority] = useState('medium');
  const [assigneeId, setAssigneeId] = useState<number | ''>('');
  const [dueAt, setDueAt] = useState('');
  const [estimateMinutes, setEstimateMinutes] = useState('');
  const [storyPoints, setStoryPoints] = useState('');
  const [projectIdForTask, setProjectIdForTask] = useState<number | ''>('');
  const [statusIdForTask, setStatusIdForTask] = useState<number | ''>('');

  useEffect(() => {
    if (modalType) {
      setName('');
      setKeyCode('');
      setDescription('');
      setColor('#6366f1');
      setTemplateType('software');
      setSpaceId(modalContext.space_id || (hierarchy?.spaces?.[0]?.id ?? ''));
      setFolderId(modalContext.folder_id || '');
      setPriority(modalContext.priority || 'medium');
      setAssigneeId('');
      setDueAt(modalContext.due_at || '');
      setEstimateMinutes('');
      setStoryPoints('');
      setProjectIdForTask(modalContext.project_id || activeProjectId || (hierarchy?.all_projects?.[0]?.id ?? ''));
      setStatusIdForTask(modalContext.status_id || '');
    }
  }, [modalType, modalContext, activeProjectId, hierarchy]);

  // Global keyboard shortcut Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen(!isCommandOpen);
      } else if (e.key === 'Escape' && isCommandOpen) {
        setCommandOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandOpen, setCommandOpen]);

  useEffect(() => {
    if (!isCommandOpen || !activeWorkspaceId) return;
    const timer = setTimeout(async () => {
      try {
        const res = await api.search(activeWorkspaceId, searchQuery);
        setSearchResults({
          tasks: res.tasks || [],
          projects: res.projects || [],
          docs: res.docs || [],
        });
      } catch {
        // ignore search errors
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [isCommandOpen, searchQuery, activeWorkspaceId]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspaceId && modalType !== 'create_workspace') return;
    setLoading(true);

    try {
      if (modalType === 'create_workspace') {
        const res = await api.createWorkspace({ name, description });
        addToast({ type: 'success', title: 'Workspace yaratildi', message: res.workspace.name });
        setActiveWorkspaceId(res.workspace.id);
        closeModal();
        onRefreshAll();
      } else if (modalType === 'create_space' && activeWorkspaceId) {
        await api.createSpace(activeWorkspaceId, {
          name,
          key_code: keyCode || undefined,
          description,
          color,
        });
        addToast({ type: 'success', title: 'Yangi Space (Bo‘lim) yaratildi', message: name });
        closeModal();
        onRefreshAll();
      } else if (modalType === 'create_folder') {
        const targetSpace = Number(spaceId);
        if (!targetSpace) throw new Error('Avval Space (Bo‘lim) tanlang.');
        await api.createFolder(targetSpace, { name, color });
        addToast({ type: 'success', title: 'Papka yaratildi', message: name });
        closeModal();
        onRefreshAll();
      } else if (modalType === 'create_project' && activeWorkspaceId) {
        const res = await api.createProject(activeWorkspaceId, {
          name,
          project_key: keyCode || undefined,
          description,
          color,
          template_type: templateType,
          space_id: spaceId ? Number(spaceId) : null,
          folder_id: folderId ? Number(folderId) : null,
        });
        addToast({
          type: 'success',
          title: 'Yangi loyiha ishga tushirildi',
          message: `${res.project.name} (${res.project.project_key})`,
        });
        closeModal();
        onRefreshAll();
        openProject(res.project.id, 'board');
      } else if (modalType === 'create_task') {
        const targetProj = Number(projectIdForTask);
        if (!targetProj) throw new Error('Loyiha tanlanishi shart.');
        const res = await api.createTask(targetProj, {
          title: name,
          description,
          priority,
          status_id: statusIdForTask ? Number(statusIdForTask) : undefined,
          assignee_id: assigneeId ? Number(assigneeId) : null,
          due_at: dueAt ? `${dueAt}T18:00:00Z` : null,
          estimate_minutes: estimateMinutes ? Number(estimateMinutes) : null,
          story_points: storyPoints ? Number(storyPoints) : null,
        });
        addToast({
          type: 'success',
          title: `Vazifa yaratildi: ${res.task.task_key}`,
          message: res.task.title,
        });
        closeModal();
        onRefreshAll();
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Xatolik', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#a855f7', '#ef4444'];

  return (
    <>
      {/* 1. Command Palette (Ctrl+K) */}
      {isCommandOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-start justify-center pt-20 p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-800">
              <Search className="w-5 h-5 text-indigo-400" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Vazifa kodi (FF-3), loyiha, hujjat qidiring yoki buyruq tanlang..."
                className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
              />
              <kbd className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                ESC
              </kbd>
              <button
                onClick={() => setCommandOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[420px] overflow-y-auto p-3 space-y-4">
              {/* Quick Commands */}
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-2 mb-1.5">
                  Tezkor Buyruqlar
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  <button
                    onClick={() => {
                      setCommandOpen(false);
                      useAppStore.getState().openModal('create_task');
                    }}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/60 hover:bg-indigo-600/20 hover:border-indigo-500/40 border border-slate-800 text-xs text-slate-200 transition"
                  >
                    <PlusCircle className="w-4 h-4 text-indigo-400" />
                    <span>Yangi Vazifa</span>
                  </button>
                  <button
                    onClick={() => {
                      setCommandOpen(false);
                      useAppStore.getState().openModal('create_project');
                    }}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/60 hover:bg-indigo-600/20 hover:border-indigo-500/40 border border-slate-800 text-xs text-slate-200 transition"
                  >
                    <Rocket className="w-4 h-4 text-emerald-400" />
                    <span>Yangi Loyiha</span>
                  </button>
                  <button
                    onClick={() => {
                      setCommandOpen(false);
                      navigateRail('my_work');
                    }}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/60 hover:bg-indigo-600/20 hover:border-indigo-500/40 border border-slate-800 text-xs text-slate-200 transition"
                  >
                    <CheckCircle2 className="w-4 h-4 text-sky-400" />
                    <span>Mening Kunim</span>
                  </button>
                  <button
                    onClick={() => {
                      setCommandOpen(false);
                      navigateRail('reports');
                    }}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/60 hover:bg-indigo-600/20 hover:border-indigo-500/40 border border-slate-800 text-xs text-slate-200 transition"
                  >
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Analitika & Hisobot</span>
                  </button>
                  <button
                    onClick={() => {
                      setCommandOpen(false);
                      openSettings('my_profile');
                    }}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/60 hover:bg-indigo-600/20 hover:border-indigo-500/40 border border-slate-800 text-xs text-slate-200 transition"
                  >
                    <Layers className="w-4 h-4 text-pink-400" />
                    <span>Profil & Sozlamalar</span>
                  </button>
                  <button
                    onClick={() => {
                      setCommandOpen(false);
                      openSettings('ws_members');
                    }}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/60 hover:bg-indigo-600/20 hover:border-indigo-500/40 border border-slate-800 text-xs text-slate-200 transition"
                  >
                    <Building2 className="w-4 h-4 text-violet-400" />
                    <span>Jamoa & Rollar</span>
                  </button>
                </div>
              </div>

              {/* Tasks */}
              {searchResults.tasks.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-2 mb-1.5">
                    Vazifalar ({searchResults.tasks.length})
                  </div>
                  <div className="space-y-1">
                    {searchResults.tasks.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          setCommandOpen(false);
                          openTaskDrawer(t.id);
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-800/80 text-left transition"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-xs font-mono font-semibold text-indigo-400 shrink-0">
                            {t.task_key}
                          </span>
                          <span className="text-xs text-slate-200 truncate">{t.title}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                            {t.project_name}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Projects */}
              {searchResults.projects.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-2 mb-1.5">
                    Loyihalar ({searchResults.projects.length})
                  </div>
                  <div className="space-y-1">
                    {searchResults.projects.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setCommandOpen(false);
                          openProject(p.id, 'board');
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-800/80 text-left transition"
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: p.color || '#6366f1' }}
                          />
                          <span className="text-xs font-medium text-white">{p.name}</span>
                          <span className="text-[10px] font-mono text-slate-400">({p.project_key})</span>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Docs */}
              {searchResults.docs.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-2 mb-1.5">
                    Loyiha Wiki Hujjatlari ({searchResults.docs.length})
                  </div>
                  <div className="space-y-1">
                    {searchResults.docs.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => {
                          setCommandOpen(false);
                          openProject(d.project_id, 'docs');
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-800/80 text-left transition"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-xs text-slate-200">{d.title}</span>
                        </div>
                        <span className="text-[10px] text-slate-500">{d.project_name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. Creation Modals */}
      {modalType && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                {modalType === 'create_workspace' && <Building2 className="w-5 h-5 text-indigo-400" />}
                {modalType === 'create_space' && <Layers className="w-5 h-5 text-indigo-400" />}
                {modalType === 'create_folder' && <FolderPlus className="w-5 h-5 text-indigo-400" />}
                {modalType === 'create_project' && <Rocket className="w-5 h-5 text-indigo-400" />}
                {modalType === 'create_task' && <PlusCircle className="w-5 h-5 text-indigo-400" />}
                <h3 className="text-base font-bold text-white">
                  {modalType === 'create_workspace' && 'Yangi Workspace yaratish'}
                  {modalType === 'create_space' && 'Yangi Space (Bo‘lim) yaratish'}
                  {modalType === 'create_folder' && 'Space ichida Papka (Folder) yaratish'}
                  {modalType === 'create_project' && 'Yangi Loyiha yaratish'}
                  {modalType === 'create_task' && 'Yangi Vazifa yaratish'}
                </h3>
              </div>
              <button onClick={closeModal} className="text-slate-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {modalType === 'create_task' ? 'Vazifa sarlavhasi *' : 'Nomi *'}
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={
                    modalType === 'create_task'
                      ? 'Masalan: OAuth2 integratsiyasini yakunlash'
                      : modalType === 'create_project'
                      ? 'Masalan: Mobile Banking SuperApp'
                      : modalType === 'create_space'
                      ? 'Masalan: Product & Design'
                      : 'Nomini kiriting...'
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {(modalType === 'create_space' || modalType === 'create_project') && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Qisqa kod (Prefiks)
                    </label>
                    <input
                      type="text"
                      maxLength={8}
                      value={keyCode}
                      onChange={(e) => setKeyCode(e.target.value.toUpperCase())}
                      placeholder="Avto (masalan: APP)"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono uppercase text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Rang belgisi
                    </label>
                    <div className="flex items-center gap-2 pt-1.5">
                      {COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setColor(c)}
                          className={`w-6 h-6 rounded-full border-2 transition ${
                            color === c ? 'border-white scale-110' : 'border-transparent opacity-70'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {(modalType === 'create_folder' || modalType === 'create_project') && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Space (Bo‘lim)
                    </label>
                    <select
                      value={spaceId}
                      onChange={(e) => {
                        setSpaceId(e.target.value ? Number(e.target.value) : '');
                        setFolderId('');
                      }}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">Bo‘limsiz (Root)</option>
                      {hierarchy?.spaces.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.key_code})
                        </option>
                      ))}
                    </select>
                  </div>

                  {modalType === 'create_project' && (
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Ichki Papka (Folder)
                      </label>
                      <select
                        value={folderId}
                        onChange={(e) => setFolderId(e.target.value ? Number(e.target.value) : '')}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                      >
                        <option value="">Papkasiz (To‘g‘ridan-to‘g‘ri Space ichida)</option>
                        {hierarchy?.spaces
                          .find((s) => s.id === Number(spaceId))
                          ?.folders.map((f) => (
                            <option key={f.id} value={f.id}>
                              📁 {f.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {modalType === 'create_project' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Loyiha Shabloni (Status ustunlari va Wiki avtomatik sozlanadi)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'software', title: 'IT & Software', sub: 'Backlog, Todo, In Progress, QA, Done' },
                      { id: 'marketing', title: 'Marketing / GTM', sub: 'G‘oya, Reja, Kontent, Review, E’lon' },
                      { id: 'kanban', title: 'Oddiy Kanban', sub: 'To Do, Doing, Done' },
                    ].map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => setTemplateType(tpl.id as any)}
                        className={`p-2.5 rounded-xl border text-left transition ${
                          templateType === tpl.id
                            ? 'bg-indigo-600/20 border-indigo-500 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-semibold mb-0.5">{tpl.title}</div>
                        <div className="text-[10px] text-slate-400 leading-tight">{tpl.sub}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {modalType === 'create_task' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Loyiha *
                      </label>
                      <select
                        required
                        value={projectIdForTask}
                        onChange={(e) => setProjectIdForTask(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                      >
                        {hierarchy?.all_projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            [{p.project_key}] {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Mas’ul a’zo (Assignee)
                      </label>
                      <select
                        value={assigneeId}
                        onChange={(e) => setAssigneeId(e.target.value ? Number(e.target.value) : '')}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                      >
                        <option value="">Tayinlanmagan</option>
                        {members.map((m) => (
                          <option key={m.user_id} value={m.user_id}>
                            {m.full_name} ({m.role})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        <Flag className="w-3 h-3 inline mr-1" /> Ustuvorlik
                      </label>
                      <select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value)}
                        className="w-full px-2.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                      >
                        <option value="urgent">🔥 Urgent</option>
                        <option value="high">⬆️ High</option>
                        <option value="medium">⏺ Medium</option>
                        <option value="low">⬇️ Low</option>
                        <option value="none">⚪ None</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        <Calendar className="w-3 h-3 inline mr-1" /> Muddat
                      </label>
                      <input
                        type="date"
                        value={dueAt}
                        onChange={(e) => setDueAt(e.target.value)}
                        className="w-full px-2.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Vaqt (daq.)
                      </label>
                      <input
                        type="number"
                        min={0}
                        placeholder="120"
                        value={estimateMinutes}
                        onChange={(e) => setEstimateMinutes(e.target.value)}
                        className="w-full px-2.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Story Points
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        placeholder="5"
                        value={storyPoints}
                        onChange={(e) => setStoryPoints(e.target.value)}
                        className="w-full px-2.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                      />
                    </div>
                  </div>
                </>
              )}

              {modalType !== 'create_folder' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Tavsif va tafsilotlar
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Batafsil ma’lumot, qabul mezonlari yoki eslatmalar..."
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-semibold text-white shadow-lg shadow-indigo-600/25"
                >
                  {loading ? 'Saqlanmoqda...' : 'Yaratish va Saqlash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
