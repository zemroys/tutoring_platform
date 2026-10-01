import type { OrderStatus } from "@/lib/api";

const LABELS: Record<OrderStatus, { text: string; color: string }> = {
  pending: { text: "Ждёт оплаты", color: "bg-sun" },
  paid: { text: "Оплачен", color: "bg-mint" },
  cancelled: { text: "Отменён", color: "bg-white" },
};

export default function OrderBadge({ status }: { status: OrderStatus }) {
  const { text, color } = LABELS[status];
  return <span className={`status-badge ${color}`}>{text}</span>;
}
