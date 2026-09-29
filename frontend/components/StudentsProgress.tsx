// Ученики группы и их активность. Видно только преподавателю группы и админу.

import type { StudentProgress } from "@/lib/api";
import { fullName } from "@/lib/names";

function percentColor(percent: number): string {
  if (percent >= 70) return "bg-mint";
  if (percent >= 40) return "bg-sun";
  return "bg-peach";
}

export default function StudentsProgress({ students }: { students: StudentProgress[] }) {
  if (students.length === 0) {
    return (
      <p className="mt-4 text-muted">Пока никого. Ученики появятся здесь сразу после оплаты курса.</p>
    );
  }

  return (
    <>
      <p className="mt-2 text-muted">
        Всего: {students.length}. Активность считается по принятым домашкам и посещённым вебинарам.
      </p>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {students.map((student) => (
          <li key={student.id} className="rounded-2xl border-2 border-ink bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <span>
                <span className="block font-semibold">
                  {fullName(student.first_name, student.last_name, student.email)}
                </span>
                {student.first_name && (
                  <span className="block text-sm break-all text-muted">{student.email}</span>
                )}
              </span>
              {student.activity_percent !== null && (
                <span className={`status-badge shrink-0 ${percentColor(student.activity_percent)}`}>
                  {student.activity_percent}%
                </span>
              )}
            </div>
            <p className="mt-3 text-sm text-muted">
              Домашки: {student.homework_done} из {student.homework_total}
            </p>
            <p className="text-sm text-muted">
              Вебинары: {student.webinars_attended} из {student.webinars_total}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
