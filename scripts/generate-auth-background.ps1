param(
  [string]$OutputPath = "mobile/assets/auth-background.png",
  [int]$Width = 1440,
  [int]$Height = 2560
)

Add-Type -AssemblyName System.Drawing

$fullOutputPath = Join-Path (Get-Location) $OutputPath
$outputDirectory = Split-Path -Parent $fullOutputPath
if (-not (Test-Path -LiteralPath $outputDirectory)) {
  New-Item -ItemType Directory -Path $outputDirectory | Out-Null
}

function New-Color([int]$a, [int]$r, [int]$g, [int]$b) {
  return [System.Drawing.Color]::FromArgb($a, $r, $g, $b)
}

$bitmap = New-Object System.Drawing.Bitmap $Width, $Height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

try {
  $rect = New-Object System.Drawing.Rectangle 0, 0, $Width, $Height
  $baseBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    $rect,
    ([System.Drawing.Color]::FromArgb(255, 255, 248, 225)),
    ([System.Drawing.Color]::FromArgb(255, 217, 189, 120)),
    145
  )
  $blend = New-Object System.Drawing.Drawing2D.ColorBlend
  $blend.Colors = @(
    [System.Drawing.Color]::FromArgb(255, 255, 248, 225),
    [System.Drawing.Color]::FromArgb(255, 247, 244, 236),
    [System.Drawing.Color]::FromArgb(255, 217, 189, 120)
  )
  $blend.Positions = @(0.0, 0.42, 1.0)
  $baseBrush.InterpolationColors = $blend
  $graphics.FillRectangle($baseBrush, $rect)
  $baseBrush.Dispose()

  function Draw-RadialGlow($graphics, [float]$centerX, [float]$centerY, [float]$radius, [System.Drawing.Color]$innerColor) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddEllipse($centerX - $radius, $centerY - $radius, $radius * 2, $radius * 2)
    $brush = [System.Drawing.Drawing2D.PathGradientBrush]::new($path)
    $brush.CenterPoint = [System.Drawing.PointF]::new($centerX, $centerY)
    $brush.CenterColor = $innerColor
    $brush.SurroundColors = @([System.Drawing.Color]::FromArgb(0, $innerColor.R, $innerColor.G, $innerColor.B))
    $graphics.FillPath($brush, $path)
    $brush.Dispose()
    $path.Dispose()
  }

  Draw-RadialGlow $graphics ($Width * 0.22) ($Height * 0.18) ($Width * 0.48) (New-Color 82 255 159 0)
  Draw-RadialGlow $graphics ($Width * 0.86) ($Height * 0.20) ($Width * 0.45) (New-Color 52 17 17 17)
  Draw-RadialGlow $graphics ($Width * 0.08) ($Height * 0.82) ($Width * 0.38) (New-Color 34 255 159 0)

  $gridPen = [System.Drawing.Pen]::new((New-Color 18 0 0 4), 2)
  $gridStep = 96
  for ($x = 0; $x -le $Width; $x += $gridStep) {
    $graphics.DrawLine($gridPen, $x, 0, $x, $Height)
  }
  for ($y = 0; $y -le $Height; $y += $gridStep) {
    $graphics.DrawLine($gridPen, 0, $y, $Width, $y)
  }
  $gridPen.Dispose()

  $stripePen = [System.Drawing.Pen]::new((New-Color 44 255 159 0), 3)
  for ($x = 40; $x -lt $Width; $x += 220) {
    $graphics.DrawLine($stripePen, $x, 0, $x + ($Height * 0.18), $Height)
  }
  $stripePen.Dispose()

  $orbitPen = [System.Drawing.Pen]::new((New-Color 92 255 159 0), 2)
  $orbitRect = New-Object System.Drawing.RectangleF ($Width * 0.64), ($Height * 0.05), ($Width * 0.58), ($Width * 0.58)
  $graphics.DrawEllipse($orbitPen, $orbitRect)
  $graphics.DrawArc($orbitPen, $orbitRect, 210, 72)
  $orbitPen.Dispose()

  $darkOrbitPen = [System.Drawing.Pen]::new((New-Color 34 0 0 4), 2)
  $innerOrbitRect = New-Object System.Drawing.RectangleF ($Width * 0.70), ($Height * 0.095), ($Width * 0.46), ($Width * 0.46)
  $graphics.DrawEllipse($darkOrbitPen, $innerOrbitRect)
  $darkOrbitPen.Dispose()

  $linePenAmber = [System.Drawing.Pen]::new((New-Color 38 255 159 0), 3)
  $graphics.TranslateTransform($Width * 0.5, $Height * 0.18)
  $graphics.RotateTransform(-12)
  $graphics.DrawLine($linePenAmber, -($Width * 0.8), 0, $Width * 0.8, 0)
  $graphics.ResetTransform()
  $linePenAmber.Dispose()

  $linePenWhite = [System.Drawing.Pen]::new((New-Color 26 255 255 255), 3)
  $graphics.TranslateTransform($Width * 0.5, $Height * 0.48)
  $graphics.RotateTransform(18)
  $graphics.DrawLine($linePenWhite, -($Width * 0.8), 0, $Width * 0.8, 0)
  $graphics.ResetTransform()
  $linePenWhite.Dispose()

  $dotBrushAmber = [System.Drawing.SolidBrush]::new((New-Color 255 255 159 0))
  $graphics.FillEllipse($dotBrushAmber, $Width * 0.78, $Height * 0.15, 16, 16)
  $graphics.FillEllipse($dotBrushAmber, $Width * 0.18, $Height * 0.72, 10, 10)
  $dotBrushAmber.Dispose()

  $dotBrushLight = [System.Drawing.SolidBrush]::new((New-Color 112 255 255 255))
  $graphics.FillEllipse($dotBrushLight, $Width * 0.12, $Height * 0.64, 12, 12)
  $graphics.FillEllipse($dotBrushLight, $Width * 0.66, $Height * 0.78, 8, 8)
  $dotBrushLight.Dispose()

  $vignette = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    $rect,
    ([System.Drawing.Color]::FromArgb(0, 0, 0, 0)),
    ([System.Drawing.Color]::FromArgb(36, 0, 0, 0)),
    90
  )
  $graphics.FillRectangle($vignette, $rect)
  $vignette.Dispose()

  $bitmap.Save($fullOutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
}
finally {
  $graphics.Dispose()
  $bitmap.Dispose()
}

Write-Output "Generated $fullOutputPath"
