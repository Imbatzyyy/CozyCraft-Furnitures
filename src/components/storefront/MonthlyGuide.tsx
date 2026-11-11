import { ChevronDown } from "lucide-react";
import { money, useStore } from "@/app/core";

const PLANS = [3, 6, 12] as const;
const MINIMUM_PRICE = 3_000;

/**
 * "About ₱X a month" beside a product's price.
 *
 * This is a budgeting guide, not a financing offer: it is the price divided
 * into equal parts and says so. CozyCraft charges the full amount at
 * checkout. It is shown only while card payment is enabled for the store,
 * because spreading a purchase is something a shopper arranges with their
 * own card issuer. Replace the wording here if the store later offers its
 * own installment terms.
 */
export function MonthlyGuide({ price }: { price: number }) {
  const { storeSettings } = useStore();
  if (!storeSettings.checkout_settings.card_enabled || storeSettings.currency_code !== "PHP" || !(price >= MINIMUM_PRICE)) return null;
  const monthly = (months: number) => money(Math.ceil(price / months));
  return (
    <details className="group mt-3 max-w-xl text-xs text-muted-foreground">
      <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1.5 rounded-full underline decoration-dotted underline-offset-4 hover:text-foreground [&::-webkit-details-marker]:hidden">
        About <span className="font-semibold text-foreground tabular-nums">{monthly(12)}</span> a month over 12 months
        <ChevronDown size={13} aria-hidden="true" className="transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="mt-2 rounded-2xl border border-border bg-card p-4">
        <dl className="grid grid-cols-3 gap-2 text-center">
          {PLANS.map((months) => (
            <div key={months} className="rounded-xl bg-secondary px-2 py-2.5">
              <dt className="text-[10px] font-bold uppercase tracking-[.12em]">{months} months</dt>
              <dd className="mt-1 text-sm font-semibold text-foreground tabular-nums">{monthly(months)}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 leading-5">
          A planning guide only: the price split into equal parts, before any bank charges. You pay the full amount at checkout. Many card issuers can convert a purchase into monthly installments afterwards — ask your bank about its terms and fees.
        </p>
      </div>
    </details>
  );
}
