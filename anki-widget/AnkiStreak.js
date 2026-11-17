// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-orange; icon-glyph: fire;

// AnkiStreak — iPhone widget (Scriptable) for an Anki study streak
// plus a recurring "send your Anki stats to Claude" reminder.
//
// Run modes:
//   widget                      -> draws the streak widget
//   tap widget / run in app     -> menu (log, undo, send stats to Claude, ...)
//   Shortcuts parameter "open"  -> AnkiMobile opened (start of session)
//   Shortcuts parameter "close" -> AnkiMobile closed; logs today if session >= minSessionMinutes
//   Shortcuts parameter "log"   -> log today unconditionally
//   Shortcuts parameter "exported" -> mark stats as sent to Claude today

const CONFIG = {
  minSessionMinutes: 2,   // AnkiMobile must stay open this long to count as practice
  exportEveryDays: 7,     // how often to send stats to Claude
  dailyReminderHour: 20,  // "streak at risk" notification, local time (24h)
  exportReminderHour: 19, // "send stats to Claude" notification, local time (24h)
  ankiURL: "anki://",
  claudeURL: "https://claude.ai/new",
  deckLabel: "ESPAÑOL",
};

const ORANGE = new Color("#FF7A18");
const RED = new Color("#E8452C");
const DIM = new Color("#FFFFFF", 0.35);

// ---------- storage ----------

function fileManager() {
  try {
    const f = FileManager.iCloud();
    f.documentsDirectory();
    return f;
  } catch (e) {
    return FileManager.local();
  }
}
const fm = fileManager();
const PATH = fm.joinPath(fm.documentsDirectory(), "anki-streak.json");
const EMPTY = { days: [], lastExport: null, openedAt: null };

async function load() {
  if (!fm.fileExists(PATH)) return { ...EMPTY, days: [] };
  if (fm.isFileStoredIniCloud(PATH) && !fm.isFileDownloaded(PATH)) {
    await fm.downloadFileFromiCloud(PATH);
  }
  try {
    return { ...EMPTY, ...JSON.parse(fm.readString(PATH)) };
  } catch (e) {
    return { ...EMPTY, days: [] };
  }
}

function save(s) {
  s.days = [...new Set(s.days)].sort();
  fm.writeString(PATH, JSON.stringify(s));
}

// ---------- dates (local time, keyed YYYY-MM-DD) ----------

function dayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function parseKey(k) {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function daysBetween(aKey, bKey) {
  return Math.round((parseKey(bKey) - parseKey(aKey)) / 86400000);
}
function atHour(d, h) {
  const x = new Date(d);
  x.setHours(h, 0, 0, 0);
  return x;
}

// ---------- stats ----------

function currentStreak(days, now = new Date()) {
  const set = new Set(days);
  // The streak stays alive until midnight even if today isn't done yet.
  let d = set.has(dayKey(now)) ? now : addDays(now, -1);
  let n = 0;
  while (set.has(dayKey(d))) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

function bestStreak(days) {
  const sorted = [...new Set(days)].sort();
  let best = 0, run = 0, prev = null;
  for (const k of sorted) {
    run = prev && daysBetween(prev, k) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  }
  return best;
}

function countLast(days, n, now = new Date()) {
  const set = new Set(days);
  let c = 0;
  for (let i = 0; i < n; i++) if (set.has(dayKey(addDays(now, -i)))) c++;
  return c;
}

function summary(s, now = new Date()) {
  const today = dayKey(now);
  const sinceExport = s.lastExport ? daysBetween(s.lastExport, today) : null;
  return {
    today,
    doneToday: s.days.includes(today),
    streak: currentStreak(s.days, now),
    best: bestStreak(s.days),
    last7: countLast(s.days, 7, now),
    last30: countLast(s.days, 30, now),
    sinceExport,
    exportDue: sinceExport === null || sinceExport >= CONFIG.exportEveryDays,
  };
}

// ---------- actions ----------

function logToday(s) {
  const k = dayKey();
  if (!s.days.includes(k)) s.days.push(k);
}

function applyAction(s, action) {
  switch (action) {
    case "open":
      s.openedAt = Date.now();
      return "session started";
    case "close": {
      const mins = s.openedAt ? (Date.now() - s.openedAt) / 60000 : null;
      s.openedAt = null;
      // If the "open" automation didn't fire, give the benefit of the doubt.
      if (mins === null || mins >= CONFIG.minSessionMinutes) {
        logToday(s);
        return "logged";
      }
      return `session too short (${mins.toFixed(1)} min)`;
    }
    case "log":
      logToday(s);
      return "logged";
    case "unlog":
      s.days = s.days.filter((d) => d !== dayKey());
      return "removed today";
    case "exported":
      s.lastExport = dayKey();
      return "export recorded";
    default:
      return null;
  }
}

function claudePrompt(st) {
  return [
    "Here are my Anki stats for learning Spanish (screenshots attached).",
    `Streak: ${st.streak} days (best ${st.best}). Practiced ${st.last7}/7 of the last 7 days and ${st.last30}/30 of the last 30.`,
    "Please review my progress: retention, workload, problem cards or topics.",
    "Then suggest new cards I should add next, as Anki import lines: Spanish;English",
  ].join("\n");
}

// ---------- notifications ----------

const DAILY_IDS = [...Array(7).keys()].map((i) => `anki-streak-daily-${i}`);
const EXPORT_IDS = [...Array(3).keys()].map((i) => `anki-export-${i}`);

async function reschedule(s) {
  const st = summary(s);
  const now = new Date();
  await Notification.removePending([...DAILY_IDS, ...EXPORT_IDS]);

  // Streak reminder for each of the next 7 days, skipping today if already done.
  let slot = 0;
  for (let i = 0; i < 7 && slot < DAILY_IDS.length; i++) {
    const when = atHour(addDays(now, i), CONFIG.dailyReminderHour);
    if (when <= now || (i === 0 && st.doneToday)) continue;
    const n = new Notification();
    n.identifier = DAILY_IDS[slot++];
    n.title = "🔥 Spanish streak";
    // Only the next reminder can truthfully quote the current streak.
    const next = st.doneToday ? i === 1 : i === 0;
    n.body = st.streak > 0 && next
      ? `${st.streak}-day streak — do your Anki reviews before midnight.`
      : "Do today's Anki reviews to keep a streak going.";
    n.openURL = CONFIG.ankiURL;
    n.setTriggerDate(when);
    await n.schedule();
  }

  // Export reminder on the due date, repeated daily for 3 days if ignored.
  const due = s.lastExport ? addDays(parseKey(s.lastExport), CONFIG.exportEveryDays) : now;
  let start = atHour(due, CONFIG.exportReminderHour);
  if (start <= now) start = atHour(now, CONFIG.exportReminderHour);
  if (start <= now) start = addDays(start, 1);
  for (let i = 0; i < EXPORT_IDS.length; i++) {
    const n = new Notification();
    n.identifier = EXPORT_IDS[i];
    n.title = "📤 Anki stats → Claude";
    n.body = "Screenshot your Anki stats and send them to Claude for a progress review + new cards. Tap the widget to copy the prompt.";
    n.openURL = URLScheme.forRunningScript();
    n.setTriggerDate(addDays(start, i));
    await n.schedule();
  }
}

// ---------- menu ----------

async function menu(s) {
  const st = summary(s);
  const a = new Alert();
  a.title = `🔥 ${st.streak}-day streak`;
  a.message = [
    `Today: ${st.doneToday ? "✓ done" : "not yet"}`,
    `Best: ${st.best} · Last 7 days: ${st.last7}/7`,
    `Stats sent to Claude: ${st.sinceExport === null ? "never" : st.sinceExport === 0 ? "today" : `${st.sinceExport} d ago`}`,
  ].join("\n");
  const opts = [];
  if (st.doneToday) opts.push(["Undo today", "unlog"]);
  else opts.push(["Log today's practice", "log"]);
  opts.push(["Open Anki", "anki"]);
  opts.push(["Send stats to Claude (copies prompt)", "claude"]);
  opts.push(["Preview widget", "preview"]);
  for (const [label] of opts) a.addAction(label);
  a.addCancelAction("Close");
  const i = await a.presentSheet();
  if (i < 0) return;
  const action = opts[i][1];

  if (action === "anki") {
    Safari.open(CONFIG.ankiURL);
  } else if (action === "claude") {
    Pasteboard.copy(claudePrompt(st));
    applyAction(s, "exported");
    const info = new Alert();
    info.title = "Prompt copied";
    info.message = "In Claude: paste it and attach screenshots of AnkiMobile → Statistics (Today, Reviews, Future Due — 1 month).";
    info.addAction("Open Claude");
    await info.present();
    Safari.open(CONFIG.claudeURL);
  } else if (action === "preview") {
    const w = buildWidget(s, "medium");
    await w.presentMedium();
  } else {
    applyAction(s, action);
  }
}

// ---------- widget ----------

function dotsRow(parent, s, size) {
  const set = new Set(s.days);
  const row = parent.addStack();
  row.centerAlignContent();
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const k = dayKey(addDays(today, -i));
    const dot = row.addStack();
    dot.size = new Size(size, size);
    dot.cornerRadius = size / 2;
    if (set.has(k)) {
      dot.backgroundColor = Color.white();
    } else {
      dot.backgroundColor = new Color("#FFFFFF", 0.18);
      if (i === 0) {
        dot.borderColor = Color.white();
        dot.borderWidth = 1.5;
      }
    }
    if (i > 0) row.addSpacer(size * 0.45);
  }
}

function addLine(stack, text, font, color = Color.white()) {
  const t = stack.addText(text);
  t.font = font;
  t.textColor = color;
  t.lineLimit = 1;
  t.minimumScaleFactor = 0.6;
  return t;
}

function buildWidget(s, family) {
  const st = summary(s);
  const w = new ListWidget();
  w.url = URLScheme.forRunningScript();
  // Redraw just after midnight so "today" rolls over.
  const nextDay = atHour(addDays(new Date(), 1), 0);
  nextDay.setMinutes(1);
  w.refreshAfterDate = nextDay;

  if (family === "accessoryCircular") {
    w.addAccessoryWidgetBackground = true;
    const t = w.addText(`🔥\n${st.streak}`);
    t.font = Font.boldRoundedSystemFont(16);
    t.centerAlignText();
    return w;
  }
  if (family === "accessoryInline") {
    w.addText(`🔥 ${st.streak} ${st.doneToday ? "✓" : "· review today"}`);
    return w;
  }
  if (family === "accessoryRectangular") {
    addLine(w, `🔥 ${st.streak}-day streak`, Font.boldSystemFont(15));
    addLine(w, st.doneToday ? "Today ✓" : "Review today", Font.systemFont(13));
    if (st.exportDue) addLine(w, "📤 Send stats to Claude", Font.systemFont(12));
    return w;
  }

  const g = new LinearGradient();
  g.locations = [0, 1];
  g.colors = st.doneToday
    ? [ORANGE, RED]
    : [new Color("#2C2C34"), new Color("#18181D")];
  w.backgroundGradient = g;
  w.setPadding(14, 14, 14, 14);

  const main = w.addStack();
  main.layoutHorizontally();

  const left = main.addStack();
  left.layoutVertically();
  addLine(left, `${CONFIG.deckLabel} · ANKI`, Font.semiboldSystemFont(10), st.doneToday ? new Color("#FFFFFF", 0.8) : DIM);
  left.addSpacer(2);
  const numRow = left.addStack();
  numRow.bottomAlignContent();
  addLine(numRow, `${st.streak}`, Font.boldRoundedSystemFont(42), st.doneToday ? Color.white() : ORANGE);
  numRow.addSpacer(4);
  addLine(numRow, "🔥", Font.systemFont(24));
  addLine(left, "day streak", Font.mediumSystemFont(12), st.doneToday ? Color.white() : DIM);
  left.addSpacer();
  dotsRow(left, s, 9);
  left.addSpacer(6);
  const status = st.exportDue
    ? "📤 Send stats to Claude"
    : st.doneToday ? "Today ✓" : "Review today";
  addLine(left, status, Font.semiboldSystemFont(11), Color.white());

  if (family === "medium" || family === "large" || family === "extraLarge") {
    main.addSpacer();
    const right = main.addStack();
    right.layoutVertically();
    const sub = st.doneToday ? new Color("#FFFFFF", 0.8) : DIM;
    const stat = (label, value) => {
      addLine(right, label, Font.mediumSystemFont(10), sub);
      addLine(right, value, Font.boldRoundedSystemFont(18), Color.white());
      right.addSpacer(4);
    };
    stat("BEST", `${st.best} d`);
    stat("LAST 30 DAYS", `${st.last30}/30`);
    stat("STATS TO CLAUDE", st.sinceExport === null ? "never" : st.sinceExport === 0 ? "today" : `${st.sinceExport} d ago`);
  }
  return w;
}

// ---------- main ----------

const state = await load();
const rawAction = args.shortcutParameter ?? (args.queryParameters || {}).action ?? null;
const action = rawAction ? String(rawAction).trim().toLowerCase() : null;

if (config.runsInWidget) {
  Script.setWidget(buildWidget(state, config.widgetFamily || "small"));
} else if (action) {
  const result = applyAction(state, action) || `unknown action: ${action}`;
  save(state);
  try { await reschedule(state); } catch (e) { console.error(e); }
  Script.setShortcutOutput(result);
} else {
  await menu(state);
  save(state);
  await reschedule(state);
}
Script.complete();
