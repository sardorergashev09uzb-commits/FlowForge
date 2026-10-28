<?php

namespace app\controllers\v1;

use Yii;
use yii\db\Query;
use app\components\TenantAccessGuard;
use app\models\User;

class SystemController extends BaseApiController
{
    protected array $publicActions = ['health'];

    public function actionHealth(): array
    {
        return $this->ok([
            'service' => 'FlowForge Enterprise Yii2 API',
            'framework' => 'Yii ' . Yii::getVersion(),
            'php' => PHP_VERSION,
            'timestamp' => gmdate('Y-m-d\TH:i:s\Z'),
        ]);
    }

    /**
     * Single fast call to bootstrap authenticated user, their workspaces, active workspace hierarchy,
     * members, labels, unread notifications count, and active sprints.
     */
    public function actionBootstrap(): array
    {
        $user = $this->currentUser();
        $userId = (int)$user->id;

        // Fetch all workspaces where user is an active member
        $workspaces = (new Query())
            ->select([
                'w.*',
                'wm.role AS my_role',
                'wm.title_in_workspace',
                'wm.weekly_capacity_hours',
                'wm.joined_at',
            ])
            ->from(['w' => '{{%workspaces}}'])
            ->innerJoin(['wm' => '{{%workspace_members}}'], 'wm.workspace_id = w.id')
            ->where(['wm.user_id' => $userId, 'wm.status' => 'active'])
            ->orderBy(['w.id' => SORT_ASC])
            ->all();

        $formattedWorkspaces = array_map(function ($w) {
            return [
                'id' => (int)$w['id'],
                'name' => $w['name'],
                'slug' => $w['slug'],
                'logo_url' => $w['logo_url'],
                'description' => $w['description'],
                'owner_id' => (int)$w['owner_id'],
                'plan_tier' => $w['plan_tier'],
                'my_role' => $w['my_role'],
                'settings' => $w['settings_json'] ? json_decode($w['settings_json'], true) : [],
                'created_at' => $w['created_at'],
            ];
        }, $workspaces);

        $unreadNotificationsCount = (int)(new Query())
            ->from('{{%notifications}}')
            ->where(['recipient_id' => $userId, 'read_at' => null, 'archived_at' => null])
            ->count();

        // Pending invitations for this user's email
        $pendingInvitations = (new Query())
            ->select(['wi.*', 'w.name AS workspace_name', 'w.slug AS workspace_slug'])
            ->from(['wi' => '{{%workspace_invitations}}'])
            ->innerJoin(['w' => '{{%workspaces}}'], 'w.id = wi.workspace_id')
            ->where([
                'wi.email' => $user->email,
                'wi.accepted_at' => null,
                'wi.revoked_at' => null,
            ])
            ->andWhere(['>', 'wi.expires_at', gmdate('Y-m-d\TH:i:s\Z')])
            ->all();

        return $this->ok([
            'user' => $user->toProfileArray(),
            'current_session_id' => User::$currentSessionId,
            'workspaces' => $formattedWorkspaces,
            'unread_notifications_count' => $unreadNotificationsCount,
            'pending_invitations' => array_map(function ($inv) {
                return [
                    'id' => (int)$inv['id'],
                    'workspace_id' => (int)$inv['workspace_id'],
                    'workspace_name' => $inv['workspace_name'],
                    'workspace_slug' => $inv['workspace_slug'],
                    'role' => $inv['role'],
                    'invite_code' => $inv['invite_code'],
                    'expires_at' => $inv['expires_at'],
                ];
            }, $pendingInvitations),
        ]);
    }

    /**
     * Command Palette & Global Search across Tasks, Projects, Docs, and Members inside a Workspace.
     */
    public function actionSearch(): array
    {
        $wsId = (int)Yii::$app->request->get('workspace_id', 0);
        $q = trim((string)Yii::$app->request->get('q', ''));
        $userId = $this->currentUserId();

        TenantAccessGuard::requireWorkspaceRole($wsId, $userId, TenantAccessGuard::ROLE_VIEWER);

        $tasksQuery = (new Query())
            ->select(['t.id', 't.task_key', 't.title', 't.priority', 't.project_id', 't.status_id', 't.due_at', 'p.name AS project_name', 's.name AS status_name', 's.color AS status_color'])
            ->from(['t' => '{{%tasks}}'])
            ->innerJoin(['p' => '{{%projects}}'], 'p.id = t.project_id')
            ->leftJoin(['s' => '{{%task_statuses}}'], 's.id = t.status_id')
            ->where(['t.workspace_id' => $wsId, 't.deleted_at' => null, 'p.deleted_at' => null])
            ->limit(15)
            ->orderBy(['t.updated_at' => SORT_DESC]);

        $projectsQuery = (new Query())
            ->select(['id', 'name', 'project_key', 'status', 'color', 'icon', 'space_id', 'folder_id'])
            ->from('{{%projects}}')
            ->where(['workspace_id' => $wsId, 'deleted_at' => null])
            ->limit(10);

        $docsQuery = (new Query())
            ->select(['d.id', 'd.title', 'd.project_id', 'd.icon', 'p.name AS project_name'])
            ->from(['d' => '{{%project_docs}}'])
            ->innerJoin(['p' => '{{%projects}}'], 'p.id = d.project_id')
            ->where(['d.workspace_id' => $wsId, 'p.deleted_at' => null])
            ->limit(10);

        if ($q !== '') {
            $tasksQuery->andWhere(['or', ['like', 't.title', $q], ['like', 't.task_key', $q], ['like', 't.description', $q]]);
            $projectsQuery->andWhere(['or', ['like', 'name', $q], ['like', 'project_key', $q]]);
            $docsQuery->andWhere(['or', ['like', 'd.title', $q], ['like', 'd.content_md', $q]]);
        }

        return $this->ok([
            'tasks' => array_map(function ($t) {
                $t['id'] = (int)$t['id'];
                $t['project_id'] = (int)$t['project_id'];
                $t['status_id'] = (int)$t['status_id'];
                return $t;
            }, $tasksQuery->all()),
            'projects' => array_map(function ($p) {
                $p['id'] = (int)$p['id'];
                return $p;
            }, $projectsQuery->all()),
            'docs' => array_map(function ($d) {
                $d['id'] = (int)$d['id'];
                $d['project_id'] = (int)$d['project_id'];
                return $d;
            }, $docsQuery->all()),
        ]);
    }
}
