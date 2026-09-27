import { useId } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const compactPeso = (value: number) =>
  value >= 1_000_000 ? `₱${(value / 1_000_000).toFixed(1)}M` : value >= 1_000 ? `₱${Math.round(value / 1_000)}K` : `₱${Math.round(value)}`;

type TooltipPayload = { value?: number | string; payload?: Record<string, unknown> };

function ChartTooltip({ active, payload, label, valueLabel, format, labelPrefix }: { active?: boolean; payload?: TooltipPayload[]; label?: string | number; valueLabel: string; format: (value: number) => string; labelPrefix?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-popover-foreground shadow-[var(--adm-shadow-pop)]">
      <p className="text-[10px] font-semibold uppercase tracking-[.1em] text-muted-foreground">{labelPrefix}{label}</p>
      <p className="adm-num mt-0.5 text-sm font-semibold">{format(Number(payload[0].value ?? 0))}</p>
      <p className="text-[10.5px] text-muted-foreground">{valueLabel}</p>
    </div>
  );
}

/** Themed revenue area chart used by the overview and reports. */
export function RevenueArea({
  data,
  xKey,
  yKey,
  valueLabel,
  format,
  height = 240,
  labelPrefix,
  ariaLabel,
}: {
  data: Array<Record<string, unknown>>;
  xKey: string;
  yKey: string;
  valueLabel: string;
  format: (value: number) => string;
  height?: number;
  labelPrefix?: string;
  ariaLabel: string;
}) {
  const gradient = useId().replace(/:/g, "");
  return (
    <div role="img" aria-label={ariaLabel} style={{ height }} className="min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--adm-chart-fill)" stopOpacity={0.42} />
              <stop offset="100%" stopColor="var(--adm-chart-fill)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--adm-chart-grid)" strokeDasharray="3 4" />
          <XAxis dataKey={xKey} tickLine={false} axisLine={false} interval="preserveStartEnd" tickMargin={8} tick={{ fontSize: 11, fill: "var(--adm-chart-axis)" }} />
          <YAxis width={52} tickLine={false} axisLine={false} tickFormatter={(value: number) => compactPeso(value)} tick={{ fontSize: 11, fill: "var(--adm-chart-axis)" }} />
          <Tooltip cursor={{ stroke: "var(--adm-chart-axis)", strokeDasharray: "3 3" }} content={<ChartTooltip valueLabel={valueLabel} format={format} labelPrefix={labelPrefix} />} />
          <Area type="monotone" dataKey={yKey} stroke="var(--adm-chart-line)" strokeWidth={2.25} fill={`url(#${gradient})`} activeDot={{ r: 4.5, strokeWidth: 2, stroke: "var(--card)", fill: "var(--adm-chart-line)" }} animationDuration={700} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
