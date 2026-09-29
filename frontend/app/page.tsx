import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import GroupCall from "@/components/GroupCall";
import { COMPARISON, SITE, STEPS, SUBJECTS } from "@/lib/site";
import Logo from "@/components/Logo";

export default function Home() {
  return (
    <>
      {/* ---------- Первый экран: синий блок во всю ширину ---------- */}
      <div className="overflow-hidden rounded-b-[2.5rem] bg-ultra text-white">
        <div className="container-page">
          <SiteHeader />

          <section className="grid items-center gap-14 pt-8 pb-20 lg:grid-cols-[1.15fr_1fr] lg:pt-14 lg:pb-28">
            <div>
              <h1 className="font-display text-[2.75rem] leading-[1.02] sm:text-6xl lg:text-[5.25rem]">
                ЕГЭ проще, когда вас шестеро
              </h1>
              <p className="mt-6 max-w-[40ch] text-lg leading-relaxed text-white/85 md:text-xl">
                Мини-группы по информатике, физике и профильной математике. Преподаватель
                знает тебя по имени, а не по нику в чате на тысячу человек.
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-5">
                <Link href="/quiz" className="btn btn-sun">
                  Подобрать курс
                </Link>
                <Link href="/prices" className="nav-link text-lg">
                  Посмотреть цены
                </Link>
              </div>
            </div>

            <div className="relative lg:pl-6">
              <GroupCall />
              {/* Стикеры: на телефоне идут строкой под карточкой, на компьютере облепляют её */}
              <div className="mt-6 flex flex-wrap gap-3 lg:mt-0">
                <span className="sticker -rotate-6 bg-bubble lg:absolute lg:-top-6 lg:left-0">
                  до 6 человек
                </span>
                <span className="sticker rotate-3 bg-sun lg:absolute lg:-bottom-5 lg:left-10">
                  домашка с разбором
                </span>
                <span className="sticker -rotate-3 bg-mint lg:absolute lg:top-1/2 lg:-left-6">
                  свой препод
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>

      <main className="container-page">
        {/* ---------- Поток против группы ---------- */}
        <section className="py-20 md:py-28">
          <h2 className="font-display max-w-[18ch] text-3xl leading-tight md:text-5xl">
            Не поток на тысячу, а своя компания
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl border-2 border-dashed border-muted/50 p-7 md:p-9">
              <h3 className="text-xl font-bold text-muted">В большом потоке</h3>
              <ul className="mt-5 space-y-4 text-lg text-muted">
                {COMPARISON.crowd.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span aria-hidden="true">✕</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="card bg-ultra p-7 text-white md:p-9">
              <h3 className="text-xl font-bold">В группе из шести</h3>
              <ul className="mt-5 space-y-4 text-lg">
                {COMPARISON.group.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="text-sun" aria-hidden="true">
                      ✓
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ---------- Предметы ---------- */}
        <section id="subjects" className="scroll-mt-8 pb-20 md:pb-28">
          <h2 className="font-display text-3xl md:text-5xl">Предметы</h2>
          <ul className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3 md:gap-6">
            {SUBJECTS.map((subject) => (
              <li
                key={subject.id}
                className={`card subject-card p-7 ${subject.color} ${subject.tilt}`}
              >
                <h3 className="font-display text-2xl leading-tight">{subject.name}</h3>
                <p className="mt-4 text-lg leading-relaxed">{subject.text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ---------- Как это работает (это последовательность, поэтому с номерами) ---------- */}
        <section id="how" className="scroll-mt-8 pb-20 md:pb-28">
          <h2 className="font-display text-3xl md:text-5xl">Как это работает</h2>
          <ol className="mt-12 grid gap-10 md:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            {STEPS.map((step, i) => (
              <li key={step.title}>
                <span className="font-display text-6xl text-ultra" aria-hidden="true">
                  {i + 1}
                </span>
                <h3 className="mt-3 text-xl font-bold">{step.title}</h3>
                <p className="mt-2 text-lg leading-relaxed text-muted">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------- Призыв к опросу ---------- */}
        <section className="pb-20 md:pb-28">
          <div className="card flex flex-col items-start gap-8 bg-sun p-8 md:flex-row md:items-center md:justify-between md:p-12">
            <div>
              <h2 className="font-display text-3xl leading-tight md:text-4xl">
                Не знаешь, какой курс твой?
              </h2>
              <p className="mt-3 max-w-[44ch] text-lg">
                Ответь на несколько вопросов, и мы посоветуем курс по предмету и уровню.
              </p>
            </div>
            <Link href="/quiz" className="btn btn-ultra shrink-0">
              Пройти опрос
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t-2 border-ink">
        <div className="container-page flex flex-col gap-4 py-10 md:flex-row md:items-center md:justify-between">
          <Logo variant="ultra" />
          <div className="flex flex-wrap gap-6 text-muted">
            <a href={SITE.contacts.telegram} className="nav-link">
              Телеграм
            </a>
            <a href={`mailto:${SITE.contacts.email}`} className="nav-link">
              {SITE.contacts.email}
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
