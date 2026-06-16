"use client";

// Minimal stroke-icon set (24x24) matching the Netomi design language.
const PATHS: Record<string, React.ReactNode> = {
  sidebar: (<><rect x="3" y="4" width="18" height="16" rx="2" /><line x1="9" y1="4" x2="9" y2="20" /></>),
  collapse: (<><polyline points="13 6 7 12 13 18" /><line x1="17" y1="6" x2="17" y2="18" /></>),
  chevRight: <polyline points="9 6 15 12 9 18" />,
  chevDown: <polyline points="6 9 12 15 18 9" />,
  check: <polyline points="20 6 9 17 4 12" />,
  help: (<><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .9-1 1.7" /><line x1="12" y1="17" x2="12" y2="17" /></>),
  bot: (<><rect x="4" y="8" width="16" height="11" rx="3" /><line x1="12" y1="4" x2="12" y2="8" /><circle cx="9" cy="13" r="1" /><circle cx="15" cy="13" r="1" /></>),
  copy: (<><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></>),
  chat: <path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z" />,
  mic: (<><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><line x1="12" y1="18" x2="12" y2="21" /></>),
  speaker: (<><path d="M4 9v6h4l5 4V5L8 9H4z" /><path d="M16 9a3 3 0 0 1 0 6" /></>),
  sliders: (<><line x1="4" y1="8" x2="20" y2="8" /><circle cx="9" cy="8" r="2.3" /><line x1="4" y1="16" x2="20" y2="16" /><circle cx="15" cy="16" r="2.3" /></>),
  wave: (<><line x1="4" y1="10" x2="4" y2="14" /><line x1="8" y1="7" x2="8" y2="17" /><line x1="12" y1="4" x2="12" y2="20" /><line x1="16" y1="7" x2="16" y2="17" /><line x1="20" y1="10" x2="20" y2="14" /></>),
  phone: <path d="M5 4h3l2 5-2 1a11 11 0 0 0 5 5l1-2 5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />,
  headset: (<><path d="M5 13a7 7 0 0 1 14 0" /><rect x="3" y="13" width="4" height="6" rx="1.5" /><rect x="17" y="13" width="4" height="6" rx="1.5" /><path d="M19 19a3 3 0 0 1-3 3h-2" /></>),
  transcript: (<><rect x="4" y="4" width="16" height="16" rx="2" /><line x1="8" y1="9" x2="16" y2="9" /><line x1="8" y1="13" x2="14" y2="13" /></>),
  info: (<><circle cx="12" cy="12" r="9" /><line x1="12" y1="11" x2="12" y2="16" /><line x1="12" y1="8" x2="12" y2="8" /></>),
  cog: (<><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></>),
  monitor: (<><rect x="3" y="4" width="18" height="12" rx="2" /><line x1="8" y1="20" x2="16" y2="20" /></>),
  palette: (<><path d="M12 3a9 9 0 1 0 0 18c1 0 1.5-.8 1.5-1.5 0-1.5 1-2 2.5-2H18a3 3 0 0 0 3-3 9 9 0 0 0-9-9z" /><circle cx="7.5" cy="11" r="1" /><circle cx="12" cy="8" r="1" /><circle cx="16" cy="11" r="1" /></>),
  code: <polyline points="8 7 4 12 8 17 M16 7 20 12 16 17" />,
  integration: (<><rect x="9" y="3" width="6" height="5" rx="1" /><rect x="3" y="16" width="6" height="5" rx="1" /><rect x="15" y="16" width="6" height="5" rx="1" /><path d="M12 8v4M6 16v-2h12v2" /></>),
  list: (<><line x1="9" y1="7" x2="20" y2="7" /><line x1="9" y1="12" x2="20" y2="12" /><line x1="9" y1="17" x2="20" y2="17" /><circle cx="4.5" cy="7" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="17" r="1" /></>),
  gauge: (<><path d="M4 18a8 8 0 1 1 16 0" /><line x1="12" y1="14" x2="16" y2="10" /></>),
  doc: (<><path d="M7 3h7l4 4v14H7z" /><polyline points="14 3 14 7 18 7" /><line x1="9.5" y1="12" x2="15" y2="12" /><line x1="9.5" y1="16" x2="15" y2="16" /></>),
  hand: (<><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11" /><path d="M12 11V4.5a1.5 1.5 0 0 1 3 0V11" /><path d="M15 11V6.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-1a6 6 0 0 1-5.2-3l-2-3.4a1.5 1.5 0 0 1 2.4-1.8L9 12" /></>),
};

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const path = PATHS[name];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      {path ?? <circle cx="12" cy="12" r="3" />}
    </svg>
  );
}
