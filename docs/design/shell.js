// Association console shells for the three board directions.
// Usage: <div data-shell="review" data-dir="a"></div>
// dir "a" = Workhorse sidebar (put inside a flex body: <body class="flex">)
// dir "b" = Focus top nav   (body block, content centered)
// dir "c" = Board chip nav  (body block, full width)
const NAV = [
  { id: "dashboard", label: "Dashboard", href: "10-dashboard.html" },
  { id: "review", label: "Review", href: "11-review.html", count: 12 },
  { id: "offers", label: "Offers nearby", href: "19-offers.html", count: 24 },
  { id: "reception", label: "Reception", href: "15-reception.html", count: 7 },
  { id: "stock", label: "Stock", href: "20-stock.html" },
  { id: "needs", label: "Needs", href: "12-needs.html" },
  { id: "capacity", label: "Capacity", href: "13-capacity.html" },
  { id: "slots", label: "Slots", href: "14-slots.html" },
  { id: "images", label: "Images", href: "16-images.html" },
];

const demoTag = '<span class="w-fit chip bg-sand-4 text-sand-11">Demo</span>';
const menuBtn = '<button aria-label="Menu" class="md:hidden -mr-[10px] w-11 h-11 grid place-items-center"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>';
const count = (n, on) => (n ? `<span class="num text-meta ${on ? "text-grass-3" : "text-sand-11"} font-normal">${n}</span>` : "");

function shellA(active) {
  const current = NAV.find((n) => n.id === active);
  const items = NAV.map((n) => {
    const on = n.id === active;
    return `<a href="${n.href}" ${on ? 'aria-current="page"' : ""} class="h-8 px-2 rounded-[6px] flex items-center justify-between ${on ? "bg-sand-4 font-medium" : "hover:bg-sand-3 transition-colors duration-250 ease-out"}">${n.label}${n.count ? `<span class="num text-sand-11 font-normal">${n.count}</span>` : ""}</a>`;
  }).join("");
  return `
  <aside class="hidden md:flex w-56 shrink-0 bg-sand-2 border-r-hair border-sand-6 p-3 flex-col">
    <div class="px-2 h-10 flex items-center font-semibold">Secours Populaire Paris 11</div>
    <div class="px-2 mb-4">${demoTag}</div>
    <nav class="space-y-0.5">${items}</nav>
    <div class="mt-auto px-2"><p class="font-medium">Léa Martin</p><p class="text-meta text-sand-11">Staff</p></div>
  </aside>
  <div class="md:hidden sticky top-0 z-10 h-12 px-4 flex items-center justify-between border-b-hair border-sand-6 bg-sand-2">
    <span class="font-semibold">${current ? current.label : ""}</span>
    <span class="flex items-center gap-2">${demoTag}${menuBtn}</span>
  </div>`;
}

function shellB(active) {
  const links = NAV.map((n) => {
    const on = n.id === active;
    return `<a href="${n.href}" ${on ? 'aria-current="page"' : ""} class="h-14 px-3 inline-flex items-center gap-1.5 whitespace-nowrap ${on ? "font-medium border-b-2 border-grass-9 -mb-[0.5px]" : "text-sand-11 hover:text-sand-12 transition-colors duration-250 ease-out"}">${n.label}${n.count ? `<span class="num text-meta text-sand-11 font-normal">${n.count}</span>` : ""}</a>`;
  }).join("");
  return `
  <header class="border-b-hair border-sand-6 bg-sand-1">
    <div class="max-w-[1120px] mx-auto px-5 flex items-center justify-between gap-4">
      <div class="h-14 flex items-center gap-2 shrink-0"><span class="font-semibold">Secours Populaire Paris 11</span>${demoTag}</div>
      <nav class="hidden md:flex items-center self-end overflow-x-auto">${links}</nav>
      <div class="h-14 flex items-center gap-3 shrink-0"><span class="hidden sm:block text-meta text-sand-11 leading-4">Léa Martin<span class="block text-sand-11">Staff</span></span><span class="w-8 h-8 rounded-full bg-sand-3 text-meta font-medium grid place-items-center">LM</span>${menuBtn}</div>
    </div>
  </header>`;
}

function shellC(active) {
  const chips = NAV.map((n) => {
    const on = n.id === active;
    return `<a href="${n.href}" ${on ? 'aria-current="page"' : ""} class="h-8 px-3 rounded-[16px] inline-flex items-center gap-1.5 whitespace-nowrap ${on ? "bg-grass-9 text-white font-medium" : "bg-sand-3 text-sand-12 hover:bg-sand-4 transition-colors duration-250 ease-out"}">${n.label}${count(n.count, on)}</a>`;
  }).join("");
  return `
  <header class="border-b-hair border-sand-6 bg-sand-2">
    <div class="max-w-[1360px] mx-auto px-5 h-14 flex items-center justify-between gap-4">
      <span class="font-semibold text-grass-11 shrink-0">dono</span>
      <nav class="hidden md:flex items-center gap-2 overflow-x-auto">${chips}</nav>
      <div class="shrink-0 flex items-center gap-3"><span class="hidden lg:block text-meta text-sand-11">Secours Populaire Paris 11 — Léa Martin</span><span class="w-8 h-8 rounded-full bg-sand-4 text-meta font-medium grid place-items-center">LM</span>${menuBtn}</div>
    </div>
  </header>`;
}

const renderShell = () => {
  document.querySelectorAll("[data-shell]").forEach((el) => {
    const dir = el.dataset.dir || "a";
    el.outerHTML = ({ a: shellA, b: shellB, c: shellC })[dir](el.dataset.shell);
  });
};
// Safe whether loaded in <head> or at the end of <body>.
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", renderShell);
else renderShell();
