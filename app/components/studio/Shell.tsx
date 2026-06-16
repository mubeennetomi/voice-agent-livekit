"use client";

import { useState } from "react";
import { Icon } from "./Icon";

export function NavHeader({ onToggleNav }: { onToggleNav: () => void }) {
  return (
    <header className="navhdr">
      <button className="navhdr__icon" aria-label="Toggle sidebar" onClick={onToggleNav}>
        <Icon name="sidebar" size={18} />
      </button>
      <div className="navhdr__brand">
        <span className="dot"><Icon name="bot" size={14} /></span>
        Netomi AI Studio
      </div>
      <nav className="navhdr__tabs">
        <button className="navhdr__tab" data-active="true">AI Agent</button>
        <button className="navhdr__tab">Organization</button>
      </nav>
      <div className="navhdr__spacer" />
      <button className="navhdr__help" aria-label="Help"><Icon name="help" size={22} /></button>
      <div className="navhdr__avatar">MM</div>
    </header>
  );
}

const NAV = [
  { label: "Channel", open: true, items: [
    { label: "Chat Look & Feel", icon: "palette" },
    { label: "Chat Installation", icon: "code" },
    { label: "Voice", icon: "mic", active: true },
  ] },
  { label: "Control", open: false, items: [
    { label: "LLM Capabilities", icon: "sliders" },
    { label: "Experience", icon: "monitor" },
  ] },
  { label: "Settings", open: false, items: [
    { label: "AI Agent Configuration", icon: "cog" },
  ] },
];

export function SideNav() {
  const [openMap, setOpenMap] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    NAV.forEach((n) => (m[n.label] = n.open));
    return m;
  });
  return (
    <nav className="sidebar">
      <div className="agentcard">
        <div className="agentcard__icon"><Icon name="bot" size={22} /></div>
        <div className="agentcard__txt">
          <div className="agentcard__name">Default Sample Bot</div>
          <div className="agentcard__id">ID: a234c90b… <Icon name="copy" size={12} /></div>
        </div>
      </div>
      {NAV.map((n) => {
        const open = openMap[n.label];
        return (
          <div className="nav__section" key={n.label}>
            <div className="nav__sechead" data-open={open}
              onClick={() => setOpenMap((m) => ({ ...m, [n.label]: !m[n.label] }))}>
              {n.label}<span className="chev"><Icon name="chevDown" size={16} /></span>
            </div>
            {open && n.items.map((it) => (
              <div className="nav__item" key={it.label} data-active={!!it.active}>
                <Icon name={it.icon} size={17} /><span>{it.label}</span>
              </div>
            ))}
          </div>
        );
      })}
    </nav>
  );
}

export function WorkHead() {
  return (
    <div className="work-head">
      <div className="work-head__row">
        <div>
          <h1 className="work-head__title">Voice</h1>
          <p className="work-head__sub">Configure what your voice agent says and how it behaves on calls.</p>
        </div>
        <div className="work-head__actions">
          <div className="envseg">
            <button data-on="true">Staging</button>
            <button>Production</button>
          </div>
        </div>
      </div>
    </div>
  );
}
