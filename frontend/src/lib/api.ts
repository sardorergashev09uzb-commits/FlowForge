const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export class ApiError extends Error {
  status: number;
  code: string;
  details: any;

  constructor(message: string, status = 500, code = 'API_ERROR', details: any = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getStoredToken(): string | null {
  return localStorage.getItem('flowforge_token');
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem('flowforge_token', token);
  } else {
    localStorage.removeItem('flowforge_token');
  }
}

async function request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  let data: any = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok || (data && data.success === false)) {
    const errObj = data?.error || {};
    const msg = errObj.message || data?.message || `So‘rov xatoligi (${response.status})`;
    throw new ApiError(msg, response.status, errObj.code || 'API_ERROR', errObj.details);
  }

  return data as T;
}

export const api = {
  // System & Bootstrap
  bootstrap: () => request('/bootstrap'),
  search: (workspaceId: number, q: string) =>
    request(`/search?workspace_id=${workspaceId}&q=${encodeURIComponent(q)}`),

  // Auth
  login: (payload: { email: string; password: string }) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  register: (payload: { full_name: string; email: string; password: string; workspace_name?: string; job_title?: string }) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  forgotPassword: (email: string) =>
    request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (payload: { reset_token: string; new_password: string }) =>
    request('/auth/reset-password', { method: 'POST', body: JSON.stringify(payload) }),

  // Profile & Sessions & Notification Prefs
  updateProfile: (payload: Record<string, any>) =>
    request('/profile', { method: 'PATCH', body: JSON.stringify(payload) }),
  changePassword: (payload: { current_password: string; new_password: string }) =>
    request('/profile/password', { method: 'POST', body: JSON.stringify(payload) }),
  getSessions: () => request('/profile/sessions'),
  revokeSession: (id: number) => request(`/profile/sessions/${id}`, { method: 'DELETE' }),
  revokeOtherSessions: () => request('/profile/sessions/revoke-others', { method: 'POST' }),
  getNotificationPrefs: () => request('/profile/notifications-prefs'),
  updateNotificationPrefs: (preferences: any[]) =>
    request('/profile/notifications-prefs', { method: 'PUT', body: JSON.stringify({ preferences }) }),

  // Workspaces
  createWorkspace: (payload: { name: string; slug?: string; description?: string }) =>
    request('/workspaces', { method: 'POST', body: JSON.stringify(payload) }),
  updateWorkspace: (id: number, payload: Record<string, any>) =>
    request(`/workspaces/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteWorkspace: (id: number) =>
    request(`/workspaces/${id}`, { method: 'DELETE' }),
  transferOwnership: (id: number, new_owner_user_id: number) =>
    request(`/workspaces/${id}/transfer-ownership`, {
      method: 'POST',
      body: JSON.stringify({ new_owner_user_id }),
    }),

  // Members & Invitations & Teams & Labels
  getMembers: (wsId: number) => request(`/workspaces/${wsId}/members`),
  updateMember: (wsId: number, userId: number, payload: Record<string, any>) =>
    request(`/workspaces/${wsId}/members/${userId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  removeMember: (wsId: number, userId: number) =>
    request(`/workspaces/${wsId}/members/${userId}`, { method: 'DELETE' }),

  getInvitations: (wsId: number) => request(`/workspaces/${wsId}/invitations`),
  inviteMember: (wsId: number, payload: { email: string; role: string }) =>
    request(`/workspaces/${wsId}/invitations`, { method: 'POST', body: JSON.stringify(payload) }),
  revokeInvitation: (wsId: number, invId: number) =>
    request(`/workspaces/${wsId}/invitations/${invId}`, { method: 'DELETE' }),
  acceptInvitation: (invite_code: string) =>
    request('/invitations/accept', { method: 'POST', body: JSON.stringify({ invite_code }) }),

  getTeams: (wsId: number) => request(`/workspaces/${wsId}/teams`),
  createTeam: (wsId: number, payload: Record<string, any>) =>
    request(`/workspaces/${wsId}/teams`, { method: 'POST', body: JSON.stringify(payload) }),
  updateTeam: (wsId: number, teamId: number, payload: Record<string, any>) =>
    request(`/workspaces/${wsId}/teams/${teamId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteTeam: (wsId: number, teamId: number) =>
    request(`/workspaces/${wsId}/teams/${teamId}`, { method: 'DELETE' }),

  getLabels: (wsId: number) => request(`/workspaces/${wsId}/labels`),
  createLabel: (wsId: number, payload: { name: string; color: string; description?: string }) =>
    request(`/workspaces/${wsId}/labels`, { method: 'POST', body: JSON.stringify(payload) }),
  updateLabel: (wsId: number, labelId: number, payload: { name?: string; color?: string; description?: string }) =>
    request(`/workspaces/${wsId}/labels/${labelId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteLabel: (wsId: number, labelId: number) =>
    request(`/workspaces/${wsId}/labels/${labelId}`, { method: 'DELETE' }),

  // Activity, Trash & Reports
  getWorkspaceActivity: (wsId: number, projectId?: number) =>
    request(`/workspaces/${wsId}/activity${projectId ? `?project_id=${projectId}` : ''}`),
  getTrash: (wsId: number) => request(`/workspaces/${wsId}/trash`),
  restoreTrash: (wsId: number, entity_type: 'task' | 'project', entity_id: number) =>
    request(`/workspaces/${wsId}/trash/restore`, {
      method: 'POST',
      body: JSON.stringify({ entity_type, entity_id }),
    }),
  purgeTrash: (wsId: number, entity_type: 'task' | 'project', entity_id: number) =>
    request(`/workspaces/${wsId}/trash/purge?entity_type=${entity_type}&entity_id=${entity_id}`, {
      method: 'DELETE',
    }),
  getReports: (wsId: number) => request(`/workspaces/${wsId}/reports`),

  // Hierarchy (Spaces, Folders, Projects)
  getHierarchy: (wsId: number) => request(`/workspaces/${wsId}/hierarchy`),
  createSpace: (wsId: number, payload: Record<string, any>) =>
    request(`/workspaces/${wsId}/spaces`, { method: 'POST', body: JSON.stringify(payload) }),
  updateSpace: (id: number, payload: Record<string, any>) =>
    request(`/spaces/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteSpace: (id: number) => request(`/spaces/${id}`, { method: 'DELETE' }),

  createFolder: (spaceId: number, payload: { name: string; color?: string }) =>
    request(`/spaces/${spaceId}/folders`, { method: 'POST', body: JSON.stringify(payload) }),
  updateFolder: (id: number, payload: Record<string, any>) =>
    request(`/folders/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteFolder: (id: number) => request(`/folders/${id}`, { method: 'DELETE' }),

  // Projects, Statuses, Sprints, Docs
  createProject: (wsId: number, payload: Record<string, any>) =>
    request(`/workspaces/${wsId}/projects`, { method: 'POST', body: JSON.stringify(payload) }),
  getProject: (id: number) => request(`/projects/${id}`),
  updateProject: (id: number, payload: Record<string, any>) =>
    request(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteProject: (id: number) => request(`/projects/${id}`, { method: 'DELETE' }),
  toggleFavoriteProject: (id: number) =>
    request(`/projects/${id}/favorite`, { method: 'POST' }),

  createStatus: (projectId: number, payload: Record<string, any>) =>
    request(`/projects/${projectId}/statuses`, { method: 'POST', body: JSON.stringify(payload) }),
  updateStatus: (projectId: number, statusId: number, payload: Record<string, any>) =>
    request(`/projects/${projectId}/statuses/${statusId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteStatus: (projectId: number, statusId: number) =>
    request(`/projects/${projectId}/statuses/${statusId}`, { method: 'DELETE' }),
  reorderStatuses: (projectId: number, status_ids: number[]) =>
    request(`/projects/${projectId}/statuses/reorder`, { method: 'POST', body: JSON.stringify({ status_ids }) }),

  createSprint: (projectId: number, payload: Record<string, any>) =>
    request(`/projects/${projectId}/sprints`, { method: 'POST', body: JSON.stringify(payload) }),
  updateSprint: (sprintId: number, payload: Record<string, any>) =>
    request(`/sprints/${sprintId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteSprint: (sprintId: number) =>
    request(`/sprints/${sprintId}`, { method: 'DELETE' }),

  getProjectDocs: (projectId: number) => request(`/projects/${projectId}/docs`),
  createDoc: (projectId: number, payload: Record<string, any>) =>
    request(`/projects/${projectId}/docs`, { method: 'POST', body: JSON.stringify(payload) }),
  updateDoc: (docId: number, payload: Record<string, any>) =>
    request(`/docs/${docId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteDoc: (docId: number) => request(`/docs/${docId}`, { method: 'DELETE' }),

  // Tasks & Kanban & Enriched Sub-entities
  getProjectTasks: (projectId: number, params: Record<string, any> = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    });
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request(`/projects/${projectId}/tasks${suffix}`);
  },
  getMyTasks: (wsId: number, scope: 'assigned' | 'created' | 'watching' | 'workspace' = 'assigned') =>
    request(`/workspaces/${wsId}/my-tasks?scope=${scope}`),
  createTask: (projectId: number, payload: Record<string, any>) =>
    request(`/projects/${projectId}/tasks`, { method: 'POST', body: JSON.stringify(payload) }),
  getTask: (taskId: number) => request(`/tasks/${taskId}`),
  updateTask: (taskId: number, payload: Record<string, any>) =>
    request(`/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteTask: (taskId: number) => request(`/tasks/${taskId}`, { method: 'DELETE' }),
  moveTask: (taskId: number, payload: { status_id: number; position?: number; before_task_id?: number | null; after_task_id?: number | null }) =>
    request(`/tasks/${taskId}/move`, { method: 'POST', body: JSON.stringify(payload) }),
  bulkUpdateTasks: (wsId: number, payload: { task_ids: number[]; action: string; value?: any }) =>
    request(`/workspaces/${wsId}/tasks/bulk`, { method: 'POST', body: JSON.stringify(payload) }),
  toggleWatchTask: (taskId: number) =>
    request(`/tasks/${taskId}/watch`, { method: 'POST' }),
  syncTaskLabels: (taskId: number, label_ids: number[]) =>
    request(`/tasks/${taskId}/labels`, { method: 'POST', body: JSON.stringify({ label_ids }) }),

  // Checklists
  createChecklist: (taskId: number, title: string) =>
    request(`/tasks/${taskId}/checklists`, { method: 'POST', body: JSON.stringify({ title }) }),
  deleteChecklist: (checklistId: number) =>
    request(`/checklists/${checklistId}`, { method: 'DELETE' }),
  addChecklistItem: (checklistId: number, title: string) =>
    request(`/checklists/${checklistId}/items`, { method: 'POST', body: JSON.stringify({ title }) }),
  updateChecklistItem: (itemId: number, payload: Record<string, any>) =>
    request(`/checklist-items/${itemId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteChecklistItem: (itemId: number) =>
    request(`/checklist-items/${itemId}`, { method: 'DELETE' }),

  // Dependencies
  addDependency: (taskId: number, depends_on_task_id: number, dependency_type = 'blocked_by') =>
    request(`/tasks/${taskId}/dependencies`, {
      method: 'POST',
      body: JSON.stringify({ depends_on_task_id, dependency_type }),
    }),
  removeDependency: (depId: number) =>
    request(`/dependencies/${depId}`, { method: 'DELETE' }),

  // Time Entries
  addTimeEntry: (taskId: number, payload: { duration_minutes: number; description?: string; logged_date?: string; is_billable?: boolean }) =>
    request(`/tasks/${taskId}/time-entries`, { method: 'POST', body: JSON.stringify(payload) }),
  deleteTimeEntry: (entryId: number) =>
    request(`/time-entries/${entryId}`, { method: 'DELETE' }),
  getWorkspaceTimeEntries: (wsId: number) =>
    request(`/workspaces/${wsId}/time-entries`),

  // Attachments
  addAttachment: (taskId: number, payload: { original_name: string; file_url?: string; mime_type?: string; size_bytes?: number; file_content_base64?: string }) =>
    request(`/tasks/${taskId}/attachments`, { method: 'POST', body: JSON.stringify(payload) }),
  deleteAttachment: (attId: number) =>
    request(`/attachments/${attId}`, { method: 'DELETE' }),

  // Comments
  addComment: (taskId: number, body: string, parent_comment_id?: number | null) =>
    request(`/tasks/${taskId}/comments`, { method: 'POST', body: JSON.stringify({ body, parent_comment_id }) }),
  updateComment: (commentId: number, payload: { body?: string; is_pinned?: boolean }) =>
    request(`/comments/${commentId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteComment: (commentId: number) =>
    request(`/comments/${commentId}`, { method: 'DELETE' }),
  reactComment: (commentId: number, emoji: string) =>
    request(`/comments/${commentId}/react`, { method: 'POST', body: JSON.stringify({ emoji }) }),

  // Notifications
  getNotifications: (workspaceId?: number, filter = 'all') =>
    request(`/notifications?filter=${filter}${workspaceId ? `&workspace_id=${workspaceId}` : ''}`),
  updateNotification: (id: number, payload: { read?: boolean; archived?: boolean }) =>
    request(`/notifications/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  markAllNotificationsRead: (workspace_id?: number) =>
    request('/notifications/mark-all-read', { method: 'POST', body: JSON.stringify({ workspace_id }) }),
};
