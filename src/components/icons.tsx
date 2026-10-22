const P = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const paths: Record<string, React.ReactNode> = {
  dashboard: <><rect x="3" y="3" width="8" height="8" rx="2" {...P} /><rect x="13" y="3" width="8" height="5" rx="2" {...P} /><rect x="13" y="10" width="8" height="11" rx="2" {...P} /><rect x="3" y="13" width="8" height="8" rx="2" {...P} /></>,
  plus: <><circle cx="12" cy="12" r="9" {...P} /><path d="M12 8v8M8 12h8" {...P} /></>,
  list: <><path d="M8 6h13M8 12h13M8 18h13" {...P} /><circle cx="3.5" cy="6" r="1.2" fill="currentColor" /><circle cx="3.5" cy="12" r="1.2" fill="currentColor" /><circle cx="3.5" cy="18" r="1.2" fill="currentColor" /></>,
  box: <><path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" {...P} /><path d="M3 8l9 5 9-5M12 13v8" {...P} /></>,
  upload: <><path d="M12 20V7m0 0 4.5 4.5M12 7 7.5 11.5" {...P} /><path d="M4 18v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" {...P} /></>,
  download: <><path d="M12 3v13m0 0-4.5-4.5M12 16l4.5-4.5" {...P} /><path d="M4 18v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" {...P} /></>,
  gear: <><circle cx="12" cy="12" r="3" {...P} /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" {...P} /></>,
  search: <><circle cx="11" cy="11" r="6.5" {...P} /><path d="m20 20-3.6-3.6" {...P} /></>,
  check: <path d="M4 12.5 9 17l11-11" {...P} strokeWidth={2} />,
  alert: <><path d="M12 3 2 20h20L12 3Z" {...P} /><path d="M12 10v4M12 17v.01" {...P} /></>,
  user: <><circle cx="12" cy="8" r="4" {...P} /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" {...P} /></>,
  logout: <><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" {...P} /></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16" {...P} />,
  edit: <><path d="M4 20h4L19 9l-4-4L4 16v4Z" {...P} /><path d="m13.5 6.5 4 4" {...P} /></>,
  star: <path d="M12 3.5l2.6 5.5 6 .7-4.4 4.1 1.2 6-5.4-3-5.4 3 1.2-6-4.4-4.1 6-.7L12 3.5Z" {...P} />,
  send: <path d="M4 12 20 4l-6 16-3-6-7-2Z" {...P} />,
  trash: <path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m1 0-1 13a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2L7 7" {...P} />,
  info: <><circle cx="12" cy="12" r="9" {...P} /><path d="M12 11v5.5M12 8v.01" {...P} /></>,
};

export function Icon({ name, className = "w-[18px] h-[18px]" }: { name: keyof typeof paths | string; className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true">{paths[name]}</svg>;
}
