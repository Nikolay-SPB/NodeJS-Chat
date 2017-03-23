<?php
/**
 * Author: Nikolay Pilipovic.
 * Email: nikola.pilipovic@gmail.com
 * Date: 23.03.2017
 * Time: 18:13
 */

$settings = [
    'host' => 'http://chat.rybalkapro.ru',

    'dev_mode' => false
];

if (file_exists(__DIR__ . "/config.local.php")) {
    require_once __DIR__ . "/config.local.php";
}