const paths = {
  arrow: <path d="M5 12h14M13 6l6 6-6 6"/>,
  diagonal: <path d="M6 18 18 6M6 6h12v12"/>,
  chevron: <path d="m6 9 6 6 6-6"/>,
  menu: <path d="M4 6h16M4 12h16M4 18h16"/>,
  close: <path d="m6 6 12 12M6 18 18 6"/>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>,
  phone: <path d="m8 3 3 5-2 2a15 15 0 0 0 5 5l2-2 5 3-1 4c-1 3-8-1-12-5S0 4 4 3Z"/>,
  pin: <><path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/></>,
  chart: <><path d="M4 3v17h17M8 15v-4M13 15V7M18 15v-6"/></>,
  document: <><path d="M14 3H5v18h14V8Z"/><path d="M14 3v5h5M8 12h8M8 16h6"/></>,
  briefcase: <><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V3h8v4M3 12c5 3 13 3 18 0M12 12v4"/></>,
  people: <><circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5v2"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  home: <path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-7h6v7"/>,
  image: <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m21 15-6-6L3 21"/></>,
  palette: <><path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-4c-1-1 0-3 2-3h2a3 3 0 0 0 3-3 9 9 0 0 0-9-8Z"/><path d="M7 9h.01M11 6h.01M16 8h.01M6 14h.01"/></>,
  settings: <><path d="m10 3-.5 3-2 .8L5 5 3 8l2 2-.2 3-2 1 2 4 3-1 2 1 1 3h4l.5-3 2-.8L19 19l2-4-2-2 .2-3 2-1-2-4-3 1-2-1-1-2Z"/><circle cx="12" cy="12" r="3"/></>,
  help: <><circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3M12 17h.01"/></>,
  refresh: <path d="M20 7v5h-5M4 17v-5h5M20 12a8 8 0 0 0-14-5M4 12a8 8 0 0 0 14 5"/>,
  edit: <path d="m16 3 5 5-12 12-6 1 1-6Z M13 6l5 5"/>,
};

export default function Icon({ name = 'arrow', size = 24, className = '', ...props }) {
  return <svg className={`icon ${className}`.trim()} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>{paths[name] || paths.document}</svg>;
}
