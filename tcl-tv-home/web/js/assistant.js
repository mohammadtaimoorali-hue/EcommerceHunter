// Voice assistant: listen -> handle simple commands instantly (offline) ->
// otherwise ask Claude, which can also act on the TV through tools
// (open apps, set timers, pin notes, search YouTube) -> speak the answer.

import Anthropic from "../vendor/anthropic.mjs";
import { registerLayer, openLayer, closeTop, current, setFocus } from "./nav.js";
import { listen, speak, stopSpeaking, canListen } from "./bridge.js";
import { getSettings } from "./store.js";
import { weatherSummary } from "./weather.js";

const MODEL = "claude-opus-5-5";

const SYSTEM = `You are the voice assistant built into a living-room TV home screen.
Your replies are read aloud by text-to-speech and shown in a small caption card, so answer in one to three short, natural sentences with no markdown, lists, emoji or URLs.
Use the tools when the person asks you to do something on the TV: open an app, play or search something on YouTube, set a timer, or pin a note to the screen. After a tool runs, confirm briefly what you did.
If a request needs something you cannot do from the TV, say so plainly in one sentence.`;

const TOOLS = [
  {
    name: "open_app",
    description: "Open an installed TV app by its name, for example Netflix, YouTube, Disney+, Spotify or Settings.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { app: { type: "string", description: "The app name as the person said it." } },
      required: ["app"],
      additionalProperties: false,
    },
  },
  {
    name: "youtube_search",
    description: "Open YouTube on the TV with search results for a query. Use it for requests to play music, videos or shows on YouTube.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "set_timer",
    description: "Start a countdown timer shown on the home screen. It chimes and speaks when done.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        minutes: { type: "number", description: "Length of the timer in minutes; may be fractional." },
        label: { type: "string", description: "Short name such as Pasta or Homework; empty if none." },
      },
      required: ["minutes", "label"],
      additionalProperties: false,
    },
  },
  {
    name: "pin_note",
    description: "Pin a short text note on the TV home screen for the household to see, for example a reminder or a message.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
      additionalProperties: false,
    },
  },
];

let actions = null;     // provided by app.js
let history = [];       // Claude conversation (append-only; reset instead of trimming)
let lastTurnAt = 0;
let busy = false;

const $ = (id) => document.getElementById(id);

function setState(state) {
  const el = $("assistant");
  el.classList.toggle("listening", state === "listening");
  el.classList.toggle("thinking", state === "thinking");
}

function show(heard, reply) {
  if (heard !== undefined) $("heard").textContent = heard ? `“${heard}”` : "";
  if (reply !== undefined) $("reply").textContent = reply;
}

function contextLine() {
  const s = getSettings();
  const now = new Date();
  const when = now.toLocaleString(undefined, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
  const parts = [`It is ${when}.`];
  const wx = weatherSummary();
  if (wx) parts.push(`Weather: ${wx}.`);
  if (s.name) parts.push(`The person's name is ${s.name}.`);
  const apps = actions.appNames().slice(0, 40).join(", ");
  if (apps) parts.push(`Installed apps: ${apps}.`);
  return `[TV context: ${parts.join(" ")}]`;
}

// ----- instant local commands (work offline and without an API key) -----
function localCommand(text) {
  const t = text.toLowerCase().trim().replace(/[.!?]+$/, "");
  let m;
  if ((m = t.match(/^(?:play|search(?: for)?)\s+(.+?)\s+on youtube$/))) {
    return actions.youtube(m[1]);
  }
  if ((m = t.match(/^(?:open|launch|start|go to)\s+(.+)$/))) {
    const r = actions.openApp(m[1]);
    if (r.ok) return r.message;
  }
  if ((m = t.match(/(?:set (?:a )?)?timer (?:for )?(\d+(?:\.\d+)?)\s*(second|minute|hour)s?/)) ||
      (m = t.match(/(\d+(?:\.\d+)?)\s*(second|minute|hour)s? timer/))) {
    const n = parseFloat(m[1]);
    const mins = m[2] === "hour" ? n * 60 : m[2] === "second" ? n / 60 : n;
    return actions.setTimer(mins, "");
  }
  if (/^(?:let me |i want to )?(?:draw|drawing mode|open draw)/.test(t)) { actions.openDraw(); return "Drawing mode is on. Press back for tools."; }
  if (/^clear (?:the )?(?:drawing|screen|board)$/.test(t)) { actions.clearDrawing(); return "Cleared."; }
  if (/^(?:clear|delete|remove) (?:all )?(?:the )?(?:notes|messages)$/.test(t)) { actions.clearMessages(); return "All notes cleared."; }
  if (/^(?:screensaver|ambient mode|ambient)$/.test(t)) { setTimeout(actions.ambient, 1500); return "Going ambient."; }
  if (/^(?:open )?(?:appearance|settings)$/.test(t)) { setTimeout(actions.settings, 600); return "Opening appearance."; }
  if ((m = t.match(/^(?:pin|post|leave) (?:a )?(?:note|message)(?: saying| that says)?\s+(.+)$/))) { return actions.pinNote(m[1]); }
  return null;
}

async function runTool(block) {
  const input = block.input || {};
  try {
    if (block.name === "open_app") return actions.openApp(String(input.app || "")).message;
    if (block.name === "youtube_search") return actions.youtube(String(input.query || ""));
    if (block.name === "set_timer") return actions.setTimer(Number(input.minutes) || 1, String(input.label || ""));
    if (block.name === "pin_note") return actions.pinNote(String(input.text || ""));
    return `Unknown tool ${block.name}`;
  } catch (e) {
    return `Error: ${e.message}`;
  }
}

async function askClaude(text) {
  const s = getSettings();
  if (!s.apiKey) {
    return "Add your Claude API key in Appearance to ask me anything. I can still open apps, set timers and draw.";
  }
  // Start a fresh conversation after 10 idle minutes or once it gets long.
  if (Date.now() - lastTurnAt > 10 * 60 * 1000 || history.length > 24) history = [];
  lastTurnAt = Date.now();

  const client = new Anthropic({ apiKey: s.apiKey, dangerouslyAllowBrowser: true });
  const turnStart = history.length;
  history.push({ role: "user", content: `${contextLine()}\n${text}` });

  try {
    for (let step = 0; step < 4; step++) {
      const resp = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 1024, // replies are spoken, so they are deliberately short
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low" },
        system: SYSTEM,
        tools: TOOLS,
        messages: history,
      });
      // Pass the content back unchanged (it may contain thinking or fallback blocks).
      history.push({ role: "assistant", content: resp.content });

      if (resp.stop_reason === "refusal") {
        return "Sorry, I can't help with that one.";
      }
      const toolUses = resp.content.filter((b) => b.type === "tool_use");
      if (resp.stop_reason === "tool_use" && toolUses.length) {
        const results = [];
        for (const b of toolUses) {
          results.push({ type: "tool_result", tool_use_id: b.id, content: await runTool(b) });
        }
        history.push({ role: "user", content: results }); // all results in one message
        continue;
      }
      const reply = resp.content.filter((b) => b.type === "text").map((b) => b.text).join(" ").trim();
      return reply || "Done.";
    }
    return "Done.";
  } catch (e) {
    // Drop the failed turn so the conversation stays valid.
    history = history.slice(0, turnStart);
    if (e instanceof Anthropic.AuthenticationError) return "Your Claude API key was rejected. Check it in Appearance.";
    if (e instanceof Anthropic.RateLimitError) return "I'm being rate limited. Try again in a moment.";
    if (e instanceof Anthropic.APIConnectionError) return "I can't reach the internet right now.";
    if (e instanceof Anthropic.APIError) return `Claude returned an error (${e.status || "unknown"}).`;
    return "Something went wrong.";
  }
}

export async function handleUtterance(text) {
  if (!text) return;
  busy = true;
  show(text, "…");
  setState("thinking");
  let reply = localCommand(text);
  if (reply === null) reply = await askClaude(text);
  busy = false;
  setState("idle");
  show(undefined, reply);
  if (getSettings().voiceReplies) speak(reply);
}

async function talk() {
  if (busy) return;
  stopSpeaking();
  if (!canListen()) {
    show("", "Voice input isn't available here. Choose Type to ask.");
    return;
  }
  setState("listening");
  show("", "Listening…");
  const text = await listen();
  if (current() !== "assistant") return;
  if (!text) { setState("idle"); show("", "I didn't catch that. Press OK to try again."); return; }
  handleUtterance(text);
}

function typeMode() {
  const input = $("assistant-input");
  input.classList.remove("hidden");
  input.value = "";
  input.focus();
}

export function openAssistant(opts) {
  openLayer("assistant", opts);
}

// Called from the phone remote or the voice result of the Android app.
export function askFromText(text) {
  if (current() !== "assistant") openLayer("assistant", { silent: true });
  handleUtterance(text);
}

export function onVoiceResult(text) {
  if (window.__voiceResolve) { const r = window.__voiceResolve; window.__voiceResolve = null; r(text || ""); }
}

export function initAssistant(acts) {
  actions = acts;
  document.querySelectorAll("#assistant-actions .tool").forEach((b) => {
    b.addEventListener("click", () => {
      const a = b.getAttribute("data-act");
      if (a === "talk") talk();
      if (a === "type") typeMode();
      if (a === "close") closeTop();
    });
  });
  const input = $("assistant-input");
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && input.value.trim()) {
      const q = input.value.trim();
      input.value = "";
      input.blur();
      input.classList.add("hidden");
      setFocus(document.querySelector('#assistant-actions [data-act="talk"]'));
      handleUtterance(q);
    }
  });
  registerLayer("assistant", {
    onShow(opts) {
      show("", opts && opts.silent ? "" : "Listening…");
      setFocus(document.querySelector('#assistant-actions [data-act="talk"]'));
      if (!(opts && opts.silent)) talk();
    },
    onHide() {
      stopSpeaking();
      setState("idle");
      $("assistant-input").classList.add("hidden");
      if (window.__voiceResolve) onVoiceResult("");
    },
  });
}
