// Логотип: монограмма Б² в стикере и название рядом.
// variant="sun" — жёлтый стикер для синего фона, variant="ultra" — синий для светлого.

import { SITE } from "@/lib/site";

type Props = {
  variant?: "sun" | "ultra";
};

export default function Logo({ variant = "ultra" }: Props) {
  return (
    <span className="flex items-center gap-3">
      <span className={`logo-mark logo-mark-${variant}`} aria-hidden="true">
        <span>Б</span>
        <sup>2</sup>
      </span>
      <span className="font-display text-2xl">{SITE.name}</span>
    </span>
  );
}
