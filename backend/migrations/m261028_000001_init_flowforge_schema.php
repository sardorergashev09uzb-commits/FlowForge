<?php

use yii\db\Migration;

/**
 * FlowForge Enterprise Multi-Tenant SaaS — Complete 24-Table Schema Migration
 */
class m261028_000001_init_flowforge_schema extends Migration
{
    public function safeUp()
    {
        $tableOptions = null;
        if ($this->db->driverName === 'mysql') {
            $tableOptions = 'CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE=InnoDB';
        }

        // 1. users
        $this->createTable('{{%users}}', [
            'id' => $this->primaryKey(),
            'email' => $this->string(191)->notNull()->unique(),
            'username' => $this->string(100)->notNull()->unique(),
            'password_hash' => $this->string(255)->notNull(),
            'status' => $this->string(20)->notNull()->defaultValue('active'), // active, suspended
            'is_platform_admin' => $this->boolean()->notNull()->defaultValue(false),
            'email_verified_at' => $this->string(35)->null(),
            'last_login_at' => $this->string(35)->null(),
            'created_at' => $this->string(35)->notNull(),
            'updated_at' => $this->string(35)->notNull(),
        ], $tableOptions);

        // 2. user_profiles
        $this->createTable('{{%user_profiles}}', [
            'user_id' => $this->primaryKey(),
            'full_name' => $this->string(150)->notNull(),
            'job_title' => $this->string(120)->null(),
            'department' => $this->string(120)->null(),
            'avatar_url' => $this->string(500)->null(),
            'bio' => $this->text()->null(),
            'phone' => $this->string(50)->null(),
            'timezone' => $this->string(64)->notNull()->defaultValue('Asia/Tashkent'),
            'locale' => $this->string(16)->notNull()->defaultValue('uz'),
            'theme' => $this->string(20)->notNull()->defaultValue('dark'), // dark, light, system
            'ui_density' => $this->string(20)->notNull()->defaultValue('comfortable'), // compact, comfortable
            'availability_status' => $this->string(30)->notNull()->defaultValue('available'), // available, busy, focusing, vacation, sick
            'availability_note' => $this->string(160)->null(),
            'telegram_handle' => $this->string(100)->null(),
            'updated_at' => $this->string(35)->notNull(),
        ], $tableOptions);

        // 3. user_sessions
        $this->createTable('{{%user_sessions}}', [
            'id' => $this->primaryKey(),
            'user_id' => $this->integer()->notNull(),
            'token_hash' => $this->string(128)->notNull()->unique(),
            'ip_address' => $this->string(64)->null(),
            'user_agent' => $this->string(500)->null(),
            'device_name' => $this->string(150)->notNull()->defaultValue('Web Browser'),
            'last_active_at' => $this->string(35)->notNull(),
            'expires_at' => $this->string(35)->notNull(),
            'revoked_at' => $this->string(35)->null(),
            'created_at' => $this->string(35)->notNull(),
        ], $tableOptions);
        $this->createIndex('idx_user_sessions_user', '{{%user_sessions}}', 'user_id');

        // 4. user_notification_prefs
        $this->createTable('{{%user_notification_prefs}}', [
            'id' => $this->primaryKey(),
            'user_id' => $this->integer()->notNull(),
            'event_type' => $this->string(60)->notNull(), // task_assigned, mentioned, comment_added, status_changed, due_soon, blocker_resolved
            'in_app_enabled' => $this->boolean()->notNull()->defaultValue(true),
            'email_enabled' => $this->boolean()->notNull()->defaultValue(true),
            'telegram_enabled' => $this->boolean()->notNull()->defaultValue(false),
        ], $tableOptions);
        $this->createIndex('uq_user_notif_pref', '{{%user_notification_prefs}}', ['user_id', 'event_type'], true);

        // 5. workspaces
        $this->createTable('{{%workspaces}}', [
            'id' => $this->primaryKey(),
            'name' => $this->string(150)->notNull(),
            'slug' => $this->string(150)->notNull()->unique(),
            'logo_url' => $this->string(500)->null(),
            'description' => $this->text()->null(),
            'owner_id' => $this->integer()->notNull(),
            'plan_tier' => $this->string(30)->notNull()->defaultValue('enterprise'), // starter, pro, enterprise
            'settings_json' => $this->text()->null(),
            'archived_at' => $this->string(35)->null(),
            'created_at' => $this->string(35)->notNull(),
            'updated_at' => $this->string(35)->notNull(),
        ], $tableOptions);
        $this->createIndex('idx_workspaces_owner', '{{%workspaces}}', 'owner_id');

        // 6. workspace_members
        $this->createTable('{{%workspace_members}}', [
            'id' => $this->primaryKey(),
            'workspace_id' => $this->integer()->notNull(),
            'user_id' => $this->integer()->notNull(),
            'role' => $this->string(25)->notNull()->defaultValue('member'), // owner, admin, member, viewer
            'status' => $this->string(25)->notNull()->defaultValue('active'), // active, deactivated
            'title_in_workspace' => $this->string(120)->null(),
            'weekly_capacity_hours' => $this->integer()->notNull()->defaultValue(40),
            'joined_at' => $this->string(35)->notNull(),
        ], $tableOptions);
        $this->createIndex('uq_workspace_member', '{{%workspace_members}}', ['workspace_id', 'user_id'], true);
        $this->createIndex('idx_wm_user', '{{%workspace_members}}', 'user_id');

        // 7. workspace_teams & workspace_team_members
        $this->createTable('{{%workspace_teams}}', [
            'id' => $this->primaryKey(),
            'workspace_id' => $this->integer()->notNull(),
            'name' => $this->string(120)->notNull(),
            'handle' => $this->string(80)->notNull(), // e.g., frontend-team
            'color' => $this->string(25)->notNull()->defaultValue('#6366f1'),
            'description' => $this->string(500)->null(),
            'lead_user_id' => $this->integer()->null(),
            'created_at' => $this->string(35)->notNull(),
        ], $tableOptions);
        $this->createIndex('idx_wt_workspace', '{{%workspace_teams}}', 'workspace_id');

        $this->createTable('{{%workspace_team_members}}', [
            'id' => $this->primaryKey(),
            'team_id' => $this->integer()->notNull(),
            'user_id' => $this->integer()->notNull(),
            'joined_at' => $this->string(35)->notNull(),
        ], $tableOptions);
        $this->createIndex('uq_team_member', '{{%workspace_team_members}}', ['team_id', 'user_id'], true);

        // 8. workspace_invitations
        $this->createTable('{{%workspace_invitations}}', [
            'id' => $this->primaryKey(),
            'workspace_id' => $this->integer()->notNull(),
            'email' => $this->string(191)->notNull(),
            'role' => $this->string(25)->notNull()->defaultValue('member'),
            'token_hash' => $this->string(128)->notNull()->unique(),
            'invite_code' => $this->string(64)->notNull(),
            'invited_by' => $this->integer()->notNull(),
            'expires_at' => $this->string(35)->notNull(),
            'accepted_at' => $this->string(35)->null(),
            'revoked_at' => $this->string(35)->null(),
            'created_at' => $this->string(35)->notNull(),
        ], $tableOptions);
        $this->createIndex('idx_wi_workspace', '{{%workspace_invitations}}', 'workspace_id');

        // 9. spaces (Level 1 inside Workspace)
        $this->createTable('{{%spaces}}', [
            'id' => $this->primaryKey(),
            'workspace_id' => $this->integer()->notNull(),
            'name' => $this->string(120)->notNull(),
            'key_code' => $this->string(20)->notNull(),
            'description' => $this->string(500)->null(),
            'color' => $this->string(25)->notNull()->defaultValue('#6366f1'),
            'icon' => $this->string(40)->notNull()->defaultValue('layers'),
            'is_private' => $this->boolean()->notNull()->defaultValue(false),
            'position' => $this->integer()->notNull()->defaultValue(100),
            'created_by' => $this->integer()->notNull(),
            'archived_at' => $this->string(35)->null(),
            'created_at' => $this->string(35)->notNull(),
        ], $tableOptions);
        $this->createIndex('idx_spaces_ws', '{{%spaces}}', 'workspace_id');

        // 10. folders (Level 2 inside Space)
        $this->createTable('{{%folders}}', [
            'id' => $this->primaryKey(),
            'workspace_id' => $this->integer()->notNull(),
            'space_id' => $this->integer()->notNull(),
            'name' => $this->string(120)->notNull(),
            'color' => $this->string(25)->notNull()->defaultValue('#94a3b8'),
            'position' => $this->integer()->notNull()->defaultValue(100),
            'archived_at' => $this->string(35)->null(),
            'created_at' => $this->string(35)->notNull(),
        ], $tableOptions);
        $this->createIndex('idx_folders_space', '{{%folders}}', ['workspace_id', 'space_id']);

        // 11. projects (Level 3 inside Space/Folder)
        $this->createTable('{{%projects}}', [
            'id' => $this->primaryKey(),
            'workspace_id' => $this->integer()->notNull(),
            'space_id' => $this->integer()->null(),
            'folder_id' => $this->integer()->null(),
            'name' => $this->string(160)->notNull(),
            'project_key' => $this->string(16)->notNull(), // e.g., FF, API, MKT
            'task_sequence' => $this->integer()->notNull()->defaultValue(0),
            'description' => $this->text()->null(),
            'status' => $this->string(30)->notNull()->defaultValue('on_track'), // on_track, at_risk, off_track, on_hold, completed, archived
            'visibility' => $this->string(20)->notNull()->defaultValue('workspace'), // workspace, private
            'template_type' => $this->string(40)->notNull()->defaultValue('software'), // software, marketing, kanban
            'color' => $this->string(25)->notNull()->defaultValue('#6366f1'),
            'icon' => $this->string(40)->notNull()->defaultValue('folder-kanban'),
            'start_date' => $this->string(20)->null(),
            'due_date' => $this->string(20)->null(),
            'lead_user_id' => $this->integer()->null(),
            'created_by' => $this->integer()->notNull(),
            'archived_at' => $this->string(35)->null(),
            'deleted_at' => $this->string(35)->null(),
            'created_at' => $this->string(35)->notNull(),
            'updated_at' => $this->string(35)->notNull(),
        ], $tableOptions);
        $this->createIndex('uq_project_ws_key', '{{%projects}}', ['workspace_id', 'project_key'], true);
        $this->createIndex('idx_projects_ws', '{{%projects}}', 'workspace_id');

        // 12. project_members
        $this->createTable('{{%project_members}}', [
            'id' => $this->primaryKey(),
            'workspace_id' => $this->integer()->notNull(),
            'project_id' => $this->integer()->notNull(),
            'user_id' => $this->integer()->notNull(),
            'project_role' => $this->string(25)->notNull()->defaultValue('contributor'), // manager, contributor, viewer
            'is_favorite' => $this->boolean()->notNull()->defaultValue(false),
            'joined_at' => $this->string(35)->notNull(),
        ], $tableOptions);
        $this->createIndex('uq_project_member', '{{%project_members}}', ['project_id', 'user_id'], true);

        // 13. project_sprints (Agile Cycles)
        $this->createTable('{{%project_sprints}}', [
            'id' => $this->primaryKey(),
            'workspace_id' => $this->integer()->notNull(),
            'project_id' => $this->integer()->notNull(),
            'name' => $this->string(120)->notNull(),
            'goal' => $this->string(500)->null(),
            'status' => $this->string(25)->notNull()->defaultValue('planned'), // planned, active, completed
            'start_date' => $this->string(20)->notNull(),
            'end_date' => $this->string(20)->notNull(),
            'created_at' => $this->string(35)->notNull(),
        ], $tableOptions);
        $this->createIndex('idx_sprints_project', '{{%project_sprints}}', 'project_id');

        // 14. task_statuses (Kanban Columns per Project)
        $this->createTable('{{%task_statuses}}', [
            'id' => $this->primaryKey(),
            'workspace_id' => $this->integer()->notNull(),
            'project_id' => $this->integer()->notNull(),
            'name' => $this->string(80)->notNull(),
            'category' => $this->string(25)->notNull()->defaultValue('todo'), // backlog, todo, in_progress, review, done, cancelled
            'color' => $this->string(25)->notNull()->defaultValue('#64748b'),
            'wip_limit' => $this->integer()->null(), // Work-In-Progress limit
            'position' => $this->integer()->notNull()->defaultValue(100),
            'is_default' => $this->boolean()->notNull()->defaultValue(false),
        ], $tableOptions);
        $this->createIndex('idx_task_statuses_project', '{{%task_statuses}}', ['project_id', 'position']);

        // 15. tasks
        $this->createTable('{{%tasks}}', [
            'id' => $this->primaryKey(),
            'workspace_id' => $this->integer()->notNull(),
            'project_id' => $this->integer()->notNull(),
            'sprint_id' => $this->integer()->null(),
            'parent_task_id' => $this->integer()->null(),
            'task_number' => $this->integer()->notNull(),
            'task_key' => $this->string(32)->notNull(), // e.g., FF-101
            'title' => $this->string(300)->notNull(),
            'description' => $this->text()->null(),
            'status_id' => $this->integer()->notNull(),
            'priority' => $this->string(20)->notNull()->defaultValue('medium'), // none, low, medium, high, urgent
            'assignee_id' => $this->integer()->null(),
            'reporter_id' => $this->integer()->notNull(),
            'start_date' => $this->string(20)->null(),
            'due_at' => $this->string(35)->null(),
            'completed_at' => $this->string(35)->null(),
            'estimate_minutes' => $this->integer()->null(),
            'logged_minutes' => $this->integer()->notNull()->defaultValue(0),
            'story_points' => $this->integer()->null(),
            'position' => $this->double()->notNull()->defaultValue(1000),
            'is_milestone' => $this->boolean()->notNull()->defaultValue(false),
            'archived_at' => $this->string(35)->null(),
            'deleted_at' => $this->string(35)->null(),
            'created_at' => $this->string(35)->notNull(),
            'updated_at' => $this->string(35)->notNull(),
        ], $tableOptions);
        $this->createIndex('uq_task_ws_key', '{{%tasks}}', ['workspace_id', 'task_key'], true);
        $this->createIndex('idx_tasks_project_status', '{{%tasks}}', ['project_id', 'status_id', 'position']);
        $this->createIndex('idx_tasks_ws_assignee', '{{%tasks}}', ['workspace_id', 'assignee_id']);
        $this->createIndex('idx_tasks_parent', '{{%tasks}}', 'parent_task_id');

        // 16. task_watchers
        $this->createTable('{{%task_watchers}}', [
            'id' => $this->primaryKey(),
            'workspace_id' => $this->integer()->notNull(),
            'task_id' => $this->integer()->notNull(),
            'user_id' => $this->integer()->notNull(),
            'created_at' => $this->string(35)->notNull(),
        ], $tableOptions);
        $this->createIndex('uq_task_watcher', '{{%task_watchers}}', ['task_id', 'user_id'], true);

        // 17. task_checklists & task_checklist_items
        $this->createTable('{{%task_checklists}}', [
            'id' => $this->primaryKey(),
            'workspace_id' => $this->integer()->notNull(),
            'task_id' => $this->integer()->notNull(),
            'title' => $this->string(160)->notNull(),
            'position' => $this->integer()->notNull()->defaultValue(100),
        ], $tableOptions);
        $this->createIndex('idx_checklists_task', '{{%task_checklists}}', 'task_id');

        $this->createTable('{{%task_checklist_items}}', [
            'id' => $this->primaryKey(),
            'checklist_id' => $this->integer()->notNull(),
            'task_id' => $this->integer()->notNull(),
            'title' => $this->string(300)->notNull(),
            'is_completed' => $this->boolean()->notNull()->defaultValue(false),
            'assignee_id' => $this->integer()->null(),
            'position' => $this->integer()->notNull()->defaultValue(100),
        ], $tableOptions);
        $this->createIndex('idx_checklist_items_cl', '{{%task_checklist_items}}', 'checklist_id');

        // 18. task_dependencies
        $this->createTable('{{%task_dependencies}}', [
            'id' => $this->primaryKey(),
            'workspace_id' => $this->integer()->notNull(),
            'task_id' => $this->integer()->notNull(), // The task that is blocked or relates
            'depends_on_task_id' => $this->integer()->notNull(), // The blocker task
            'dependency_type' => $this->string(25)->notNull()->defaultValue('blocked_by'), // blocked_by, relates_to, duplicates
            'created_by' => $this->integer()->notNull(),
            'created_at' => $this->string(35)->notNull(),
        ], $tableOptions);
        $this->createIndex('uq_task_dependency', '{{%task_dependencies}}', ['task_id', 'depends_on_task_id'], true);

        // 19. labels & task_labels
        $this->createTable('{{%labels}}', [
            'id' => $this->primaryKey(),
            'workspace_id' => $this->integer()->notNull(),
            'project_id' => $this->integer()->null(),
            'name' => $this->string(64)->notNull(),
            'color' => $this->string(25)->notNull()->defaultValue('#6366f1'),
            'description' => $this->string(255)->null(),
        ], $tableOptions);
        $this->createIndex('idx_labels_ws', '{{%labels}}', 'workspace_id');

        $this->createTable('{{%task_labels}}', [
            'id' => $this->primaryKey(),
            'task_id' => $this->integer()->notNull(),
            'label_id' => $this->integer()->notNull(),
        ], $tableOptions);
        $this->createIndex('uq_task_label', '{{%task_labels}}', ['task_id', 'label_id'], true);

        // 20. task_comments
        $this->createTable('{{%task_comments}}', [
            'id' => $this->primaryKey(),
            'workspace_id' => $this->integer()->notNull(),
            'task_id' => $this->integer()->notNull(),
            'parent_comment_id' => $this->integer()->null(),
            'author_id' => $this->integer()->notNull(),
            'body' => $this->text()->notNull(),
            'is_pinned' => $this->boolean()->notNull()->defaultValue(false),
            'reactions_json' => $this->text()->null(), // JSON map of emoji -> [userIds]
            'edited_at' => $this->string(35)->null(),
            'deleted_at' => $this->string(35)->null(),
            'created_at' => $this->string(35)->notNull(),
        ], $tableOptions);
        $this->createIndex('idx_comments_task', '{{%task_comments}}', 'task_id');

        // 21. task_attachments
        $this->createTable('{{%task_attachments}}', [
            'id' => $this->primaryKey(),
            'workspace_id' => $this->integer()->notNull(),
            'task_id' => $this->integer()->notNull(),
            'uploaded_by' => $this->integer()->notNull(),
            'original_name' => $this->string(255)->notNull(),
            'file_url' => $this->string(500)->notNull(),
            'mime_type' => $this->string(120)->notNull()->defaultValue('application/octet-stream'),
            'size_bytes' => $this->integer()->notNull()->defaultValue(0),
            'created_at' => $this->string(35)->notNull(),
        ], $tableOptions);
        $this->createIndex('idx_attachments_task', '{{%task_attachments}}', 'task_id');

        // 22. time_entries
        $this->createTable('{{%time_entries}}', [
            'id' => $this->primaryKey(),
            'workspace_id' => $this->integer()->notNull(),
            'project_id' => $this->integer()->notNull(),
            'task_id' => $this->integer()->notNull(),
            'user_id' => $this->integer()->notNull(),
            'description' => $this->string(300)->null(),
            'duration_minutes' => $this->integer()->notNull(),
            'logged_date' => $this->string(20)->notNull(),
            'is_billable' => $this->boolean()->notNull()->defaultValue(true),
            'created_at' => $this->string(35)->notNull(),
        ], $tableOptions);
        $this->createIndex('idx_time_entries_task', '{{%time_entries}}', 'task_id');
        $this->createIndex('idx_time_entries_ws_user', '{{%time_entries}}', ['workspace_id', 'user_id']);

        // 23. project_docs (Wiki / Docs inside Project)
        $this->createTable('{{%project_docs}}', [
            'id' => $this->primaryKey(),
            'workspace_id' => $this->integer()->notNull(),
            'project_id' => $this->integer()->notNull(),
            'parent_doc_id' => $this->integer()->null(),
            'title' => $this->string(200)->notNull(),
            'icon' => $this->string(40)->notNull()->defaultValue('file-text'),
            'content_md' => $this->text()->null(),
            'created_by' => $this->integer()->notNull(),
            'updated_by' => $this->integer()->notNull(),
            'position' => $this->integer()->notNull()->defaultValue(100),
            'created_at' => $this->string(35)->notNull(),
            'updated_at' => $this->string(35)->notNull(),
        ], $tableOptions);
        $this->createIndex('idx_docs_project', '{{%project_docs}}', 'project_id');

        // 24. notifications & activity_logs
        $this->createTable('{{%notifications}}', [
            'id' => $this->primaryKey(),
            'workspace_id' => $this->integer()->notNull(),
            'recipient_id' => $this->integer()->notNull(),
            'actor_id' => $this->integer()->null(),
            'type' => $this->string(50)->notNull(), // task_assigned, mentioned, comment_added, status_changed, invitation, blocker_resolved
            'title' => $this->string(255)->notNull(),
            'body' => $this->string(500)->null(),
            'entity_type' => $this->string(40)->notNull(), // task, project, workspace, comment
            'entity_id' => $this->integer()->notNull(),
            'project_id' => $this->integer()->null(),
            'task_key' => $this->string(32)->null(),
            'read_at' => $this->string(35)->null(),
            'archived_at' => $this->string(35)->null(),
            'created_at' => $this->string(35)->notNull(),
        ], $tableOptions);
        $this->createIndex('idx_notifications_recipient', '{{%notifications}}', ['recipient_id', 'read_at']);

        $this->createTable('{{%activity_logs}}', [
            'id' => $this->primaryKey(),
            'workspace_id' => $this->integer()->notNull(),
            'project_id' => $this->integer()->null(),
            'task_id' => $this->integer()->null(),
            'actor_id' => $this->integer()->notNull(),
            'entity_type' => $this->string(40)->notNull(),
            'entity_id' => $this->integer()->notNull(),
            'action' => $this->string(60)->notNull(),
            'summary' => $this->string(350)->notNull(),
            'metadata_json' => $this->text()->null(),
            'ip_address' => $this->string(64)->null(),
            'created_at' => $this->string(35)->notNull(),
        ], $tableOptions);
        $this->createIndex('idx_activity_ws', '{{%activity_logs}}', ['workspace_id', 'created_at']);
        $this->createIndex('idx_activity_task', '{{%activity_logs}}', ['task_id', 'created_at']);
    }

    public function safeDown()
    {
        $tables = [
            'activity_logs', 'notifications', 'project_docs', 'time_entries',
            'task_attachments', 'task_comments', 'task_labels', 'labels',
            'task_dependencies', 'task_checklist_items', 'task_checklists',
            'task_watchers', 'tasks', 'task_statuses', 'project_sprints',
            'project_members', 'projects', 'folders', 'spaces',
            'workspace_invitations', 'workspace_team_members', 'workspace_teams',
            'workspace_members', 'workspaces', 'user_notification_prefs',
            'user_sessions', 'user_profiles', 'users'
        ];
        foreach ($tables as $table) {
            $this->dropTable("{{%$table}}");
        }
    }
}
