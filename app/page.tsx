"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ConnectionDetails } from "./api/connection-details/route";
import { type AgentConfig, defaultAgentConfig } from "./lib/agentConfig";
import { SECTION_GROUPS } from "./lib/sections";
import { NavHeader, SideNav, WorkHead } from "./components/studio/Shell";
import { SectionRail } from "./components/studio/SectionRail";
import { SectionEditor } from "./components/studio/SectionEditor";
import { TestPanel } from "./components/studio/TestPanel";

export default function Page() {
  // config: live edits (values) vs last-saved snapshot (saved)
  const [values, setValues] = useState<AgentConfig>(defaultAgentConfig);
  const [saved, setSaved] = useState<AgentConfig>(defaultAgentConfig);

  // shell / navigation
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [activeSection, setActiveSection] = useState("integration");

  // call lifecycle
  const [connectionDetails, setConnectionDetails] = useState<ConnectionDetails | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [endedRoom, setEndedRoom] = useState<string | null>(null);

  // load + persist config
  useEffect(() => {
    try {
      const raw = localStorage.getItem("agentConfig");
      if (raw) {
        const merged = { ...defaultAgentConfig, ...JSON.parse(raw) };
        setValues(merged);
        setSaved(merged);
      }
    } catch { /* ignore */ }
  }, []);

  const setVal = useCallback((k: keyof AgentConfig, v: AgentConfig[keyof AgentConfig]) => {
    setValues((s) => {
      const next = { ...s, [k]: v };
      // changing TTS provider invalidates the voice id
      if (k === "ttsModel") {
        const oldP = s.ttsModel.split("/")[0];
        const newP = String(v).split("/")[0];
        if (oldP !== newP) next.ttsVoice = "";
      }
      return next;
    });
  }, []);

  const dirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(saved),
    [values, saved],
  );

  const save = useCallback(() => {
    setSaved(values);
    try { localStorage.setItem("agentConfig", JSON.stringify(values)); } catch { /* ignore */ }
  }, [values]);

  const discard = useCallback(() => setValues(saved), [saved]);

  // resolve active section + its group label
  const { section, eyebrow } = useMemo(() => {
    for (const g of SECTION_GROUPS) {
      const found = g.items.find((it) => it.id === activeSection);
      if (found) return { section: found, eyebrow: g.group };
    }
    const first = SECTION_GROUPS[0].items[0];
    return { section: first, eyebrow: SECTION_GROUPS[0].group };
  }, [activeSection]);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    setEndedRoom(null);
    try {
      const res = await fetch("/api/connection-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: values }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to get token");
      setConnectionDetails(data as ConnectionDetails);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setConnecting(false);
    }
  }, [values]);

  const onDisconnected = useCallback(() => {
    setConnectionDetails((cur) => {
      if (cur) setEndedRoom(cur.roomName);
      return null;
    });
  }, []);

  return (
    <div className="app" data-nav-collapsed={navCollapsed}>
      <div className="app__header">
        <NavHeader onToggleNav={() => setNavCollapsed((v) => !v)} />
      </div>
      <div className="app__nav"><SideNav /></div>
      <div className="app__main">
        <WorkHead />
        <div className="panes">
          <SectionRail
            groups={SECTION_GROUPS}
            active={activeSection}
            onSelect={setActiveSection}
            collapsed={railCollapsed}
            onToggleCollapse={() => setRailCollapsed((v) => !v)}
          />
          <div className="editor">
            <SectionEditor section={section} eyebrow={eyebrow} values={values} setVal={setVal} />
          </div>
          <TestPanel
            config={values}
            connectionDetails={connectionDetails}
            connecting={connecting}
            error={error}
            endedRoom={endedRoom}
            onStart={connect}
            onDisconnected={onDisconnected}
          />
        </div>

        <div className="savebar">
          <span className="savebar__dot" data-clean={!dirty} />
          <span className="savebar__txt">
            {dirty ? <>Unsaved changes <span>· applied to the next call you start</span></> : <span>All changes saved</span>}
          </span>
          <div className="savebar__spacer" />
          <button className="btn btn--ghost" disabled={!dirty} onClick={discard}>Discard</button>
          <button className="btn btn--primary" disabled={!dirty} onClick={save}>Save changes</button>
        </div>
      </div>
    </div>
  );
}
