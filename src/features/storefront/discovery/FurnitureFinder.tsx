import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Ruler, Sparkles } from "lucide-react";
import { Layout, ProductCard, useStore, type Product } from "@/app/core";
import {
  CATALOG_STALE_EVENT,
  isCatalogStale,
} from "@/lib/catalog/offline-catalog";
import {
  FURNITURE_TYPES,
  emptyPreferences,
  furnitureType,
  trainFurnitureMatcher,
  type MatchPreferences,
} from "@/lib/intelligence/furniture-match";
import {
  COLORS,
  MATERIALS,
  type VisualProfile,
} from "../../../../supabase/functions/_shared/furniture-discovery";
import { interpretFurniture, loadVisualProfiles } from "./discovery.service";
import "./furniture-finder.css";

export function Component() {
  const { products, catalogReady } = useStore();
  const [stale, setStale] = useState(isCatalogStale);
  const [profiles, setProfiles] = useState<VisualProfile[]>([]);
  const [photoError, setPhotoError] = useState("");
  const [photoLoading, setPhotoLoading] = useState(true);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setPhotoLoading(true);
    setPhotoError("");
    void loadVisualProfiles(reload > 0)
      .then((rows) => {
        if (active) setProfiles(rows);
      })
      .catch(() => {
        if (active)
          setPhotoError(
            "Photo observations could not be loaded. Only confirmed catalog colours can be matched until you retry.",
          );
      })
      .finally(() => {
        if (active) setPhotoLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reload]);
  useEffect(() => {
    const update = () => setStale(isCatalogStale());
    window.addEventListener(CATALOG_STALE_EVENT, update);
    return () => window.removeEventListener(CATALOG_STALE_EVENT, update);
  }, []);
  return (
    <Layout>
      <FurnitureFinder
        products={products}
        profiles={profiles}
        photoError={photoError}
        ready={Boolean(catalogReady) && !photoLoading}
        stale={stale}
        retry={() => {
          setReload((v) => v + 1);
          window.dispatchEvent(new Event("cozycraft:refresh-catalog"));
        }}
      />
    </Layout>
  );
}

export function FurnitureFinder({
  products,
  profiles = [],
  photoError = "",
  ready,
  stale,
  retry,
}: {
  products: Product[];
  profiles?: VisualProfile[];
  photoError?: string;
  ready: boolean;
  stale: boolean;
  retry: () => void;
}) {
  const [draft, setDraft] = useState<MatchPreferences>({ ...emptyPreferences });
  const [selection, setSelection] = useState<MatchPreferences | null>(null);
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState("");
  const [slow, setSlow] = useState(false);
  const [searching, setSearching] = useState(false);
  const request = useRef<AbortController | null>(null);
  const resultsHeading = useRef<HTMLHeadingElement>(null);
  const model = useMemo(
    () => trainFurnitureMatcher(products, profiles),
    [products, profiles],
  );
  const result = useMemo(
    () => (selection ? model.match(selection) : null),
    [model, selection],
  );
  const pages = Math.max(1, Math.ceil((result?.matches.length || 0) / 6));
  const currentPage = Math.min(page, pages);
  const results =
    result?.matches.slice((currentPage - 1) * 6, currentPage * 6) ?? [];
  const changed =
    selection &&
    JSON.stringify(draft) !==
      JSON.stringify({ ...selection, intent: undefined });
  const subtypes = useMemo(
    () =>
      [
        ...new Set(
          products
            .filter(
              (p) =>
                p.status === "active" &&
                (!draft.type || furnitureType(p) === draft.type),
            )
            .map((p) => p.subcategory)
            .filter((s): s is string => Boolean(s)),
        ),
      ].sort(),
    [products, draft.type],
  );
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 10000);
    return () => {
      window.clearTimeout(timer);
      request.current?.abort();
    };
  }, []);
  const update = (values: Partial<MatchPreferences>) => {
    request.current?.abort();
    request.current = null;
    setSearching(false);
    setDraft((v) => ({ ...v, ...values }));
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!ready || stale || searching) return;
    if (
      [draft.budget, draft.width, draft.depth, draft.height].some(
        (v) => v != null && (!Number.isFinite(v) || v <= 0),
      )
    ) {
      setNotice("Budget and measurements must be positive numbers.");
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 25000);
    setSearching(true);
    setNotice("");
    setSelection(null);
    try {
      const limits = [
        draft.budget != null
          ? `Maximum product budget: ${draft.budget.toFixed(2)} pesos.`
          : "",
        ...(["width", "depth", "height"] as const).map((axis) =>
          draft[axis] != null
            ? `Maximum overall ${axis}: ${draft[axis]!.toFixed(2)} cm.`
            : "",
        ),
      ]
        .filter(Boolean)
        .join(" ");
      const intent = draft.needs.trim()
        ? await interpretFurniture(
            `${draft.needs}\n${limits ? `Additional maximum limits (keep the smaller value if two are given): ${limits}` : ""}`.trim(),
            controller.signal,
          )
        : undefined;
      if (controller.signal.aborted || request.current !== controller) return;
      setSelection({ ...draft, intent });
      setPage(1);
      requestAnimationFrame(() => resultsHeading.current?.focus());
    } catch (error) {
      if (request.current === controller)
        setNotice(
          controller.signal.aborted
            ? "Search took too long. Retry, or clear the description and use the filters."
            : error instanceof Error
              ? error.message
              : "Search unavailable.",
        );
    } finally {
      window.clearTimeout(timeout);
      if (request.current === controller) {
        request.current = null;
        setSearching(false);
      }
    }
  };
  const number = (
    key: "budget" | "width" | "depth" | "height",
    value: string,
  ) => update({ [key]: value.trim() === "" ? null : Number(value) });
  const selectedLimit = (key: "budget" | "width" | "depth" | "height") => {
    const a = selection?.[key],
      b = selection?.intent?.[key];
    return a != null && b != null ? Math.min(a, b) : (a ?? b);
  };
  const requirements = selection
    ? [
        selection.type || selection.intent?.type,
        selection.subtype || selection.intent?.subtype,
        selection.color,
        selection.material,
        ...(selection.intent?.colors ?? []),
        ...(selection.intent?.materials ?? []),
        ...(selection.intent?.features ?? []),
        ...(selection.intent?.excludedColors ?? []).map((v) => `Not ${v}`),
        ...(selection.intent?.excludedMaterials ?? []).map((v) => `No ${v}`),
        ...(selection.intent?.excludedFeatures ?? []).map(
          (v) => `Without ${v}`,
        ),
        selectedLimit("budget")
          ? `Up to ₱${selectedLimit("budget")!.toLocaleString()}`
          : "",
        ...(["width", "depth", "height"] as const).map((k) =>
          selectedLimit(k) ? `${k} ≤ ${selectedLimit(k)} cm` : "",
        ),
      ].filter(Boolean)
    : [];
  return (
    <main className="furniture-finder">
      <section className="finder-hero">
        <div>
          <p className="finder-eyebrow">
            <Sparkles size={15} aria-hidden="true" /> YOUR SPACE, THOUGHTFULLY
            MATCHED
          </p>
          <h1>
            Find your kind
            <br />
            of comfortable.
          </h1>
          <p>
            A little about your space. A shortlist that makes sense. Discover
            real CozyCraft pieces using catalog specifications and AI
            observations of our product photos.
          </p>
          <div className="finder-assurances">
            <span>
              <Check size={14} />
              Real catalog products
            </span>
            <span>
              <Check size={14} />
              Your budget respected
            </span>
            <span>
              <Check size={14} />
              No sign-in needed to explore
            </span>
          </div>
        </div>
        <div className="finder-hero-note">
          <Ruler size={32} strokeWidth={1.2} aria-hidden="true" />
          <span>THOUGHTFUL CHOICES</span>
          <p>
            Furniture for your life.
            <br />
            Room for your preferences.
          </p>
          <Link to="/compare">
            Open product comparison <ArrowRight size={14} />
          </Link>
        </div>
      </section>
      <div className="finder-layout">
        <form
          className="finder-form"
          onSubmit={submit}
          aria-label="Furniture preferences"
          aria-busy={searching}
        >
          <p className="finder-eyebrow">01 · MAKE IT YOURS</p>
          <h2>What are you looking for?</h2>
          <p className="finder-muted">
            Describe it naturally, use the filters, or combine both. English and
            Filipino are supported.
          </p>
          <label>
            Furniture type
            <select
              value={draft.type}
              onChange={(e) =>
                update({
                  type: e.target.value as MatchPreferences["type"],
                  subtype: "",
                })
              }
            >
              <option value="">All furniture types</option>
              {FURNITURE_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          <label>
            Specific product type
            <select
              value={draft.subtype || ""}
              onChange={(e) => update({ subtype: e.target.value })}
            >
              <option value="">Any matching type</option>
              {subtypes.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          <label>
            Describe your ideal piece
            <textarea
              rows={4}
              maxLength={400}
              placeholder="e.g. A grey two-seater fabric sofa under ₱15,000, no wider than 150 cm. Not leather."
              value={draft.needs}
              onChange={(e) => update({ needs: e.target.value })}
            />
            <small>
              Furniture details only—no personal information. Your description
              and selected size or budget limits are processed by our AI
              provider. They are not saved to your account.
            </small>
          </label>
          <label>
            Colour family
            <select
              value={draft.color || ""}
              onChange={(e) => update({ color: e.target.value })}
            >
              <option value="">Any colour</option>
              {COLORS.map((c) => (
                <option key={c} value={c}>
                  {c[0].toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Required material
            <select
              value={draft.material || ""}
              onChange={(e) => update({ material: e.target.value })}
            >
              <option value="">Any material</option>
              {MATERIALS.map((m) => (
                <option key={m} value={m}>
                  {m[0].toUpperCase() + m.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Maximum product budget (₱)
            <input
              type="number"
              min="1"
              max="10000000"
              step="0.01"
              inputMode="decimal"
              placeholder="e.g. 25000"
              value={draft.budget ?? ""}
              onChange={(e) => number("budget", e.target.value)}
            />
            <small>
              Product price only. Delivery and any discounts are confirmed at
              checkout.
            </small>
          </label>
          <fieldset>
            <legend>Maximum furniture size · cm</legend>
            <p className="finder-muted">
              Use overall dimensions. Depth also checks listed bed/table length.
              Extendable tables use their maximum length—not the folded size.
            </p>
            <div className="finder-size">
              <label>
                Width
                <input
                  type="number"
                  min="1"
                  max="10000"
                  step="0.1"
                  inputMode="decimal"
                  placeholder="e.g. 200"
                  value={draft.width ?? ""}
                  onChange={(e) => number("width", e.target.value)}
                />
              </label>
              <label>
                Depth / length
                <input
                  type="number"
                  min="1"
                  max="10000"
                  step="0.1"
                  inputMode="decimal"
                  placeholder="e.g. 90"
                  value={draft.depth ?? ""}
                  onChange={(e) => number("depth", e.target.value)}
                />
              </label>
            </div>
          </fieldset>
          <label>
            Maximum height · cm
            <input
              type="number"
              min="1"
              max="10000"
              step="0.1"
              inputMode="decimal"
              value={draft.height ?? ""}
              onChange={(e) => number("height", e.target.value)}
            />
          </label>
          <label>
            Style preference
            <select
              value={draft.style}
              onChange={(e) => update({ style: e.target.value })}
            >
              <option value="">Open to different styles</option>
              {[
                "Modern",
                "Minimalist",
                "Traditional",
                "Industrial",
                "Scandinavian",
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <small>
              Style influences ranking, not verified specifications.
            </small>
          </label>
          {photoError && (
            <p role="status" className="finder-note">
              {photoError}{" "}
              <button type="button" onClick={retry}>
                Retry photo matching
              </button>
            </p>
          )}
          {ready && !photoError && model.colorCoverage < model.catalogSize && (
            <p className="finder-note">
              Colour matching is ready for {model.colorCoverage} of{" "}
              {model.catalogSize} products. Photos still being analysed or
              awaiting confirmation are excluded from colour-specific matches.{" "}
              <button type="button" onClick={retry}>
                Refresh photo matching
              </button>
            </p>
          )}
          {notice && (
            <p role="alert" className="finder-error">
              {notice}
            </p>
          )}
          {(!ready || stale) && (
            <p role="status" className="finder-muted">
              {stale
                ? "The catalog connection needs to be refreshed before matching current stock."
                : slow
                  ? "The catalog is taking longer than expected. Retry loading it."
                  : "Loading the current collection…"}
            </p>
          )}
          <button
            className="finder-primary"
            type="submit"
            disabled={!ready || stale || searching}
          >
            {searching ? "Understanding your request…" : "Find my furniture"}{" "}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
          {(stale || (!ready && slow)) && (
            <button className="finder-secondary" type="button" onClick={retry}>
              Retry catalog
            </button>
          )}
          <button
            type="button"
            className="finder-reset"
            onClick={() => {
              request.current?.abort();
              request.current = null;
              setSearching(false);
              setDraft({ ...emptyPreferences });
              setSelection(null);
              setNotice("");
              setPage(1);
            }}
          >
            Reset preferences
          </button>
        </form>
        <section className="finder-results" aria-label="Furniture matches">
          <p className="finder-eyebrow">02 · YOUR SHORTLIST</p>
          <h2 ref={resultsHeading} tabIndex={-1}>
            {selection
              ? result?.eligible
                ? "Pieces worth a closer look."
                : "Let’s find a better fit."
              : "A more personal way to browse."}
          </h2>
          <div aria-live="polite" aria-atomic="true" className="finder-muted">
            {searching
              ? "Understanding your requirements…"
              : selection &&
                !result?.error &&
                `${result?.eligible || 0} available product${result?.eligible === 1 ? "" : "s"} meet${result?.eligible === 1 ? "s" : ""} the interpreted requirements.`}
          </div>
          {requirements.length > 0 && (
            <div className="finder-understood">
              <p>YOUR REQUEST, UNDERSTOOD AS</p>
              <ul>
                {[...new Set(requirements)].map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
              <small>
                Check these before choosing. Edit your description if something
                is not what you intended.
              </small>
            </div>
          )}
          {result?.error && (
            <p className="finder-note" role="alert">
              {result.error}
            </p>
          )}
          {changed && (
            <p className="finder-note">
              Preferences changed. Select “Find my furniture” to update this
              shortlist.
            </p>
          )}
          {stale && selection && (
            <p className="finder-note">
              These matches are from the last loaded catalog. Refresh to check
              current price and stock before deciding.
            </p>
          )}
          {!selection ? (
            <div className="finder-welcome">
              <Sparkles size={36} strokeWidth={1} aria-hidden="true" />
              <h3>
                Less searching.
                <br />
                More finding.
              </h3>
              <p>
                Tell us your essentials, then explore a considered shortlist.
                Compare details, save your favourites, or open a piece to see
                more.
              </p>
              <ul>
                <li>Budget and measurements are firm limits.</li>
                <li>
                  Colours, materials and requested features are requirements.
                </li>
                <li>We’ll tell you when there isn’t a match.</li>
              </ul>
            </div>
          ) : result?.error ? (
            <div className="finder-welcome">
              <h3>A little more detail will help.</h3>
              <p>
                Review the message above, then edit your description or use the
                filters. We have not broadened your request to show unrelated
                products.
              </p>
            </div>
          ) : !results.length ? (
            <div className="finder-welcome">
              <h3>No confirmed matches within these limits.</h3>
              <p>
                No available piece has enough confirmed details to meet every
                interpreted requirement. We have not relaxed your colours,
                materials, size or budget. Edit the request or remove a filter
                to explore alternatives.
              </p>
              {(result?.missingMeasurements ?? 0) > 0 && (
                <p>
                  {result?.missingMeasurements} otherwise eligible products were
                  excluded because a required measurement is missing.
                </p>
              )}
              <Link to="/living-room" className="finder-secondary">
                Browse the collection
              </Link>
            </div>
          ) : (
            <>
              <p className="finder-muted finder-ranking">
                Matched against your requirements, then ranked by catalog text
                and style preference. Photo colours are observations, not
                guaranteed colour measurements.
              </p>
              <div className="finder-grid">
                {results.map(({ product, reasons, width, depth, height }) => (
                  <div className="finder-match" key={product.id}>
                    <ProductCard product={product} />
                    <div className="finder-reasons">
                      <p>WHY IT MATCHES</p>
                      <ul>
                        {reasons.map((reason) => (
                          <li key={reason}>
                            <Check size={13} aria-hidden="true" />
                            {reason}
                          </li>
                        ))}
                      </ul>
                      {width !== null && depth !== null && (
                        <span>
                          Listed size: {Number(width.toFixed(1))} W ×{" "}
                          {Number(depth.toFixed(1))}{" "}
                          {furnitureType(product) === "Bed" ? "L" : "D"}
                          {height !== null
                            ? ` × ${Number(height.toFixed(1))} H`
                            : ""}{" "}
                          cm
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {pages > 1 && (
                <nav
                  className="finder-pagination"
                  aria-label="Furniture match pages"
                >
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => {
                      setPage(currentPage - 1);
                      resultsHeading.current?.focus();
                    }}
                  >
                    Previous
                  </button>
                  <span>
                    Page {currentPage} of {pages}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage === pages}
                    onClick={() => {
                      setPage(currentPage + 1);
                      resultsHeading.current?.focus();
                    }}
                  >
                    Next
                  </button>
                </nav>
              )}
              <p className="finder-muted">
                Size matching uses listed product measurements, not a room
                survey. Check doors, stairs, assembly space and walking
                clearance before ordering. Stock and prices can change.
              </p>
            </>
          )}
          <details className="finder-method">
            <summary>How photo-aware matching works</summary>
            <p>
              Existing product photos are analysed once and cached. AI-observed
              body colours and visible features are used only while those same
              photos remain current. Confirmed catalog colours override photo
              observations. No customer image uploads are used.
            </p>
            <p>
              A language model interprets your optional description into
              requirements. The website independently checks actual price,
              stock, product type, catalog materials and overall dimensions.
              Unknown required attributes are not treated as confirmed matches.
              Text similarity ranks eligible products without overriding
              requirements.
            </p>
            <p>
              Photos cannot prove exact dimensions, material composition,
              durability or safety. Lighting changes colour appearance. AI
              interpretations can be wrong; review the displayed requirements,
              product photos and specifications. Stock and price are checked
              again at checkout.
            </p>
          </details>
        </section>
      </div>
    </main>
  );
}
