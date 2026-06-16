"use client";

import { Toggle, TextArea, Select, FieldRow } from "./controls";
import type { Section, Field } from "../../lib/sections";
import { type AgentConfig, type Option, VOICES_BY_PROVIDER } from "../../lib/agentConfig";

function voiceOptions(ttsModel: string, current: string): Option[] {
  const provider = ttsModel.split("/")[0];
  const voices = VOICES_BY_PROVIDER[provider] ?? [];
  const opts: Option[] = [{ value: "", label: "Provider default" }, ...voices];
  // keep a saved/custom value selectable
  if (current && !opts.some((o) => o.value === current)) {
    opts.push({ value: current, label: `Custom: ${current}` });
  }
  return opts;
}

function Control({ field, values, setVal }: {
  field: Field;
  values: AgentConfig;
  setVal: (k: keyof AgentConfig, v: AgentConfig[keyof AgentConfig]) => void;
}) {
  const key = field.key;
  if (!key) return null;
  const value = values[key];
  switch (field.kind) {
    case "textarea":
      return <TextArea value={value as string} rows={field.rows} onChange={(v) => setVal(key, v)} />;
    case "toggle":
      return <Toggle on={value as boolean} onChange={(v) => setVal(key, v)} />;
    case "select":
      return <Select value={value as string} options={field.options} onChange={(v) => setVal(key, v)} />;
    case "modelselect":
      return <Select value={value as string} groups={field.groups} onChange={(v) => setVal(key, v)} />;
    case "voice":
      return (
        <Select value={value as string}
          options={voiceOptions(values.ttsModel, value as string)}
          onChange={(v) => setVal(key, v)} />
      );
    default:
      return null;
  }
}

export function SectionEditor({ section, eyebrow, values, setVal }: {
  section: Section;
  eyebrow: string;
  values: AgentConfig;
  setVal: (k: keyof AgentConfig, v: AgentConfig[keyof AgentConfig]) => void;
}) {
  return (
    <>
      <div className="ed-eyebrow">{eyebrow}</div>
      <div className="ed-titlerow">
        <h2 className="ed-title">{section.title}</h2>
      </div>
      <p className="ed-sub">{section.desc}</p>

      <div className="card">
        <div className="card-body">
          <div className="acc__fields">
            {section.fields.map((f) =>
              f.kind === "subhead" ? (
                <div key={f.label} className="subgroup__label">{f.label}</div>
              ) : (
                <FieldRow key={f.key} label={f.label} help={f.help} wide={f.wide}>
                  <Control field={f} values={values} setVal={setVal} />
                </FieldRow>
              ),
            )}
          </div>
        </div>
      </div>
    </>
  );
}
