<?php

namespace NodeJS_Chat;

require_once __DIR__ . "/../front/localization.php";
require_once __DIR__ . "/../front/settings.php";

$settings = new Settings();
$settings->init();

$locale = new Localization();
$locale->init();

require_once __DIR__ . "/../tpl/index.phtml";