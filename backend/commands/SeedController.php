<?php

namespace app\commands;

use Yii;
use yii\console\Controller;
use yii\console\ExitCode;
use yii\db\Query;

/**
 * Seeds comprehensive, realistic enterprise SaaS data for FlowForge local development & testing.
 */
class SeedController extends Controller
{
    public function actionRun(): int
    {
        $db = Yii::$app->db;
        $existingUsers = (int)(new Query())->from('{{%users}}')->count();
        if ($existingUsers > 0) {
            $this->stdout("Database already contains {$existingUsers} users. Skipping seed.\n");
            return ExitCode::OK;
        }

        $now = gmdate('Y-m-d\TH:i:s\Z');
        $passwordHash = Yii::$app->security->generatePasswordHash('FlowForge!2026');

        $tx = $db->beginTransaction();
        try {
            // 1. Create 5 Users (4 in Workspace 1 with Owner/Admin/Member/Viewer roles, 1 isolated in Workspace 2)
            $usersData = [
                ['sardorbek@flowforge.uz', 'sardorbek', 'Sardorbek Alimov', 'Founder & Principal Architect', 'Executive & Architecture', 'available', 'FlowForge v2.0 reliz ustida ishlamoqda'],
                ['malika@flowforge.uz', 'malika', 'Malika Karimova', 'Engineering Manager', 'Engineering', 'focusing', 'Code Review (14:00-17:00)'],
                ['javohir@flowforge.uz', 'javohir', 'Javohir Rustamov', 'Senior Full-Stack Engineer', 'Engineering', 'available', 'Yii2 API & Kanban Engine'],
                ['nilufar@flowforge.uz', 'nilufar', 'Nilufar Saidova', 'Product Stakeholder & QA', 'Quality & Product', 'busy', 'Mijozlar bilan uchrashuvda'],
                ['aziz@othercompany.uz', 'aziz_external', 'Azizbek Toshmatov', 'CEO at OtherCorp', 'Management', 'available', 'Boshqa kompaniya workspace egasi'],
            ];

            $userIds = [];
            foreach ($usersData as $idx => [$email, $username, $fullName, $jobTitle, $dept, $avail, $note]) {
                $db->createCommand()->insert('{{%users}}', [
                    'email' => $email,
                    'username' => $username,
                    'password_hash' => $passwordHash,
                    'status' => 'active',
                    'is_platform_admin' => ($idx === 0),
                    'email_verified_at' => $now,
                    'last_login_at' => $now,
                    'created_at' => $now,
                    'updated_at' => $now,
                ])->execute();
                $uid = (int)$db->getLastInsertID();
                $userIds[$username] = $uid;

                $db->createCommand()->insert('{{%user_profiles}}', [
                    'user_id' => $uid,
                    'full_name' => $fullName,
                    'job_title' => $jobTitle,
                    'department' => $dept,
                    'bio' => "{$fullName} — {$jobTitle} ({$dept}).",
                    'phone' => '+998 90 123 45 6' . $idx,
                    'timezone' => 'Asia/Tashkent',
                    'locale' => 'uz',
                    'theme' => 'dark',
                    'ui_density' => 'comfortable',
                    'availability_status' => $avail,
                    'availability_note' => $note,
                    'telegram_handle' => '@' . $username,
                    'updated_at' => $now,
                ])->execute();

                foreach (['task_assigned', 'mentioned', 'comment_added', 'status_changed', 'due_soon', 'blocker_resolved'] as $ev) {
                    $db->createCommand()->insert('{{%user_notification_prefs}}', [
                        'user_id' => $uid,
                        'event_type' => $ev,
                        'in_app_enabled' => true,
                        'email_enabled' => true,
                        'telegram_enabled' => ($idx < 3),
                    ])->execute();
                }
            }

            $uSardor = $userIds['sardorbek'];
            $uMalika = $userIds['malika'];
            $uJavohir = $userIds['javohir'];
            $uNilufar = $userIds['nilufar'];
            $uAziz = $userIds['aziz_external'];

            // 2. Create Workspace 1: FlowForge Technologies (Main Enterprise Workspace)
            $db->createCommand()->insert('{{%workspaces}}', [
                'name' => 'FlowForge Technologies',
                'slug' => 'flowforge-tech',
                'description' => 'Ko‘p foydalanuvchili SaaS mahsulotlar, mobil ilovalar va korporativ tizimlar ishlab chiqish markazi',
                'owner_id' => $uSardor,
                'plan_tier' => 'enterprise',
                'settings_json' => json_encode([
                    'allow_member_project_creation' => true,
                    'default_timezone' => 'Asia/Tashkent',
                    'working_days' => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
                    'require_time_tracking' => true,
                ]),
                'created_at' => $now,
                'updated_at' => $now,
            ])->execute();
            $ws1 = (int)$db->getLastInsertID();

            // Workspace 1 Members with all 4 roles: Owner, Admin, Member, Viewer
            $ws1Members = [
                [$uSardor, 'owner', 'Founder & Principal Architect', 40],
                [$uMalika, 'admin', 'Engineering Manager', 40],
                [$uJavohir, 'member', 'Senior Full-Stack Developer', 40],
                [$uNilufar, 'viewer', 'Stakeholder / Product Observer', 25],
            ];
            foreach ($ws1Members as [$uid, $role, $title, $cap]) {
                $db->createCommand()->insert('{{%workspace_members}}', [
                    'workspace_id' => $ws1,
                    'user_id' => $uid,
                    'role' => $role,
                    'status' => 'active',
                    'title_in_workspace' => $title,
                    'weekly_capacity_hours' => $cap,
                    'joined_at' => $now,
                ])->execute();
            }

            // Secondary workspace for Sardorbek (to test Workspace Switcher!)
            $db->createCommand()->insert('{{%workspaces}}', [
                'name' => 'FinTech Innovation Lab',
                'slug' => 'fintech-lab',
                'description' => 'To‘lov tizimlari va sun’iy intellekt asosidagi moliyaviy servislar',
                'owner_id' => $uSardor,
                'plan_tier' => 'pro',
                'settings_json' => json_encode(['allow_member_project_creation' => true]),
                'created_at' => $now,
                'updated_at' => $now,
            ])->execute();
            $ws2 = (int)$db->getLastInsertID();

            $db->createCommand()->insert('{{%workspace_members}}', [
                'workspace_id' => $ws2,
                'user_id' => $uSardor,
                'role' => 'owner',
                'status' => 'active',
                'title_in_workspace' => 'Chief Architect',
                'weekly_capacity_hours' => 30,
                'joined_at' => $now,
            ])->execute();

            // Isolated Workspace 3 owned by Aziz (for negative cross-tenant isolation testing!)
            $db->createCommand()->insert('{{%workspaces}}', [
                'name' => 'OtherCorp Private Workspace',
                'slug' => 'othercorp-private',
                'description' => 'Begona kompaniyaning yopiq ma’lumotlari',
                'owner_id' => $uAziz,
                'plan_tier' => 'starter',
                'created_at' => $now,
                'updated_at' => $now,
            ])->execute();
            $ws3 = (int)$db->getLastInsertID();

            $db->createCommand()->insert('{{%workspace_members}}', [
                'workspace_id' => $ws3,
                'user_id' => $uAziz,
                'role' => 'owner',
                'status' => 'active',
                'joined_at' => $now,
            ])->execute();

            // Teams in Workspace 1
            $db->createCommand()->insert('{{%workspace_teams}}', [
                'workspace_id' => $ws1,
                'name' => 'Core Platform & API',
                'handle' => 'core-api',
                'color' => '#6366f1',
                'description' => 'Yii2 Backend, Database arxitekturasi va xavfsizlik jamoasi',
                'lead_user_id' => $uSardor,
                'created_at' => $now,
            ])->execute();
            $team1 = (int)$db->getLastInsertID();
            foreach ([$uSardor, $uJavohir] as $uid) {
                $db->createCommand()->insert('{{%workspace_team_members}}', ['team_id' => $team1, 'user_id' => $uid, 'joined_at' => $now])->execute();
            }

            $db->createCommand()->insert('{{%workspace_teams}}', [
                'workspace_id' => $ws1,
                'name' => 'Product & Frontend UX',
                'handle' => 'frontend-ux',
                'color' => '#ec4899',
                'description' => 'React, TypeScript, Design System va foydalanuvchi interfeysi',
                'lead_user_id' => $uMalika,
                'created_at' => $now,
            ])->execute();
            $team2 = (int)$db->getLastInsertID();
            foreach ([$uMalika, $uJavohir, $uNilufar] as $uid) {
                $db->createCommand()->insert('{{%workspace_team_members}}', ['team_id' => $team2, 'user_id' => $uid, 'joined_at' => $now])->execute();
            }

            // Pending Invitation in Workspace 1
            $db->createCommand()->insert('{{%workspace_invitations}}', [
                'workspace_id' => $ws1,
                'email' => 'devops@flowforge.uz',
                'role' => 'member',
                'token_hash' => hash('sha256', 'FF-INV-DEVOPS2026'),
                'invite_code' => 'FF-INV-DEVOPS2026',
                'invited_by' => $uSardor,
                'expires_at' => gmdate('Y-m-d\TH:i:s\Z', time() + 86400 * 7),
                'created_at' => $now,
            ])->execute();

            // Labels in Workspace 1
            $labelsData = [
                ['Architecture', '#6366f1', 'Tizim arxitekturasi va dizayni'],
                ['Security / RBAC', '#ef4444', 'Avtorizatsiya va xavfsizlik talablari'],
                ['Yii2 API', '#10b981', 'Backend REST endpointlar va migratsiyalar'],
                ['Frontend UI', '#ec4899', 'React komponentlar va Kanban UX'],
                ['Performance', '#f59e0b', 'Tezlik va indeks optimizatsiyasi'],
                ['Bugfix', '#f43f5e', 'Aniqlangan xatoliklarni bartaraf etish'],
            ];
            $labelIds = [];
            foreach ($labelsData as [$lName, $lColor, $lDesc]) {
                $db->createCommand()->insert('{{%labels}}', [
                    'workspace_id' => $ws1,
                    'name' => $lName,
                    'color' => $lColor,
                    'description' => $lDesc,
                ])->execute();
                $labelIds[$lName] = (int)$db->getLastInsertID();
            }

            // 3. Hierarchy: Spaces -> Folders -> Projects
            // Space 1: Mahsulot va Dasturlash (Engineering)
            $db->createCommand()->insert('{{%spaces}}', [
                'workspace_id' => $ws1,
                'name' => 'Engineering & Platform',
                'key_code' => 'ENG',
                'description' => 'Barcha dasturiy mahsulotlar, backend va frontend loyihalari',
                'color' => '#6366f1',
                'icon' => 'cpu',
                'is_private' => false,
                'position' => 100,
                'created_by' => $uSardor,
                'created_at' => $now,
            ])->execute();
            $spaceEng = (int)$db->getLastInsertID();

            // Space 2: Growth, Marketing & Operations
            $db->createCommand()->insert('{{%spaces}}', [
                'workspace_id' => $ws1,
                'name' => 'Growth & Operations',
                'key_code' => 'OPS',
                'description' => 'Bozorga chiqarish (Go-to-market), mijozlar bilan ishlash va analitika',
                'color' => '#10b981',
                'icon' => 'globe',
                'is_private' => false,
                'position' => 200,
                'created_by' => $uMalika,
                'created_at' => $now,
            ])->execute();
            $spaceOps = (int)$db->getLastInsertID();

            // Folders inside Space 1 (Engineering)
            $db->createCommand()->insert('{{%folders}}', [
                'workspace_id' => $ws1,
                'space_id' => $spaceEng,
                'name' => 'Core SaaS Platform',
                'color' => '#818cf8',
                'position' => 100,
                'created_at' => $now,
            ])->execute();
            $folderCore = (int)$db->getLastInsertID();

            $db->createCommand()->insert('{{%folders}}', [
                'workspace_id' => $ws1,
                'space_id' => $spaceEng,
                'name' => 'Mobile & Integrations',
                'color' => '#38bdf8',
                'position' => 200,
                'created_at' => $now,
            ])->execute();
            $folderMobile = (int)$db->getLastInsertID();

            // Project 1: FlowForge SaaS v2.0 (Inside Space 1 -> Folder Core)
            $db->createCommand()->insert('{{%projects}}', [
                'workspace_id' => $ws1,
                'space_id' => $spaceEng,
                'folder_id' => $folderCore,
                'name' => 'FlowForge Enterprise v2.0',
                'project_key' => 'FF',
                'task_sequence' => 8,
                'description' => 'Ko‘p foydalanuvchili SaaS platformasining asosiy web-ilovasi va Yii2 REST API dvigateli.',
                'status' => 'on_track',
                'visibility' => 'workspace',
                'template_type' => 'software',
                'color' => '#6366f1',
                'icon' => 'rocket',
                'start_date' => gmdate('Y-m-d', time() - 86400 * 10),
                'due_date' => gmdate('Y-m-d', time() + 86400 * 20),
                'lead_user_id' => $uSardor,
                'created_by' => $uSardor,
                'created_at' => $now,
                'updated_at' => $now,
            ])->execute();
            $projFF = (int)$db->getLastInsertID();

            // Project 2: Telegram Bot & Webhook Engine (Inside Space 1 -> Folder Mobile)
            $db->createCommand()->insert('{{%projects}}', [
                'workspace_id' => $ws1,
                'space_id' => $spaceEng,
                'folder_id' => $folderMobile,
                'name' => 'Telegram Bot & Real-Time Sync',
                'project_key' => 'TG',
                'task_sequence' => 2,
                'description' => 'Telegram orqali bildirishnomalar yuborish va vazifa statuslarini inline tugmalar bilan boshqarish.',
                'status' => 'on_track',
                'visibility' => 'workspace',
                'template_type' => 'software',
                'color' => '#0ea5e9',
                'icon' => 'bot',
                'start_date' => gmdate('Y-m-d', time() - 86400 * 5),
                'due_date' => gmdate('Y-m-d', time() + 86400 * 25),
                'lead_user_id' => $uJavohir,
                'created_by' => $uSardor,
                'created_at' => $now,
                'updated_at' => $now,
            ])->execute();
            $projTG = (int)$db->getLastInsertID();

            // Project 3: Beta Launch & Enterprise Onboarding (Inside Space 2)
            $db->createCommand()->insert('{{%projects}}', [
                'workspace_id' => $ws1,
                'space_id' => $spaceOps,
                'folder_id' => null,
                'name' => 'Q4 Beta Launch & B2B Onboarding',
                'project_key' => 'GTM',
                'task_sequence' => 2,
                'description' => 'Birinchi 50 ta korporativ jamoani platformaga ulash va SLA sifat nazorati.',
                'status' => 'at_risk',
                'visibility' => 'workspace',
                'template_type' => 'marketing',
                'color' => '#10b981',
                'icon' => 'megaphone',
                'start_date' => gmdate('Y-m-d', time() - 86400 * 3),
                'due_date' => gmdate('Y-m-d', time() + 86400 * 15),
                'lead_user_id' => $uMalika,
                'created_by' => $uMalika,
                'created_at' => $now,
                'updated_at' => $now,
            ])->execute();
            $projGTM = (int)$db->getLastInsertID();

            // Favorite Project 1 & 2 for Sardorbek
            foreach ([$projFF, $projTG] as $pid) {
                $db->createCommand()->insert('{{%project_members}}', [
                    'workspace_id' => $ws1,
                    'project_id' => $pid,
                    'user_id' => $uSardor,
                    'project_role' => 'manager',
                    'is_favorite' => true,
                    'joined_at' => $now,
                ])->execute();
            }

            // Statuses for Project 1 (FF)
            $ffStatuses = [
                ['Backlog', 'backlog', '#64748b', 100, false, null],
                ['Todo (Sprint)', 'todo', '#3b82f6', 200, true, 8],
                ['In Progress', 'in_progress', '#f59e0b', 300, false, 5],
                ['Code Review & QA', 'review', '#a855f7', 400, false, 4],
                ['Done', 'done', '#10b981', 500, false, null],
            ];
            $stMapFF = [];
            foreach ($ffStatuses as [$sName, $sCat, $sColor, $sPos, $sDef, $sWip]) {
                $db->createCommand()->insert('{{%task_statuses}}', [
                    'workspace_id' => $ws1,
                    'project_id' => $projFF,
                    'name' => $sName,
                    'category' => $sCat,
                    'color' => $sColor,
                    'wip_limit' => $sWip,
                    'position' => $sPos,
                    'is_default' => $sDef,
                ])->execute();
                $stMapFF[$sCat] = (int)$db->getLastInsertID();
            }

            // Statuses for Project 2 (TG) & Project 3 (GTM)
            foreach ([$projTG, $projGTM] as $pid) {
                foreach ($ffStatuses as [$sName, $sCat, $sColor, $sPos, $sDef, $sWip]) {
                    $db->createCommand()->insert('{{%task_statuses}}', [
                        'workspace_id' => $ws1,
                        'project_id' => $pid,
                        'name' => $sName,
                        'category' => $sCat,
                        'color' => $sColor,
                        'wip_limit' => $sWip,
                        'position' => $sPos,
                        'is_default' => $sDef,
                    ])->execute();
                }
            }

            // Sprints for Project 1 (FF)
            $db->createCommand()->insert('{{%project_sprints}}', [
                'workspace_id' => $ws1,
                'project_id' => $projFF,
                'name' => 'Sprint 1 — Core Security & Multi-Tenancy',
                'goal' => 'Yii2 REST API, JWT sessiyalar, 24 jadval migratsiyasi va RBAC izolyatsiyasini yakunlash',
                'status' => 'active',
                'start_date' => gmdate('Y-m-d', time() - 86400 * 7),
                'end_date' => gmdate('Y-m-d', time() + 86400 * 7),
                'created_at' => $now,
            ])->execute();
            $sprint1 = (int)$db->getLastInsertID();

            $db->createCommand()->insert('{{%project_sprints}}', [
                'workspace_id' => $ws1,
                'project_id' => $projFF,
                'name' => 'Sprint 2 — Advanced Collaboration & Analytics',
                'goal' => 'Real-time bildirishnomalar, Gantt Timeline, Workload va hisobotlar modulini topshirish',
                'status' => 'planned',
                'start_date' => gmdate('Y-m-d', time() + 86400 * 8),
                'end_date' => gmdate('Y-m-d', time() + 86400 * 22),
                'created_at' => $now,
            ])->execute();
            $sprint2 = (int)$db->getLastInsertID();

            // Tasks in Project 1 (FF)
            $tasksFF = [
                [
                    'num' => 1,
                    'key' => 'FF-1',
                    'title' => 'Multi-tenant RBAC va TenantAccessGuard arxitekturasini joriy etish',
                    'desc' => "Barcha API endpointlarda `workspace_id` va foydalanuvchi rolini (`owner`, `admin`, `member`, `viewer`) markazlashgan holda tekshiruvchi `TenantAccessGuard` komponentini yozish.",
                    'status_id' => $stMapFF['done'],
                    'priority' => 'urgent',
                    'assignee_id' => $uSardor,
                    'sprint_id' => $sprint1,
                    'start_date' => gmdate('Y-m-d', time() - 86400 * 6),
                    'due_at' => gmdate('Y-m-d\TH:i:s\Z', time() - 86400 * 2),
                    'completed_at' => gmdate('Y-m-d\TH:i:s\Z', time() - 86400 * 2),
                    'est' => 240,
                    'logged' => 210,
                    'pts' => 8,
                    'pos' => 1000,
                    'milestone' => true,
                    'labels' => ['Architecture', 'Security / RBAC', 'Yii2 API'],
                ],
                [
                    'num' => 2,
                    'key' => 'FF-2',
                    'title' => 'JWT Access Token va faol qurilmalar (user_sessions) monitoringi',
                    'desc' => "Har bir login bo'lganda qurilma nomi, IP manzili va brauzer ma'lumotlarini `user_sessions` jadvalida saqlash hamda masofadan sessiyani uzish imkoniyatini berish.",
                    'status_id' => $stMapFF['done'],
                    'priority' => 'high',
                    'assignee_id' => $uJavohir,
                    'sprint_id' => $sprint1,
                    'start_date' => gmdate('Y-m-d', time() - 86400 * 5),
                    'due_at' => gmdate('Y-m-d\TH:i:s\Z', time() - 86400 * 1),
                    'completed_at' => gmdate('Y-m-d\TH:i:s\Z', time() - 86400 * 1),
                    'est' => 180,
                    'logged' => 165,
                    'pts' => 5,
                    'pos' => 2000,
                    'milestone' => false,
                    'labels' => ['Security / RBAC', 'Yii2 API'],
                ],
                [
                    'num' => 3,
                    'key' => 'FF-3',
                    'title' => '4-qatlamli ichma-ich Sidebar (Spaces > Folders > Projects) navigatsiyasi',
                    'desc' => "Global Icon Rail + Kontekstual ikkinchi Sidebar + Settings boshqaruv markazi + Command Palette (`Ctrl+K`) interfeysini qurish.",
                    'status_id' => $stMapFF['in_progress'],
                    'priority' => 'urgent',
                    'assignee_id' => $uSardor,
                    'sprint_id' => $sprint1,
                    'start_date' => gmdate('Y-m-d', time() - 86400 * 2),
                    'due_at' => gmdate('Y-m-d\TH:i:s\Z', time() + 3600 * 8), // Today!
                    'completed_at' => null,
                    'est' => 300,
                    'logged' => 180,
                    'pts' => 8,
                    'pos' => 1000,
                    'milestone' => false,
                    'labels' => ['Frontend UI', 'Architecture'],
                ],
                [
                    'num' => 4,
                    'key' => 'FF-4',
                    'title' => 'Kanban Board Drag-and-Drop (Fractional Indexing) va WIP limitlari',
                    'desc' => "Vazifalarni ustunlar orasida va ustun ichida surishda pozitsiyani kasr son (`position`) orqali bitta SQL so'rovda yangilash va sahifa yangilanganda saqlab qolish.",
                    'status_id' => $stMapFF['review'],
                    'priority' => 'high',
                    'assignee_id' => $uMalika,
                    'sprint_id' => $sprint1,
                    'start_date' => gmdate('Y-m-d', time() - 86400 * 3),
                    'due_at' => gmdate('Y-m-d\TH:i:s\Z', time() + 86400 * 1),
                    'completed_at' => null,
                    'est' => 240,
                    'logged' => 220,
                    'pts' => 5,
                    'pos' => 1000,
                    'milestone' => false,
                    'labels' => ['Frontend UI', 'Performance'],
                ],
                [
                    'num' => 5,
                    'key' => 'FF-5',
                    'title' => 'Vazifa bog‘liqliklari (Blocked By / Blocking) va sikllarni aniqlash',
                    'desc' => "BFS algoritmi yordamida halqasimon bog'liqliklarni (`A -> B -> A`) bloklash va bloker vazifa bitmasdan keyingi vazifani yopishda ogohlantirish.",
                    'status_id' => $stMapFF['todo'],
                    'priority' => 'high',
                    'assignee_id' => $uJavohir,
                    'sprint_id' => $sprint1,
                    'start_date' => gmdate('Y-m-d'),
                    'due_at' => gmdate('Y-m-d\TH:i:s\Z', time() + 86400 * 2),
                    'completed_at' => null,
                    'est' => 180,
                    'logged' => 45,
                    'pts' => 5,
                    'pos' => 1000,
                    'milestone' => false,
                    'labels' => ['Yii2 API', 'Architecture'],
                ],
                [
                    'num' => 6,
                    'key' => 'FF-6',
                    'title' => 'Eski hisobot keshini tozalash va SQL indekslarini tekshirish (Kechikkan vazifa)',
                    'desc' => "Katta workspace'larda analitika sahifasi 50ms dan tez ochilishini ta'minlash uchun kompozit indekslarni tekshirish.",
                    'status_id' => $stMapFF['in_progress'],
                    'priority' => 'urgent',
                    'assignee_id' => $uSardor,
                    'sprint_id' => $sprint1,
                    'start_date' => gmdate('Y-m-d', time() - 86400 * 4),
                    'due_at' => gmdate('Y-m-d\TH:i:s\Z', time() - 86400 * 1), // Overdue!
                    'completed_at' => null,
                    'est' => 120,
                    'logged' => 60,
                    'pts' => 3,
                    'pos' => 2000,
                    'milestone' => false,
                    'labels' => ['Performance', 'Bugfix'],
                ],
                [
                    'num' => 7,
                    'key' => 'FF-7',
                    'title' => 'Loyiha ichki hujjatlari (Project Docs / Wiki) va Markdown muharriri',
                    'desc' => "Har bir loyiha ichida texnik topshiriqlar, API spetsifikatsiyalari va jamoa qoidalarini saqlash uchun Wiki modulini ishga tushirish.",
                    'status_id' => $stMapFF['todo'],
                    'priority' => 'medium',
                    'assignee_id' => $uMalika,
                    'sprint_id' => $sprint2,
                    'start_date' => gmdate('Y-m-d', time() + 86400 * 2),
                    'due_at' => gmdate('Y-m-d\TH:i:s\Z', time() + 86400 * 5),
                    'completed_at' => null,
                    'est' => 150,
                    'logged' => 0,
                    'pts' => 3,
                    'pos' => 2000,
                    'milestone' => true,
                    'labels' => ['Frontend UI'],
                ],
                [
                    'num' => 8,
                    'key' => 'FF-8',
                    'title' => 'Production Release Audit va E2E xavfsizlik testlari',
                    'desc' => "Cross-workspace data leakage, IDOR va rol eskalatsiyasi bo'yicha barcha avtotestlarni o'tkazish.",
                    'status_id' => $stMapFF['backlog'],
                    'priority' => 'high',
                    'assignee_id' => $uSardor,
                    'sprint_id' => $sprint2,
                    'start_date' => gmdate('Y-m-d', time() + 86400 * 6),
                    'due_at' => gmdate('Y-m-d\TH:i:s\Z', time() + 86400 * 12),
                    'completed_at' => null,
                    'est' => 240,
                    'logged' => 0,
                    'pts' => 8,
                    'pos' => 1000,
                    'milestone' => true,
                    'labels' => ['Security / RBAC', 'Architecture'],
                ],
            ];

            $taskIdByKey = [];
            foreach ($tasksFF as $td) {
                $db->createCommand()->insert('{{%tasks}}', [
                    'workspace_id' => $ws1,
                    'project_id' => $projFF,
                    'sprint_id' => $td['sprint_id'],
                    'parent_task_id' => null,
                    'task_number' => $td['num'],
                    'task_key' => $td['key'],
                    'title' => $td['title'],
                    'description' => $td['desc'],
                    'status_id' => $td['status_id'],
                    'priority' => $td['priority'],
                    'assignee_id' => $td['assignee_id'],
                    'reporter_id' => $uSardor,
                    'start_date' => $td['start_date'],
                    'due_at' => $td['due_at'],
                    'completed_at' => $td['completed_at'],
                    'estimate_minutes' => $td['est'],
                    'logged_minutes' => $td['logged'],
                    'story_points' => $td['pts'],
                    'position' => $td['pos'],
                    'is_milestone' => $td['milestone'],
                    'created_at' => $now,
                    'updated_at' => $now,
                ])->execute();
                $tid = (int)$db->getLastInsertID();
                $taskIdByKey[$td['key']] = $tid;

                // Watchers
                $db->createCommand()->insert('{{%task_watchers}}', [
                    'workspace_id' => $ws1,
                    'task_id' => $tid,
                    'user_id' => $uSardor,
                    'created_at' => $now,
                ])->execute();

                // Labels
                foreach ($td['labels'] as $lName) {
                    if (isset($labelIds[$lName])) {
                        $db->createCommand()->insert('{{%task_labels}}', [
                            'task_id' => $tid,
                            'label_id' => $labelIds[$lName],
                        ])->execute();
                    }
                }
            }

            // Add Subtasks under FF-3
            $parentFF3 = $taskIdByKey['FF-3'];
            $db->createCommand()->insert('{{%tasks}}', [
                'workspace_id' => $ws1,
                'project_id' => $projFF,
                'sprint_id' => $sprint1,
                'parent_task_id' => $parentFF3,
                'task_number' => 9,
                'task_key' => 'FF-9',
                'title' => 'Global Navigation Rail va Workspace Switcher modalini yakunlash',
                'description' => 'Chap ustundagi tezkor workspace almashtirgich va bildirishnoma indikatori.',
                'status_id' => $stMapFF['done'],
                'priority' => 'high',
                'assignee_id' => $uSardor,
                'reporter_id' => $uSardor,
                'completed_at' => $now,
                'estimate_minutes' => 90,
                'logged_minutes' => 90,
                'story_points' => 2,
                'position' => 1000,
                'created_at' => $now,
                'updated_at' => $now,
            ])->execute();

            $db->createCommand()->insert('{{%tasks}}', [
                'workspace_id' => $ws1,
                'project_id' => $projFF,
                'sprint_id' => $sprint1,
                'parent_task_id' => $parentFF3,
                'task_number' => 10,
                'task_key' => 'FF-10',
                'title' => 'Command Palette (Ctrl+K) orqali loyiha va vazifalarga tezkor o‘tish',
                'description' => 'Sichqonchasiz klaviatura orqali qidiruv va tezkor amallar.',
                'status_id' => $stMapFF['in_progress'],
                'priority' => 'medium',
                'assignee_id' => $uMalika,
                'reporter_id' => $uSardor,
                'estimate_minutes' => 90,
                'logged_minutes' => 45,
                'story_points' => 3,
                'position' => 2000,
                'created_at' => $now,
                'updated_at' => $now,
            ])->execute();
            $db->createCommand()->update('{{%projects}}', ['task_sequence' => 10], ['id' => $projFF])->execute();

            // Checklists on FF-3
            $db->createCommand()->insert('{{%task_checklists}}', [
                'workspace_id' => $ws1,
                'task_id' => $parentFF3,
                'title' => 'UI/UX Sifat Tekshiruvi (QA Checklist)',
                'position' => 100,
            ])->execute();
            $clId = (int)$db->getLastInsertID();

            $clItems = [
                ['Spaces -> Folders -> Projects daraxti yig‘ilib-ochilishi (Collapsible)', true],
                ['Settings bosilganda kontekstual sidebar sozlamalar menyusiga almashishi', true],
                ['Loyiha ichida 9 ta tab (Overview, Kanban, List, Calendar, Timeline, Sprints, Docs, Time, Settings)', true],
                ['Mobil va planshet ekranlarida moslashuvchan (Responsive) ishlashi', false],
            ];
            foreach ($clItems as $idx => [$cTitle, $cDone]) {
                $db->createCommand()->insert('{{%task_checklist_items}}', [
                    'checklist_id' => $clId,
                    'task_id' => $parentFF3,
                    'title' => $cTitle,
                    'is_completed' => $cDone,
                    'assignee_id' => $uSardor,
                    'position' => ($idx + 1) * 100,
                ])->execute();
            }

            // Dependencies: FF-8 is blocked by FF-3 and FF-5
            $db->createCommand()->insert('{{%task_dependencies}}', [
                'workspace_id' => $ws1,
                'task_id' => $taskIdByKey['FF-8'],
                'depends_on_task_id' => $taskIdByKey['FF-3'],
                'dependency_type' => 'blocked_by',
                'created_by' => $uSardor,
                'created_at' => $now,
            ])->execute();

            $db->createCommand()->insert('{{%task_dependencies}}', [
                'workspace_id' => $ws1,
                'task_id' => $taskIdByKey['FF-8'],
                'depends_on_task_id' => $taskIdByKey['FF-5'],
                'dependency_type' => 'blocked_by',
                'created_by' => $uSardor,
                'created_at' => $now,
            ])->execute();

            // Time entries
            $db->createCommand()->insert('{{%time_entries}}', [
                'workspace_id' => $ws1,
                'project_id' => $projFF,
                'task_id' => $taskIdByKey['FF-1'],
                'user_id' => $uSardor,
                'description' => 'TenantAccessGuard va RBAC ruxsatlar matritsasini yozish hamda testlash',
                'duration_minutes' => 210,
                'logged_date' => gmdate('Y-m-d', time() - 86400 * 2),
                'is_billable' => true,
                'created_at' => $now,
            ])->execute();

            $db->createCommand()->insert('{{%time_entries}}', [
                'workspace_id' => $ws1,
                'project_id' => $projFF,
                'task_id' => $taskIdByKey['FF-3'],
                'user_id' => $uSardor,
                'description' => '4-qatlamli Sidebar va Project View Switcher arxitekturasi',
                'duration_minutes' => 180,
                'logged_date' => gmdate('Y-m-d'),
                'is_billable' => true,
                'created_at' => $now,
            ])->execute();

            // Comments on FF-3
            $db->createCommand()->insert('{{%task_comments}}', [
                'workspace_id' => $ws1,
                'task_id' => $parentFF3,
                'author_id' => $uMalika,
                'body' => "@sardorbek Yangi 4-qatlamli sidebar dizayni juda qulay chiqibdi! Spaces va Folders ichma-ich ochilishi ClickUp va Linear'ning eng yaxshi jihatlarini birlashtirgan.",
                'is_pinned' => true,
                'reactions_json' => json_encode(['🔥' => [$uSardor, $uJavohir], '👍' => [$uNilufar]]),
                'created_at' => gmdate('Y-m-d\TH:i:s\Z', time() - 3600 * 3),
            ])->execute();

            $db->createCommand()->insert('{{%task_comments}}', [
                'workspace_id' => $ws1,
                'task_id' => $parentFF3,
                'author_id' => $uSardor,
                'body' => "Rahmat @malika! Shuningdek, Settings bo‘limiga o‘tganda ikkinchi sidebar to‘liq profil, sessiyalar va workspace boshqaruv menyusiga aylanadigan qildik.",
                'is_pinned' => false,
                'reactions_json' => json_encode(['✅' => [$uMalika]]),
                'created_at' => gmdate('Y-m-d\TH:i:s\Z', time() - 3600 * 2),
            ])->execute();

            // Project Docs (Wiki) for Project 1 (FF)
            $db->createCommand()->insert('{{%project_docs}}', [
                'workspace_id' => $ws1,
                'project_id' => $projFF,
                'title' => 'FlowForge v2.0 — Tizim Arxitekturasi va Xavfsizlik Standarti',
                'icon' => 'shield-check',
                'content_md' => "# FlowForge v2.0 — Arxitektura Hujjati\n\n## 1. Ko‘p Qatlamli Tenant Izolyatsiyasi\nHar bir so‘rov `TenantAccessGuard` orqali tekshiriladi:\n- **Owner**: To‘liq boshqaruv, workspace o‘chirish va egalikni topshirish.\n- **Admin**: A’zolar, jamoalar, bo‘limlar (Spaces) va loyihalarni boshqarish.\n- **Member**: Vazifalar, subtasklar, izohlar, vaqt hisobi va hujjatlar bilan ishlash.\n- **Viewer**: Faqat ko‘rish huquqi (har qanday `POST/PATCH/DELETE` so‘rovi serverda `403 Forbidden` bilan qaytariladi).\n\n## 2. Kanban Fractional Indexing\nVazifa ustun ichida surilganda `position = (prev + next) / 2` formulasi bilan bitta qator yangilanadi.",
                'created_by' => $uSardor,
                'updated_by' => $uSardor,
                'position' => 100,
                'created_at' => $now,
                'updated_at' => $now,
            ])->execute();

            $db->createCommand()->insert('{{%project_docs}}', [
                'workspace_id' => $ws1,
                'project_id' => $projFF,
                'title' => 'REST API Endpointlar va Kodlash Standarti',
                'icon' => 'code-2',
                'content_md' => "# Yii2 REST API Standarti\n\nBarcha endpointlar `/api/v1/*` prefiksi ostida ishlaydi.\n\n### Asosiy qoidalar:\n1. Har bir mutatsiya ma'lumotlar bazasi tranzaksiyasi (`beginTransaction()`) ichida bajariladi.\n2. Muhim o‘zgarishlar avtomatik ravishda `activity_logs` jadvaliga yoziladi.\n3. `@username` chaqiruvlari tahlil qilinib, `notifications` jadvali orqali Inbox'ga yetkaziladi.",
                'created_by' => $uJavohir,
                'updated_by' => $uJavohir,
                'position' => 200,
                'created_at' => $now,
                'updated_at' => $now,
            ])->execute();

            // Notifications for Sardorbek
            $db->createCommand()->insert('{{%notifications}}', [
                'workspace_id' => $ws1,
                'recipient_id' => $uSardor,
                'actor_id' => $uMalika,
                'type' => 'mentioned',
                'title' => 'FF-3 izohida @malika sizni eslab o‘tdi',
                'body' => '@sardorbek Yangi 4-qatlamli sidebar dizayni juda qulay chiqibdi!',
                'entity_type' => 'task',
                'entity_id' => $parentFF3,
                'project_id' => $projFF,
                'task_key' => 'FF-3',
                'read_at' => null,
                'created_at' => gmdate('Y-m-d\TH:i:s\Z', time() - 3600 * 3),
            ])->execute();

            $db->createCommand()->insert('{{%notifications}}', [
                'workspace_id' => $ws1,
                'recipient_id' => $uSardor,
                'actor_id' => $uJavohir,
                'type' => 'status_changed',
                'title' => 'FF-2 vazifasi yakunlandi (Done)',
                'body' => 'JWT Access Token va faol qurilmalar monitoringi topshirildi.',
                'entity_type' => 'task',
                'entity_id' => $taskIdByKey['FF-2'],
                'project_id' => $projFF,
                'task_key' => 'FF-2',
                'read_at' => null,
                'created_at' => gmdate('Y-m-d\TH:i:s\Z', time() - 3600 * 5),
            ])->execute();

            // Activity logs
            $activities = [
                [$uSardor, 'workspace', $ws1, 'workspace.created', "FlowForge Technologies korporativ workspace'i ishga tushirildi.", null, null],
                [$uSardor, 'project', $projFF, 'project.created', "FlowForge Enterprise v2.0 (FF) loyihasi yaratildi.", $projFF, null],
                [$uJavohir, 'task', $taskIdByKey['FF-2'], 'task.completed', "FF-2: 'JWT Access Token va faol qurilmalar monitoringi' Done ustuniga o‘tkazildi.", $projFF, $taskIdByKey['FF-2']],
                [$uMalika, 'task', $taskIdByKey['FF-4'], 'task.moved', "FF-4 Kanban doskada 'In Progress' ➔ 'Code Review & QA' ustuniga ko‘chirildi.", $projFF, $taskIdByKey['FF-4']],
                [$uMalika, 'comment', $parentFF3, 'comment.added', "FF-3 vazifasiga yangi izoh qoldirildi va @sardorbek chaqirildi.", $projFF, $parentFF3],
            ];
            foreach ($activities as [$actor, $eType, $eId, $act, $sum, $pId, $tId]) {
                $db->createCommand()->insert('{{%activity_logs}}', [
                    'workspace_id' => $ws1,
                    'project_id' => $pId,
                    'task_id' => $tId,
                    'actor_id' => $actor,
                    'entity_type' => $eType,
                    'entity_id' => $eId,
                    'action' => $act,
                    'summary' => $sum,
                    'ip_address' => '127.0.0.1',
                    'created_at' => $now,
                ])->execute();
            }

            $tx->commit();
            $this->stdout("FlowForge Enterprise seed data successfully created!\n");
            return ExitCode::OK;
        } catch (\Throwable $e) {
            $tx->rollBack();
            $this->stderr("Seed error: " . $e->getMessage() . "\n" . $e->getTraceAsString() . "\n");
            return ExitCode::UNSPECIFIED_ERROR;
        }
    }
}
