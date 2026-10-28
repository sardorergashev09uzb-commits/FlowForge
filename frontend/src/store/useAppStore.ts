import { create } from 'zustand';
import type { User, Workspace, WorkspaceInvitation } from '../types/flowforge';

export type RailSection =
  | 'pulse'
  | 'inbox'
  | 'my_work'
  | 'spaces'
  | 'docs'
  | 'timesheets'
  | 'reports'
  | 'settings';

export type ProjectTab =
  | 'overview'
  | 'board'
  | 'list'
  | 'calendar'
  | 'timeline'
  | 'sprints'
  | 'docs'
  | 'time'
  | 'settings';

export type SettingsTab =
  | 'my_profile'
  | 'security_sessions'
  | 'notifications_prefs'
  | 'ws_general'
  | 'ws_members'
  | 'ws_teams'
  | 'ws_roles'
  | 'ws_labels'
  | 'ws_audit'
  | 'ws_trash';

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message?: string;
}

export interface RunningTimer {
  taskId: number;
  taskKey: string;
  taskTitle: string;
  startedAt: number; // epoch ms
}

interface AppState {
  user: User | null;
  workspaces: Workspace[];
  activeWorkspaceId: number | null;
  unreadNotificationsCount: number;
  pendingInvitations: WorkspaceInvitation[];

  // Multi-layered Navigation State
  railSection: RailSection;
  isSecondarySidebarOpen: boolean;
  activeProjectId: number | null;
  projectTab: ProjectTab;
  settingsTab: SettingsTab;

  // Slide-over Task Drawer & Modals
  selectedTaskId: number | null;
  isCommandOpen: boolean;
  modalType: null | 'create_workspace' | 'create_space' | 'create_folder' | 'create_project' | 'create_task';
  modalContext: Record<string, any>;

  // Live Stopwatch Timer
  activeTimer: RunningTimer | null;

  // Toast queue
  toasts: ToastItem[];

  // Actions
  setBootstrapData: (data: {
    user: User;
    workspaces: Workspace[];
    unread_notifications_count: number;
    pending_invitations: WorkspaceInvitation[];
  }) => void;
  setUser: (user: User | null) => void;
  setActiveWorkspaceId: (id: number) => void;
  setUnreadCount: (count: number) => void;

  navigateRail: (section: RailSection) => void;
  toggleSecondarySidebar: () => void;
  openProject: (projectId: number, tab?: ProjectTab) => void;
  setProjectTab: (tab: ProjectTab) => void;
  openSettings: (tab?: SettingsTab) => void;
  setSettingsTab: (tab: SettingsTab) => void;

  openTaskDrawer: (taskId: number | null) => void;
  setCommandOpen: (open: boolean) => void;
  openModal: (type: AppState['modalType'], context?: Record<string, any>) => void;
  closeModal: () => void;

  startTimer: (timer: Omit<RunningTimer, 'startedAt'>) => void;
  stopTimer: () => RunningTimer | null;

  addToast: (toast: Omit<ToastItem, 'id'>) => void;
  removeToast: (id: string) => void;
  resetState: () => void;
}

const savedWsId = Number(localStorage.getItem('flowforge_active_ws') || 0) || null;

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  workspaces: [],
  activeWorkspaceId: savedWsId,
  unreadNotificationsCount: 0,
  pendingInvitations: [],

  railSection: 'spaces',
  isSecondarySidebarOpen: true,
  activeProjectId: null,
  projectTab: 'board',
  settingsTab: 'my_profile',

  selectedTaskId: null,
  isCommandOpen: false,
  modalType: null,
  modalContext: {},

  activeTimer: null,
  toasts: [],

  setBootstrapData: (data) => {
    const currentWsId = get().activeWorkspaceId;
    const validWs = data.workspaces.find((w) => w.id === currentWsId) || data.workspaces[0] || null;
    if (validWs) {
      localStorage.setItem('flowforge_active_ws', String(validWs.id));
    }

    // Apply UI density to body
    const density = data.user?.profile?.ui_density || 'comfortable';
    document.body.classList.remove('density-compact', 'density-comfortable');
    document.body.classList.add(`density-${density}`);

    set({
      user: data.user,
      workspaces: data.workspaces,
      activeWorkspaceId: validWs ? validWs.id : null,
      unreadNotificationsCount: data.unread_notifications_count,
      pendingInvitations: data.pending_invitations || [],
    });
  },

  setUser: (user) => {
    if (user?.profile?.ui_density) {
      document.body.classList.remove('density-compact', 'density-comfortable');
      document.body.classList.add(`density-${user.profile.ui_density}`);
    }
    set({ user });
  },

  setActiveWorkspaceId: (id) => {
    localStorage.setItem('flowforge_active_ws', String(id));
    set({
      activeWorkspaceId: id,
      activeProjectId: null,
      selectedTaskId: null,
      railSection: 'pulse',
    });
  },

  setUnreadCount: (count) => set({ unreadNotificationsCount: count }),

  navigateRail: (section) =>
    set({
      railSection: section,
      isSecondarySidebarOpen: true,
    }),

  toggleSecondarySidebar: () =>
    set((s) => ({ isSecondarySidebarOpen: !s.isSecondarySidebarOpen })),

  openProject: (projectId, tab) =>
    set((s) => ({
      railSection: 'spaces',
      activeProjectId: projectId,
      projectTab: tab || s.projectTab || 'board',
    })),

  setProjectTab: (tab) => set({ projectTab: tab }),

  openSettings: (tab = 'my_profile') =>
    set({
      railSection: 'settings',
      settingsTab: tab,
      isSecondarySidebarOpen: true,
    }),

  setSettingsTab: (tab) => set({ settingsTab: tab }),

  openTaskDrawer: (taskId) => set({ selectedTaskId: taskId }),

  setCommandOpen: (open) => set({ isCommandOpen: open }),

  openModal: (type, context = {}) => set({ modalType: type, modalContext: context }),
  closeModal: () => set({ modalType: null, modalContext: {} }),

  startTimer: (timer) =>
    set({
      activeTimer: {
        ...timer,
        startedAt: Date.now(),
      },
    }),

  stopTimer: () => {
    const current = get().activeTimer;
    set({ activeTimer: null });
    return current;
  },

  addToast: (toast) => {
    const id = Math.random().toString(36).slice(2, 9);
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4200);
  },

  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  resetState: () =>
    set({
      user: null,
      workspaces: [],
      activeWorkspaceId: null,
      activeProjectId: null,
      selectedTaskId: null,
      activeTimer: null,
    }),
}));
