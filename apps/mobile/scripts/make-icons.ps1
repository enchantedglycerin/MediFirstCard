Add-Type -AssemblyName System.Drawing
$src = "C:\Users\Lolicon_Cafe\Downloads\icon.png"
$out = "C:\workspace\MediFirstCard\apps\mobile\assets\images"
$img = [System.Drawing.Image]::FromFile($src)

function New-Canvas([int]$size, [System.Drawing.Color]$bg) {
  $b = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($b)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear($bg)
  return @($b, $g)
}
function Save($bmp, $name) { $bmp.Save((Join-Path $out $name), [System.Drawing.Imaging.ImageFormat]::Png); "wrote $name ($($bmp.Width)x$($bmp.Height))" }

$navy = [System.Drawing.Color]::FromArgb(255, 10, 23, 48)   # dark navy sampled from the artwork edges
$transparent = [System.Drawing.Color]::FromArgb(0, 0, 0, 0)

# 1) icon.png - full-bleed 1024 (iOS/web/legacy launcher)
$c = New-Canvas 1024 $navy; $c[1].DrawImage($img, 0, 0, 1024, 1024); $c[1].Dispose(); Save $c[0] "icon.png"; $c[0].Dispose()

# 2) adaptive foreground - artwork scaled to 86% so the card and character survive the circular mask
$c = New-Canvas 1024 $transparent; $s = [int](1024 * 0.86); $o = [int]((1024 - $s) / 2)
$c[1].DrawImage($img, $o, $o, $s, $s); $c[1].Dispose(); Save $c[0] "android-icon-foreground.png"; $c[0].Dispose()

# 3) adaptive background - solid navy (matches the artwork, no seam when the mask shows it)
$c = New-Canvas 1024 $navy; $c[1].Dispose(); Save $c[0] "android-icon-background.png"; $c[0].Dispose()

# 4) monochrome (Android 13 themed icon) + notification glyph: white card-with-cross silhouette on transparent
function Draw-Glyph([System.Drawing.Graphics]$g, [int]$size, [double]$scale) {
  $white = [System.Drawing.Brushes]::White
  $w = $size * 0.62 * $scale; $h = $size * 0.42 * $scale
  $x = ($size - $w) / 2; $y = ($size - $h) / 2
  $r = $h * 0.18
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddArc($x, $y, $r*2, $r*2, 180, 90); $path.AddArc($x+$w-$r*2, $y, $r*2, $r*2, 270, 90)
  $path.AddArc($x+$w-$r*2, $y+$h-$r*2, $r*2, $r*2, 0, 90); $path.AddArc($x, $y+$h-$r*2, $r*2, $r*2, 90, 90); $path.CloseFigure()
  $g.FillPath($white, $path)
  # cut a cross out of the card (transparent) so it reads as a medical card
  $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
  $clear = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(0,0,0,0))
  $cs = $h * 0.55; $cw = $cs * 0.32; $cx = $x + $h * 0.5; $cy = $y + $h / 2
  $g.FillRectangle($clear, $cx - $cw/2, $cy - $cs/2, $cw, $cs); $g.FillRectangle($clear, $cx - $cs/2, $cy - $cw/2, $cs, $cw)
  # two text lines
  $lx = $cx + $cs * 0.75; $lw = ($x + $w) - $lx - $h * 0.2
  $g.FillRectangle($clear, $lx, $cy - $h*0.16, $lw, $h*0.09); $g.FillRectangle($clear, $lx, $cy + $h*0.06, $lw * 0.7, $h*0.09)
  $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
}
$c = New-Canvas 1024 $transparent; Draw-Glyph $c[1] 1024 0.8; $c[1].Dispose(); Save $c[0] "android-icon-monochrome.png"; $c[0].Dispose()
$c = New-Canvas 96 $transparent; Draw-Glyph $c[1] 96 1.25; $c[1].Dispose(); Save $c[0] "notification-icon.png"; $c[0].Dispose()

# 5) splash icon (shown at 96 dp on the #005B96 splash) and favicon
$c = New-Canvas 512 $navy; $c[1].DrawImage($img, 0, 0, 512, 512); $c[1].Dispose(); Save $c[0] "splash-icon.png"; $c[0].Dispose()
$c = New-Canvas 48 $navy; $c[1].DrawImage($img, 0, 0, 48, 48); $c[1].Dispose(); Save $c[0] "favicon.png"; $c[0].Dispose()
$img.Dispose()