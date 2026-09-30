import { useState, type ReactNode } from "react";
import {
  Activity, AlertTriangle, Bell, BookOpenCheck, Check, CheckCircle2, ChevronLeft,
  ChevronRight, CircleDot, ClipboardCheck, Clock3, Database, Eye, FileClock, Filter,
  Gauge, KeyRound, LayoutDashboard, ListFilter, LockKeyhole, Menu, Network, PanelLeftClose,
  PanelLeftOpen, Plus, RefreshCw, Search, Send, Shield, ShieldAlert, ShieldCheck, Signpost,
  Siren, TerminalSquare, UserCog, Users, XCircle, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type Screen = "dashboard" | "events" | "alerts" | "incidents" | "notifications" | "audit" | "access";
type Tone = "low" | "medium" | "high" | "critical" | "new" | "investigating" | "contained" | "resolved" | "dismissed" | "neutral";

const navigation: { id: Screen; label: string; icon: typeof Activity; count?: number }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "events", label: "Events", icon: Activity, count: 1842 },
  { id: "alerts", label: "Alerts", icon: ShieldAlert, count: 16 },
  { id: "incidents", label: "Incidents", icon: Siren, count: 5 },
  { id: "notifications", label: "Notifications", icon: Bell, count: 3 },
  { id: "audit", label: "Audit", icon: FileClock },
  { id: "access", label: "Access", icon: UserCog },
];

const titles: Record<Screen, [string, string]> = {
  dashboard: ["Security operations overview", "Documented security activity and analyst-reported outcomes across the last 24 hours."],
  events: ["Security events", "Normalized telemetry records available for deterministic review and correlation."],
  alerts: ["Detection alerts", "Rule-generated detections awaiting analyst triage and disposition."],
  incidents: ["Incidents", "Investigate evidence, record findings, and document human-controlled response actions."],
  notifications: ["Notifications", "Operational messages and analyst notices. Notifications do not replace incident handling."],
  audit: ["Audit trail", "Protected-looking chronological records of analyst and system activity."],
  access: ["Access management", "Visual role administration prototype. No authentication is implemented."],
};

const severityClass: Record<Tone, string> = {
  low: "border-severity-low/35 bg-severity-low/10 text-severity-low",
  medium: "border-severity-medium/35 bg-severity-medium/10 text-severity-medium",
  high: "border-severity-high/35 bg-severity-high/10 text-severity-high",
  critical: "border-severity-critical/40 bg-severity-critical/10 text-severity-critical",
  new: "border-status-new/35 bg-status-new/10 text-status-new",
  investigating: "border-status-investigating/35 bg-status-investigating/10 text-status-investigating",
  contained: "border-status-contained/35 bg-status-contained/10 text-status-contained",
  resolved: "border-status-resolved/35 bg-status-resolved/10 text-status-resolved",
  dismissed: "border-status-dismissed/35 bg-status-dismissed/10 text-status-dismissed",
  neutral: "border-border bg-muted text-muted-foreground",
};

const distributionBarClass: Record<Tone, string> = {
  low: "bg-severity-low",
  medium: "bg-severity-medium",
  high: "bg-severity-high",
  critical: "bg-severity-critical",
  new: "bg-status-new",
  investigating: "bg-status-investigating",
  contained: "bg-status-contained",
  resolved: "bg-status-resolved",
  dismissed: "bg-status-dismissed",
  neutral: "bg-muted-foreground",
};

function Badge({ children, tone = "neutral", dot = true }: { children: ReactNode; tone?: Tone; dot?: boolean }) {
  return <span className={cn("inline-flex min-h-6 shrink-0 items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide", severityClass[tone])}>{dot && <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />}{children}</span>;
}

function Panel({ title, description, action, children, className }: { title: string; description?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={cn("min-w-0 rounded-md border border-border bg-card", className)}>
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b border-border px-4 py-3">
      <div className="min-w-0"><h2 className="text-sm font-semibold text-foreground">{title}</h2>{description && <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>}</div>{action}
    </div>
    {children}
  </section>;
}

function Notice({ tone, title, children }: { tone: "success" | "warning" | "info" | "error"; title: string; children: ReactNode }) {
  const styles = { success: "border-success/35 bg-success/8 text-success", warning: "border-warning/35 bg-warning/8 text-warning", info: "border-info/35 bg-info/8 text-info", error: "border-destructive/35 bg-destructive/8 text-destructive" };
  const Icon = tone === "success" ? CheckCircle2 : tone === "warning" ? AlertTriangle : tone === "error" ? XCircle : CircleDot;
  return <div className={cn("flex gap-3 rounded-md border p-3", styles[tone])} role={tone === "error" ? "alert" : "status"}><Icon className="mt-0.5 size-4 shrink-0" /><div><p className="text-xs font-bold">{title}</p><div className="mt-0.5 text-xs leading-5 text-foreground/80">{children}</div></div></div>;
}

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return <label className={cn("block min-w-0", className)}><span className="mb-1.5 block text-[11px] font-semibold uppercase text-muted-foreground">{label}</span>{children}</label>;
}

function SelectField({ label, options }: { label: string; options: string[] }) {
  return <Field label={label}><select className="h-9 w-full rounded-md border border-input bg-surface-raised px-2.5 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">{options.map((o) => <option key={o}>{o}</option>)}</select></Field>;
}

function TableShell({ children, label }: { children: ReactNode; label: string }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[780px] border-collapse text-left text-xs" aria-label={label}>{children}</table></div>;
}
const Th = ({ children }: { children: ReactNode }) => <th scope="col" className="whitespace-nowrap border-b border-border bg-table-header px-3 py-2.5 text-[10px] font-bold uppercase text-muted-foreground">{children}</th>;
const Td = ({ children, className }: { children: ReactNode; className?: string }) => <td className={cn("border-b border-border/70 px-3 py-3 align-middle text-foreground", className)}>{children}</td>;

function Pagination({ label = "Showing 1–5 of 48" }: { label?: string }) {
  return <div className="flex items-center justify-between gap-3 px-4 py-3 text-xs text-muted-foreground"><span>{label}</span><div className="flex gap-1"><Button variant="outline" size="icon" className="size-9" aria-label="Previous page" disabled><ChevronLeft /></Button><Button variant="outline" size="icon" className="size-9" aria-label="Next page"><ChevronRight /></Button></div></div>;
}

function CodeBlock({ children }: { children: ReactNode }) {
  return <pre className="max-h-52 overflow-auto whitespace-pre-wrap break-all rounded-md border border-border bg-code p-3 font-mono text-[11px] leading-5 text-code-foreground">{children}</pre>;
}

function FilterToolbar({ kind }: { kind: "events" | "alerts" | "audit" }) {
  const [expanded, setExpanded] = useState(kind === "events");
  const eventFilters = ["Source", "Type", "Threat category", "Rule ID", "MITRE technique", "Severity", "Action", "Status", "User", "Host", "Source IP", "Destination IP", "Date range"];
  const alertFilters = ["Severity", "Threat category", "Rule", "Source", "Status", "Generated range"];
  const auditFilters = ["Actor", "Action", "Target type", "Occurred range"];
  const filters = kind === "events" ? eventFilters : kind === "alerts" ? alertFilters : auditFilters;
  return <div className="border-b border-border bg-surface-subtle p-3">
    <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2">
      <label className="relative min-w-0"><span className="sr-only">Search {kind}</span><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input className="pl-9 text-xs" placeholder={`Search ${kind}…`} /></label>
      <Button variant="outline" size="sm" className="h-9" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}><ListFilter /> Filters <Badge dot={false}>{filters.length}</Badge></Button>
      <Button size="sm" className="h-9"><Filter /> Apply</Button>
    </div>
    {expanded && <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">{filters.map((f) => <SelectField key={f} label={f} options={[`All ${f.toLowerCase()}`, "Selected value"]} />)}</div>}
  </div>;
}

function MetricCard({ label, value, detail, icon: Icon, tone = "neutral" }: { label: string; value: string; detail: string; icon: typeof Activity; tone?: Tone }) {
  return <article className="rounded-md border border-border bg-card p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{value}</p></div><span className={cn("grid size-9 place-items-center rounded border", severityClass[tone])}><Icon className="size-4" /></span></div><p className="mt-2 text-xs text-muted-foreground">{detail}</p></article>;
}

function Distribution({ rows }: { rows: { label: string; value: number; tone: Tone }[] }) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return <div className="space-y-3 p-4">{rows.map((row) => <div key={row.label}><div className="mb-1.5 flex items-center justify-between text-xs"><span className="flex items-center gap-2 text-foreground"><span className={cn("size-2 rounded-sm", distributionBarClass[row.tone])} />{row.label}</span><span className="font-mono text-muted-foreground">{row.value}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", distributionBarClass[row.tone])} style={{ width: `${Math.max(7, row.value / total * 100)}%` }} /></div></div>)}</div>;
}

function Dashboard() {
  const metrics = [
    ["Security events", "1,842", "+12% vs prior 24h", Activity, "neutral"], ["Alerts", "48", "16 require review", ShieldAlert, "high"],
    ["Incidents", "12", "5 currently active", Siren, "critical"], ["Active incidents", "5", "2 assigned to you", Clock3, "investigating"],
    ["New alerts", "16", "Rolling 24 hours", Bell, "new"], ["Recorded responses", "9", "Analyst documented", ClipboardCheck, "neutral"],
    ["Successful containment", "7", "Analyst-reported outcomes", ShieldCheck, "contained"], ["Mean incident risk / 100", "63", "Documented score", Gauge, "medium"],
  ] as const;
  const trend = [24, 32, 27, 44, 38, 53, 48];
  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label, value, detail, icon, tone]) => <MetricCard key={label} label={label} value={value} detail={detail} icon={icon} tone={tone} />)}</div>
    <div className="grid gap-4 xl:grid-cols-3">
      <Panel title="Severity distribution" description="Alerts and incidents · rolling 24 hours"><Distribution rows={[{ label: "Critical", value: 4, tone: "critical" }, { label: "High", value: 14, tone: "high" }, { label: "Medium", value: 27, tone: "medium" }, { label: "Low", value: 15, tone: "low" }]} /></Panel>
      <Panel title="Workflow state" description="Current incident lifecycle"><Distribution rows={[{ label: "New", value: 2, tone: "new" }, { label: "Investigating", value: 3, tone: "investigating" }, { label: "Contained", value: 4, tone: "contained" }, { label: "Resolved", value: 11, tone: "resolved" }, { label: "Dismissed", value: 2, tone: "dismissed" }]} /></Panel>
      <Panel title="Threat categories" description="Deterministic rule classifications"><div className="divide-y divide-border">{[["Credential access", 18], ["Command and control", 11], ["Persistence", 9], ["Initial access", 7]].map(([name, value]) => <div key={name} className="flex items-center justify-between px-4 py-3 text-xs"><span>{name}</span><span className="font-mono text-muted-foreground">{value}</span></div>)}</div></Panel>
    </div>
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
      <Panel title="Seven-day UTC trend" description="Alert volume by day; current day is partial"><div className="p-4"><div className="flex h-44 items-end gap-3 border-b border-border px-2">{trend.map((v, i) => <div className="flex h-full flex-1 flex-col justify-end gap-2" key={i}><span className="text-center font-mono text-[10px] text-muted-foreground">{v}</span><div className="min-h-2 rounded-t-sm bg-primary" style={{ height: `${v * 2.2}px` }} /></div>)}</div><div className="mt-2 grid grid-cols-7 text-center text-[10px] text-muted-foreground">{["24 Sep", "25", "26", "27", "28", "29", "30 Sep"].map((x) => <span key={x}>{x}</span>)}</div></div></Panel>
      <Panel title="Recorded response outcomes" description="Human-controlled, analyst-reported"><div className="p-4"><div className="grid grid-cols-2 gap-3"><div className="rounded border border-success/30 bg-success/8 p-3"><p className="text-2xl font-semibold text-success">7</p><p className="mt-1 text-xs text-foreground">Successful containment</p></div><div className="rounded border border-border bg-muted/40 p-3"><p className="text-2xl font-semibold">2</p><p className="mt-1 text-xs text-foreground">Pending validation</p></div></div><p className="mt-4 text-xs leading-5 text-muted-foreground">Response success is analyst-reported. It is not independently verified by SentinelX.</p></div></Panel>
    </div>
    <Notice tone="info" title="Interpretation guidance">Risk is a documented score, not a probability. Values support prioritization and do not predict incident likelihood.</Notice>
  </div>;
}

const events = [
  ["21:08:44.218", "Endpoint", "Process created", "high", "j.ortiz / wkstn-044", "Correlated"],
  ["21:07:12.809", "Identity", "Sign-in failure", "medium", "svc_backup / idp", "Reviewed"],
  ["21:04:52.041", "Network", "Outbound connection", "critical", "wkstn-044", "Escalated"],
  ["20:58:09.317", "Email", "Attachment opened", "low", "r.chen / mbx-112", "Normalized"],
];
function Events() {
  const [selected, setSelected] = useState(0);
  return <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,.85fr)]">
    <Panel title="Normalized event stream" description="1,842 records · latest first" className="min-w-0"><FilterToolbar kind="events" /><TableShell label="Security events"><thead><tr><Th>Occurred UTC</Th><Th>Source</Th><Th>Type</Th><Th>Severity</Th><Th>User / host</Th><Th>Status</Th><Th>Action</Th></tr></thead><tbody>{events.map((e, i) => <tr key={e[0]} className={cn("hover:bg-muted/40", selected === i && "bg-primary/5")}><Td className="font-mono">{e[0]}</Td><Td>{e[1]}</Td><Td>{e[2]}</Td><Td><Badge tone={e[3] as Tone}>{e[3]}</Badge></Td><Td className="font-mono">{e[4]}</Td><Td>{e[5]}</Td><Td><Button variant="outline" size="sm" onClick={() => setSelected(i)}><Eye /> Inspect</Button></Td></tr>)}</tbody></TableShell><Pagination label="Showing 1–4 of 1,842" /></Panel>
    <Panel title="Event inspection" description="EVT-20260930-88421" action={<Badge tone="critical">Critical</Badge>}><div className="space-y-4 p-4"><div className="grid grid-cols-2 gap-3 text-xs"><Meta k="Occurred" v="2026-09-30 21:04:52.041 UTC" /><Meta k="Source" v="network_sensor_03" /><Meta k="Rule ID" v="SX-NET-0047" /><Meta k="MITRE" v="T1071.001" /><Meta k="Source IP" v="10.24.18.44" /><Meta k="Destination" v="198.51.100.72:443" /></div><div><h3 className="mb-2 text-xs font-semibold">Normalized data</h3><CodeBlock>{`event.kind: network\naction: connection_attempt\nhost.name: wkstn-044\nnetwork.direction: outbound\nrule.deterministic: true`}</CodeBlock></div><div><h3 className="mb-2 text-xs font-semibold">Raw evidence</h3><CodeBlock>{`{\n  "event_id": "b5f3a18d-4d52-4aa7-94ce-3f90c1a57f19",\n  "src_ip": "10.24.18.44",\n  "dst_ip": "198.51.100.72",\n  "transport": "tcp",\n  "bytes_out": 18422\n}`}</CodeBlock></div></div></Panel>
  </div>;
}

function Meta({ k, v }: { k: string; v: string }) { return <div className="min-w-0"><dt className="text-[10px] font-bold uppercase text-muted-foreground">{k}</dt><dd className="mt-1 break-all font-mono text-foreground">{v}</dd></div>; }

const alerts = [
  ["21:06:03", "critical", "Possible C2 over HTTPS", "SX-NET-0047", "Network", "New"],
  ["20:44:11", "high", "Encoded PowerShell invocation", "SX-END-0019", "Endpoint", "Investigating"],
  ["20:31:58", "medium", "Repeated identity failures", "SX-ID-0008", "Identity", "Acknowledged"],
];
function Alerts() {
  const [saved, setSaved] = useState(false);
  return <div className="space-y-4"><Panel title="Detection queue" description="Deterministic alert rules are the primary detection authority"><FilterToolbar kind="alerts" /><TableShell label="Detection alerts"><thead><tr><Th>Generated UTC</Th><Th>Severity</Th><Th>Threat</Th><Th>Rule</Th><Th>Source</Th><Th>Status</Th><Th>Action</Th></tr></thead><tbody>{alerts.map((a) => <tr key={a[0]} className="hover:bg-muted/40"><Td className="font-mono">{a[0]}</Td><Td><Badge tone={a[1] as Tone}>{a[1]}</Badge></Td><Td className="font-medium">{a[2]}</Td><Td className="font-mono">{a[3]}</Td><Td>{a[4]}</Td><Td>{a[5]}</Td><Td><Button variant="outline" size="sm"><Eye /> Inspect</Button></Td></tr>)}</tbody></TableShell><Pagination label="Showing 1–3 of 48" /></Panel>
    <div className="grid gap-4 xl:grid-cols-[1.25fr_.75fr]"><Panel title="Alert inspection · ALT-2941" description="Possible command and control over HTTPS" action={<Badge tone="critical">Critical</Badge>}><div className="grid gap-4 p-4 md:grid-cols-2"><div><h3 className="mb-2 text-xs font-semibold">Affected entities</h3><div className="space-y-2"><Entity icon={TerminalSquare} title="wkstn-044" detail="Windows 11 · Finance subnet" /><Entity icon={Users} title="j.ortiz" detail="Interactive user session" /><Entity icon={Network} title="198.51.100.72" detail="External destination" /></div></div><div><h3 className="mb-2 text-xs font-semibold">Detection evidence</h3><CodeBlock>{`rule_id: SX-NET-0047\nmatch: periodic outbound TLS\ninterval_variance: 1.8%\nsource_events: 14\nwindow: 35m`}</CodeBlock></div><div className="md:col-span-2"><Notice tone="warning" title="Supporting ML evidence only">Anomaly score 0.82 is contextual support. It is not the primary detection authority and does not create an alert independently.</Notice></div><div className="md:col-span-2"><h3 className="mb-2 text-xs font-semibold">Source events</h3><div className="rounded border border-border bg-surface-subtle p-3 font-mono text-[11px] text-muted-foreground">14 related network events · 20:29:42–21:04:52 UTC</div></div></div></Panel>
    <Panel title="Analyst status" description="Record triage disposition"><div className="space-y-3 p-4">{saved && <Notice tone="success" title="Status recorded">Mock analyst status updated locally for this session.</Notice>}<SelectField label="Status" options={["Investigating", "Acknowledged", "Escalated", "Dismissed"]} /><Field label="Analyst note"><Textarea placeholder="Document triage rationale…" /></Field><Button className="w-full" onClick={() => setSaved(true)}><Check /> Record status</Button></div></Panel></div>
  </div>;
}

function Entity({ icon: Icon, title, detail }: { icon: typeof Activity; title: string; detail: string }) { return <div className="flex items-center gap-3 rounded border border-border bg-surface-subtle p-3"><Icon className="size-4 shrink-0 text-primary" /><div className="min-w-0"><p className="truncate text-xs font-medium">{title}</p><p className="mt-0.5 truncate text-[11px] text-muted-foreground">{detail}</p></div></div>; }

const incidents = [
  ["20:47", "INC-1094", "Suspected C2 beaconing", "critical", "87", "Command & control", "investigating", "M. Reyes"],
  ["18:12", "INC-1093", "Privileged account misuse", "high", "74", "Credential access", "contained", "A. Patel"],
  ["15:39", "INC-1092", "Malicious attachment execution", "high", "69", "Initial access", "resolved", "J. Brooks"],
];
function Incidents() {
  const [created, setCreated] = useState(false);
  const [tab, setTab] = useState("evidence");
  return <div className="space-y-4">{created && <Notice tone="success" title="Incident created.">Mock incident INC-1095 is ready for visual review. No record was persisted.</Notice>}
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,.7fr)]"><Panel title="Incident queue" description="Evidence-led investigations and documented lifecycle"><TableShell label="Incidents"><thead><tr><Th>Created</Th><Th>Incident</Th><Th>Title</Th><Th>Severity</Th><Th>Risk</Th><Th>Category</Th><Th>Status</Th><Th>Assignee</Th><Th>Inspect</Th></tr></thead><tbody>{incidents.map((x) => <tr key={x[1]} className="hover:bg-muted/40"><Td className="font-mono">{x[0]}</Td><Td className="font-mono">{x[1]}</Td><Td className="font-medium">{x[2]}</Td><Td><Badge tone={x[3] as Tone}>{x[3]}</Badge></Td><Td><span className="font-mono font-bold">{x[4]}</span>/100</Td><Td>{x[5]}</Td><Td><Badge tone={x[6] as Tone}>{x[6]}</Badge></Td><Td>{x[7]}</Td><Td><Button variant="outline" size="sm"><Eye /> Inspect</Button></Td></tr>)}</tbody></TableShell><Pagination label="Showing 1–3 of 12" /></Panel>
    <Panel title="Create incident" description="Manual analyst-created record"><div className="space-y-3 p-4"><Field label="Title"><Input placeholder="Incident title" /></Field><SelectField label="Severity" options={["High", "Critical", "Medium", "Low"]} /><SelectField label="Classification" options={["Command & control", "Credential access", "Initial access", "Persistence"]} /><Field label="Linked alert IDs"><Input placeholder="ALT-2941, ALT-2938" /></Field><Button className="w-full" onClick={() => setCreated(true)}><Plus /> Create incident</Button></div></Panel></div>
    <Panel title="INC-1094 · Suspected C2 beaconing" description="Created 2026-09-30 20:47 UTC · Last updated 21:11 UTC" action={<div className="flex gap-2"><Badge tone="critical">Critical</Badge><Badge tone="investigating">Investigating</Badge></div>}>
      <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_280px]"><div className="min-w-0 border-b border-border xl:border-b-0 xl:border-r"><div className="flex overflow-x-auto border-b border-border px-3" role="tablist" aria-label="Incident workspace">{["evidence", "investigation", "response"].map((x) => <button key={x} role="tab" aria-selected={tab === x} onClick={() => setTab(x)} className={cn("min-h-11 whitespace-nowrap border-b-2 px-4 text-xs font-semibold capitalize outline-none focus-visible:ring-2 focus-visible:ring-ring", tab === x ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>{x}</button>)}</div>
        {tab === "evidence" && <div className="grid gap-4 p-4 lg:grid-cols-2"><IncidentSection icon={ShieldAlert} title="Linked alerts" subtitle="2 deterministic detections"><Entity icon={ShieldAlert} title="ALT-2941 · C2 over HTTPS" detail="Critical · SX-NET-0047" /><Entity icon={ShieldAlert} title="ALT-2938 · Suspicious process tree" detail="High · SX-END-0019" /></IncidentSection><IncidentSection icon={Users} title="Affected entities" subtitle="3 entities in scope"><Entity icon={TerminalSquare} title="wkstn-044" detail="Primary affected host" /><Entity icon={Users} title="j.ortiz" detail="Logged-on identity" /></IncidentSection><div className="lg:col-span-2"><IncidentSection icon={Activity} title="Related security events" subtitle="28 normalized records"><CodeBlock>{`21:04:52  NETWORK  outbound TLS connection   198.51.100.72\n20:59:51  ENDPOINT process creation          powershell.exe\n20:59:49  ENDPOINT parent process             WINWORD.EXE\n20:58:09  EMAIL    attachment opened          invoice_sept.docm`}</CodeBlock></IncidentSection></div></div>}
        {tab === "investigation" && <div className="grid gap-4 p-4 lg:grid-cols-[.8fr_1.2fr]"><IncidentSection icon={BookOpenCheck} title="Analyst findings" subtitle="Documented observations"><Finding title="Periodic network pattern" detail="Outbound TLS observed at approximately 150-second intervals across a 35-minute window." /><Finding title="Process ancestry" detail="PowerShell execution traced to a macro-enabled document opened by the affected user." /></IncidentSection><IncidentSection icon={Clock3} title="Chronological timeline" subtitle="All times UTC"><Timeline /></IncidentSection></div>}
        {tab === "response" && <div className="grid gap-4 p-4 lg:grid-cols-2"><IncidentSection icon={ShieldCheck} title="Manual response actions" subtitle="Human-controlled and recorded"><Action status="Completed" title="Endpoint isolation recorded" detail="Analyst reported host isolated at 21:09 UTC." /><Action status="Pending" title="Credential reset validation" detail="Awaiting identity team confirmation." /><Button><Plus /> Record manual action</Button></IncidentSection><IncidentSection icon={ClipboardCheck} title="Classification & assessment" subtitle="Analyst judgment"><div className="grid grid-cols-2 gap-3"><SelectField label="Severity" options={["Critical", "High", "Medium", "Low"]} /><Field label="Risk / 100"><Input value="87" readOnly /></Field></div><Field label="Assessment"><Textarea defaultValue="Confirmed malicious activity with documented endpoint and network evidence." /></Field><Button><Check /> Save assessment</Button></IncidentSection></div>}
      </div><aside className="space-y-4 bg-surface-subtle p-4"><h3 className="text-xs font-bold uppercase text-muted-foreground">Incident control</h3><SelectField label="Assignee" options={["M. Reyes", "A. Patel", "J. Brooks", "Unassigned"]} /><SelectField label="Lifecycle status" options={["INVESTIGATING", "NEW", "CONTAINED", "RESOLVED", "DISMISSED"]} /><Notice tone="warning" title="Lifecycle distinction">CONTAINED limits impact. It does not mean the incident is RESOLVED.</Notice><Button className="w-full"><Check /> Record changes</Button></aside></div>
    </Panel>
  </div>;
}
function IncidentSection({ icon: Icon, title, subtitle, children }: { icon: typeof Activity; title: string; subtitle: string; children: ReactNode }) { return <section className="space-y-3"><div className="flex items-center gap-2"><Icon className="size-4 text-primary" /><div><h3 className="text-xs font-semibold">{title}</h3><p className="text-[10px] text-muted-foreground">{subtitle}</p></div></div>{children}</section>; }
function Finding({ title, detail }: { title: string; detail: string }) { return <div className="rounded border-l-2 border-l-primary border-y-border border-r-border bg-surface-subtle p-3"><p className="text-xs font-semibold">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p></div>; }
function Action({ status, title, detail }: { status: string; title: string; detail: string }) { return <div className="rounded border border-border p-3"><div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold">{title}</p><Badge tone={status === "Completed" ? "contained" : "medium"}>{status}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>; }
function Timeline() { return <ol className="relative ml-2 border-l border-border">{[["21:09", "Response", "Endpoint isolation recorded by M. Reyes"], ["21:02", "Finding", "Process ancestry confirmed"], ["20:51", "Assignment", "Incident assigned to M. Reyes"], ["20:47", "Created", "Incident created from ALT-2941"]].map(([time, label, text]) => <li key={time} className="relative pb-4 pl-5 last:pb-0"><span className="absolute -left-1 top-1 size-2 rounded-full bg-primary ring-4 ring-card" /><div className="flex items-center gap-2"><time className="font-mono text-[10px] text-muted-foreground">{time}</time><Badge dot={false}>{label}</Badge></div><p className="mt-1 text-xs">{text}</p></li>)}</ol>; }

function Notifications() {
  const [filter, setFilter] = useState("All");
  const items = [
    ["critical", "Incident INC-1094 requires review", "New critical evidence was linked by the correlation workflow.", "2 min ago", "Unread"],
    ["high", "High severity alert assigned", "ALT-2938 was assigned to your queue.", "18 min ago", "Unread"],
    ["medium", "Containment validation pending", "INC-1093 requires analyst confirmation before resolution.", "1 hr ago", "Unread"],
    ["low", "Daily review completed", "The scheduled analyst review was recorded.", "3 hr ago", "Read"],
  ];
  return <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,.6fr)]"><Panel title="Notification inbox" description="Operational messages only — not a substitute for incident handling" action={<Badge tone="new">3 unread</Badge>}><div className="flex gap-1 overflow-x-auto border-b border-border p-3">{["All", "Unread", "Critical / high"].map((f) => <Button key={f} variant={filter === f ? "default" : "ghost"} size="sm" onClick={() => setFilter(f)}>{f}</Button>)}</div><ul className="divide-y divide-border">{items.map((n) => <li key={n[1]} className={cn("grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 p-4", n[4] === "Unread" && "bg-primary/4")}><span className={cn("mt-1 size-2 rounded-full", n[4] === "Unread" ? "bg-primary" : "bg-muted-foreground/40")} aria-hidden="true" /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-semibold">{n[1]}</p><Badge tone={n[0] as Tone}>{n[0]}</Badge><span className="text-[10px] font-semibold uppercase text-muted-foreground">{n[4]}</span></div><p className="mt-1 text-xs leading-5 text-muted-foreground">{n[2]}</p></div><time className="whitespace-nowrap text-[10px] text-muted-foreground">{n[3]}</time></li>)}</ul><Pagination label="Showing 1–4 of 24" /></Panel>
    <Panel title="Send in-app notification" description="Visual mock form; no message will be sent"><div className="space-y-3 p-4"><SelectField label="Recipient" options={["SOC analysts", "Incident owner", "All reviewers"]} /><SelectField label="Severity" options={["Informational", "Medium", "High", "Critical"]} /><Field label="Subject"><Input placeholder="Notification subject" /></Field><Field label="Message"><Textarea className="min-h-28" placeholder="Operational message…" /></Field><Button className="w-full"><Send /> Send notification</Button><Notice tone="info" title="Incident handling remains separate">Use the Incidents workspace to investigate, respond, and manage lifecycle.</Notice></div></Panel></div>;
}

function Audit() {
  const rows = [
    ["21:11:28", "m.reyes", "incident.status.updated", "INC-1094", "contained → investigating"],
    ["21:09:04", "m.reyes", "response.recorded", "INC-1094", "endpoint isolation"],
    ["20:51:33", "a.patel", "incident.assigned", "INC-1094", "assignee=m.reyes"],
    ["20:47:12", "system", "incident.created", "INC-1094", "source=ALT-2941"],
  ];
  return <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(330px,.7fr)]"><Panel title="Protected audit entries" description="Append-only visual treatment · all timestamps UTC" action={<span className="flex items-center gap-1.5 text-[10px] font-semibold text-success"><LockKeyhole className="size-3" /> INTEGRITY RECORDED</span>}><FilterToolbar kind="audit" /><TableShell label="Audit trail"><thead><tr><Th>Occurred at</Th><Th>Actor</Th><Th>Action</Th><Th>Target</Th><Th>Context summary</Th><Th>Inspect</Th></tr></thead><tbody>{rows.map((r) => <tr key={r[0]} className="hover:bg-muted/40"><Td className="font-mono">{r[0]}</Td><Td className="font-mono">{r[1]}</Td><Td><Badge dot={false}>{r[2]}</Badge></Td><Td className="font-mono">{r[3]}</Td><Td>{r[4]}</Td><Td><Button variant="outline" size="sm"><Eye /> Inspect</Button></Td></tr>)}</tbody></TableShell><Pagination label="Showing 1–4 of 3,819" /></Panel>
    <Panel title="Entry context" description="AUD-7f94a8c2 · immutable-looking mock"><div className="space-y-4 p-4"><dl className="grid grid-cols-2 gap-3"><Meta k="Actor" v="m.reyes" /><Meta k="Target" v="incident:INC-1094" /><Meta k="Occurred" v="2026-09-30T21:11:28.442Z" /><Meta k="Request ID" v="req_8d2f9103" /></dl><CodeBlock>{`{\n  "action": "incident.status.updated",\n  "before": "CONTAINED",\n  "after": "INVESTIGATING",\n  "reason": "Additional evidence under review",\n  "actor_role": "SOC_ANALYST"\n}`}</CodeBlock><Notice tone="info" title="Audit semantics">This prototype presents audit history as protected and append-only. No storage or enforcement exists.</Notice></div></Panel></div>;
}

function Access() {
  const [saved, setSaved] = useState(false);
  return <div className="space-y-4"><Notice tone="warning" title="Visual prototype only">No authentication, authorization, session, or role enforcement is implemented. Navigation visibility never implies authorization.</Notice><div className="grid gap-4 xl:grid-cols-3"><Panel title="Sign in" description="Non-functional presentation state"><div className="space-y-3 p-4"><Field label="Work email"><Input type="email" placeholder="analyst@iphyn.example" /></Field><Field label="Password"><Input type="password" placeholder="••••••••••••" /></Field><Button className="w-full"><KeyRound /> Sign in</Button><p className="text-center text-[10px] text-muted-foreground">Mock interface — credentials are not processed.</p></div></Panel><Panel title="Authenticated identity" description="Example current-session presentation"><div className="p-4"><div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-md border border-primary/30 bg-primary/10 font-semibold text-primary">MR</div><div><p className="text-sm font-semibold">Morgan Reyes</p><p className="text-xs text-muted-foreground">m.reyes@iphyn.example</p></div></div><div className="mt-4 grid grid-cols-2 gap-3"><Meta k="Primary role" v="SOC_ANALYST" /><Meta k="Session state" v="Authenticated" /><Meta k="Last sign-in" v="20:02 UTC" /><Meta k="MFA" v="Recorded" /></div></div></Panel><Panel title="Access posture" description="Display-only summary"><div className="divide-y divide-border">{[["Active users", "18"], ["Administrators", "3"], ["SOC analysts", "11"], ["Read-only reviewers", "4"]].map(([a,b]) => <div key={a} className="flex justify-between px-4 py-3 text-xs"><span className="text-muted-foreground">{a}</span><span className="font-mono font-semibold">{b}</span></div>)}</div></Panel></div>
    <div className="grid gap-4 xl:grid-cols-[1fr_1fr]"><Panel title="User role management" description="Example role assignment for Jordan Brooks"><div className="space-y-4 p-4">{saved && <Notice tone="success" title="Role changes recorded visually">The mock form state was updated locally.</Notice>}<div className="grid gap-3 sm:grid-cols-2">{[["SOC analyst", true], ["Incident manager", false], ["Audit reviewer", true], ["Access administrator", false]].map(([role, checked], i) => <label key={String(role)} htmlFor={`role-${i}`} className="flex min-h-11 items-center gap-3 rounded border border-border bg-surface-subtle px-3 text-xs"><Checkbox id={`role-${i}`} aria-label={String(role)} defaultChecked={Boolean(checked)} /><span>{role}</span></label>)}</div><Field label="Reason for change"><Textarea placeholder="Document the business reason…" /></Field><Button onClick={() => setSaved(true)}><Check /> Save role changes</Button><Notice tone="warning" title="Session impact">Role changes sign the affected user out. They must sign in again before updated access is presented.</Notice></div></Panel><Panel title="Role definitions" description="UI descriptions do not enforce access"><div className="divide-y divide-border">{[["SOC_ANALYST", "Review alerts, investigate incidents, and record manual actions."], ["INCIDENT_MANAGER", "Assign incident ownership and review lifecycle changes."], ["AUDIT_REVIEWER", "Read audit records and supporting context."], ["ACCESS_ADMIN", "Manage visual role assignments in this prototype."]].map(([role, desc]) => <div key={role} className="p-4"><p className="font-mono text-xs font-semibold text-primary">{role}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{desc}</p></div>)}</div></Panel></div></div>;
}

function SidebarNav({ screen, setScreen, collapsed = false, close }: { screen: Screen; setScreen: (s: Screen) => void; collapsed?: boolean; close?: () => void }) {
  return <nav aria-label="Primary navigation" className="space-y-1 p-2">{navigation.map((item) => { const Icon = item.icon; const active = screen === item.id; return <button key={item.id} onClick={() => { setScreen(item.id); close?.(); }} aria-current={active ? "page" : undefined} title={collapsed ? item.label : undefined} className={cn("grid min-h-11 w-full items-center rounded-md text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring", collapsed ? "grid-cols-1 place-items-center px-2" : "grid-cols-[auto_minmax(0,1fr)_auto] gap-3 px-3", active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground")}><Icon className="size-4 shrink-0" />{!collapsed && <><span className="truncate font-medium">{item.label}</span>{item.count !== undefined && <span className="font-mono text-[10px] opacity-70">{item.count}</span>}</>}</button>; })}</nav>;
}

export function SentinelXConsole() {
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [refreshed, setRefreshed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const Current = { dashboard: Dashboard, events: Events, alerts: Alerts, incidents: Incidents, notifications: Notifications, audit: Audit, access: Access }[screen];
  return <div className="min-h-dvh bg-background text-foreground">
    <div className="flex min-h-dvh w-full">
      <aside className={cn("sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] md:flex", collapsed ? "w-16" : "w-60")}>
        <div className={cn("flex h-16 items-center border-b border-sidebar-border", collapsed ? "justify-center px-2" : "gap-3 px-4")}><div className="grid size-9 shrink-0 place-items-center rounded-md border border-primary/40 bg-primary/10 text-primary"><Shield className="size-5" /></div>{!collapsed && <div className="min-w-0"><p className="text-base font-bold text-sidebar-foreground">SentinelX</p><p className="text-[9px] font-semibold uppercase text-sidebar-foreground/55">IPHYN Security Operations</p></div>}</div>
        <div className="flex-1 overflow-y-auto py-2"><SidebarNav screen={screen} setScreen={setScreen} collapsed={collapsed} /></div>
        <div className="border-t border-sidebar-border p-2"><Button variant="ghost" size={collapsed ? "icon" : "sm"} className={cn("min-h-11", !collapsed && "w-full justify-start")} onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>{collapsed ? <PanelLeftOpen /> : <><PanelLeftClose /><span>Collapse</span></>}</Button></div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-sm"><div className="grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 sm:px-5">
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}><SheetTrigger asChild><Button variant="outline" size="icon" className="size-11 md:hidden" aria-label="Open navigation"><Menu /></Button></SheetTrigger><SheetContent side="left" className="w-[min(88vw,320px)] p-0"><SheetHeader className="border-b border-border p-4 text-left"><SheetTitle className="flex items-center gap-2"><Shield className="size-5 text-primary" /> SentinelX</SheetTitle><SheetDescription>IPHYN Security Operations</SheetDescription></SheetHeader><SidebarNav screen={screen} setScreen={setScreen} close={() => setMobileNavOpen(false)} /></SheetContent></Sheet>
          <div className="min-w-0 py-2"><h1 className="truncate text-base font-semibold sm:text-lg">{titles[screen][0]}</h1><p className="hidden truncate text-xs text-muted-foreground sm:block">{titles[screen][1]}</p></div>
          <div className="flex shrink-0 items-center gap-2"><div className="hidden text-right lg:block"><p className="text-xs font-semibold">Morgan Reyes</p><p className="text-[10px] text-muted-foreground">SOC_ANALYST</p></div><Button variant="outline" size="icon" className="size-11" aria-label="Refresh mock data" onClick={() => { setRefreshed(true); window.setTimeout(() => setRefreshed(false), 1800); }}><RefreshCw className={refreshed ? "animate-spin" : ""} /></Button><Button variant="ghost" size="sm" className="hidden sm:inline-flex" disabled><Signpost /> Sign out</Button></div>
        </div></header>
        <main className="mx-auto w-full max-w-[1680px] p-3 sm:p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2 text-[10px] font-semibold uppercase text-muted-foreground"><span className="inline-flex items-center gap-1.5 text-success"><span className="size-1.5 rounded-full bg-success" /> Operational</span><span>•</span><span>Mock data</span><span>•</span><time>30 Sep 2026 · 21:12 UTC</time></div>{refreshed && <span className="text-xs text-success" role="status">Mock data refreshed</span>}</div><Current /></main>
      </div>
    </div>
  </div>;
}