import type { Metadata } from "next";
import Link from "next/link";
import PageTop from "@/components/PageTop";
import { CATALOG, INCLUDED, LEVELS, formatPrice, type LevelId } from "@/lib/courses";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: `Цены | ${SITE.name}`,
  description: "Стоимость подготовки к ЕГЭ в мини-группах: оплата помесячно за каждый предмет.",
};

const LEVEL_ORDER: LevelId[] = ["base", "advanced"];

export default function PricesPage() {
  return (
    <>
      <PageTop
        title="Цены"
        lead="Оплата помесячно за каждый предмет. Уровень группы подбираем по твоим баллам на пробниках."
      />

      <main className="container-page py-16 md:py-20">
        <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {CATALOG.map((subject) => (
            <li key={subject.id} className="card flex flex-col bg-white p-7">
              <h2 className="font-display text-2xl leading-tight">{subject.name}</h2>
              <dl className="mt-6 flex flex-col gap-5">
                {LEVEL_ORDER.filter((level) => subject.prices[level] !== undefined).map((level) => (
                  <div key={level}>
                    <dt className="flex items-baseline justify-between gap-4">
                      <span className="font-semibold">{LEVELS[level].name}</span>
                      <span className="text-xl font-bold whitespace-nowrap">
                        {formatPrice(subject.prices[level]!)}
                        <span className="text-base font-normal text-muted"> / мес</span>
                      </span>
                    </dt>
                    <dd className="mt-1 text-sm text-muted">{LEVELS[level].text}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>

        <section className="mt-20 grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl">Что входит</h2>
            <ul className="mt-6 flex flex-col gap-3 text-lg">
              {INCLUDED.map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="font-bold text-ultra" aria-hidden="true">
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="card flex flex-col items-start justify-center gap-5 bg-sun p-8">
            <h2 className="font-display text-2xl leading-tight md:text-3xl">
              Не знаешь, какой уровень твой?
            </h2>
            <p className="text-lg">
              Ответь на несколько вопросов, и мы посоветуем группу по каждому предмету.
            </p>
            <Link href="/quiz" className="btn btn-ultra">
              Подобрать курс
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
