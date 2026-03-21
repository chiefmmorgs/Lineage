import { scoreLevelMeta, type ScoreLevel } from "@/lib/ethos";

interface Props {
  score: number;
  level: ScoreLevel;
  size?: "sm" | "md";
}

export default function ScoreBadge({ score, level, size = "md" }: Props) {
  const meta = scoreLevelMeta(level);
  return (
    <span
      className="score-badge"
      style={{
        color: meta.color,
        borderColor: meta.color + "55",
        background: meta.glow,
        fontSize: size === "sm" ? "0.6875rem" : undefined,
      }}
    >
      <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{score}</span>
      <span style={{ opacity: 0.8 }}>{meta.label}</span>
    </span>
  );
}
