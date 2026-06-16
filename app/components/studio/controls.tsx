"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import type { Option, ModelGroup } from "../../lib/agentConfig";

/* ---------------- Toggle ---------------- */
export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" className="tgl" data-on={!!on} role="switch" aria-checked={!!on}
      onClick={() => onChange(!on)} />
  );
}

/* ---------------- TextArea ---------------- */
export function TextArea({ value, onChange, rows = 4 }: { value: string; onChange: (v: string) => void; rows?: number }) {
  return <textarea className="inp" rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />;
}

/* ---------------- TextField ---------------- */
export function TextField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input className="inp" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

type SelectProps = {
  value: string;
  onChange: (v: string) => void;
  options?: Option[];
  groups?: ModelGroup[];
  placeholder?: string;
};

/* ---------------- Select (custom dropdown, supports optgroups) ---------------- */
export function Select({ value, onChange, options, groups, placeholder }: SelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const flat: Option[] = options ?? (groups ? groups.flatMap((g) => g.options) : []);
  const current = flat.find((o) => o.value === value);
  const label = current?.label ?? (value || placeholder || "Select…");

  const renderOpt = (o: Option) => (
    <div key={o.value} className="sel__opt" data-on={o.value === value}
      onClick={() => { onChange(o.value); setOpen(false); }}>
      <span>{o.label}</span>
      {o.value === value && <span className="check"><Icon name="check" size={15} /></span>}
    </div>
  );

  return (
    <div className="sel" ref={ref}>
      <button type="button" className="sel__btn" data-open={open} onClick={() => setOpen((v) => !v)}>
        <span className="sel__btn-txt">{label}</span>
        <span className="sel__chev"><Icon name="chevDown" size={16} /></span>
      </button>
      {open && (
        <div className="sel__menu">
          {groups
            ? groups.map((g) => (
                <div key={g.group}>
                  <div className="sel__grp">{g.group}</div>
                  {g.options.map(renderOpt)}
                </div>
              ))
            : (options ?? []).map(renderOpt)}
        </div>
      )}
    </div>
  );
}

/* ---------------- Field row wrapper ---------------- */
export function FieldRow({ label, help, wide, children }: {
  label: string; help?: string; wide?: boolean; children: React.ReactNode;
}) {
  return (
    <div className={`fld${wide ? " fld--wide" : ""}`}>
      <div>
        <div className="fld__label">{label}</div>
        {help && <div className="fld__help">{help}</div>}
      </div>
      <div className="fld__control">{children}</div>
    </div>
  );
}
