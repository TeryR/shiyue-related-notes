# 调整封面纵向节奏（一次性脚本）
const fs = require("fs");
const p = "release/xhs/gen-xhs.ps1";
let s = fs.readFileSync(p, "utf8");
const reps = [
  ["  # 顶部徽章\n  $badgeFont", "  # 顶部徽章\n  $topAdj = 0\n  if ($card.type -eq \"cover\") { $topAdj = 56 }\n  $badgeFont"],
  ["$badgePath = RoundedPath 76 84 ([int]$bw) 54 27", "$badgePath = RoundedPath 76 (84 + $topAdj) ([int]$bw) 54 27"],
  ["$g.DrawString($badgeText, $badgeFont, (New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)), 100, 95)", "$g.DrawString($badgeText, $badgeFont, (New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)), 100, (95 + $topAdj))"],
  ["  # 标题\n  $y = 200", "  # 标题\n  $y = 200 + $topAdj"],
  ["    if ($card.bigStat) {\n    $y += 48", "    if ($card.bigStat) {\n    $y += 116"],
  ["    $y += [int](112 * 1.25)", "    $y += [int](112 * 1.35)"],
  ["    $y += 70\n  }", "    $y += 110\n  }"],
  ["      $y += 88\n    }", "      $y += 104\n    }"],
  ["$g.DrawString([string]$card.footer, $footerFont, (New-Object System.Drawing.SolidBrush($mutedColor)), $margin, ($H - 70))", "$g.DrawString([string]$card.footer, $footerFont, (New-Object System.Drawing.SolidBrush($mutedColor)), $margin, ($H - 96))"],
];
let count = 0;
for (const [a, b] of reps) {
  if (s.includes(a)) { s = s.replace(a, b); count++; }
  else { console.log("NOT FOUND:", a.slice(0, 60)); }
}
fs.writeFileSync(p, s);
console.log("applied:", count, "/", reps.length);
