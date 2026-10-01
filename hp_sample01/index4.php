<?php
$settings = require __DIR__ . '/function/settings.php';

$maxClicks = (int) $settings['click']['max_clicks'];

function h($value)
{
    return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
}

// 文言中の {count} を回数に置き換える。
function fill_count($text, $count)
{
    return str_replace('{count}', (string) $count, $text);
}

// 更新時にブラウザのキャッシュが残らないよう、ファイルの更新時刻を付ける。
function asset($path)
{
    $file = __DIR__ . '/' . $path;
    return is_file($file) ? $path . '?v=' . filemtime($file) : $path;
}

$pageClasses = ['page'];
if (empty($settings['finale']['shake'])) {
    $pageClasses[] = 'no-shake';
}
if (empty($settings['finale']['flash'])) {
    $pageClasses[] = 'no-flash';
}
?>
<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, viewport-fit=cover"
    />
    <meta name="theme-color" content="<?= h($settings['page']['theme_color']) ?>" />
    <title><?= h($settings['page']['title']) ?></title>
    <link rel="stylesheet" href="<?= h(asset('css/style.css')) ?>" />
    <style>
      /* 背景画像は settings.php の page.background / page.background_pc で切り替える。 */
      .page {
        background-image: url("<?= h($settings['page']['background']) ?>");
        /* 画面いっぱいに表示して、上下左右の黒い余白を出さない。 */
        background-size: cover;
      }
      @media (min-width: <?= (int) $settings['mobile_breakpoint'] ?>px) {
        .page {
          background-image: url("<?= h($settings['page']['background_pc']) ?>");
        }
      }
    </style>
  </head>
  <body>
    <main
      class="<?= h(implode(' ', $pageClasses)) ?>"
      id="click-area"
      role="button"
      tabindex="0"
      aria-label="<?= h(fill_count($settings['text']['aria_label'], $maxClicks)) ?>"
    >
      <p class="instruction"><?= h(fill_count($settings['text']['instruction'], $maxClicks)) ?></p>
      <div class="burst-layer" id="burst-layer" aria-hidden="true"></div>
      <p class="sr-only" id="click-status" aria-live="polite"><?= h(fill_count($settings['text']['remaining'], $maxClicks)) ?></p>
    </main>

    <script id="app-settings" type="application/json"><?= json_encode(
        [
            'maxClicks'        => $maxClicks,
            'redirectUrl'      => $settings['click']['redirect_url'],
            'redirectDelay'    => (int) $settings['click']['redirect_delay'],
            'particles'        => $settings['particles'],
            'burst'            => $settings['burst'],
            'finale'           => $settings['finale'],
            'mobileBreakpoint' => (int) $settings['mobile_breakpoint'],
            'text'             => [
                'remaining'   => $settings['text']['remaining'],
                'redirecting' => $settings['text']['redirecting'],
            ],
        ],
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP
    ) ?></script>
    <script src="<?= h(asset('js/script.js')) ?>"></script>
  </body>
</html>
