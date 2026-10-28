import React, { useState, useEffect } from 'react';
import {
  Layers,
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
  Folder,
  Star,
  PanelLeftClose,
  PanelLeftOpen,
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

export const AppShell: React.FC<AppShellProps> = ({ onLogout }) => {
  const {
    user,
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

  // Expanded state for nested tree nodes
  const [expandedSpaces, setExpandedSpaces] = useState<Record<number, boolean>>({});
  const [expandedFolders, setExpandedFolders] = useState<Record<number, boolean>>({});
  const [wsDropdownOpen, setWsDropdownOpen] = useState(false);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];
  const currentProject = hierarchy?.all_projects.find((p) => p.id === activeProjectId) || null;

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

      // Expand all spaces & folders by default on first load
      const spMap: Record<number, boolean> = {};
      const flMap: Record<number, boolean> = {};
      (treeRes.spaces || []).forEach((s: any) => {
        spMap[s.id] = true;
        (s.folders || []).forEach((f: any) => {
          flMap[f.id] = true;
        });
      });
      setExpandedSpaces((prev) => ({ ...spMap, ...prev }));
      setExpandedFolders((prev) => ({ ...flMap, ...prev }));

      // If in 'spaces' mode and no project selected yet, select first project automatically
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

  const PROJECT_TABS: Array<{ id: ProjectTab; label: string; icon: any }> = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'board', label: 'Kanban Board', icon: Kanban },
    { id: 'list', label: 'Jadval (List)', icon: ListFilter },
    { id: 'calendar', label: 'Kalendar', icon: Calendar },
    { id: 'timeline', label: 'Timeline (Gantt)', icon: GitMerge },
    { id: 'sprints', label: 'Sprints', icon: Sparkles },
    { id: 'docs', label: 'Docs & Wiki', icon: FileText },
    { id: 'time', label: 'Vaqt (Time)', icon: Clock },
    { id: 'settings', label: 'Sozlamalar', icon: Settings },
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

  const availabilityColors: Record<string, string> = {
    available: 'bg-emerald-500',
    focusing: 'bg-indigo-500',
    busy: 'bg-rose-500',
    vacation: 'bg-amber-500',
    sick: 'bg-orange-500',
  };

  return (
    <div className="h-screen w-screen flex bg-slate-950 text-slate-100 overflow-hidden select-none">
      {/* =====================================================================
          LAYER 1: LEFT PRIMARY GLOBAL RAIL (Icon Bar + Workspace Switcher)
         ===================================================================== */}
      <aside className="w-16 bg-slate-950 border-r border-slate-800/90 flex flex-col items-center justify-between py-3 shrink-0 z-30">
        <div className="flex flex-col items-center gap-3 w-full">
          {/* Workspace Switcher Button */}
          <div className="relative">
            <button
              onClick={() => setWsDropdownOpen(!wsDropdownOpen)}
              className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center font-bold text-sm text-white shadow-lg shadow-indigo-600/25 hover:scale-105 transition"
              title={`Workspace: ${activeWorkspace?.name || 'FlowForge'}`}
            >
              {activeWorkspace?.name?.slice(0, 2).toUpperCase() || 'FF'}
            </button>

            {wsDropdownOpen && (
              <div className="absolute left-14 top-0 w-72 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-2 z-50">
                <div className="px-3 py-2 border-b border-slate-800 mb-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Mening Workspacelarim ({workspaces.length})
                  </div>
                </div>
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {workspaces.map((ws) => (
                    <button
                      key={ws.id}
                      onClick={() => {
                        setWsDropdownOpen(false);
                        setActiveWorkspaceId(ws.id);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition ${
                        ws.id === activeWorkspaceId
                          ? 'bg-indigo-600 text-white font-semibold'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="truncate">
                        <div>{ws.name}</div>
                        <div className="text-[10px] opacity-75 font-mono">
                          /{ws.slug} • {ws.my_role.toUpperCase()}
                        </div>
                      </div>
                      {ws.id === activeWorkspaceId && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                    </button>
                  ))}
                </div>
                <div className="pt-2 mt-1 border-t border-slate-800">
                  <button
                    onClick={() => {
                      setWsDropdownOpen(false);
                      openModal('create_workspace');
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-indigo-400 hover:bg-slate-800"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Yangi Workspace Yaratish</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="w-8 h-px bg-slate-800" />

          {/* Main Rail Icons */}
          {[
            { id: 'pulse', label: 'Pulse (Bosh sahifa)', icon: Home },
            { id: 'inbox', label: 'Inbox (Bildirishnomalar)', icon: Bell, badge: unreadNotificationsCount },
            { id: 'my_work', label: 'Mening Ishim (My Work)', icon: CheckSquare },
            { id: 'spaces', label: 'Spaces & Loyihalar', icon: FolderKanban },
            { id: 'docs', label: 'Docs & Wiki Markazi', icon: FileText },
            { id: 'timesheets', label: 'Time Sheets (Vaqt)', icon: Clock },
            { id: 'reports', label: 'Analitika & Workload', icon: BarChart3 },
          ].map((item) => {
            const Icon = item.icon;
            const active = railSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigateRail(item.id as any)}
                title={item.label}
                className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition ${
                  active
                    ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/40'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.badge ? (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-[10px] font-bold text-white flex items-center justify-center">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Bottom Rail: Settings, Profile & Logout */}
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={() => openSettings('my_profile')}
            title="Profil va Workspace Sozlamalari"
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition ${
              railSection === 'settings'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Settings className="w-5 h-5" />
          </button>

          {/* User Avatar with Live Availability Dot */}
          <button
            onClick={() => openSettings('my_profile')}
            title={`${user?.profile?.full_name} (${user?.profile?.availability_status})`}
            className="relative w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-indigo-300"
          >
            {user?.profile?.full_name
              ?.split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2) || 'U'}
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-950 ${
                availabilityColors[user?.profile?.availability_status || 'available'] || 'bg-emerald-500'
              }`}
            />
          </button>

          <button
            onClick={async () => {
              try {
                await api.logout();
              } catch {
                // ignore
              }
              setStoredToken(null);
              useAppStore.getState().resetState();
              onLogout();
            }}
            title="Tizimdan chiqish (Logout)"
            className="w-9 h-9 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 flex items-center justify-center transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* =====================================================================
          LAYER 2: CONTEXTUAL SECONDARY SIDEBAR (Hierarchical Tree OR Settings Menu)
         ===================================================================== */}
      {isSecondarySidebarOpen && (
        <aside className="w-68 bg-slate-900/95 border-r border-slate-800/90 flex flex-col justify-between shrink-0 z-20">
          {railSection === 'settings' ? (
            /* SETTINGS MODE SIDEBAR */
            <div className="flex flex-col h-full">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white">Boshqaruv Markazi</div>
                  <div className="text-[11px] text-slate-400">Profil & Workspace</div>
                </div>
                <button
                  onClick={() => navigateRail('spaces')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200"
                >
                  <ArrowLeft className="w-3 h-3" /> Orqaga
                </button>
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
                            onClick={() => setSettingsTab(item.id)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition ${
                              active
                                ? 'bg-indigo-600 text-white shadow'
                                : 'text-slate-300 hover:bg-slate-800/80'
                            }`}
                          >
                            <Icon className="w-4 h-4 shrink-0" />
                            <span className="truncate">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* WORKSPACE HIERARCHY TREE SIDEBAR (Spaces -> Folders -> Projects) */
            <div className="flex flex-col h-full">
              {/* Workspace Title & Search Trigger */}
              <div className="p-3.5 border-b border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white truncate">
                      {activeWorkspace?.name || 'Workspace'}
                    </div>
                    <div className="text-[11px] text-indigo-400 font-medium uppercase">
                      Rol: {activeWorkspace?.my_role}
                    </div>
                  </div>
                  <button
                    onClick={toggleSecondarySidebar}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                    title="Menyuni yig‘ish"
                  >
                    <PanelLeftClose className="w-4 h-4" />
                  </button>
                </div>

                {/* Ctrl+K Command Palette Button */}
                <button
                  onClick={() => setCommandOpen(true)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-xs text-slate-400 transition"
                >
                  <div className="flex items-center gap-2">
                    <Search className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Qidiruv & Buyruqlar...</span>
                  </div>
                  <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                    Ctrl+K
                  </kbd>
                </button>
              </div>

              {/* Scrollable Hierarchy Tree */}
              <div className="flex-1 overflow-y-auto p-3 space-y-5">
                {/* Quick Global Views */}
                <div className="space-y-1">
                  {[
                    { id: 'pulse', label: 'Pulse Dashboard', icon: Home },
                    { id: 'inbox', label: 'Inbox & @Mentions', icon: Bell, badge: unreadNotificationsCount },
                    { id: 'my_work', label: 'Mening Vazifalarim', icon: CheckSquare },
                    { id: 'docs', label: 'Hujjatlar (Wiki Hub)', icon: FileText },
                    { id: 'timesheets', label: 'Vaqt Tabeli (Time Sheets)', icon: Clock },
                    { id: 'reports', label: 'Hisobotlar & Workload', icon: BarChart3 },
                  ].map((nav) => {
                    const Icon = nav.icon;
                    const active = railSection === nav.id;
                    return (
                      <button
                        key={nav.id}
                        onClick={() => navigateRail(nav.id as any)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition ${
                          active
                            ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                            : 'text-slate-300 hover:bg-slate-800/70'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5 text-slate-400" />
                          <span>{nav.label}</span>
                        </div>
                        {nav.badge ? (
                          <span className="px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold">
                            {nav.badge}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                {/* Favorites */}
                {hierarchy?.favorites && hierarchy.favorites.length > 0 && (
                  <div>
                    <div className="px-2 mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-400/90">
                      <Star className="w-3 h-3 fill-current" />
                      <span>Yulduzchalangan (Favorites)</span>
                    </div>
                    <div className="space-y-0.5">
                      {hierarchy.favorites.map((proj) => {
                        const isSelected = railSection === 'spaces' && activeProjectId === proj.id;
                        return (
                          <button
                            key={proj.id}
                            onClick={() => openProject(proj.id)}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition ${
                              isSelected
                                ? 'bg-indigo-600 text-white font-semibold'
                                : 'text-slate-300 hover:bg-slate-800/70'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: proj.color }}
                              />
                              <span className="truncate">{proj.name}</span>
                            </div>
                            <span className="text-[10px] font-mono opacity-75">{proj.project_key}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Nested Hierarchy: SPACES -> FOLDERS -> PROJECTS */}
                <div>
                  <div className="px-2 mb-1.5 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Bo‘limlar (Spaces) & Loyihalar
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openModal('create_space')}
                        className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                        title="Yangi Space (Bo‘lim) yaratish"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {hierarchy?.spaces.map((space) => {
                      const isExpanded = !!expandedSpaces[space.id];
                      return (
                        <div key={space.id} className="space-y-0.5">
                          {/* Space Header */}
                          <div className="flex items-center justify-between px-2 py-1.5 rounded-xl hover:bg-slate-800/60 group">
                            <button
                              onClick={() =>
                                setExpandedSpaces((prev) => ({
                                  ...prev,
                                  [space.id]: !prev[space.id],
                                }))
                              }
                              className="flex items-center gap-1.5 min-w-0 flex-1 text-left"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              )}
                              <span
                                className="w-2.5 h-2.5 rounded-md shrink-0"
                                style={{ backgroundColor: space.color }}
                              />
                              <span className="text-xs font-bold text-slate-200 truncate">
                                {space.name}
                              </span>
                            </button>

                            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
                              <button
                                onClick={() => openModal('create_folder', { space_id: space.id })}
                                className="p-0.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white"
                                title="Papka qo‘shish"
                              >
                                <Folder className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => openModal('create_project', { space_id: space.id })}
                                className="p-0.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white"
                                title="Loyiha qo‘shish"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    await api.deleteSpace(space.id);
                                    await refreshAllWorkspaceData();
                                    addToast({ type: 'info', title: `${space.name} bo‘limi o‘chirildi` });
                                  } catch (err: any) {
                                    addToast({ type: 'error', title: 'Xatolik', message: err.message });
                                  }
                                }}
                                className="p-0.5 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400"
                                title="Space bo‘limini o‘chirish"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          {/* Inside Space: Folders & Direct Projects */}
                          {isExpanded && (
                            <div className="pl-3.5 border-l border-slate-800/80 ml-3 space-y-1">
                              {/* Folders */}
                              {space.folders.map((folder) => {
                                const fExpanded = !!expandedFolders[folder.id];
                                return (
                                  <div key={folder.id} className="space-y-0.5">
                                    <div className="flex items-center justify-between px-2 py-1 rounded-lg hover:bg-slate-800/50 group">
                                      <button
                                        onClick={() =>
                                          setExpandedFolders((prev) => ({
                                            ...prev,
                                            [folder.id]: !prev[folder.id],
                                          }))
                                        }
                                        className="flex items-center gap-1.5 min-w-0 flex-1 text-left"
                                      >
                                        {fExpanded ? (
                                          <ChevronDown className="w-3 h-3 text-slate-500" />
                                        ) : (
                                          <ChevronRight className="w-3 h-3 text-slate-500" />
                                        )}
                                        <Folder className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        <span className="text-xs font-medium text-slate-300 truncate">
                                          {folder.name}
                                        </span>
                                      </button>
                                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
                                          <button
                                            onClick={() =>
                                              openModal('create_project', {
                                                space_id: space.id,
                                                folder_id: folder.id,
                                              })
                                            }
                                            className="p-0.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white"
                                            title="Papkaga loyiha qo‘shish"
                                          >
                                            <Plus className="w-3 h-3" />
                                          </button>
                                          <button
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              try {
                                                await api.deleteFolder(folder.id);
                                                await refreshAllWorkspaceData();
                                                addToast({ type: 'info', title: `${folder.name} papkasi o‘chirildi` });
                                              } catch (err: any) {
                                                addToast({ type: 'error', title: 'Xatolik', message: err.message });
                                              }
                                            }}
                                            className="p-0.5 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400"
                                            title="Papkani o‘chirish"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        </div>
                                    </div>

                                    {/* Projects inside Folder */}
                                    {fExpanded && (
                                      <div className="pl-3.5 border-l border-slate-800/60 ml-2.5 space-y-0.5">
                                        {folder.projects.map((proj) => {
                                          const active =
                                            railSection === 'spaces' && activeProjectId === proj.id;
                                          return (
                                            <button
                                              key={proj.id}
                                              onClick={() => openProject(proj.id)}
                                              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition ${
                                                active
                                                  ? 'bg-indigo-600 text-white font-semibold'
                                                  : 'text-slate-300 hover:bg-slate-800/70'
                                              }`}
                                            >
                                              <div className="flex items-center gap-2 min-w-0">
                                                <span
                                                  className="w-2 h-2 rounded-full shrink-0"
                                                  style={{ backgroundColor: proj.color }}
                                                />
                                                <span className="truncate">{proj.name}</span>
                                              </div>
                                              <span className="text-[10px] font-mono opacity-75">
                                                {proj.total_tasks}
                                              </span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}

                              {/* Direct Projects in Space */}
                              {space.projects.map((proj) => {
                                const active =
                                  railSection === 'spaces' && activeProjectId === proj.id;
                                return (
                                  <button
                                    key={proj.id}
                                    onClick={() => openProject(proj.id)}
                                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition ${
                                      active
                                        ? 'bg-indigo-600 text-white font-semibold'
                                        : 'text-slate-300 hover:bg-slate-800/70'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span
                                        className="w-2 h-2 rounded-full shrink-0"
                                        style={{ backgroundColor: proj.color }}
                                      />
                                      <span className="truncate">{proj.name}</span>
                                    </div>
                                    <span className="text-[10px] font-mono opacity-75">
                                      {proj.total_tasks}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Bottom Quick Action */}
              <div className="p-3 border-t border-slate-800 flex items-center justify-between text-xs">
                <button
                  onClick={() => openModal('create_project')}
                  className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 font-semibold"
                >
                  <Plus className="w-4 h-4" />
                  <span>Yangi Loyiha</span>
                </button>
                <button
                  onClick={() => openSettings('ws_trash')}
                  className="flex items-center gap-1 text-slate-400 hover:text-white"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Savat</span>
                </button>
              </div>
            </div>
          )}
        </aside>
      )}

      {/* =====================================================================
          LAYER 3: MAIN CONTENT AREA + CONTEXTUAL HEADER & VIEW TABS
         ===================================================================== */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Contextual Header */}
        <header className="h-14 px-5 bg-slate-950 border-b border-slate-800/90 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {!isSecondarySidebarOpen && (
              <button
                onClick={toggleSecondarySidebar}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300"
                title="Yon menyuni ochish"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            )}

            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 text-xs min-w-0">
              <span className="text-slate-400 font-medium truncate hidden sm:inline">
                {activeWorkspace?.name}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600 hidden sm:inline" />
              {railSection === 'spaces' && currentProject ? (
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: currentProject.color }}
                  />
                  <span className="font-bold text-white truncate">{currentProject.name}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-indigo-400">
                    {currentProject.project_key}
                  </span>
                </div>
              ) : (
                <span className="font-bold text-white uppercase tracking-wide">
                  {railSection.replace('_', ' ')}
                </span>
              )}
            </div>
          </div>

          {/* Right Header Controls: Active Stopwatch Timer, Command Palette, New Task */}
          <div className="flex items-center gap-2.5 shrink-0">
            {activeTimer && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-600/20 border border-rose-500/40 text-xs">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                <span
                  onClick={() => openTaskDrawer(activeTimer.taskId)}
                  className="font-mono font-bold text-rose-300 cursor-pointer"
                >
                  {activeTimer.taskKey}
                </span>
                <button
                  onClick={handleStopGlobalTimer}
                  className="px-2 py-0.5 rounded bg-rose-600 text-white font-semibold flex items-center gap-1"
                >
                  <Square className="w-3 h-3 fill-current" /> Stop
                </button>
              </div>
            )}

            <button
              onClick={() => setCommandOpen(true)}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300"
            >
              <Search className="w-3.5 h-3.5 text-indigo-400" />
              <span>Qidiruv</span>
              <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-slate-950 text-slate-400">
                Ctrl+K
              </kbd>
            </button>

            <button
              onClick={() => openModal('create_task')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Vazifa</span>
            </button>
          </div>
        </header>

        {/* Project 9-Tab View Switcher Sub-Header (when inside a Project) */}
        {railSection === 'spaces' && currentProject && (
          <div className="px-5 bg-slate-950 border-b border-slate-800 flex items-center gap-1 overflow-x-auto shrink-0">
            {PROJECT_TABS.map((t) => {
              const Icon = t.icon;
              const active = projectTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setProjectTab(t.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition ${
                    active
                      ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Active View Content */}
        <main className="flex-1 overflow-hidden bg-slate-950">
          {(railSection === 'pulse' || railSection === 'docs' || railSection === 'timesheets') && (
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

      {/* =====================================================================
          LAYER 4: SLIDE-OVER TASK DETAIL DRAWER, MODALS & TOASTS
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
