import React, { useState, useEffect } from 'react';
import {
  User as UserIcon,
  Shield,
  Bell,
  Building2,
  Users,
  UsersRound,
  KeyRound,
  Tag,
  FileSearch,
  Trash2,
  Laptop,
  Check,
  X,
  RotateCcw,
  Crown,
  Send,
  Edit3,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAppStore } from '../../store/useAppStore';
import type {
  WorkspaceMember,
  WorkspaceTeam,
  WorkspaceInvitation,
  Label,
  UserSession,
  NotificationPref,
  ActivityItem,
} from '../../types/flowforge';

interface SettingsCenterViewProps {
  members: WorkspaceMember[];
  labels: Label[];
  onRefreshAll: () => void;
}

export const SettingsCenterView: React.FC<SettingsCenterViewProps> = ({
  members,
  labels,
  onRefreshAll,
}) => {
  const {
    user,
    setUser,
    workspaces,
    activeWorkspaceId,
    setActiveWorkspaceId,
    settingsTab,
    addToast,
  } = useAppStore();

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);

  // Profile form state
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [timezone, setTimezone] = useState('Asia/Tashkent');
  const [themePref, setThemePref] = useState<'dark' | 'light' | 'system'>('dark');
  const [availabilityStatus, setAvailabilityStatus] = useState('available');
  const [availabilityNote, setAvailabilityNote] = useState('');
  const [uiDensity, setUiDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [telegramHandle, setTelegramHandle] = useState('');

  // Password & Sessions
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [sessions, setSessions] = useState<UserSession[]>([]);

  // Notification prefs
  const [notifPrefs, setNotifPrefs] = useState<NotificationPref[]>([]);

  // Workspace General & Policies
  const [wsName, setWsName] = useState('');
  const [wsSlug, setWsSlug] = useState('');
  const [wsDesc, setWsDesc] = useState('');
  const [allowMemberProjectCreation, setAllowMemberProjectCreation] = useState(true);
  const [requireTimeTracking, setRequireTimeTracking] = useState(false);
  const [newOwnerId, setNewOwnerId] = useState<number | ''>('');
  const [deleteWsConfirmSlug, setDeleteWsConfirmSlug] = useState('');

  // Invitations
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');

  // Teams
  const [teams, setTeams] = useState<WorkspaceTeam[]>([]);
  const [teamName, setTeamName] = useState('');
  const [teamHandle, setTeamHandle] = useState('');
  const [teamDesc, setTeamDesc] = useState('');
  const [teamMemberIds, setTeamMemberIds] = useState<number[]>([]);
  const [editingTeamId, setEditingTeamId] = useState<number | null>(null);
  const [editTeamName, setEditTeamName] = useState('');
  const [editTeamDesc, setEditTeamDesc] = useState('');
  const [editTeamMemberIds, setEditTeamMemberIds] = useState<number[]>([]);

  // Labels
  const [labelName, setLabelName] = useState('');
  const [labelColor, setLabelColor] = useState('#6366f1');
  const [editingLabelId, setEditingLabelId] = useState<number | null>(null);
  const [editLabelName, setEditLabelName] = useState('');
  const [editLabelColor, setEditLabelColor] = useState('#6366f1');

  // Audit & Trash
  const [auditLogs, setAuditLogs] = useState<ActivityItem[]>([]);
  const [trashData, setTrashData] = useState<{ tasks: any[]; projects: any[] }>({
    tasks: [],
    projects: [],
  });

  useEffect(() => {
    if (user) {
      setFullName(user.profile.full_name || '');
      setUsername(user.username || '');
      setJobTitle(user.profile.job_title || '');
      setDepartment(user.profile.department || '');
      setPhone(user.profile.phone || '');
      setBio(user.profile.bio || '');
      setTimezone(user.profile.timezone || 'Asia/Tashkent');
      setThemePref((user.profile.theme as any) || 'dark');
      setAvailabilityStatus(user.profile.availability_status || 'available');
      setAvailabilityNote(user.profile.availability_note || '');
      setUiDensity(user.profile.ui_density || 'comfortable');
      setTelegramHandle(user.profile.telegram_handle || '');
    }
  }, [user]);

  useEffect(() => {
    if (activeWorkspace) {
      setWsName(activeWorkspace.name);
      setWsSlug(activeWorkspace.slug);
      setWsDesc(activeWorkspace.description || '');
      setAllowMemberProjectCreation(
        activeWorkspace.settings?.allow_member_project_creation !== false
      );
      setRequireTimeTracking(!!activeWorkspace.settings?.require_time_tracking);
    }
  }, [activeWorkspace]);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    if (settingsTab === 'security_sessions') {
      api.getSessions().then((res) => setSessions(res.sessions || [])).catch(() => {});
    } else if (settingsTab === 'notifications_prefs') {
      api.getNotificationPrefs().then((res) => setNotifPrefs(res.preferences || [])).catch(() => {});
    } else if (settingsTab === 'ws_members') {
      api.getInvitations(activeWorkspaceId).then((res) => setInvitations(res.invitations || [])).catch(() => {});
    } else if (settingsTab === 'ws_teams') {
      api.getTeams(activeWorkspaceId).then((res) => setTeams(res.teams || [])).catch(() => {});
    } else if (settingsTab === 'ws_audit') {
      api.getWorkspaceActivity(activeWorkspaceId).then((res) => setAuditLogs(res.activities || [])).catch(() => {});
    } else if (settingsTab === 'ws_trash') {
      api.getTrash(activeWorkspaceId).then((res) => setTrashData({ tasks: res.tasks || [], projects: res.projects || [] })).catch(() => {});
    }
  }, [settingsTab, activeWorkspaceId]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.updateProfile({
        full_name: fullName,
        username,
        job_title: jobTitle,
        department,
        phone,
        bio,
        timezone,
        theme: themePref,
        availability_status: availabilityStatus,
        availability_note: availabilityNote,
        ui_density: uiDensity,
        telegram_handle: telegramHandle,
      });
      setUser(res.user);
      onRefreshAll();
      addToast({ type: 'success', title: 'Shaxsiy profil saqlandi' });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Xatolik', message: err.message });
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      addToast({ type: 'success', title: res.message });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Parol xatoligi', message: err.message });
    }
  };

  const EVENT_LABELS: Record<string, string> = {
    task_assigned: 'Menga yangi vazifa biriktirilganda',
    mentioned: 'Izohlarda meni @mention qilib chaqirishganda',
    comment_added: 'Men kuzatayotgan vazifaga yangi izoh yozilganda',
    status_changed: 'Vazifa statusi o‘zgarganda yoki yakunlanganda',
    due_soon: 'Vazifa muddati yaqinlashganda (24 soat oldin)',
    blocker_resolved: 'Vazifamni to‘sib turgan Bloker yechilganda',
  };

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6 h-full overflow-y-auto">
      {/* 1. MY PROFILE */}
      {settingsTab === 'my_profile' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
              <UserIcon className="w-6 h-6 text-indigo-400" />
              <span>Shaxsiy Profil, Ish Holati va Interfeys Sozlamalari</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Jamoa a’zolariga ko‘rinadigan shaxsiy ma’lumotlaringiz, bandlik statusingiz va ekran zichligi
            </p>
          </div>

          <form onSubmit={handleSaveProfile} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">To‘liq ism-sharif *</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Username (@mention uchun) *</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Lavozim (Job Title)</label>
                <input
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Bo‘lim (Department)</label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Telefon raqam</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Telegram Handle</label>
                <input
                  type="text"
                  value={telegramHandle}
                  onChange={(e) => setTelegramHandle(e.target.value)}
                  placeholder="@username"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2 border-t border-slate-800">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Joriy Ish Holatingiz</label>
                <select
                  value={availabilityStatus}
                  onChange={(e) => setAvailabilityStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
                >
                  <option value="available">🟢 Available (Ishda)</option>
                  <option value="focusing">🎯 Focusing (Chalg‘itmang)</option>
                  <option value="busy">🔴 Busy (Uchrashuvda)</option>
                  <option value="vacation">🌴 Vacation (Ta’tilda)</option>
                  <option value="sick">🤒 Sick Leave (Betob)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Holat izohi (Status Note)</label>
                <input
                  type="text"
                  value={availabilityNote}
                  onChange={(e) => setAvailabilityNote(e.target.value)}
                  placeholder="Masalan: Sprint 1 reliz ustida"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Interfeys Zichligi (UI Density)</label>
                <select
                  value={uiDensity}
                  onChange={(e) => setUiDensity(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
                >
                  <option value="comfortable">Comfortable (Keng)</option>
                  <option value="compact">Compact (Zich rejim)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Vaqt Mintaqasi (Timezone)</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
                >
                  <option value="Asia/Tashkent">Asia/Tashkent (UTC+5)</option>
                  <option value="Asia/Samarkand">Asia/Samarkand (UTC+5)</option>
                  <option value="Europe/London">Europe/London (UTC+0)</option>
                  <option value="America/New_York">America/New_York (UTC-5)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Qisqacha Bio</label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20"
              >
                Profil O‘zgarishlarini Saqlash
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 2. SECURITY & ACTIVE SESSIONS */}
      {settingsTab === 'security_sessions' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
              <Shield className="w-6 h-6 text-emerald-400" />
              <span>Hisob Xavfsizligi va Faol Qurilmalar (Active Sessions)</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Parolni yangilash hamda hisobingizga kirilgan barcha qurilmalar va IP manzillarni boshqarish
            </p>
          </div>

          <form onSubmit={handleChangePassword} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white">Parolni almashtirish</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Joriy parol *</label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Yangi parol (kamida 8 ta belgi) *</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
                />
              </div>
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white"
            >
              Parolni yangilash
            </button>
          </form>

          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Faol Sessiyalar ({sessions.length})</h3>
              <button
                onClick={async () => {
                  await api.revokeOtherSessions();
                  const res = await api.getSessions();
                  setSessions(res.sessions || []);
                  addToast({ type: 'success', title: 'Boshqa qurilmalar sessiyasi uzildi' });
                }}
                className="text-xs text-rose-400 hover:text-rose-300 font-semibold"
              >
                Boshqa barcha qurilmalardan chiqish
              </button>
            </div>

            <div className="space-y-2.5">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-slate-950 border border-slate-800"
                >
                  <div className="flex items-center gap-3">
                    <Laptop className="w-5 h-5 text-indigo-400" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{s.device_name}</span>
                        {s.is_current && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                            Joriy qurilma
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        IP: {s.ip_address} • So‘nggi faollik: {s.last_active_at.slice(0, 16).replace('T', ' ')}
                      </div>
                    </div>
                  </div>
                  {!s.is_current && (
                    <button
                      onClick={async () => {
                        await api.revokeSession(s.id);
                        setSessions((prev) => prev.filter((x) => x.id !== s.id));
                        addToast({ type: 'info', title: 'Sessiya yakunlandi' });
                      }}
                      className="px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 text-xs"
                    >
                      Sessiyani uzish
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. NOTIFICATION PREFERENCES MATRIX */}
      {settingsTab === 'notifications_prefs' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
              <Bell className="w-6 h-6 text-amber-400" />
              <span>Bildirishnomalar Matritsasi</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Qaysi hodisa ro‘y berganda qaysi kanal orqali xabardor qilinishingizni belgilang
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase text-[11px]">
                  <th className="py-3.5 px-5">Hodisa turi</th>
                  <th className="py-3.5 px-4 text-center">In-App (Inbox)</th>
                  <th className="py-3.5 px-4 text-center">Email</th>
                  <th className="py-3.5 px-4 text-center">Telegram Bot</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {notifPrefs.map((pref, idx) => (
                  <tr key={pref.event_type}>
                    <td className="py-3.5 px-5 font-medium text-white">
                      {EVENT_LABELS[pref.event_type] || pref.event_type}
                    </td>
                    {(['in_app_enabled', 'email_enabled', 'telegram_enabled'] as const).map((channel) => (
                      <td key={channel} className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={pref[channel]}
                          onChange={(e) => {
                            const next = [...notifPrefs];
                            next[idx] = { ...pref, [channel]: e.target.checked };
                            setNotifPrefs(next);
                          }}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-600"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="p-4 bg-slate-950/50 border-t border-slate-800 flex justify-end">
              <button
                onClick={async () => {
                  try {
                    const res = await api.updateNotificationPrefs(notifPrefs);
                    setNotifPrefs(res.preferences || []);
                    addToast({ type: 'success', title: 'Bildirishnoma sozlamalari saqlandi' });
                  } catch (err: any) {
                    addToast({ type: 'error', title: 'Xatolik', message: err.message });
                  }
                }}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white"
              >
                Matritsani Saqlash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. WORKSPACE GENERAL, POLICIES, OWNERSHIP TRANSFER & DELETE */}
      {settingsTab === 'ws_general' && activeWorkspace && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
              <Building2 className="w-6 h-6 text-indigo-400" />
              <span>Workspace Umumiy Sozlamalari, Siyosatlar va Egalik</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Sizning ushbu Workspace’dagi rolingiz:{' '}
              <span className="font-bold text-indigo-400 uppercase">{activeWorkspace.my_role}</span>
            </p>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api.updateWorkspace(activeWorkspace.id, {
                  name: wsName,
                  slug: wsSlug,
                  description: wsDesc,
                  settings: {
                    allow_member_project_creation: allowMemberProjectCreation,
                    require_time_tracking: requireTimeTracking,
                  },
                });
                onRefreshAll();
                addToast({ type: 'success', title: 'Workspace ma’lumotlari va siyosatlari yangilandi' });
              } catch (err: any) {
                addToast({ type: 'error', title: 'Ruxsat rad etildi', message: err.message });
              }
            }}
            className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Workspace nomi *</label>
                <input
                  type="text"
                  required
                  value={wsName}
                  onChange={(e) => setWsName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">URL Slug *</label>
                <input
                  type="text"
                  required
                  value={wsSlug}
                  onChange={(e) => setWsSlug(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm font-mono text-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Tavsif</label>
              <textarea
                rows={3}
                value={wsDesc}
                onChange={(e) => setWsDesc(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
              />
            </div>

            {/* Workspace Governance Policies */}
            <div className="pt-3 border-t border-slate-800 space-y-2.5">
              <div className="text-xs font-bold text-slate-300">Workspace ichki siyosatlari (Governance Policies):</div>
              <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowMemberProjectCreation}
                  onChange={(e) => setAllowMemberProjectCreation(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-indigo-600"
                />
                <span>
                  Oddiy <b>Member</b> roliga ega a’zolarga yangi Loyiha va Space yaratishga ruxsat berish (o‘chirilsa faqat Owner va Admin yarata oladi)
                </span>
              </label>

              <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requireTimeTracking}
                  onChange={(e) => setRequireTimeTracking(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-indigo-600"
                />
                <span>Vazifalarda vaqt hisobi (Time Tracking) yuritilishini talab qilish</span>
              </label>
            </div>

            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white"
            >
              Saqlash (Owner / Admin)
            </button>
          </form>

          {/* Ownership Transfer (Owner Only) */}
          <div className="p-6 rounded-2xl bg-amber-950/20 border border-amber-500/30 space-y-3">
            <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
              <Crown className="w-4 h-4" />
              <span>Workspace Egaligini Topshirish (Faqat Owner uchun)</span>
            </div>
            <p className="text-xs text-slate-400">
              Egalik boshqa a’zoga topshirilganda sizning rolingiz avtomatik ravishda Admin darajasiga o‘zgaradi.
            </p>
            <div className="flex gap-2">
              <select
                value={newOwnerId}
                onChange={(e) => setNewOwnerId(e.target.value ? Number(e.target.value) : '')}
                className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
              >
                <option value="">Yangi egani tanlang...</option>
                {members
                  .filter((m) => m.user_id !== activeWorkspace.owner_id)
                  .map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.full_name} ({m.email})
                    </option>
                  ))}
              </select>
              <button
                onClick={async () => {
                  if (!newOwnerId) return;
                  try {
                    await api.transferOwnership(activeWorkspace.id, Number(newOwnerId));
                    onRefreshAll();
                    addToast({ type: 'success', title: 'Workspace egaligi topshirildi' });
                  } catch (err: any) {
                    addToast({ type: 'error', title: 'Rad etildi', message: err.message });
                  }
                }}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-semibold text-white"
              >
                Egalikni topshirish
              </button>
            </div>
          </div>

          {/* Delete Workspace (Owner Only) */}
          <div className="p-6 rounded-2xl bg-rose-950/20 border border-rose-500/30 space-y-3">
            <div className="flex items-center gap-2 text-rose-300 font-bold text-sm">
              <AlertTriangle className="w-4 h-4" />
              <span>Workspace’ni Butunlay O‘chirish (Faqat Owner uchun)</span>
            </div>
            <p className="text-xs text-slate-400">
              Tasdiqlash uchun Workspace slug nomini (<code className="text-rose-300 font-mono">{activeWorkspace.slug}</code>) kiriting:
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={deleteWsConfirmSlug}
                onChange={(e) => setDeleteWsConfirmSlug(e.target.value)}
                placeholder={activeWorkspace.slug}
                className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white"
              />
              <button
                type="button"
                disabled={deleteWsConfirmSlug !== activeWorkspace.slug}
                onClick={async () => {
                  try {
                    await api.deleteWorkspace(activeWorkspace.id);
                    const remaining = workspaces.filter((w) => w.id !== activeWorkspace.id);
                    if (remaining.length > 0) {
                      setActiveWorkspaceId(remaining[0].id);
                    }
                    onRefreshAll();
                    addToast({ type: 'info', title: 'Workspace o‘chirildi' });
                  } catch (err: any) {
                    addToast({ type: 'error', title: 'Rad etildi', message: err.message });
                  }
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-xs font-semibold text-white"
              >
                Workspace’ni o‘chirish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. MEMBERS & INVITATIONS */}
      {settingsTab === 'ws_members' && activeWorkspaceId && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
              <Users className="w-6 h-6 text-indigo-400" />
              <span>Workspace A’zolari, Rollar va Taklifnomalar</span>
            </h1>
          </div>

          {/* Invite Member Form */}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const res = await api.inviteMember(activeWorkspaceId, {
                  email: inviteEmail,
                  role: inviteRole,
                });
                setInvitations(res.invitations || []);
                setInviteEmail('');
                addToast({ type: 'success', title: 'Taklifnoma yaratildi!' });
              } catch (err: any) {
                addToast({ type: 'error', title: 'Taklifnoma xatoligi', message: err.message });
              }
            }}
            className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-end gap-3"
          >
            <div className="flex-1 min-w-[220px]">
              <label className="block text-xs text-slate-300 mb-1">Yangi a’zo Email manzili *</label>
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="developer@company.uz"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
              />
            </div>
            <div className="w-44">
              <label className="block text-xs text-slate-300 mb-1">Biriktiriladigan Rol</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
              >
                <option value="admin">Admin</option>
                <option value="member">Member</option>
                <option value="viewer">Viewer (Read-only)</option>
              </select>
            </div>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Taklif yuborish</span>
            </button>
          </form>

          {/* Active Members Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase text-[11px]">
                  <th className="py-3 px-4">Foydalanuvchi</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Roli</th>
                  <th className="py-3 px-4">Haftalik Quvvati</th>
                  <th className="py-3 px-4 text-right">Amal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {members.map((m) => (
                  <tr key={m.user_id}>
                    <td className="py-3 px-4">
                      <div className="font-bold text-white">{m.full_name}</div>
                      <div className="text-[11px] text-slate-400">@{m.username} • {m.title_in_workspace}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">{m.email}</td>
                    <td className="py-3 px-4">
                      {m.role === 'owner' ? (
                        <span className="px-2.5 py-1 rounded bg-indigo-500/20 text-indigo-300 font-bold uppercase text-[10px]">
                          OWNER
                        </span>
                      ) : (
                        <select
                          value={m.role}
                          onChange={async (e) => {
                            try {
                              await api.updateMember(activeWorkspaceId, m.user_id, {
                                role: e.target.value,
                              });
                              onRefreshAll();
                              addToast({ type: 'success', title: 'A’zo roli yangilandi' });
                            } catch (err: any) {
                              addToast({ type: 'error', title: 'Xatolik', message: err.message });
                            }
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
                        >
                          <option value="admin">Admin</option>
                          <option value="member">Member</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-300">{m.weekly_capacity_hours} soat/hafta</td>
                    <td className="py-3 px-4 text-right">
                      {m.role !== 'owner' && (
                        <button
                          onClick={async () => {
                            try {
                              await api.removeMember(activeWorkspaceId, m.user_id);
                              onRefreshAll();
                              addToast({ type: 'info', title: 'A’zo chiqarildi' });
                            } catch (err: any) {
                              addToast({ type: 'error', title: 'Xatolik', message: err.message });
                            }
                          }}
                          className="text-rose-400 hover:text-rose-300"
                        >
                          Chiqarish
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Invitations List */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-white">Yuborilgan Taklifnomalar ({invitations.length})</h3>
            <div className="space-y-2">
              {invitations.map((inv) => (
                <div
                  key={inv.id}
                  className="flex flex-wrap items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs"
                >
                  <div>
                    <span className="font-bold text-white mr-2">{inv.email}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 uppercase text-[10px] mr-2">
                      {inv.role}
                    </span>
                    <span className="font-mono text-indigo-400">Kod: {inv.invite_code}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {inv.accepted_at ? (
                      <span className="text-emerald-400">Qabul qilingan</span>
                    ) : inv.revoked_at ? (
                      <span className="text-slate-500">Bekor qilingan</span>
                    ) : (
                      <button
                        onClick={async () => {
                          const res = await api.revokeInvitation(activeWorkspaceId, inv.id);
                          setInvitations(res.invitations || []);
                        }}
                        className="text-rose-400 hover:text-rose-300"
                      >
                        Bekor qilish
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 6. TEAMS / USER GROUPS */}
      {settingsTab === 'ws_teams' && activeWorkspaceId && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
              <UsersRound className="w-6 h-6 text-pink-400" />
              <span>Ichki Jamoalar va Guruhlar (Workspace Teams)</span>
            </h1>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const res = await api.createTeam(activeWorkspaceId, {
                  name: teamName,
                  handle: teamHandle || undefined,
                  description: teamDesc,
                  member_ids: teamMemberIds,
                });
                setTeams(res.teams || []);
                setTeamName('');
                setTeamHandle('');
                setTeamDesc('');
                setTeamMemberIds([]);
                addToast({ type: 'success', title: 'Jamoa yaratildi' });
              } catch (err: any) {
                addToast({ type: 'error', title: 'Xatolik', message: err.message });
              }
            }}
            className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                required
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Jamoa nomi (masalan: QA & Security)"
                className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
              />
              <input
                type="text"
                value={teamHandle}
                onChange={(e) => setTeamHandle(e.target.value)}
                placeholder="Handle (masalan: qa-team)"
                className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white"
              />
              <input
                type="text"
                value={teamDesc}
                onChange={(e) => setTeamDesc(e.target.value)}
                placeholder="Qisqa tavsif..."
                className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {members.map((m) => {
                const selected = teamMemberIds.includes(m.user_id);
                return (
                  <button
                    key={m.user_id}
                    type="button"
                    onClick={() =>
                      setTeamMemberIds((prev) =>
                        selected ? prev.filter((x) => x !== m.user_id) : [...prev, m.user_id]
                      )
                    }
                    className={`px-3 py-1 rounded-lg text-xs border transition ${
                      selected
                        ? 'bg-indigo-600/20 border-indigo-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    {m.full_name}
                  </button>
                );
              })}
            </div>

            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white"
            >
              + Jamoa Yaratish
            </button>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teams.map((t) => (
              <div key={t.id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-white">{t.name}</div>
                    <div className="text-xs font-mono text-indigo-400">@{t.handle}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingTeamId(editingTeamId === t.id ? null : t.id);
                        setEditTeamName(t.name);
                        setEditTeamDesc(t.description || '');
                        setEditTeamMemberIds(t.member_ids || []);
                      }}
                      className="text-xs text-slate-400 hover:text-indigo-400 flex items-center gap-1"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Tahrirlash
                    </button>
                    <button
                      onClick={async () => {
                        const res = await api.deleteTeam(activeWorkspaceId, t.id);
                        setTeams(res.teams || []);
                      }}
                      className="text-xs text-slate-500 hover:text-rose-400"
                    >
                      O‘chirish
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-400">{t.description}</p>
                <div className="text-[11px] text-slate-300">
                  A’zolar soni: <span className="font-bold">{t.member_ids.length} ta</span>
                </div>

                {editingTeamId === t.id && (
                  <div className="pt-3 border-t border-slate-800 space-y-3">
                    <input
                      type="text"
                      value={editTeamName}
                      onChange={(e) => setEditTeamName(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
                    />
                    <input
                      type="text"
                      value={editTeamDesc}
                      onChange={(e) => setEditTeamDesc(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {members.map((m) => {
                        const sel = editTeamMemberIds.includes(m.user_id);
                        return (
                          <button
                            key={m.user_id}
                            type="button"
                            onClick={() =>
                              setEditTeamMemberIds((prev) =>
                                sel ? prev.filter((x) => x !== m.user_id) : [...prev, m.user_id]
                              )
                            }
                            className={`px-2 py-1 rounded text-[11px] border ${
                              sel
                                ? 'bg-indigo-600/20 border-indigo-500 text-white'
                                : 'bg-slate-950 border-slate-800 text-slate-400'
                            }`}
                          >
                            {m.full_name}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        const res = await api.updateTeam(activeWorkspaceId, t.id, {
                          name: editTeamName,
                          description: editTeamDesc,
                          member_ids: editTeamMemberIds,
                        });
                        setTeams(res.teams || []);
                        setEditingTeamId(null);
                        addToast({ type: 'success', title: 'Jamoa yangilandi' });
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
        </div>
      )}

      {/* 7. RBAC PERMISSIONS MATRIX */}
      {settingsTab === 'ws_roles' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
              <KeyRound className="w-6 h-6 text-emerald-400" />
              <span>Rollar va Server-Side Ruxsatlar Matritsasi (RBAC Policy)</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Yii2 `TenantAccessGuard` tomonidan har bir API so‘rovda majburiy tekshiriladigan vakolatlar jadvali
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-300 uppercase text-[11px]">
                  <th className="py-3.5 px-5">Amal / Vakolat</th>
                  <th className="py-3.5 px-4 text-center text-indigo-300">Owner</th>
                  <th className="py-3.5 px-4 text-center text-emerald-300">Admin</th>
                  <th className="py-3.5 px-4 text-center text-sky-300">Member</th>
                  <th className="py-3.5 px-4 text-center text-amber-300">Viewer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {[
                  ['Workspace sozlamalarini o‘zgartirish', true, true, false, false],
                  ['A’zolarni taklif qilish va rollarni boshqarish', true, true, false, false],
                  ['Spaces, Folders va Loyihalar yaratish', true, true, true, false],
                  ['Vazifa, Subtask, Checklist va Bog‘liqlik yaratish/tahrirlash', true, true, true, false],
                  ['Kanban drag-and-drop va status o‘zgartirish', true, true, true, false],
                  ['Vaqt hisobi (Time Tracking) va Wiki hujjatlar yozish', true, true, true, false],
                  ['Izoh yozish va @mention chaqirish', true, true, true, false],
                  ['Vazifalar, Kalendar, Timeline va Hisobotlarni ko‘rish', true, true, true, true],
                  ['Savatdan (Trash) butunlay o‘chirish (Purge)', true, true, false, false],
                  ['Workspace egaligini topshirish va Workspace’ni o‘chirish', true, false, false, false],
                ].map(([label, o, a, m, v], i) => (
                  <tr key={i}>
                    <td className="py-3 px-5 font-medium text-slate-200">{label as string}</td>
                    {[o, a, m, v].map((allowed, j) => (
                      <td key={j} className="py-3 px-4 text-center">
                        {allowed ? (
                          <Check className="w-4 h-4 text-emerald-400 inline" />
                        ) : (
                          <X className="w-4 h-4 text-slate-600 inline" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 8. WORKSPACE LABELS */}
      {settingsTab === 'ws_labels' && activeWorkspaceId && (
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Tag className="w-6 h-6 text-indigo-400" />
            <span>Workspace Teglari (Labels)</span>
          </h1>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!labelName.trim()) return;
              try {
                await api.createLabel(activeWorkspaceId, { name: labelName.trim(), color: labelColor });
                setLabelName('');
                onRefreshAll();
                addToast({ type: 'success', title: 'Teg yaratildi' });
              } catch (err: any) {
                addToast({ type: 'error', title: 'Xatolik', message: err.message });
              }
            }}
            className="flex gap-3 p-4 rounded-2xl bg-slate-900 border border-slate-800"
          >
            <input
              type="text"
              required
              value={labelName}
              onChange={(e) => setLabelName(e.target.value)}
              placeholder="Yangi teg nomi..."
              className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
            />
            <input
              type="color"
              value={labelColor}
              onChange={(e) => setLabelColor(e.target.value)}
              className="w-12 h-9 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white"
            >
              + Qo‘shish
            </button>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {labels.map((l) => (
              <div
                key={l.id}
                className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: l.color }} />
                    <span className="text-xs font-bold text-white">{l.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingLabelId(editingLabelId === l.id ? null : l.id);
                        setEditLabelName(l.name);
                        setEditLabelColor(l.color);
                      }}
                      className="text-xs text-slate-400 hover:text-indigo-400"
                    >
                      Tahrirlash
                    </button>
                    <button
                      onClick={async () => {
                        await api.deleteLabel(activeWorkspaceId, l.id);
                        onRefreshAll();
                      }}
                      className="text-xs text-slate-500 hover:text-rose-400"
                    >
                      O‘chirish
                    </button>
                  </div>
                </div>

                {editingLabelId === l.id && (
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                    <input
                      type="text"
                      value={editLabelName}
                      onChange={(e) => setEditLabelName(e.target.value)}
                      className="flex-1 px-2.5 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-white"
                    />
                    <input
                      type="color"
                      value={editLabelColor}
                      onChange={(e) => setEditLabelColor(e.target.value)}
                      className="w-8 h-7 rounded bg-slate-950 border border-slate-700 cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        await api.updateLabel(activeWorkspaceId, l.id, {
                          name: editLabelName,
                          color: editLabelColor,
                        });
                        setEditingLabelId(null);
                        onRefreshAll();
                        addToast({ type: 'success', title: 'Teg yangilandi' });
                      }}
                      className="px-2.5 py-1 rounded bg-indigo-600 text-xs font-semibold text-white"
                    >
                      Saqlash
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 9. AUDIT LOG */}
      {settingsTab === 'ws_audit' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
              <FileSearch className="w-6 h-6 text-indigo-400" />
              <span>Xavfsizlik va Operatsion Audit Jurnali (Audit Trail)</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Workspace ichidagi barcha muhim o‘zgarishlar, kim tomonidan va qaysi IP manzildan bajarilgani
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase text-[11px]">
                  <th className="py-3 px-4">Vaqt (UTC)</th>
                  <th className="py-3 px-4">Foydalanuvchi</th>
                  <th className="py-3 px-4">Amal kodi</th>
                  <th className="py-3 px-4">Tafsilotlar</th>
                  <th className="py-3 px-4">IP Manzil</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {log.created_at.slice(0, 19).replace('T', ' ')}
                    </td>
                    <td className="py-3 px-4 font-semibold text-white">
                      {log.actor?.full_name || `#${log.actor_id}`}
                    </td>
                    <td className="py-3 px-4 font-mono text-indigo-400">{log.action}</td>
                    <td className="py-3 px-4 text-slate-300">{log.summary}</td>
                    <td className="py-3 px-4 font-mono text-slate-500">{log.ip_address}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 10. TRASH / RECYCLE BIN */}
      {settingsTab === 'ws_trash' && activeWorkspaceId && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
              <Trash2 className="w-6 h-6 text-rose-400" />
              <span>Savat (Recycle Bin) — O‘chirilgan Loyiha va Vazifalarni Tiklash</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Tasodifan o‘chirilgan yozuvlarni 1-click bilan joyiga qaytarishingiz yoki butunlay o‘chirishingiz mumkin
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white">
              O‘chirilgan Vazifalar ({trashData.tasks.length})
            </h3>
            {trashData.tasks.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs"
              >
                <div>
                  <span className="font-mono font-bold text-indigo-400 mr-2">{t.task_key}</span>
                  <span className="font-semibold text-white">{t.title}</span>
                  <span className="text-slate-500 ml-2">({t.project_name})</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      const res = await api.restoreTrash(activeWorkspaceId, 'task', t.id);
                      setTrashData({ tasks: res.tasks || [], projects: res.projects || [] });
                      onRefreshAll();
                      addToast({ type: 'success', title: `${t.task_key} qayta tiklandi` });
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Tiklash
                  </button>
                  <button
                    onClick={async () => {
                      const res = await api.purgeTrash(activeWorkspaceId, 'task', t.id);
                      setTrashData({ tasks: res.tasks || [], projects: res.projects || [] });
                      addToast({ type: 'info', title: 'Butunlay o‘chirildi' });
                    }}
                    className="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30"
                  >
                    Butunlay o‘chirish
                  </button>
                </div>
              </div>
            ))}

            <h3 className="text-sm font-bold text-white pt-4">
              O‘chirilgan Loyihalar ({trashData.projects.length})
            </h3>
            {trashData.projects.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs"
              >
                <div>
                  <span className="font-mono font-bold text-indigo-400 mr-2">{p.project_key}</span>
                  <span className="font-semibold text-white">{p.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      const res = await api.restoreTrash(activeWorkspaceId, 'project', p.id);
                      setTrashData({ tasks: res.tasks || [], projects: res.projects || [] });
                      onRefreshAll();
                      addToast({ type: 'success', title: `${p.name} qayta tiklandi` });
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Tiklash
                  </button>
                  <button
                    onClick={async () => {
                      const res = await api.purgeTrash(activeWorkspaceId, 'project', p.id);
                      setTrashData({ tasks: res.tasks || [], projects: res.projects || [] });
                      onRefreshAll();
                      addToast({ type: 'info', title: 'Loyiha butunlay o‘chirildi' });
                    }}
                    className="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30"
                  >
                    Butunlay o‘chirish
                  </button>
                </div>
              </div>
            ))}

            {trashData.tasks.length === 0 && trashData.projects.length === 0 && (
              <div className="py-12 text-center text-slate-500 text-sm bg-slate-900/40 rounded-2xl border border-slate-800">
                Savat bo‘sh.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
