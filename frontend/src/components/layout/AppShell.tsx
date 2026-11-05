import React, { useState, useEffect, useRef } from 'react';
import {
  Home,
  Bell,
  CheckSquare,
  FolderKanban,
  FileText,
  Clock,
  BarChart3,
  Settings,
  LogOut,
  Search,
  Plus,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Folder,
  Star,
  Building2,
  User as UserIcon,
  Shield,
  Users,
  UsersRound,
  KeyRound,
  Tag,
  FileSearch,
  Trash2,
  ArrowLeft,
  Square,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Calendar,
  GitMerge,
  ListFilter,
  Kanban,
  LayoutDashboard,
  Menu,
  Check,
  Globe,
  Sliders,
  Activity,
  Layers,
  Rocket,
  MoreHorizontal,
  Share2,
} from 'lucide-react';
import { api, setStoredToken } from '../../lib/api';
import { useAppStore, type ProjectTab, type SettingsTab } from '../../store/useAppStore';
import type { HierarchyTree, WorkspaceMember, Label } from '../../types/flowforge';
import { PulseDashboardView } from '../views/PulseDashboardView';
import { InboxView } from '../views/InboxView';
import { MyWorkView } from '../views/MyWorkView';
import { ReportsAnalyticsView } from '../views/ReportsAnalyticsView';
import { SettingsCenterView } from '../views/SettingsCenterView';
import { ProjectWorkspaceView } from '../views/ProjectWorkspaceView';
import { TaskDetailDrawer } from '../task/TaskDetailDrawer';
import { CreateModals } from '../modals/CreateModals';

interface AppShellProps {
  onLogout: () => void;
}

type SidebarDrillLevel = 'root' | 'space' | 'project' | 'settings';
type AvatarMenuDrill = 'root' | 'status' | 'workspace' | 'density' | 'timezone';

export const AppShell: React.FC<AppShellProps> = ({ onLogout }) => {
  const {
    user,
    setUser,
    workspaces,
    activeWorkspaceId,
    setActiveWorkspaceId,
    unreadNotificationsCount,
    railSection,
    navigateRail,
    isSecondarySidebarOpen,
    toggleSecondarySidebar,
    activeProjectId,
    openProject,
    projectTab,
    setProjectTab,
    settingsTab,
    openSettings,
    setSettingsTab,
    openTaskDrawer,
    setCommandOpen,
    openModal,
    activeTimer,
    stopTimer,
    toasts,
    removeToast,
    addToast,
    setBootstrapData,
  } = useAppStore();

  const [hierarchy, setHierarchy] = useState<HierarchyTree | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Single Unified Sidebar Drill-Down State (YouTube Studio style)
  const [sidebarDrill, setSidebarDrill] = useState<SidebarDrillLevel>('root');
  const [selectedSpaceId, setSelectedSpaceId] = useState<number | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Record<number, boolean>>({});

  // Top-Right Popovers (YouTube-style "+ Create" & Multi-level Avatar Menu)
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [avatarMenuDrill, setAvatarMenuDrill] = useState<AvatarMenuDrill>('root');

  // Interactive Drill-Down Breadcrumbs State
  const [breadcrumbDropdown, setBreadcrumbDropdown] = useState<'workspace' | 'space' | 'project' | 'view' | 'actions' | null>(null);
  const [breadcrumbProjectSearch, setBreadcrumbProjectSearch] = useState('');
  const breadcrumbBarRef = useRef<HTMLDivElement>(null);

  const createMenuRef = useRef<HTMLDivElement>(null);
  const avatarMenuRef = useRef<HTMLDivElement>(null);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];
  const currentProject = hierarchy?.all_projects.find((p) => p.id === activeProjectId) || null;
  const currentSpace =
    hierarchy?.spaces.find((s) => s.id === selectedSpaceId) ||
    hierarchy?.spaces.find((s) => s.id === currentProject?.space_id) ||
    null;

  // Synchronize sidebar drill state with active section
  useEffect(() => {
    if (railSection === 'settings') {
      setSidebarDrill('settings');
    } else if (railSection === 'spaces' && activeProjectId) {
      setSidebarDrill('project');
    } else if (
      ['pulse', 'inbox', 'my_work', 'docs', 'timesheets', 'reports'].includes(railSection)
    ) {
      setSidebarDrill('root');
    }
  }, [railSection, activeProjectId]);

  // Close popovers on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (createMenuRef.current && !createMenuRef.current.contains(e.target as Node)) {
        setCreateMenuOpen(false);
      }
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target as Node)) {
        setAvatarMenuOpen(false);
        setAvatarMenuDrill('root');
      }
      if (breadcrumbBarRef.current && !breadcrumbBarRef.current.contains(e.target as Node)) {
        setBreadcrumbDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const refreshAllWorkspaceData = async () => {
    try {
      const boot = await api.bootstrap();
      setBootstrapData(boot);
      const targetWsId = useAppStore.getState().activeWorkspaceId || boot.workspaces?.[0]?.id;
      if (!targetWsId) return;

      const [treeRes, memRes, lblRes] = await Promise.all([
        api.getHierarchy(targetWsId),
        api.getMembers(targetWsId),
        api.getLabels(targetWsId),
      ]);

      setHierarchy(treeRes);
      setMembers(memRes.members || []);
      setLabels(lblRes.labels || []);
      setRefreshTrigger((n) => n + 1);

      const flMap: Record<number, boolean> = {};
      (treeRes.spaces || []).forEach((s: any) => {
        (s.folders || []).forEach((f: any) => {
          flMap[f.id] = true;
        });
      });
      setExpandedFolders((prev) => ({ ...flMap, ...prev }));

      if (!useAppStore.getState().activeProjectId && treeRes.all_projects?.length > 0) {
        useAppStore.setState({ activeProjectId: treeRes.all_projects[0].id });
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    refreshAllWorkspaceData();
  }, [activeWorkspaceId]);

  const handleStopGlobalTimer = async () => {
    if (!activeTimer) return;
    const stopped = stopTimer();
    if (stopped) {
      const mins = Math.max(1, Math.round((Date.now() - stopped.startedAt) / 60000));
      try {
        await api.addTimeEntry(stopped.taskId, {
          duration_minutes: mins,
          description: 'Yuqori paneldagi sekundomer orqali qayd etildi',
        });
        setRefreshTrigger((n) => n + 1);
        addToast({
          type: 'success',
          title: `Vaqt saqlandi (${stopped.taskKey})`,
          message: `${mins} daqiqa ish vaqti yozildi.`,
        });
      } catch (err: any) {
        addToast({ type: 'error', title: 'Xatolik', message: err.message });
      }
    }
  };

  const handleQuickProfileUpdate = async (patch: Record<string, any>, toastMsg: string) => {
    if (!user) return;
    try {
      const res = await api.updateProfile({
        full_name: user.profile.full_name,
        username: user.username,
        ...patch,
      });
      setUser(res.user);
      addToast({ type: 'success', title: toastMsg });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Xatolik', message: err.message });
    }
  };

  const PROJECT_TABS: Array<{ id: ProjectTab; label: string; sub: string; icon: any }> = [
    { id: 'overview', label: 'Umumiy Pasport', sub: 'Overview & KPI', icon: LayoutDashboard },
    { id: 'board', label: 'Kanban Doskasi', sub: 'Ustunlar & Swimlanes', icon: Kanban },
    { id: 'list', label: 'Jadval Ro‘yxat', sub: 'Ommaviy amallar', icon: ListFilter },
    { id: 'calendar', label: 'Kalendar', sub: 'Muddatlar setkasi', icon: Calendar },
    { id: 'timeline', label: 'Gantt Timeline', sub: 'Vaqt chizig‘i', icon: GitMerge },
    { id: 'sprints', label: 'Sprintlar', sub: 'Agile sikllar', icon: Sparkles },
    { id: 'docs', label: 'Loyiha Wiki', sub: 'Hujjatlar bazasi', icon: FileText },
    { id: 'time', label: 'Vaqt Sarfi', sub: 'Soatlar hisoboti', icon: Clock },
    { id: 'settings', label: 'Loyiha Sozlamalari', sub: 'Statuslar & Arxiv', icon: Settings },
  ];

  const SETTINGS_MENU: Array<{
    group: string;
    items: Array<{ id: SettingsTab; label: string; icon: any }>;
  }> = [
    {
      group: 'Shaxsiy Hisob & Profil',
      items: [
        { id: 'my_profile', label: 'Mening Profilim & Holat', icon: UserIcon },
        { id: 'security_sessions', label: 'Xavfsizlik va Sessiyalar', icon: Shield },
        { id: 'notifications_prefs', label: 'Bildirishnoma Matritsasi', icon: Bell },
      ],
    },
    {
      group: 'Workspace Boshqaruvi',
      items: [
        { id: 'ws_general', label: 'Umumiy va Egalik', icon: Building2 },
        { id: 'ws_members', label: 'A’zolar va Takliflar', icon: Users },
        { id: 'ws_teams', label: 'Ichki Jamoalar (Teams)', icon: UsersRound },
        { id: 'ws_roles', label: 'Rollar & RBAC Matritsasi', icon: KeyRound },
        { id: 'ws_labels', label: 'Teglar (Labels)', icon: Tag },
        { id: 'ws_audit', label: 'Audit Jurnali (Security)', icon: FileSearch },
        { id: 'ws_trash', label: 'Savat (Recycle Bin)', icon: Trash2 },
      ],
    },
  ];

  const availabilityConfig: Record<string, { label: string; dot: string }> = {
    available: { label: 'Ishda (Available)', dot: 'bg-emerald-500 shadow-[0_0_8px_#10b981]' },
    focusing: { label: 'Diqqat markazida (Focusing)', dot: 'bg-indigo-500 shadow-[0_0_8px_#6366f1]' },
    busy: { label: 'Band / Uchrashuvda (Busy)', dot: 'bg-rose-500 shadow-[0_0_8px_#f43f5e]' },
    vacation: { label: 'Ta’tilda (Vacation)', dot: 'bg-amber-500 shadow-[0_0_8px_#f59e0b]' },
    sick: { label: 'Betob (Sick Leave)', dot: 'bg-orange-500 shadow-[0_0_8px_#f97316]' },
  };

  const currentAvail =
    availabilityConfig[user?.profile?.availability_status || 'available'] ||
    availabilityConfig.available;

  return (
    <div className="h-screen w-screen flex flex-col bg-[#090b10] text-slate-100 overflow-hidden select-none">
      {/* =====================================================================
          TOP YOUTUBE-STYLE GLOBAL NAVBAR (Hamburger + Brand + Pill Search + Create + Nested Avatar Menu)
         ===================================================================== */}
      <header className="h-14 px-4 bg-[#0c0f17]/95 backdrop-blur-xl border-b border-white/[0.07] flex items-center justify-between gap-4 shrink-0 z-40">
        {/* Left: Hamburger ☰ + Logo + Active Workspace Badge */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={toggleSecondarySidebar}
            className="w-9 h-9 rounded-full hover:bg-white/[0.08] flex items-center justify-center text-slate-300 hover:text-white transition"
            title="Menyuni yig‘ish / yoyish"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div
            onClick={() => {
              navigateRail('pulse');
              setSidebarDrill('root');
            }}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm tracking-tight text-white">FlowForge</span>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/[0.08] text-[11px] font-medium text-slate-300">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                {activeWorkspace?.name || 'Workspace'}
              </span>
            </div>
          </div>
        </div>

        {/* Center: YouTube-style Rounded Search Pill (Ctrl+K) */}
        <div className="flex-1 max-w-xl mx-auto hidden md:block">
          <button
            onClick={() => setCommandOpen(true)}
            className="w-full h-9 px-4 rounded-full bg-[#121622] hover:bg-[#161b29] border border-white/[0.09] hover:border-indigo-500/40 flex items-center justify-between text-xs text-slate-400 transition group shadow-inner"
          >
            <div className="flex items-center gap-2.5">
              <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-400 transition" />
              <span>Vazifa (FF-101), loyiha, Wiki hujjat yoki a’zoni qidiring...</span>
            </div>
            <kbd className="px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-[10px] font-mono text-slate-400">
              Ctrl + K
            </kbd>
          </button>
        </div>

        {/* Right: Active Timer + "+ Yaratish" Dropdown + Inbox Bell + Multi-Level Avatar Popover */}
        <div className="flex items-center gap-2.5 shrink-0">
          {activeTimer && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/40 text-xs">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              <span
                onClick={() => openTaskDrawer(activeTimer.taskId)}
                className="font-mono font-bold text-rose-300 cursor-pointer"
              >
                {activeTimer.taskKey}
              </span>
              <button
                onClick={handleStopGlobalTimer}
                className="px-2 py-0.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold flex items-center gap-1"
              >
                <Square className="w-2.5 h-2.5 fill-current" /> Stop
              </button>
            </div>
          )}

          {/* YouTube-style "+ Yaratish" Pill Dropdown */}
          <div className="relative" ref={createMenuRef}>
            <button
              onClick={() => setCreateMenuOpen((v) => !v)}
              className="h-9 px-3.5 rounded-full bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.09] flex items-center gap-1.5 text-xs font-semibold text-white transition"
            >
              <Plus className="w-4 h-4 text-indigo-400" />
              <span>Yaratish</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {createMenuOpen && (
              <div className="absolute right-0 mt-2 w-60 rounded-2xl bg-[#141824] border border-white/[0.1] shadow-2xl py-2 z-50 animate-popover">
                <div className="px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Tezkor Yaratish
                </div>
                <button
                  onClick={() => {
                    setCreateMenuOpen(false);
                    openModal('create_task');
                  }}
                  className="w-full px-3.5 py-2.5 hover:bg-white/[0.06] flex items-center gap-3 text-left text-xs text-slate-200"
                >
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                    <CheckSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-white">Yangi Vazifa</div>
                    <div className="text-[10px] text-slate-400">Loyiha va mas’ulga biriktirish</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setCreateMenuOpen(false);
                    openModal('create_project');
                  }}
                  className="w-full px-3.5 py-2.5 hover:bg-white/[0.06] flex items-center gap-3 text-left text-xs text-slate-200"
                >
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <Rocket className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-white">Yangi Loyiha</div>
                    <div className="text-[10px] text-slate-400">Kanban, Timeline va Sprintlar</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setCreateMenuOpen(false);
                    openModal('create_space');
                  }}
                  className="w-full px-3.5 py-2.5 hover:bg-white/[0.06] flex items-center gap-3 text-left text-xs text-slate-200"
                >
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <FolderKanban className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-white">Yangi Space (Bo‘lim)</div>
                    <div className="text-[10px] text-slate-400">Departament yoki yo‘nalish</div>
                  </div>
                </button>

                <div className="my-1 border-t border-white/[0.07]" />

                <button
                  onClick={() => {
                    setCreateMenuOpen(false);
                    openModal('create_workspace');
                  }}
                  className="w-full px-3.5 py-2.5 hover:bg-white/[0.06] flex items-center gap-3 text-left text-xs text-slate-200"
                >
                  <div className="w-7 h-7 rounded-lg bg-violet-500/20 text-violet-400 flex items-center justify-center">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-white">Yangi Workspace</div>
                    <div className="text-[10px] text-slate-400">Alohida kompaniya muhiti</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Notifications Bell */}
          <button
            onClick={() => {
              navigateRail('inbox');
              setSidebarDrill('root');
            }}
            className="relative w-9 h-9 rounded-full hover:bg-white/[0.08] flex items-center justify-center text-slate-300 hover:text-white transition"
            title="Inbox va Bildirishnomalar"
          >
            <Bell className="w-4 h-4" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-0.5 right-0.5 min-w-[17px] h-[17px] px-1 rounded-full bg-rose-500 text-[10px] font-bold text-white flex items-center justify-center shadow">
                {unreadNotificationsCount}
              </span>
            )}
          </button>

          {/* YouTube-Style Multi-Level Nested Profile Popover */}
          <div className="relative" ref={avatarMenuRef}>
            <button
              onClick={() => {
                setAvatarMenuOpen((v) => !v);
                setAvatarMenuDrill('root');
              }}
              className="relative w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 p-[2px] hover:scale-105 transition"
              title="Hisob va Ichma-ich Sozlamalar Menyusi"
            >
              <div className="w-full h-full rounded-full bg-[#0c0f17] flex items-center justify-center text-xs font-bold text-white">
                {user?.profile?.full_name
                  ?.split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2) || 'U'}
              </div>
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0c0f17] ${currentAvail.dot}`}
              />
            </button>

            {avatarMenuOpen && (
              <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-[#141824] border border-white/[0.1] shadow-2xl overflow-hidden z-50 animate-popover">
                {/* LEVEL 0: ROOT ACCOUNT MENU */}
                {avatarMenuDrill === 'root' && (
                  <div className="divide-y divide-white/[0.07]">
                    {/* User Header */}
                    <div className="p-4 flex items-start gap-3 bg-white/[0.02]">
                      <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-sm font-bold text-white shrink-0">
                        {user?.profile?.full_name
                          ?.split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2) || 'U'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-white truncate">
                          {user?.profile?.full_name}
                        </div>
                        <div className="text-xs text-slate-400 truncate">
                          @{user?.username} • {user?.profile?.job_title || 'Member'}
                        </div>
                        <button
                          onClick={() => {
                            setAvatarMenuOpen(false);
                            openSettings('my_profile');
                          }}
                          className="mt-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
                        >
                          Shaxsiy profilni boshqarish ›
                        </button>
                      </div>
                    </div>

                    {/* Nested Drill-Down Triggers (YouTube Style) */}
                    <div className="py-1.5">
                      <button
                        onClick={() => setAvatarMenuDrill('workspace')}
                        className="w-full px-4 py-2.5 hover:bg-white/[0.06] flex items-center justify-between text-xs text-slate-200"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Building2 className="w-4 h-4 text-indigo-400 shrink-0" />
                          <div className="text-left truncate">
                            <div className="text-slate-400 text-[10px]">Joriy Workspace</div>
                            <div className="font-semibold text-white truncate">
                              {activeWorkspace?.name} ({activeWorkspace?.my_role.toUpperCase()})
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                      </button>

                      <button
                        onClick={() => setAvatarMenuDrill('status')}
                        className="w-full px-4 py-2.5 hover:bg-white/[0.06] flex items-center justify-between text-xs text-slate-200"
                      >
                        <div className="flex items-center gap-3">
                          <Activity className="w-4 h-4 text-emerald-400 shrink-0" />
                          <div className="text-left">
                            <div className="text-slate-400 text-[10px]">Ish holati (Status)</div>
                            <div className="font-semibold text-white">{currentAvail.label}</div>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </button>

                      <button
                        onClick={() => setAvatarMenuDrill('density')}
                        className="w-full px-4 py-2.5 hover:bg-white/[0.06] flex items-center justify-between text-xs text-slate-200"
                      >
                        <div className="flex items-center gap-3">
                          <Sliders className="w-4 h-4 text-amber-400 shrink-0" />
                          <div className="text-left">
                            <div className="text-slate-400 text-[10px]">Interfeys Zichligi</div>
                            <div className="font-semibold text-white capitalize">
                              {user?.profile?.ui_density || 'comfortable'}
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </button>

                      <button
                        onClick={() => setAvatarMenuDrill('timezone')}
                        className="w-full px-4 py-2.5 hover:bg-white/[0.06] flex items-center justify-between text-xs text-slate-200"
                      >
                        <div className="flex items-center gap-3">
                          <Globe className="w-4 h-4 text-sky-400 shrink-0" />
                          <div className="text-left">
                            <div className="text-slate-400 text-[10px]">Vaqt mintaqasi</div>
                            <div className="font-semibold text-white">
                              {user?.profile?.timezone || 'Asia/Tashkent'}
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>

                    {/* Direct Links to Studio Settings */}
                    <div className="py-1.5">
                      <button
                        onClick={() => {
                          setAvatarMenuOpen(false);
                          openSettings('ws_general');
                        }}
                        className="w-full px-4 py-2 hover:bg-white/[0.06] flex items-center gap-3 text-xs text-slate-200"
                      >
                        <Settings className="w-4 h-4 text-slate-400" />
                        <span>Boshqaruv va Sozlamalar Studiyasi</span>
                      </button>
                      <button
                        onClick={() => {
                          setAvatarMenuOpen(false);
                          openSettings('security_sessions');
                        }}
                        className="w-full px-4 py-2 hover:bg-white/[0.06] flex items-center gap-3 text-xs text-slate-200"
                      >
                        <Shield className="w-4 h-4 text-slate-400" />
                        <span>Xavfsizlik va Faol Qurilmalar</span>
                      </button>
                      <button
                        onClick={() => {
                          setAvatarMenuOpen(false);
                          openSettings('ws_trash');
                        }}
                        className="w-full px-4 py-2 hover:bg-white/[0.06] flex items-center gap-3 text-xs text-slate-200"
                      >
                        <Trash2 className="w-4 h-4 text-slate-400" />
                        <span>Savat (Recycle Bin)</span>
                      </button>
                    </div>

                    {/* Logout */}
                    <div className="py-1.5">
                      <button
                        onClick={async () => {
                          setAvatarMenuOpen(false);
                          try {
                            await api.logout();
                          } catch {
                            // ignore
                          }
                          setStoredToken(null);
                          useAppStore.getState().resetState();
                          onLogout();
                        }}
                        className="w-full px-4 py-2 hover:bg-rose-500/10 flex items-center gap-3 text-xs font-semibold text-rose-400"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Tizimdan chiqish</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* SUB-MENU 1: WORKSPACE SWITCHER DRILL-DOWN */}
                {avatarMenuDrill === 'workspace' && (
                  <div className="animate-drill-in">
                    <div className="p-3 border-b border-white/[0.07] flex items-center gap-2">
                      <button
                        onClick={() => setAvatarMenuDrill('root')}
                        className="p-1.5 rounded-full hover:bg-white/[0.08] text-slate-300"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-bold text-white">Workspace almashtirish</span>
                    </div>
                    <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
                      {workspaces.map((ws) => (
                        <button
                          key={ws.id}
                          onClick={() => {
                            setActiveWorkspaceId(ws.id);
                            setAvatarMenuOpen(false);
                            setAvatarMenuDrill('root');
                          }}
                          className={`w-full px-3 py-2.5 rounded-xl flex items-center justify-between text-xs transition ${
                            ws.id === activeWorkspaceId
                              ? 'bg-indigo-600/20 border border-indigo-500/40 text-white'
                              : 'hover:bg-white/[0.06] text-slate-300'
                          }`}
                        >
                          <div className="text-left truncate">
                            <div className="font-bold">{ws.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              /{ws.slug} • {ws.my_role.toUpperCase()}
                            </div>
                          </div>
                          {ws.id === activeWorkspaceId && (
                            <Check className="w-4 h-4 text-indigo-400 shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                    <div className="p-2 border-t border-white/[0.07]">
                      <button
                        onClick={() => {
                          setAvatarMenuOpen(false);
                          openModal('create_workspace');
                        }}
                        className="w-full px-3 py-2 rounded-xl hover:bg-white/[0.06] flex items-center gap-2 text-xs font-semibold text-indigo-400"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Yangi Workspace yaratish</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* SUB-MENU 2: AVAILABILITY STATUS DRILL-DOWN */}
                {avatarMenuDrill === 'status' && (
                  <div className="animate-drill-in">
                    <div className="p-3 border-b border-white/[0.07] flex items-center gap-2">
                      <button
                        onClick={() => setAvatarMenuDrill('root')}
                        className="p-1.5 rounded-full hover:bg-white/[0.08] text-slate-300"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-bold text-white">Ish holatini tanlash</span>
                    </div>
                    <div className="p-2 space-y-1">
                      {Object.entries(availabilityConfig).map(([key, cfg]) => {
                        const active = (user?.profile?.availability_status || 'available') === key;
                        return (
                          <button
                            key={key}
                            onClick={async () => {
                              await handleQuickProfileUpdate(
                                { availability_status: key },
                                `Ish holatingiz "${cfg.label}" ga o‘zgartirildi`
                              );
                              setAvatarMenuDrill('root');
                            }}
                            className={`w-full px-3 py-2.5 rounded-xl flex items-center justify-between text-xs ${
                              active ? 'bg-white/[0.08] text-white font-semibold' : 'text-slate-300 hover:bg-white/[0.05]'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                              <span>{cfg.label}</span>
                            </div>
                            {active && <Check className="w-4 h-4 text-indigo-400" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* SUB-MENU 3: UI DENSITY DRILL-DOWN */}
                {avatarMenuDrill === 'density' && (
                  <div className="animate-drill-in">
                    <div className="p-3 border-b border-white/[0.07] flex items-center gap-2">
                      <button
                        onClick={() => setAvatarMenuDrill('root')}
                        className="p-1.5 rounded-full hover:bg-white/[0.08] text-slate-300"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-bold text-white">Interfeys zichligi</span>
                    </div>
                    <div className="p-2 space-y-1">
                      {[
                        { id: 'comfortable', label: 'Comfortable (Keng va qulay)' },
                        { id: 'compact', label: 'Compact (Zich ma’lumotlar rejimi)' },
                      ].map((opt) => {
                        const active = (user?.profile?.ui_density || 'comfortable') === opt.id;
                        return (
                          <button
                            key={opt.id}
                            onClick={async () => {
                              await handleQuickProfileUpdate(
                                { ui_density: opt.id },
                                `Interfeys zichligi: ${opt.label}`
                              );
                              setAvatarMenuDrill('root');
                            }}
                            className={`w-full px-3 py-2.5 rounded-xl flex items-center justify-between text-xs ${
                              active ? 'bg-white/[0.08] text-white font-semibold' : 'text-slate-300 hover:bg-white/[0.05]'
                            }`}
                          >
                            <span>{opt.label}</span>
                            {active && <Check className="w-4 h-4 text-indigo-400" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* SUB-MENU 4: TIMEZONE DRILL-DOWN */}
                {avatarMenuDrill === 'timezone' && (
                  <div className="animate-drill-in">
                    <div className="p-3 border-b border-white/[0.07] flex items-center gap-2">
                      <button
                        onClick={() => setAvatarMenuDrill('root')}
                        className="p-1.5 rounded-full hover:bg-white/[0.08] text-slate-300"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-bold text-white">Vaqt mintaqasini tanlash</span>
                    </div>
                    <div className="p-2 space-y-1">
                      {[
                        'Asia/Tashkent',
                        'Asia/Samarkand',
                        'Europe/London',
                        'America/New_York',
                      ].map((tz) => {
                        const active = (user?.profile?.timezone || 'Asia/Tashkent') === tz;
                        return (
                          <button
                            key={tz}
                            onClick={async () => {
                              await handleQuickProfileUpdate(
                                { timezone: tz },
                                `Vaqt mintaqasi: ${tz}`
                              );
                              setAvatarMenuDrill('root');
                            }}
                            className={`w-full px-3 py-2.5 rounded-xl flex items-center justify-between text-xs ${
                              active ? 'bg-white/[0.08] text-white font-semibold' : 'text-slate-300 hover:bg-white/[0.05]'
                            }`}
                          >
                            <span>{tz}</span>
                            {active && <Check className="w-4 h-4 text-indigo-400" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* =====================================================================
          BODY CONTAINER: SINGLE UNIFIED SIDEBAR (WITH NESTED DRILL-DOWN) + MAIN VIEWPORT
         ===================================================================== */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {isSecondarySidebarOpen ? (
          /* EXPANDED SINGLE UNIFIED SIDEBAR (268px) WITH YOUTUBE STUDIO DRILL-DOWN */
          <aside className="w-[268px] bg-[#0c0f17] border-r border-white/[0.07] flex flex-col justify-between shrink-0 z-20 overflow-hidden">
            {/* DRILL MODE 1: ROOT MAIN MENU */}
            {sidebarDrill === 'root' && (
              <div className="flex-1 overflow-y-auto p-3 space-y-5 animate-drill-back">
                {/* Primary Global Navigation */}
                <div className="space-y-1">
                  {[
                    { id: 'pulse', label: 'Bosh sahifa (Studio)', icon: Home },
                    {
                      id: 'inbox',
                      label: 'Inbox & Xabarlar',
                      icon: Bell,
                      badge: unreadNotificationsCount,
                    },
                    { id: 'my_work', label: 'Mening Vazifalarim', icon: CheckSquare },
                    { id: 'docs', label: 'Bilimlar Bazasi (Wiki)', icon: FileText },
                    { id: 'timesheets', label: 'Vaqt Tabeli (Time)', icon: Clock },
                    { id: 'reports', label: 'Analitika & Workload', icon: BarChart3 },
                  ].map((nav) => {
                    const Icon = nav.icon;
                    const active = railSection === nav.id;
                    return (
                      <button
                        key={nav.id}
                        onClick={() => navigateRail(nav.id as any)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition ${
                          active
                            ? 'bg-white/[0.09] text-white font-semibold shadow-sm'
                            : 'text-slate-300 hover:bg-white/[0.04] hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon
                            className={`w-4 h-4 ${
                              active ? 'text-indigo-400' : 'text-slate-400'
                            }`}
                          />
                          <span>{nav.label}</span>
                        </div>
                        {nav.badge ? (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                            {nav.badge}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                {/* Starred / Favorites */}
                {hierarchy?.favorites && hierarchy.favorites.length > 0 && (
                  <div className="pt-3 border-t border-white/[0.06]">
                    <div className="px-3 mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-400/90">
                      <Star className="w-3 h-3 fill-current" />
                      <span>Tanlangan Loyihalar</span>
                    </div>
                    <div className="space-y-0.5">
                      {hierarchy.favorites.map((proj) => (
                        <button
                          key={proj.id}
                          onClick={() => {
                            openProject(proj.id);
                            setSidebarDrill('project');
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-slate-300 hover:bg-white/[0.05] hover:text-white transition group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: proj.color }}
                            />
                            <span className="truncate font-medium">{proj.name}</span>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Spaces (Click to Drill Inside a Space or Project!) */}
                <div className="pt-3 border-t border-white/[0.06]">
                  <div className="px-3 mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Bo‘limlar (Spaces)
                    </span>
                    <button
                      onClick={() => openModal('create_space')}
                      className="p-1 rounded-lg hover:bg-white/[0.08] text-slate-400 hover:text-white"
                      title="Yangi Space yaratish"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-1">
                    {hierarchy?.spaces.map((space) => {
                      const totalProjs =
                        space.projects.length +
                        space.folders.reduce((acc, f) => acc + f.projects.length, 0);

                      return (
                        <button
                          key={space.id}
                          onClick={() => {
                            setSelectedSpaceId(space.id);
                            setSidebarDrill('space');
                          }}
                          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-white/[0.06] text-left transition group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className="w-3 h-3 rounded-md shrink-0"
                              style={{ backgroundColor: space.color }}
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-200 group-hover:text-white truncate">
                                {space.name}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {space.folders.length} papka • {totalProjs} loyiha
                              </div>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* All Projects Quick Drill-Down List */}
                <div className="pt-3 border-t border-white/[0.06]">
                  <div className="px-3 mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Barcha Loyihalar ({hierarchy?.all_projects.length || 0})
                    </span>
                    <button
                      onClick={() => openModal('create_project')}
                      className="p-1 rounded-lg hover:bg-white/[0.08] text-slate-400 hover:text-white"
                      title="Yangi Loyiha yaratish"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-1">
                    {hierarchy?.all_projects.map((proj) => {
                      const pct =
                        proj.total_tasks && proj.total_tasks > 0
                          ? Math.round(((proj.done_tasks || 0) / proj.total_tasks) * 100)
                          : 0;
                      return (
                        <button
                          key={proj.id}
                          onClick={() => {
                            openProject(proj.id);
                            setSidebarDrill('project');
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/[0.06] text-left transition group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: proj.color }}
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-medium text-slate-200 group-hover:text-white truncate">
                                {proj.name}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono">
                                {proj.project_key} • {pct}% bajarildi
                              </div>
                            </div>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* DRILL MODE 2: SPACE SUB-MENU (Folders & Projects inside selected Space) */}
            {sidebarDrill === 'space' && currentSpace && (
              <div className="flex-1 flex flex-col overflow-hidden animate-drill-in">
                <div className="p-3.5 border-b border-white/[0.07] bg-white/[0.02] space-y-2.5">
                  <button
                    onClick={() => setSidebarDrill('root')}
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Asosiy menyuga qaytish</span>
                  </button>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-3.5 h-3.5 rounded-lg shrink-0"
                        style={{ backgroundColor: currentSpace.color }}
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-white truncate">
                          {currentSpace.name}
                        </div>
                        <div className="text-[10px] font-mono text-indigo-400">
                          BO‘LIM • {currentSpace.key_code}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openModal('create_folder', { space_id: currentSpace.id })}
                        className="p-1.5 rounded-lg hover:bg-white/[0.08] text-slate-400 hover:text-white"
                        title="Papka qo‘shish"
                      >
                        <Folder className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => openModal('create_project', { space_id: currentSpace.id })}
                        className="p-1.5 rounded-lg hover:bg-white/[0.08] text-slate-400 hover:text-white"
                        title="Loyiha qo‘shish"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {/* Folders inside Space */}
                  {currentSpace.folders.map((folder) => {
                    const fExpanded = !!expandedFolders[folder.id];
                    return (
                      <div key={folder.id} className="space-y-1">
                        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] group">
                          <button
                            onClick={() =>
                              setExpandedFolders((prev) => ({
                                ...prev,
                                [folder.id]: !prev[folder.id],
                              }))
                            }
                            className="flex items-center gap-2 min-w-0 flex-1 text-left"
                          >
                            {fExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                            )}
                            <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="text-xs font-semibold text-slate-200 truncate">
                              {folder.name}
                            </span>
                          </button>

                          <button
                            onClick={() =>
                              openModal('create_project', {
                                space_id: currentSpace.id,
                                folder_id: folder.id,
                              })
                            }
                            className="p-1 rounded hover:bg-white/[0.1] text-slate-400 hover:text-white"
                            title="Papkaga loyiha qo‘shish"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        {fExpanded && (
                          <div className="pl-3 border-l border-white/[0.08] ml-3 space-y-1">
                            {folder.projects.map((proj) => (
                              <button
                                key={proj.id}
                                onClick={() => {
                                  openProject(proj.id);
                                  setSidebarDrill('project');
                                }}
                                className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/[0.06] text-xs text-slate-300 hover:text-white transition"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: proj.color }}
                                  />
                                  <span className="truncate">{proj.name}</span>
                                </div>
                                <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Direct Projects in Space */}
                  <div className="space-y-1">
                    <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      To‘g‘ridan-to‘g‘ri Loyihalar
                    </div>
                    {currentSpace.projects.map((proj) => (
                      <button
                        key={proj.id}
                        onClick={() => {
                          openProject(proj.id);
                          setSidebarDrill('project');
                        }}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-white/[0.06] text-xs text-slate-200 transition"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: proj.color }}
                          />
                          <span className="truncate font-medium">{proj.name}</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* DRILL MODE 3: YOUTUBE STUDIO STYLE PROJECT SUB-NAVIGATION */}
            {sidebarDrill === 'project' && currentProject && (
              <div className="flex-1 flex flex-col overflow-hidden animate-drill-in">
                {/* Back button + Current Project Card */}
                <div className="p-3.5 border-b border-white/[0.07] bg-gradient-to-b from-white/[0.03] to-transparent space-y-3">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setSidebarDrill('root')}
                      className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Barcha loyihalar</span>
                    </button>

                    {currentProject.space_id && (
                      <button
                        onClick={() => {
                          setSelectedSpaceId(currentProject.space_id);
                          setSidebarDrill('space');
                        }}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium"
                      >
                        Bo‘limga o‘tish
                      </button>
                    )}
                  </div>

                  {/* Active Project Mini Hero Card inside Sidebar (like YouTube Studio Video Card) */}
                  <div className="p-3 rounded-2xl bg-[#131724] border border-white/[0.08] space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0 shadow"
                          style={{ backgroundColor: currentProject.color }}
                        >
                          {currentProject.project_key}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">
                            {currentProject.name}
                          </div>
                          <div className="text-[10px] text-emerald-400 font-medium uppercase">
                            ● {currentProject.status.replace('_', ' ')}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    {(() => {
                      const total = currentProject.total_tasks || 0;
                      const done = currentProject.done_tasks || 0;
                      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                      return (
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-slate-400">
                            <span>Bajarilish ko‘rsatkichi</span>
                            <span className="font-mono font-bold text-white">
                              {done}/{total} ({pct}%)
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-slate-950 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-300"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Vertical Project Sub-Menu Items (9 Views) */}
                <div className="flex-1 overflow-y-auto p-2.5 space-y-1">
                  <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Loyiha Ichki Bo‘limlari
                  </div>
                  {PROJECT_TABS.map((t) => {
                    const Icon = t.icon;
                    const active = railSection === 'spaces' && projectTab === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => {
                          if (railSection !== 'spaces') navigateRail('spaces');
                          setProjectTab(t.id);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition ${
                          active
                            ? 'bg-indigo-600/20 border-l-4 border-indigo-500 text-white font-semibold'
                            : 'text-slate-300 hover:bg-white/[0.05] hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Icon
                            className={`w-4 h-4 shrink-0 ${
                              active ? 'text-indigo-400' : 'text-slate-400'
                            }`}
                          />
                          <div className="min-w-0">
                            <div className="text-xs truncate">{t.label}</div>
                            <div className="text-[10px] text-slate-500 truncate">{t.sub}</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* DRILL MODE 4: SETTINGS STUDIO SUB-NAVIGATION */}
            {sidebarDrill === 'settings' && (
              <div className="flex-1 flex flex-col overflow-hidden animate-drill-in">
                <div className="p-3.5 border-b border-white/[0.07] bg-white/[0.02] space-y-2">
                  <button
                    onClick={() => {
                      navigateRail('pulse');
                      setSidebarDrill('root');
                    }}
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Asosiy menyuga qaytish</span>
                  </button>
                  <div className="text-sm font-bold text-white">Boshqaruv va Sozlamalar</div>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-5">
                  {SETTINGS_MENU.map((grp) => (
                    <div key={grp.group}>
                      <div className="px-2.5 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        {grp.group}
                      </div>
                      <div className="space-y-1">
                        {grp.items.map((item) => {
                          const Icon = item.icon;
                          const active = settingsTab === item.id;
                          return (
                            <button
                              key={item.id}
                              onClick={() => {
                                if (railSection !== 'settings') openSettings(item.id);
                                else setSettingsTab(item.id);
                              }}
                              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition ${
                                active
                                  ? 'bg-indigo-600/20 border-l-4 border-indigo-500 text-white font-semibold'
                                  : 'text-slate-300 hover:bg-white/[0.05]'
                              }`}
                            >
                              <Icon
                                className={`w-4 h-4 shrink-0 ${
                                  active ? 'text-indigo-400' : 'text-slate-400'
                                }`}
                              />
                              <span className="truncate">{item.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sidebar Footer */}
            <div className="p-3 border-t border-white/[0.07] bg-[#0a0c14] flex items-center justify-between text-xs">
              <button
                onClick={() => {
                  openSettings('my_profile');
                  setSidebarDrill('settings');
                }}
                className="flex items-center gap-2 text-slate-400 hover:text-white font-medium"
              >
                <Settings className="w-4 h-4 text-indigo-400" />
                <span>Sozlamalar Markazi</span>
              </button>
              <button
                onClick={() => {
                  openSettings('ws_trash');
                  setSidebarDrill('settings');
                }}
                className="p-1.5 rounded-lg hover:bg-white/[0.07] text-slate-400 hover:text-rose-400"
                title="Savat (Recycle Bin)"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </aside>
        ) : (
          /* COLLAPSED YOUTUBE MINI-SIDEBAR (72px) */
          <aside className="w-[72px] bg-[#0c0f17] border-r border-white/[0.07] flex flex-col items-center py-3 gap-2 shrink-0 z-20">
            {[
              { id: 'pulse', label: 'Studio', icon: Home },
              { id: 'inbox', label: 'Inbox', icon: Bell, badge: unreadNotificationsCount },
              { id: 'my_work', label: 'Vazifalar', icon: CheckSquare },
              { id: 'spaces', label: 'Loyihalar', icon: FolderKanban },
              { id: 'docs', label: 'Wiki', icon: FileText },
              { id: 'timesheets', label: 'Vaqt', icon: Clock },
              { id: 'reports', label: 'Analitika', icon: BarChart3 },
              { id: 'settings', label: 'Sozlama', icon: Settings },
            ].map((item) => {
              const Icon = item.icon;
              const active = railSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.id === 'settings') openSettings('my_profile');
                    else navigateRail(item.id as any);
                  }}
                  className={`relative w-14 py-2 rounded-xl flex flex-col items-center justify-center gap-1 transition ${
                    active
                      ? 'bg-indigo-600/20 text-indigo-400'
                      : 'text-slate-400 hover:bg-white/[0.05] hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-[10px] font-medium truncate max-w-[52px]">
                    {item.label}
                  </span>
                  {item.badge ? (
                    <span className="absolute top-1 right-2 w-4 h-4 rounded-full bg-rose-500 text-[9px] font-bold text-white flex items-center justify-center">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </aside>
        )}

        {/* =====================================================================
            MAIN CONTENT VIEWPORT
           ===================================================================== */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#090b10]">
          {/* =====================================================================
              CONTEXTUAL MULTI-LEVEL DRILL-DOWN BREADCRUMB & VIEW SWITCHER
             ===================================================================== */}
          <div
            ref={breadcrumbBarRef}
            className="px-6 py-2.5 bg-[#0c0f17]/95 border-b border-white/[0.07] flex flex-wrap items-center justify-between gap-3 shrink-0 relative z-30"
          >
            {/* Left: Drill-down breadcrumbs */}
            <div className="flex items-center gap-1.5 text-xs flex-wrap">
              {/* 1. Workspace Popover */}
              <div className="relative">
                <button
                  onClick={() =>
                    setBreadcrumbDropdown((v) => (v === 'workspace' ? null : 'workspace'))
                  }
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition ${
                    breadcrumbDropdown === 'workspace'
                      ? 'bg-indigo-600/25 border-indigo-500/50 text-white shadow-sm'
                      : 'bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.08] hover:text-white'
                  }`}
                  title="Workspace tanlash yoki yangi ochish"
                >
                  <Building2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="font-semibold max-w-[120px] truncate">{activeWorkspace?.name || 'Workspace'}</span>
                  <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                </button>

                {breadcrumbDropdown === 'workspace' && (
                  <div className="absolute left-0 mt-2 w-64 rounded-2xl bg-[#141824] border border-white/[0.1] shadow-2xl p-2 z-50 animate-popover">
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-white/[0.06] mb-1">
                      Ishchi Muhitlar (Workspaces)
                    </div>
                    <div className="max-h-60 overflow-y-auto space-y-1">
                      {workspaces.map((ws) => (
                        <button
                          key={ws.id}
                          onClick={() => {
                            setActiveWorkspaceId(ws.id);
                            setBreadcrumbDropdown(null);
                          }}
                          className={`w-full px-3 py-2 rounded-xl flex items-center justify-between text-left text-xs transition ${
                            ws.id === activeWorkspaceId
                              ? 'bg-indigo-600/20 text-indigo-300 font-bold border border-indigo-500/30'
                              : 'text-slate-300 hover:bg-white/[0.06]'
                          }`}
                        >
                          <div className="truncate">
                            <div>{ws.name}</div>
                            <div className="text-[10px] text-slate-400 font-normal">{ws.my_role.toUpperCase()}</div>
                          </div>
                          {ws.id === activeWorkspaceId && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                        </button>
                      ))}
                    </div>
                    <div className="pt-1.5 border-t border-white/[0.06] mt-1">
                      <button
                        onClick={() => {
                          setBreadcrumbDropdown(null);
                          openModal('create_workspace');
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] flex items-center gap-2 text-xs font-semibold text-indigo-300 transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Yangi Workspace yaratish</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Separator */}
              <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />

              {/* 2. Space Popover (if in spaces or project) */}
              {currentSpace ? (
                <div className="relative">
                  <button
                    onClick={() => setBreadcrumbDropdown((v) => (v === 'space' ? null : 'space'))}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition ${
                      breadcrumbDropdown === 'space'
                        ? 'bg-indigo-600/25 border-indigo-500/50 text-white shadow-sm'
                        : 'bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.08] hover:text-white'
                    }`}
                    title="Space bo‘limini almashtirish"
                  >
                    <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="font-semibold max-w-[120px] truncate">{currentSpace.name}</span>
                    <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                  </button>

                  {breadcrumbDropdown === 'space' && (
                    <div className="absolute left-0 mt-2 w-64 rounded-2xl bg-[#141824] border border-white/[0.1] shadow-2xl p-2 z-50 animate-popover">
                      <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-white/[0.06] mb-1">
                        Bo‘limlar (Spaces)
                      </div>
                      <div className="max-h-60 overflow-y-auto space-y-1">
                        {hierarchy?.spaces.map((sp) => (
                          <button
                            key={sp.id}
                            onClick={() => {
                              setSelectedSpaceId(sp.id);
                              setSidebarDrill('space');
                              setBreadcrumbDropdown(null);
                            }}
                            className={`w-full px-3 py-2 rounded-xl flex items-center justify-between text-left text-xs transition ${
                              sp.id === currentSpace?.id
                                ? 'bg-indigo-600/20 text-indigo-300 font-bold border border-indigo-500/30'
                                : 'text-slate-300 hover:bg-white/[0.06]'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sp.color || '#6366f1' }} />
                              <span className="truncate">{sp.name}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {sp.projects?.length || 0} loyiha
                            </span>
                          </button>
                        ))}
                      </div>
                      <div className="pt-1.5 border-t border-white/[0.06] mt-1">
                        <button
                          onClick={() => {
                            setBreadcrumbDropdown(null);
                            openModal('create_space');
                          }}
                          className="w-full px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] flex items-center gap-2 text-xs font-semibold text-indigo-300 transition"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Yangi Space qo‘shish</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              {/* 3. Project Popover (if currentProject exists) */}
              {currentProject ? (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  <div className="relative">
                    <button
                      onClick={() => {
                        setBreadcrumbDropdown((v) => (v === 'project' ? null : 'project'));
                        setBreadcrumbProjectSearch('');
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition ${
                        breadcrumbDropdown === 'project'
                          ? 'bg-indigo-600/25 border-indigo-500/50 text-white shadow-sm'
                          : 'bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.08] hover:text-white'
                      }`}
                      title="Loyihani almashtirish"
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: currentProject.color || '#6366f1' }} />
                      <span className="font-bold text-white max-w-[140px] truncate">{currentProject.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 shrink-0">
                        {currentProject.project_key}
                      </span>
                      <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                    </button>

                    {breadcrumbDropdown === 'project' && (
                      <div className="absolute left-0 mt-2 w-72 rounded-2xl bg-[#141824] border border-white/[0.1] shadow-2xl p-2 z-50 animate-popover">
                        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-white/[0.06] mb-2 flex items-center justify-between">
                          <span>Loyihani tanlash</span>
                          <span className="text-slate-400 font-mono text-[10px]">{hierarchy?.all_projects.length || 0} ta</span>
                        </div>
                        <div className="px-2 mb-2">
                          <input
                            type="text"
                            autoFocus
                            value={breadcrumbProjectSearch}
                            onChange={(e) => setBreadcrumbProjectSearch(e.target.value)}
                            placeholder="Loyihani qidiring..."
                            className="w-full px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/[0.1] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div className="max-h-60 overflow-y-auto space-y-1">
                          {hierarchy?.all_projects
                            .filter((p) =>
                              !breadcrumbProjectSearch ||
                              p.name.toLowerCase().includes(breadcrumbProjectSearch.toLowerCase()) ||
                              p.project_key.toLowerCase().includes(breadcrumbProjectSearch.toLowerCase())
                            )
                            .map((p) => (
                              <button
                                key={p.id}
                                onClick={() => {
                                  openProject(p.id);
                                  setSidebarDrill('project');
                                  setBreadcrumbDropdown(null);
                                }}
                                className={`w-full px-3 py-2 rounded-xl flex items-center justify-between text-left text-xs transition ${
                                  p.id === currentProject.id
                                    ? 'bg-indigo-600/20 text-indigo-300 font-bold border border-indigo-500/30'
                                    : 'text-slate-300 hover:bg-white/[0.06]'
                                }`}
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color || '#6366f1' }} />
                                  <span className="truncate">{p.name}</span>
                                </div>
                                <span className="font-mono text-[10px] text-slate-400 shrink-0">
                                  {p.project_key}
                                </span>
                              </button>
                            ))}
                        </div>
                        <div className="pt-1.5 border-t border-white/[0.06] mt-1">
                          <button
                            onClick={() => {
                              setBreadcrumbDropdown(null);
                              openModal('create_project', { space_id: currentSpace?.id });
                            }}
                            className="w-full px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] flex items-center gap-2 text-xs font-semibold text-indigo-300 transition"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Yangi Loyiha yaratish</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : null}

              {/* If on other rail sections like Pulse, Inbox, My Work, etc. */}
              {!currentProject && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  <span className="px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs font-semibold text-white">
                    {railSection === 'pulse' && '⚡ Boshqaruv Pulsi'}
                    {railSection === 'inbox' && '📥 Inbox & Xabarlar'}
                    {railSection === 'my_work' && '💼 Mening Ishlarim'}
                    {railSection === 'docs' && '📄 Wiki Hujjatlar'}
                    {railSection === 'timesheets' && '⏱ Timesheet (Vaqt)'}
                    {railSection === 'reports' && '📊 Tahliliy Hisobotlar'}
                    {railSection === 'settings' && '⚙️ Sozlamalar'}
                  </span>
                </>
              )}
            </div>

            {/* Right: Quick Tab Chips Bar when in Project, plus Project Actions dropdown */}
            {railSection === 'spaces' && currentProject && (
              <div className="flex items-center gap-2 overflow-x-auto">
                <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/[0.06]">
                  {PROJECT_TABS.map((t) => {
                    const Icon = t.icon;
                    const active = projectTab === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setProjectTab(t.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                          active
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                            : 'text-slate-400 hover:bg-white/[0.06] hover:text-white'
                        }`}
                        title={t.sub}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Project Actions Dropdown ('•••') */}
                <div className="relative">
                  <button
                    onClick={() =>
                      setBreadcrumbDropdown((v) => (v === 'actions' ? null : 'actions'))
                    }
                    className="p-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-400 hover:text-white transition"
                    title="Loyiha amallari"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>

                  {breadcrumbDropdown === 'actions' && (
                    <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-[#141824] border border-white/[0.1] shadow-2xl p-1.5 z-50 animate-popover">
                      <button
                        onClick={async () => {
                          setBreadcrumbDropdown(null);
                          await api.toggleFavoriteProject(currentProject.id);
                          refreshAllWorkspaceData();
                          addToast({
                            type: 'info',
                            title: currentProject.is_favorite
                              ? 'Sevimlilardan olib tashlandi'
                              : 'Sevimlilarga qo‘shildi',
                          });
                        }}
                        className="w-full px-3 py-2 rounded-xl hover:bg-white/[0.06] flex items-center gap-2.5 text-xs text-slate-200"
                      >
                        <Star
                          className={`w-3.5 h-3.5 ${
                            currentProject.is_favorite ? 'text-amber-400 fill-current' : 'text-slate-400'
                          }`}
                        />
                        <span>{currentProject.is_favorite ? 'Sevimlilardan o‘chirish' : 'Sevimlilarga qo‘shish'}</span>
                      </button>

                      <button
                        onClick={() => {
                          setBreadcrumbDropdown(null);
                          navigator.clipboard.writeText(
                            `${window.location.origin}?project=${currentProject.id}`
                          );
                          addToast({ type: 'success', title: 'Loyiha havolasi nusxalandi!' });
                        }}
                        className="w-full px-3 py-2 rounded-xl hover:bg-white/[0.06] flex items-center gap-2.5 text-xs text-slate-200"
                      >
                        <Share2 className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Loyiha havolasini nusxalash</span>
                      </button>

                      <button
                        onClick={() => {
                          setBreadcrumbDropdown(null);
                          openModal('create_task', { project_id: currentProject.id });
                        }}
                        className="w-full px-3 py-2 rounded-xl hover:bg-white/[0.06] flex items-center gap-2.5 text-xs text-slate-200"
                      >
                        <Plus className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Shu loyihaga vazifa qo‘shish</span>
                      </button>

                      <div className="my-1 border-t border-white/[0.06]" />

                      <button
                        onClick={() => {
                          setBreadcrumbDropdown(null);
                          setProjectTab('settings');
                        }}
                        className="w-full px-3 py-2 rounded-xl hover:bg-white/[0.06] flex items-center gap-2.5 text-xs text-slate-200"
                      >
                        <Settings className="w-3.5 h-3.5 text-slate-400" />
                        <span>Loyiha sozlamalarini tahrirlash</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Active View Content */}
          <main className="flex-1 overflow-hidden">
            {(railSection === 'pulse' ||
              railSection === 'docs' ||
              railSection === 'timesheets') && (
              <PulseDashboardView
                mode={railSection}
                hierarchy={hierarchy}
                onRefreshAll={refreshAllWorkspaceData}
              />
            )}

            {railSection === 'inbox' && <InboxView />}

            {railSection === 'my_work' && <MyWorkView />}

            {railSection === 'reports' && <ReportsAnalyticsView />}

            {railSection === 'settings' && (
              <SettingsCenterView
                members={members}
                labels={labels}
                onRefreshAll={refreshAllWorkspaceData}
              />
            )}

            {railSection === 'spaces' && currentProject && (
              <ProjectWorkspaceView
                projectId={currentProject.id}
                members={members}
                labels={labels}
                refreshTrigger={refreshTrigger}
                onRefreshHierarchy={refreshAllWorkspaceData}
              />
            )}
          </main>
        </div>
      </div>

      {/* =====================================================================
          SLIDE-OVER TASK DETAIL DRAWER, MODALS & TOASTS
         ===================================================================== */}
      <TaskDetailDrawer
        members={members}
        workspaceLabels={labels}
        onTaskMutated={() => {
          setRefreshTrigger((n) => n + 1);
          refreshAllWorkspaceData();
        }}
      />

      <CreateModals
        hierarchy={hierarchy}
        members={members}
        onRefreshAll={refreshAllWorkspaceData}
      />

      {/* Toast Notifications Stack */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            onClick={() => removeToast(t.id)}
            className={`pointer-events-auto p-3.5 rounded-2xl border shadow-xl flex items-start gap-2.5 cursor-pointer backdrop-blur-md transition ${
              t.type === 'error'
                ? 'bg-rose-950/90 border-rose-500/50 text-rose-200'
                : t.type === 'info'
                ? 'bg-slate-900/95 border-indigo-500/40 text-slate-200'
                : 'bg-slate-900/95 border-emerald-500/40 text-emerald-200'
            }`}
          >
            {t.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div className="text-xs">
              <div className="font-bold">{t.title}</div>
              {t.message && <div className="opacity-85 mt-0.5">{t.message}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
