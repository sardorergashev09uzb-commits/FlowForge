<?php

$params = require __DIR__ . '/params.php';
$db = require __DIR__ . '/db.php';

return [
    'id' => 'flowforge-api',
    'name' => 'FlowForge Enterprise SaaS API',
    'basePath' => dirname(__DIR__),
    'bootstrap' => ['log'],
    'timeZone' => 'UTC',
    'aliases' => [
        '@app' => dirname(__DIR__),
    ],
    'components' => [
        'request' => [
            'cookieValidationKey' => getenv('COOKIE_VALIDATION_KEY') ?: 'flowforge_cookie_validation_key_2026',
            'enableCsrfValidation' => false,
            'parsers' => [
                'application/json' => 'yii\web\JsonParser',
            ],
        ],
        'response' => [
            'format' => yii\web\Response::FORMAT_JSON,
            'charset' => 'UTF-8',
            'on beforeSend' => function ($event) {
                $response = $event->sender;
                $origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
                $response->headers->set('Access-Control-Allow-Origin', $origin);
                $response->headers->set('Access-Control-Allow-Credentials', 'true');
                $response->headers->set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
                $response->headers->set('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Workspace-Id');

                if ($response->data !== null && !$response->isSuccessful) {
                    $statusCode = $response->statusCode;
                    $message = $response->data['message'] ?? $response->statusText ?? 'Server xatoligi';
                    $errors = $response->data['errors'] ?? null;
                    $code = $response->data['code'] ?? 'API_ERROR';
                    $response->data = [
                        'success' => false,
                        'error' => [
                            'code' => $code,
                            'message' => $message,
                            'status' => $statusCode,
                            'details' => $errors,
                        ],
                    ];
                }
            },
        ],
        'cache' => [
            'class' => 'yii\caching\FileCache',
        ],
        'user' => [
            'identityClass' => 'app\models\User',
            'enableSession' => false,
            'loginUrl' => null,
        ],
        'errorHandler' => [
            'errorAction' => null,
        ],
        'log' => [
            'traceLevel' => YII_DEBUG ? 3 : 0,
            'targets' => [
                [
                    'class' => 'yii\log\FileTarget',
                    'levels' => ['error', 'warning'],
                ],
            ],
        ],
        'db' => $db,
        'urlManager' => [
            'enablePrettyUrl' => true,
            'showScriptName' => false,
            'enableStrictParsing' => false,
            'rules' => [
                // Health & Bootstrap
                'GET api/v1/health' => 'v1/system/health',
                'GET api/v1/bootstrap' => 'v1/system/bootstrap',
                'GET api/v1/search' => 'v1/system/search',

                // Auth & Profile & Sessions
                'POST api/v1/auth/register' => 'v1/auth/register',
                'POST api/v1/auth/login' => 'v1/auth/login',
                'POST api/v1/auth/logout' => 'v1/auth/logout',
                'POST api/v1/auth/forgot-password' => 'v1/auth/forgot-password',
                'POST api/v1/auth/reset-password' => 'v1/auth/reset-password',
                'GET api/v1/auth/me' => 'v1/auth/me',
                'PATCH api/v1/profile' => 'v1/profile/update',
                'POST api/v1/profile/password' => 'v1/profile/change-password',
                'GET api/v1/profile/sessions' => 'v1/profile/sessions',
                'DELETE api/v1/profile/sessions/<id:\d+>' => 'v1/profile/revoke-session',
                'POST api/v1/profile/sessions/revoke-others' => 'v1/profile/revoke-other-sessions',
                'GET api/v1/profile/notifications-prefs' => 'v1/profile/notification-prefs',
                'PUT api/v1/profile/notifications-prefs' => 'v1/profile/update-notification-prefs',

                // Workspaces, Members, Teams, Invitations, Trash, Audit
                'GET api/v1/workspaces' => 'v1/workspace/index',
                'POST api/v1/workspaces' => 'v1/workspace/create',
                'GET api/v1/workspaces/<id:\d+>' => 'v1/workspace/view',
                'PATCH api/v1/workspaces/<id:\d+>' => 'v1/workspace/update',
                'DELETE api/v1/workspaces/<id:\d+>' => 'v1/workspace/delete',
                'POST api/v1/workspaces/<id:\d+>/transfer-ownership' => 'v1/workspace/transfer-ownership',

                'GET api/v1/workspaces/<id:\d+>/members' => 'v1/workspace/members',
                'PATCH api/v1/workspaces/<id:\d+>/members/<memberId:\d+>' => 'v1/workspace/update-member',
                'DELETE api/v1/workspaces/<id:\d+>/members/<memberId:\d+>' => 'v1/workspace/remove-member',

                'GET api/v1/workspaces/<id:\d+>/invitations' => 'v1/workspace/invitations',
                'POST api/v1/workspaces/<id:\d+>/invitations' => 'v1/workspace/invite',
                'DELETE api/v1/workspaces/<id:\d+>/invitations/<invId:\d+>' => 'v1/workspace/revoke-invitation',
                'POST api/v1/invitations/accept' => 'v1/workspace/accept-invitation',

                'GET api/v1/workspaces/<id:\d+>/teams' => 'v1/workspace/teams',
                'POST api/v1/workspaces/<id:\d+>/teams' => 'v1/workspace/create-team',
                'PATCH api/v1/workspaces/<id:\d+>/teams/<teamId:\d+>' => 'v1/workspace/update-team',
                'DELETE api/v1/workspaces/<id:\d+>/teams/<teamId:\d+>' => 'v1/workspace/delete-team',

                'GET api/v1/workspaces/<id:\d+>/labels' => 'v1/workspace/labels',
                'POST api/v1/workspaces/<id:\d+>/labels' => 'v1/workspace/create-label',
                'PATCH api/v1/workspaces/<id:\d+>/labels/<labelId:\d+>' => 'v1/workspace/update-label',
                'DELETE api/v1/workspaces/<id:\d+>/labels/<labelId:\d+>' => 'v1/workspace/delete-label',

                'GET api/v1/workspaces/<id:\d+>/activity' => 'v1/workspace/activity',
                'GET api/v1/workspaces/<id:\d+>/trash' => 'v1/workspace/trash',
                'POST api/v1/workspaces/<id:\d+>/trash/restore' => 'v1/workspace/restore-trash',
                'DELETE api/v1/workspaces/<id:\d+>/trash/purge' => 'v1/workspace/purge-trash',
                'GET api/v1/workspaces/<id:\d+>/reports' => 'v1/workspace/reports',

                // Hierarchy: Spaces, Folders, Projects, Sprints, Docs
                'GET api/v1/workspaces/<wsId:\d+>/hierarchy' => 'v1/hierarchy/tree',
                'POST api/v1/workspaces/<wsId:\d+>/spaces' => 'v1/hierarchy/create-space',
                'PATCH api/v1/spaces/<id:\d+>' => 'v1/hierarchy/update-space',
                'DELETE api/v1/spaces/<id:\d+>' => 'v1/hierarchy/delete-space',

                'POST api/v1/spaces/<spaceId:\d+>/folders' => 'v1/hierarchy/create-folder',
                'PATCH api/v1/folders/<id:\d+>' => 'v1/hierarchy/update-folder',
                'DELETE api/v1/folders/<id:\d+>' => 'v1/hierarchy/delete-folder',

                'GET api/v1/workspaces/<wsId:\d+>/projects' => 'v1/project/index',
                'POST api/v1/workspaces/<wsId:\d+>/projects' => 'v1/project/create',
                'GET api/v1/projects/<id:\d+>' => 'v1/project/view',
                'PATCH api/v1/projects/<id:\d+>' => 'v1/project/update',
                'DELETE api/v1/projects/<id:\d+>' => 'v1/project/delete',
                'POST api/v1/projects/<id:\d+>/favorite' => 'v1/project/toggle-favorite',

                'POST api/v1/projects/<id:\d+>/statuses' => 'v1/project/create-status',
                'PATCH api/v1/projects/<id:\d+>/statuses/<statusId:\d+>' => 'v1/project/update-status',
                'DELETE api/v1/projects/<id:\d+>/statuses/<statusId:\d+>' => 'v1/project/delete-status',
                'POST api/v1/projects/<id:\d+>/statuses/reorder' => 'v1/project/reorder-statuses',

                'GET api/v1/projects/<id:\d+>/sprints' => 'v1/project/sprints',
                'POST api/v1/projects/<id:\d+>/sprints' => 'v1/project/create-sprint',
                'PATCH api/v1/sprints/<id:\d+>' => 'v1/project/update-sprint',
                'DELETE api/v1/sprints/<id:\d+>' => 'v1/project/delete-sprint',

                'GET api/v1/projects/<id:\d+>/docs' => 'v1/doc/index',
                'POST api/v1/projects/<id:\d+>/docs' => 'v1/doc/create',
                'GET api/v1/docs/<id:\d+>' => 'v1/doc/view',
                'PATCH api/v1/docs/<id:\d+>' => 'v1/doc/update',
                'DELETE api/v1/docs/<id:\d+>' => 'v1/doc/delete',

                // Tasks, Kanban, Bulk, Subtasks, Checklists, Dependencies, Time, Comments
                'GET api/v1/projects/<projectId:\d+>/tasks' => 'v1/task/index',
                'POST api/v1/projects/<projectId:\d+>/tasks' => 'v1/task/create',
                'GET api/v1/workspaces/<wsId:\d+>/my-tasks' => 'v1/task/my-tasks',
                'POST api/v1/workspaces/<wsId:\d+>/tasks/bulk' => 'v1/task/bulk-update',
                'GET api/v1/tasks/<id:\d+>' => 'v1/task/view',
                'PATCH api/v1/tasks/<id:\d+>' => 'v1/task/update',
                'DELETE api/v1/tasks/<id:\d+>' => 'v1/task/delete',
                'POST api/v1/tasks/<id:\d+>/move' => 'v1/task/move',
                'POST api/v1/tasks/<id:\d+>/watch' => 'v1/task/toggle-watch',
                'POST api/v1/tasks/<id:\d+>/labels' => 'v1/task/sync-labels',

                'POST api/v1/tasks/<id:\d+>/checklists' => 'v1/task/create-checklist',
                'DELETE api/v1/checklists/<id:\d+>' => 'v1/task/delete-checklist',
                'POST api/v1/checklists/<id:\d+>/items' => 'v1/task/add-checklist-item',
                'PATCH api/v1/checklist-items/<id:\d+>' => 'v1/task/update-checklist-item',
                'DELETE api/v1/checklist-items/<id:\d+>' => 'v1/task/delete-checklist-item',

                'POST api/v1/tasks/<id:\d+>/dependencies' => 'v1/task/add-dependency',
                'DELETE api/v1/dependencies/<id:\d+>' => 'v1/task/remove-dependency',

                'POST api/v1/tasks/<id:\d+>/time-entries' => 'v1/task/add-time-entry',
                'DELETE api/v1/time-entries/<id:\d+>' => 'v1/task/delete-time-entry',
                'GET api/v1/workspaces/<wsId:\d+>/time-entries' => 'v1/task/workspace-time-entries',

                'POST api/v1/tasks/<id:\d+>/attachments' => 'v1/task/add-attachment',
                'DELETE api/v1/attachments/<id:\d+>' => 'v1/task/delete-attachment',

                'POST api/v1/tasks/<id:\d+>/comments' => 'v1/task/add-comment',
                'PATCH api/v1/comments/<id:\d+>' => 'v1/task/update-comment',
                'DELETE api/v1/comments/<id:\d+>' => 'v1/task/delete-comment',
                'POST api/v1/comments/<id:\d+>/react' => 'v1/task/react-comment',

                // Notifications / Inbox
                'GET api/v1/notifications' => 'v1/notification/index',
                'PATCH api/v1/notifications/<id:\d+>' => 'v1/notification/update',
                'POST api/v1/notifications/mark-all-read' => 'v1/notification/mark-all-read',
            ],
        ],
    ],
    'params' => $params,
];
