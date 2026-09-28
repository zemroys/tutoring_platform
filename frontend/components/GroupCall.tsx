// Главная картинка первого экрана: «созвон» группы, где одно место свободно.
// Плитки появляются по очереди при загрузке (анимация в globals.css).

import { GROUP } from "@/lib/site";

export default function GroupCall() {
  return (
    <div className="card rotate-1 bg-white p-4 text-ink sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="font-semibold">Твоя группа по физике</p>
        <span className="rounded-full border-2 border-ink bg-mint px-3 py-0.5 text-sm font-semibold">
          5 из 6
        </span>
      </div>

      <ul className="grid grid-cols-3 gap-3">
        {GROUP.map((member, i) => (
          <li
            key={member.name}
            className={`tile ${member.color}`}
            style={{ "--i": i } as React.CSSProperties}
          >
            <span className="text-4xl sm:text-5xl" aria-hidden="true">
              {member.emoji}
            </span>
            <span className="text-sm font-semibold">{member.name}</span>
          </li>
        ))}

        {/* Свободное место: мягко пульсирует, чтобы притянуть взгляд */}
        <li className="tile tile-empty" style={{ "--i": GROUP.length } as React.CSSProperties}>
          <span className="text-4xl leading-none font-light sm:text-5xl" aria-hidden="true">
            +
          </span>
          <span className="text-center text-sm font-semibold">Твоё место</span>
        </li>
      </ul>
    </div>
  );
}
