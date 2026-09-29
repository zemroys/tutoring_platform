import type { SubmissionStatus } from "@/lib/api";

const LABELS: Record<SubmissionStatus | "none", { text: string; color: string }> = {
  none: { text: "Не сдано", color: "bg-white" },
  submitted: { text: "На проверке", color: "bg-sky" },
  accepted: { text: "Принято", color: "bg-mint" },
  returned: { text: "На доработку", color: "bg-peach" },
};

export default function StatusBadge({ status }: { status: SubmissionStatus | "none" }) {
  const { text, color } = LABELS[status];
  return <span className={`status-badge ${color}`}>{text}</span>;
}
