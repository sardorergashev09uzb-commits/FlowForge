<?php

$dsn = getenv('DB_DSN');
$username = getenv('DB_USERNAME') ?: 'root';
$password = getenv('DB_PASSWORD') !== false ? getenv('DB_PASSWORD') : '';

if (!$dsn) {
    // Check if local MySQL (3306) is reachable; if so use MySQL, otherwise use persistent SQLite database
    $fp = @fsockopen('127.0.0.1', 3306, $errno, $errstr, 0.20);
    if ($fp) {
        fclose($fp);
        $dsn = 'mysql:host=127.0.0.1;port=3306;dbname=flowforge_db';
    } else {
        $runtimeDir = dirname(__DIR__) . '/runtime';
        if (!is_dir($runtimeDir)) {
            @mkdir($runtimeDir, 0777, true);
        }
        $sqlitePath = $runtimeDir . '/flowforge_enterprise.sqlite';
        $dsn = 'sqlite:' . $sqlitePath;
    }
}

$config = [
    'class' => 'yii\db\Connection',
    'dsn' => $dsn,
    'username' => $username,
    'password' => $password,
    'charset' => 'utf8mb4',
    'enableSchemaCache' => false,
];

if (strpos($dsn, 'sqlite:') === 0) {
    $config['on afterOpen'] = function ($event) {
        $event->sender->createCommand('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;')->execute();
    };
}

return $config;
