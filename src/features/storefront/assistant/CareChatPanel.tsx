import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { ArrowUp, MessageCircle, RotateCcw, X } from "lucide-react";
import { askCare, type AssistantRequest } from "./assistant.service";
import { containsSensitiveChatData, conversationKey, greeting, persistConversation, readConversation, replyBlocks, type CareMessage } from "./conversation";
import "./care-chat.css";

export function CareReply({ message, onNavigate }: { message: CareMessage; onNavigate: () => void }) {
  return <div className="care-reply">
    {replyBlocks(message.text).map((block, index) => block.kind === "steps" ? <ol key={index}>{block.lines.map((line, i) => <li key={i}>{line}</li>)}</ol> : <p key={index}>{block.lines.map((line, i) => <span key={i}>{i > 0 && <br />}{line}</span>)}</p>)}
    {!!message.actions?.length && <nav className="care-actions" aria-label="Suggested next steps">{message.actions.map(action => <Link key={action.href} to={action.href} onClick={onNavigate}>{action.label}</Link>)}</nav>}
    {!!message.sources?.length && <small className="care-sources">Based on {message.sources.join(" and ").toLowerCase()}.</small>}
  </div>;
}

export function CareChatPanel({ ownerId, currentPath, raisedForComparison = false }: { ownerId: string | null; currentPath: string; raisedForComparison?: boolean }) {
  const key = conversationKey(ownerId ?? "guest");
  const [messages, setMessages] = useState<CareMessage[]>(() => readConversation(key));
  const [open, setOpen] = useState(false), [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false), [error, setError] = useState("");
  const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && navigator.onLine === false);
  const [cooldown, setCooldown] = useState(0), [clearConfirm, setClearConfirm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [viewport, setViewport] = useState<{ height: number; top: number } | null>(null);
  const busy = useRef(false), alive = useRef(true), generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const retry = useRef<AssistantRequest | null>(null);
  const transcript = useRef<HTMLDivElement>(null), opener = useRef<HTMLButtonElement>(null), panel = useRef<HTMLElement>(null);
  const previousOpen = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; generation.current++; controller.current?.abort(); };
  }, []);
  useEffect(() => { persistConversation(key, messages); }, [messages, key]);
  useEffect(() => {
    const online = () => setOffline(navigator.onLine === false);
    const focus = () => { const active = document.activeElement; setEditing(active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement || active instanceof HTMLElement && active.isContentEditable); };
    window.addEventListener("online", online); window.addEventListener("offline", online);
    document.addEventListener("focusin", focus); document.addEventListener("focusout", focus);
    return () => { window.removeEventListener("online", online); window.removeEventListener("offline", online); document.removeEventListener("focusin", focus); document.removeEventListener("focusout", focus); };
  }, []);
  useEffect(() => {
    if (!open) { if (previousOpen.current) opener.current?.focus(); previousOpen.current = false; return; }
    previousOpen.current = true;
    panel.current?.focus({ preventScroll: true });
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const update = () => setViewport(window.visualViewport ? { height: window.visualViewport.height, top: window.visualViewport.offsetTop } : null);
    update(); window.visualViewport?.addEventListener("resize", update); window.visualViewport?.addEventListener("scroll", update);
    return () => { document.body.style.overflow = priorOverflow; window.visualViewport?.removeEventListener("resize", update); window.visualViewport?.removeEventListener("scroll", update); };
  }, [open]);
  useEffect(() => { if (!cooldown) return; const timer = window.setTimeout(() => setCooldown(value => Math.max(0, value - 1)), 1000); return () => clearTimeout(timer); }, [cooldown]);
  useEffect(() => { if (open && transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight; }, [messages, sending, open]);
  const send = async (text: string, retrying = false) => {
    const value = text.trim();
    if ((!value && !retrying) || busy.current || cooldown) return;
    if (offline || navigator.onLine === false) { setError("You’re offline. Your message has not been sent. Reconnect, then try again."); return; }
    if (containsSensitiveChatData(value)) { setError("Please remove passwords, verification codes, wallet PINs or card numbers. Tell me which step is not working without including those details."); return; }
    const body: AssistantRequest = retrying && retry.current ? retry.current : { message: value, currentPath, history: messages.filter(item => item.includeInContext !== false).slice(-6).map(item => ({ role: item.from === "you" ? "user" : "assistant", content: item.text.slice(0, 600) })) };
    busy.current = true; setSending(true); setError(""); setClearConfirm(false);
    if (!retrying) { setDraft(""); setMessages(current => [...current.slice(-22), { from: "you", text: value }]); }
    retry.current = body;
    const run = ++generation.current;
    const abort = new AbortController(); controller.current = abort;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // Race also bounds a stuck auth getSession, not just the HTTP fetch.
      const result = await Promise.race([askCare(body, ownerId, abort.signal), new Promise<never>((_, reject) => { timer = setTimeout(() => { abort.abort(); reject(new Error("This answer took too long. Please retry your message or open Help and Support.")); }, 32_000); })]);
      if (!alive.current || run !== generation.current) return;
      setMessages(current => [...current.slice(-23), result.message]); setCooldown(result.retryAfter); retry.current = null;
    } catch (cause) {
      if (alive.current && run === generation.current) setError(cause instanceof Error ? cause.message : "I couldn’t load an answer. Please try again.");
    } finally {
      clearTimeout(timer);
      if (run === generation.current) { busy.current = false; if (alive.current) setSending(false); }
    }
  };
  const suggestions = currentPath.includes("home-circle") ? ["How do I convert points to vouchers?", "Why is my voucher unavailable?"] : currentPath === "/cart" || currentPath.startsWith("/checkout") ? ["Where do I enter the checkout email code?", "I paid with GCash but payment is pending"] : ["Find a sofa within my budget", "Track my latest order", "How do I use Home Circle vouchers?", "How do I change my phone number?"];
  const close = () => { setEditing(false); setOpen(false); };
  const keyboard = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") { event.preventDefault(); close(); }
    if (event.key !== "Tab") return;
    const controls = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],textarea:not(:disabled)') ?? []);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first?.focus(); }
  };
  return <>
    <button ref={opener} type="button" className={`care-launch ${raisedForComparison ? "care-launch-raised" : ""}`} hidden={open || editing} onClick={() => setOpen(true)} aria-label="Open CozyCraft chat" aria-haspopup="dialog"><MessageCircle size={23} /></button>
    {open && createPortal(<div className="care-chat-layer" style={viewport ? { top: viewport.top, height: viewport.height } as CSSProperties : undefined}>
      <div className="care-chat-backdrop" onClick={close} aria-hidden="true" />
      <section ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="care-chat-title" data-cozy-focus-managed className="care-panel" onKeyDown={keyboard}>
        <header className="care-header"><div><p id="care-chat-title">CozyCraft Care</p><span>{offline ? "Offline · reconnect to send" : sending ? "Finding the right guidance…" : "AI shopping and website guide"}</span></div><button type="button" aria-label="Close chat" onClick={close}><X size={21} /></button></header>
        <div className="care-toolbar"><Link to="/profile?tab=support" onClick={close}>Contact support</Link><button type="button" onClick={() => setClearConfirm(value => !value)} disabled={sending}><RotateCcw size={13} /> New conversation</button></div>
        {clearConfirm && <div className="care-clear" role="group" aria-label="Start a new conversation"><p>Clear this conversation from this tab?</p><button type="button" onClick={() => { setMessages(greeting()); setDraft(""); setError(""); retry.current = null; setClearConfirm(false); }}>Start new</button><button type="button" onClick={() => setClearConfirm(false)}>Keep conversation</button></div>}
        <div className="care-transcript" ref={transcript} role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions">
          {messages.map((message, index) => <article key={index} className={`care-message care-message-${message.from}`} aria-label={message.from === "you" ? "You" : "Cozy"}>{message.from === "you" ? <p>{message.text}</p> : <CareReply message={message} onNavigate={close} />}</article>)}
          {sending && <p className="care-thinking" role="status">Checking the relevant details…</p>}
          {messages.length === 1 && <div className="care-suggestions"><p>A few things I can help with</p>{suggestions.map(item => <button key={item} type="button" onClick={() => void send(item)} disabled={sending || offline}>{item}</button>)}</div>}
        </div>
        {error && <div className="care-error" role="alert"><p>{error}</p>{retry.current && <button type="button" disabled={sending || offline || !!cooldown} onClick={() => void send("", true)}>Retry message</button>}<Link to="/faq" onClick={close}>Open Help</Link></div>}
        <form className="care-composer" onSubmit={event => { event.preventDefault(); void send(draft); }}><div><textarea rows={2} aria-label="Chat message" placeholder="What would you like help with?" maxLength={2000} value={draft} onChange={event => setDraft(event.target.value)} disabled={sending} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(draft); } }} /><button type="submit" aria-label={sending ? "Sending message" : "Send message"} disabled={sending || offline || !!cooldown || !draft.trim()}><ArrowUp size={21} /></button></div><p>{cooldown ? `Please wait ${cooldown}s before another message. ` : ""}AI guidance can be imperfect. Never share passwords, codes or card details.</p></form>
      </section>
    </div>, document.body)}
  </>;
}
