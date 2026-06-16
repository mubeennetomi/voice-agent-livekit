"use client";

import { Icon } from "./Icon";
import type { Group } from "../../lib/sections";

export function SectionRail({ groups, active, onSelect, collapsed, onToggleCollapse }: {
  groups: Group[];
  active: string;
  onSelect: (id: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  return (
    <nav className={"rail" + (collapsed ? " mini" : "")}>
      <div className="rail-top">
        <span className="rail-top__lbl">Configuration</span>
        <button className="rail-top__btn" onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand" : "Collapse"}>
          <Icon name={collapsed ? "chevRight" : "collapse"} size={16} />
        </button>
      </div>
      {groups.map((g) => (
        <div key={g.group} className="rail-grp">
          <div className="rail-grplbl">{g.group}</div>
          {g.items.map((it) => (
            <button key={it.id} className="ritem" data-on={active === it.id}
              onClick={() => onSelect(it.id)} title={it.title}>
              <Icon name={it.icon} size={16} />
              <span className="ritem__txt">{it.title}</span>
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}
