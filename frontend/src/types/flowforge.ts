export interface UserProfile {
  full_name: string;
  job_title: string | null;
  department: string | null;
  avatar_url: string | null;
  bio: string | null;
  phone: string | null;
  timezone: string;
  locale: string;
  theme: 'dark' | 'light' | 'system';
  ui_density: 'comfortable' | 'compact';
  availability_status: 'available' | 'busy' | 'focusing' | 'vacation' | 'sick';
  availability_note: string | null;
  telegram_handle: string | null;
}

export interface User {
  id: number;
  email: string;
  username: string;
  status: string;
  is_platform_admin: boolean;
  last_login_at: string | null;
  created_at: string;
  profile: UserProfile;
}

export interface UserBrief {
  id: number;
  email: string;
  username: string;
  full_name: string;
  job_title: string;
  department?: string | null;
  avatar_url: string | null;
  availability_status: string;
  availability_note?: string | null;
}

export interface UserSession {
  id: number;
  ip_address: string;
  user_agent: string;
  device_name: string;
  last_active_at: string;
  expires_at: string;
  created_at: string;
  is_current: boolean;
}

export interface NotificationPref {
  id: number;
  event_type: string;
  in_app_enabled: boolean;
  email_enabled: boolean;
  telegram_enabled: boolean;
}

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface Workspace {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  owner_id: number;
  plan_tier: string;
  my_role: WorkspaceRole;
  settings: Record<string, any>;
  created_at: string;
}

export interface WorkspaceMember {
  membership_id: number;
  user_id: number;
  role: WorkspaceRole;
  status: 'active' | 'deactivated';
  title_in_workspace: string;
  weekly_capacity_hours: number;
  joined_at: string;
  email: string;
  username: string;
  full_name: string;
  job_title: string | null;
  department: string | null;
  avatar_url: string | null;
  availability_status: string;
  availability_note: string | null;
  last_login_at: string | null;
}

export interface WorkspaceTeam {
  id: number;
  workspace_id: number;
  name: string;
  handle: string;
  color: string;
  description: string | null;
  lead_user_id: number | null;
  member_ids: number[];
  created_at: string;
}

export interface WorkspaceInvitation {
  id: number;
  workspace_id: number;
  workspace_name?: string;
  workspace_slug?: string;
  email: string;
  role: WorkspaceRole;
  invite_code: string;
  invited_by?: number;
  expires_at: string;
  accepted_at?: string | null;
  revoked_at?: string | null;
  created_at?: string;
}

export interface Label {
  id: number;
  workspace_id?: number;
  project_id?: number | null;
  name: string;
  color: string;
  description?: string | null;
}

export interface TaskStatus {
  id: number;
  project_id?: number;
  name: string;
  category: 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled';
  color: string;
  wip_limit?: number | null;
  position?: number;
  is_default?: boolean;
}

export interface Sprint {
  id: number;
  project_id: number;
  name: string;
  goal: string | null;
  status: 'planned' | 'active' | 'completed';
  start_date: string;
  end_date: string;
}

export interface ProjectDoc {
  id: number;
  workspace_id?: number;
  project_id: number;
  parent_doc_id: number | null;
  title: string;
  icon: string;
  content_md: string;
  created_by?: number;
  updated_by?: number;
  author?: UserBrief | null;
  position?: number;
  created_at?: string;
  updated_at: string;
}

export interface Project {
  id: number;
  workspace_id: number;
  space_id: number | null;
  folder_id: number | null;
  name: string;
  project_key: string;
  task_sequence?: number;
  description: string | null;
  status: 'on_track' | 'at_risk' | 'off_track' | 'on_hold' | 'completed' | 'archived';
  visibility: 'workspace' | 'private';
  template_type: 'software' | 'marketing' | 'kanban';
  color: string;
  icon: string;
  start_date: string | null;
  due_date: string | null;
  lead_user_id: number | null;
  is_favorite?: boolean;
  total_tasks?: number;
  done_tasks?: number;
  archived_at: string | null;
  statuses?: TaskStatus[];
  sprints?: Sprint[];
  docs?: ProjectDoc[];
  milestones?: Array<{
    id: number;
    task_key: string;
    title: string;
    due_at: string | null;
    completed_at: string | null;
  }>;
}

export interface FolderNode {
  id: number;
  workspace_id: number;
  space_id: number;
  name: string;
  color: string;
  position: number;
  projects: Project[];
}

export interface SpaceNode {
  id: number;
  workspace_id: number;
  name: string;
  key_code: string;
  description: string | null;
  color: string;
  icon: string;
  is_private: boolean;
  position: number;
  folders: FolderNode[];
  projects: Project[];
}

export interface HierarchyTree {
  favorites: Project[];
  spaces: SpaceNode[];
  root_projects: Project[];
  all_projects: Project[];
}

export type TaskPriority = 'none' | 'low' | 'medium' | 'high' | 'urgent';

export interface ChecklistItem {
  id: number;
  checklist_id: number;
  title: string;
  is_completed: boolean;
  assignee_id: number | null;
  position: number;
}

export interface Checklist {
  id: number;
  task_id: number;
  title: string;
  items: ChecklistItem[];
}

export interface DependencyItem {
  id: number;
  task_id: number;
  task_key: string;
  title: string;
  priority: TaskPriority;
  status_name: string;
  status_category: string;
  status_color: string;
  is_resolved: boolean;
}

export interface TimeEntry {
  id: number;
  project_id?: number;
  project_name?: string;
  project_color?: string;
  task_id: number;
  task_key?: string;
  task_title?: string;
  user_id: number;
  user: UserBrief | null;
  description: string;
  duration_minutes: number;
  logged_date: string;
  is_billable: boolean;
  created_at: string;
}

export interface TaskAttachment {
  id: number;
  task_id: number;
  uploaded_by: number;
  uploader: UserBrief | null;
  original_name: string;
  file_url: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

export interface TaskComment {
  id: number;
  task_id: number;
  parent_comment_id: number | null;
  author_id: number;
  author: UserBrief | null;
  body: string;
  is_pinned: boolean;
  reactions: Record<string, number[]>;
  edited_at: string | null;
  created_at: string;
}

export interface ActivityItem {
  id: number;
  workspace_id?: number;
  project_id?: number | null;
  task_id?: number | null;
  actor_id: number;
  actor: UserBrief | null;
  entity_type?: string;
  entity_id?: number;
  action: string;
  summary: string;
  metadata: Record<string, any>;
  ip_address?: string;
  created_at: string;
}

export interface Task {
  id: number;
  workspace_id: number;
  project_id: number;
  project?: {
    id: number;
    name: string;
    project_key: string;
    color: string;
    icon: string;
  } | null;
  sprint_id: number | null;
  parent_task_id: number | null;
  task_number: number;
  task_key: string;
  title: string;
  description: string | null;
  status_id: number;
  status: TaskStatus | null;
  priority: TaskPriority;
  assignee_id: number | null;
  assignee: UserBrief | null;
  reporter_id: number;
  reporter: UserBrief | null;
  start_date: string | null;
  due_at: string | null;
  completed_at: string | null;
  estimate_minutes: number | null;
  logged_minutes: number;
  story_points: number | null;
  position: number;
  is_milestone: boolean;
  labels: Label[];
  subtasks_summary: { total: number; done: number };
  checklists_summary: { total: number; done: number };
  unresolved_blockers_count: number;
  comments_count: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  // Detailed fields from GET /api/v1/tasks/:id
  parent_task?: { id: number; task_key: string; title: string; status_id: number } | null;
  subtasks?: Task[];
  checklists?: Checklist[];
  dependencies?: {
    blocked_by: DependencyItem[];
    blocking: DependencyItem[];
  };
  watcher_ids?: number[];
  is_watching?: boolean;
  time_entries?: TimeEntry[];
  attachments?: TaskAttachment[];
  comments?: TaskComment[];
  activities?: ActivityItem[];
}

export interface NotificationItem {
  id: number;
  workspace_id: number;
  recipient_id: number;
  actor_id: number | null;
  actor: UserBrief | null;
  type: string;
  title: string;
  body: string | null;
  entity_type: string;
  entity_id: number;
  project_id: number | null;
  task_key: string | null;
  read_at: string | null;
  archived_at: string | null;
  created_at: string;
}

export interface WorkspaceReportData {
  metrics: {
    total_tasks: number;
    active_tasks: number;
    completed_tasks: number;
    in_progress_tasks: number;
    overdue_tasks: number;
    upcoming_deadlines: number;
    completion_rate: number;
    total_estimated_minutes: number;
    total_logged_minutes: number;
  };
  by_priority: Record<string, number>;
  by_category: Record<string, number>;
  projects: Array<{
    id: number;
    name: string;
    project_key: string;
    status: string;
    color: string;
    due_date: string | null;
    total_tasks: number;
    completed_tasks: number;
    in_progress_tasks: number;
    overdue_tasks: number;
    logged_minutes: number;
    progress_percent: number;
  }>;
  workload: Array<WorkspaceMember & {
    total_assigned: number;
    active_tasks: number;
    completed_tasks: number;
    overdue_tasks: number;
    estimated_minutes: number;
    logged_minutes: number;
    story_points: number;
  }>;
}
