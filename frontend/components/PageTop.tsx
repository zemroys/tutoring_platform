// Синяя шапка для внутренних страниц сайта: логотип, меню и заголовок страницы.

import SiteHeader from "@/components/SiteHeader";

type Props = {
  title: string;
  lead?: string;
};

export default function PageTop({ title, lead }: Props) {
  return (
    <div className="rounded-b-[2.5rem] bg-ultra text-white">
      <div className="container-page">
        <SiteHeader />
        <div className="pt-6 pb-14 md:pt-10 md:pb-20">
          <h1 className="font-display text-4xl leading-tight md:text-6xl">{title}</h1>
          {lead && <p className="mt-5 max-w-[48ch] text-lg text-white/85 md:text-xl">{lead}</p>}
        </div>
      </div>
    </div>
  );
}
