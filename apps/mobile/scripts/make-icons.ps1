# Renders the app icon set from the same Material Community Icons glyph the sign-in page
# shows ("card-account-details" in onPrimaryContainer on a primaryContainer circle).
# Usage: .\make-icons.ps1            (from anywhere; paths are resolved from the repo)
Add-Type -AssemblyName System.Drawing
$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
$out = Join-Path $PSScriptRoot "..\assets\images"
$ttf = Join-Path $repo "node_modules\@expo\vector-icons\build\vendor\react-native-vector-icons\Fonts\MaterialCommunityIcons.ttf"
$mapPath = Join-Path $repo "node_modules\@expo\vector-icons\build\vendor\react-native-vector-icons\glyphmaps\MaterialCommunityIcons.json"
if (-not (Test-Path $ttf)) { throw "font not found: $ttf" }
$code = (Get-Content $mapPath -Raw | ConvertFrom-Json).'card-account-details'
$glyph = [char]::ConvertFromUtf32([int]$code)
"glyph card-account-details = U+{0:X}" -f $code

$pfc = New-Object System.Drawing.Text.PrivateFontCollection
$pfc.AddFontFile($ttf)
$family = $pfc.Families[0]

# theme tokens (apps/mobile/src/theme/tokens.ts): primaryContainer / onPrimaryContainer / primary
$blue   = [System.Drawing.ColorTranslator]::FromHtml("#D6EBFF")
$navy   = [System.Drawing.ColorTranslator]::FromHtml("#00294A")
$white  = [System.Drawing.Color]::White
$clear  = [System.Drawing.Color]::FromArgb(0, 0, 0, 0)

function New-Canvas([int]$size, [System.Drawing.Color]$bg) {
  $b = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($b)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $g.Clear($bg)
  return @($b, $g)
}
function Draw-Glyph([System.Drawing.Graphics]$g, [int]$size, [double]$scale, [System.Drawing.Color]$color) {
  $font = New-Object System.Drawing.Font($family, [float]($size * $scale), [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $brush = New-Object System.Drawing.SolidBrush($color)
  $sf = New-Object System.Drawing.StringFormat; $sf.Alignment = "Center"; $sf.LineAlignment = "Center"
  # the glyph's em box places it slightly high; shift down 4% for optical centering
  $rect = New-Object System.Drawing.RectangleF(0, [float]($size * 0.04), $size, $size)
  $g.DrawString($glyph, $font, $brush, $rect, $sf)
}
function Draw-Circle([System.Drawing.Graphics]$g, [int]$size, [double]$scale, [System.Drawing.Color]$color) {
  $d = $size * $scale; $o = ($size - $d) / 2
  $g.FillEllipse((New-Object System.Drawing.SolidBrush($color)), [float]$o, [float]$o, [float]$d, [float]$d)
}
function Save($bmp, $name) { $bmp.Save((Join-Path $out $name), [System.Drawing.Imaging.ImageFormat]::Png); "wrote $name ($($bmp.Width)x$($bmp.Height))" }

# icon.png (iOS/web/legacy): light-blue square with the navy glyph
$c = New-Canvas 1024 $blue; Draw-Glyph $c[1] 1024 0.58 $navy; $c[1].Dispose(); Save $c[0] "icon.png"; $c[0].Dispose()
# adaptive foreground: glyph only, inside the safe zone; background: solid light blue
$c = New-Canvas 1024 $clear; Draw-Glyph $c[1] 1024 0.46 $navy; $c[1].Dispose(); Save $c[0] "android-icon-foreground.png"; $c[0].Dispose()
$c = New-Canvas 1024 $blue; $c[1].Dispose(); Save $c[0] "android-icon-background.png"; $c[0].Dispose()
# monochrome (themed icon) and notification small icon: white glyph on transparent
$c = New-Canvas 1024 $clear; Draw-Glyph $c[1] 1024 0.5 $white; $c[1].Dispose(); Save $c[0] "android-icon-monochrome.png"; $c[0].Dispose()
$c = New-Canvas 96 $clear; Draw-Glyph $c[1] 96 0.8 $white; $c[1].Dispose(); Save $c[0] "notification-icon.png"; $c[0].Dispose()
# splash (sits on the #005B96 splash background) and favicon: the sign-in circle itself
$c = New-Canvas 512 $clear; Draw-Circle $c[1] 512 1.0 $blue; Draw-Glyph $c[1] 512 0.48 $navy; $c[1].Dispose(); Save $c[0] "splash-icon.png"; $c[0].Dispose()
$c = New-Canvas 48 $clear; Draw-Circle $c[1] 48 1.0 $blue; Draw-Glyph $c[1] 48 0.55 $navy; $c[1].Dispose(); Save $c[0] "favicon.png"; $c[0].Dispose()
