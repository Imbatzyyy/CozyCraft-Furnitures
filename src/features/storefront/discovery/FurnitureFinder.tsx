import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Ruler, Sparkles } from "lucide-react";
import { Layout, ProductCard, useStore, type Product } from "@/app/core";
import { CATALOG_STALE_EVENT, isCatalogStale } from "@/lib/catalog/offline-catalog";
import { FURNITURE_TYPES, emptyPreferences, trainFurnitureMatcher, type MatchPreferences } from "@/lib/intelligence/furniture-match";
import "./furniture-finder.css";

export function Component() {
  const { products, catalogReady } = useStore();
  const [stale, setStale] = useState(isCatalogStale);
  useEffect(() => {
    const update = () => setStale(isCatalogStale());
    window.addEventListener(CATALOG_STALE_EVENT, update);
    return () => window.removeEventListener(CATALOG_STALE_EVENT, update);
  }, []);
  return <Layout><FurnitureFinder products={products} ready={Boolean(catalogReady)} stale={stale} retry={() => window.dispatchEvent(new Event("cozycraft:refresh-catalog"))} /></Layout>;
}

export function FurnitureFinder({ products, ready, stale, retry }: { products: Product[]; ready: boolean; stale: boolean; retry: () => void }) {
  const [draft, setDraft] = useState(emptyPreferences);
  const [selection, setSelection] = useState<MatchPreferences | null>(null);
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState("");
  const [slow, setSlow] = useState(false);
  const resultsHeading = useRef<HTMLHeadingElement>(null);
  const model = useMemo(() => trainFurnitureMatcher(products), [products]);
  const result = useMemo(() => selection ? model.match(selection) : null, [model, selection]);
  const pages = Math.max(1, Math.ceil((result?.matches.length || 0) / 6));
  const currentPage = Math.min(page, pages);
  const results = result?.matches.slice((currentPage - 1) * 6, currentPage * 6) ?? [];
  const changed = selection && JSON.stringify(draft) !== JSON.stringify(selection);
  useEffect(() => { const timer = window.setTimeout(() => setSlow(true), 10000); return () => window.clearTimeout(timer); }, []);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!ready || stale) return;
    if (!draft.type) { setNotice("Choose the type of furniture you are looking for."); return; }
    if ([draft.budget, draft.width, draft.depth].some(v => v !== null && (!Number.isFinite(v) || v <= 0))) { setNotice("Budget and measurements must be positive numbers."); return; }
    setSelection({ ...draft }); setPage(1); setNotice("");
    // Focus after render also announces the updated result heading to keyboards.
    requestAnimationFrame(() => resultsHeading.current?.focus({ preventScroll: false }));
  };
  const number = (key: "budget" | "width" | "depth", value: string) => setDraft(v => ({ ...v, [key]: value.trim() === "" ? null : Number(value) }));
  return <main className="furniture-finder">
    <section className="finder-hero"><div><p className="finder-eyebrow"><Sparkles size={15} aria-hidden="true" /> YOUR SPACE, THOUGHTFULLY MATCHED</p><h1>Find your kind<br />of comfortable.</h1><p>A little about your space. A shortlist that makes sense. Discover real CozyCraft pieces matched to your needs with content-based AI.</p><div className="finder-assurances"><span><Check size={14} />Real catalog products</span><span><Check size={14} />Your budget respected</span><span><Check size={14} />No sign-in needed to explore</span></div></div><div className="finder-hero-note"><Ruler size={32} strokeWidth={1.2} aria-hidden="true" /><span>THOUGHTFUL CHOICES</span><p>Furniture for your life.<br />Room for your preferences.</p><Link to="/compare">Open product comparison <ArrowRight size={14} /></Link></div></section>
    <div className="finder-layout"><form className="finder-form" onSubmit={submit} aria-label="Furniture preferences">
      <p className="finder-eyebrow">01 · MAKE IT YOURS</p><h2>What are you looking for?</h2><p className="finder-muted">Choose a type. Everything else is optional.</p>
      <label>Furniture type<select required value={draft.type} onChange={e => setDraft(v => ({ ...v, type: e.target.value as MatchPreferences["type"] }))}><option value="">Choose a piece</option>{FURNITURE_TYPES.map(type => <option key={type}>{type}</option>)}</select></label>
      <label>Maximum product budget (₱)<input type="number" min="1" max="10000000" step="0.01" inputMode="decimal" placeholder="e.g. 25000" value={draft.budget ?? ""} onChange={e => number("budget", e.target.value)} /><small>Product price only. Delivery and any discounts are confirmed at checkout.</small></label>
      <fieldset><legend>Maximum furniture size · cm</legend><p className="finder-muted">Leave room for movement and access—not just the furniture itself.</p><div className="finder-size"><label>Width<input type="number" min="1" max="10000" step="0.1" inputMode="decimal" placeholder="e.g. 200" value={draft.width ?? ""} onChange={e => number("width", e.target.value)} /></label><label>Depth<input type="number" min="1" max="10000" step="0.1" inputMode="decimal" placeholder="e.g. 90" value={draft.depth ?? ""} onChange={e => number("depth", e.target.value)} /></label></div></fieldset>
      <label>Style preference<select value={draft.style} onChange={e => setDraft(v => ({ ...v, style: e.target.value }))}><option value="">Open to different styles</option>{["Modern", "Minimalist", "Traditional", "Industrial", "Scandinavian"].map(s => <option key={s}>{s}</option>)}</select></label>
      <label>Colour or material preference<input maxLength={80} placeholder="e.g. beige fabric or natural wood" value={draft.finish} onChange={e => setDraft(v => ({ ...v, finish: e.target.value }))} /></label>
      <label>What matters to you?<textarea rows={2} maxLength={160} placeholder="e.g. storage drawers, a velvet finish, or an extendable table" value={draft.needs} onChange={e => setDraft(v => ({ ...v, needs: e.target.value }))} /><small>Preferences stay on this page. Do not enter personal details.</small></label>
      {notice && <p role="alert" className="finder-error">{notice}</p>}
      {(!ready || stale) && <p role="status" className="finder-muted">{stale ? "The catalog connection needs to be refreshed before matching current stock." : slow ? "The catalog is taking longer than expected. Retry loading it." : "Loading the current collection…"}</p>}
      <button className="finder-primary" type="submit" disabled={!ready || stale}>Find my furniture <ArrowRight size={16} aria-hidden="true" /></button>
      {(stale || (!ready && slow)) && <button className="finder-secondary" type="button" onClick={retry}>Retry catalog</button>}
      <button type="button" className="finder-reset" onClick={() => { setDraft({ ...emptyPreferences }); setSelection(null); setNotice(""); setPage(1); }}>Reset preferences</button>
    </form><section className="finder-results" aria-label="Furniture matches">
      <p className="finder-eyebrow">02 · YOUR SHORTLIST</p><h2 ref={resultsHeading} tabIndex={-1}>{selection ? result?.eligible ? "Pieces worth a closer look." : "Let’s find a better fit." : "A more personal way to browse."}</h2>
      <div aria-live="polite" aria-atomic="true" className="finder-muted">{selection && `${result?.eligible || 0} available products meet your type, budget and size limits.`}</div>
      {changed && <p className="finder-note">Preferences changed. Select “Find my furniture” to update this shortlist.</p>}
      {stale && selection && <p className="finder-note">These matches are from the last loaded catalog. Refresh to check current price and stock before deciding.</p>}
      {!selection ? <div className="finder-welcome"><Sparkles size={36} strokeWidth={1} aria-hidden="true" /><h3>Less searching.<br />More finding.</h3><p>Tell us your essentials, then explore a considered shortlist. Compare details, save your favourites, or open a piece to see more.</p><ul><li>Budget and measurements are firm limits.</li><li>Style and material preferences help rank the results.</li><li>We’ll tell you when there isn’t a match.</li></ul></div> : !results.length ? <div className="finder-welcome"><h3>No matches within these limits.</h3><p>Try a different furniture type or adjust the budget or size. We won’t increase your budget or ignore your measurements automatically.</p>{(result?.missingMeasurements ?? 0) > 0 && <p>{result?.missingMeasurements} otherwise eligible products were excluded because a required measurement is missing.</p>}<Link to="/living-room" className="finder-secondary">Browse the collection</Link></div> : <>
        <p className="finder-muted finder-ranking">Ranked by catalog text and your preferences—not paid placement or a guarantee of suitability. Style preferences are not mandatory filters.</p>
        <div className="finder-grid">{results.map(({ product, reasons, width, depth }) => <div className="finder-match" key={product.id}><ProductCard product={product} /><div className="finder-reasons"><p>WHY IT’S HERE</p><ul>{reasons.map(reason => <li key={reason}><Check size={13} aria-hidden="true" />{reason}</li>)}</ul>{width !== null && depth !== null && <span>Listed size: {Number(width.toFixed(1))} W × {Number(depth.toFixed(1))} D cm</span>}</div></div>)}</div>
        {pages > 1 && <nav className="finder-pagination" aria-label="Furniture match pages"><button type="button" disabled={currentPage === 1} onClick={() => { setPage(currentPage - 1); resultsHeading.current?.focus(); }}>Previous</button><span>Page {currentPage} of {pages}</span><button type="button" disabled={currentPage === pages} onClick={() => { setPage(currentPage + 1); resultsHeading.current?.focus(); }}>Next</button></nav>}
        <p className="finder-muted">Size matching uses listed product measurements, not a room survey. Check doors, stairs, assembly space and walking clearance before ordering. Stock and prices can change.</p>
      </>}
      <details className="finder-method"><summary>How your matches are chosen</summary><p>A content-based recommendation model learns word importance from the current catalog using TF-IDF and ranks eligible pieces with cosine similarity. It compares the product’s name, type, finish, material and description with your stated preferences. This is text matching—not image recognition or a claim to understand your entire room.</p><p>Type, price, stock and entered dimensions are checked separately. Products with unknown required measurements are not labelled as fitting. Equal text matches are ordered by price, then product ID. No personal browsing history or external AI API is used; no preference data is saved by this tool.</p></details>
    </section></div>
  </main>;
}
