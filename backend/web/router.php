<?php
/**
 * Unified Router script for PHP built-in server & Cloud Container deployments
 * Serves static assets, /uploads/*, /api/v1/* (via Yii2), and React SPA fallback (index.html)
 */
$uri = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
$filePath = __DIR__ . $uri;

// 1. Serve existing static files (.js, .css, .png, .svg, /uploads/tasks/*, etc.)
if ($uri !== '/' && file_exists($filePath) && !is_dir($filePath)) {
    return false;
}

// 2. Route all /api/* requests to Yii2 REST API entry script
if (strpos($uri, '/api/') === 0) {
    $_SERVER['SCRIPT_NAME'] = '/index.php';
    require __DIR__ . '/index.php';
    return true;
}

// 3. If built React SPA (index.html) exists in backend/web, serve it for frontend routes
$spaIndex = __DIR__ . '/index.html';
if (file_exists($spaIndex)) {
    header('Content-Type: text/html; charset=UTF-8');
    readfile($spaIndex);
    return true;
}

// 4. Default fallback to Yii2 index.php
$_SERVER['SCRIPT_NAME'] = '/index.php';
require __DIR__ . '/index.php';
