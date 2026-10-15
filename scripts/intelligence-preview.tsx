import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import { ForecastSourceControl, ForecastView, type ForecastInputs } from '../src/features/admin/intelligence/ForecastPanel';
import { forecastFixture } from '../src/test/forecast-fixtures';
import '../src/styles/index.css';
const fixture = forecastFixture();
const data: ForecastInputs = { version: 2, generatedAt: '2026-09-27T00:00:00Z', through: fixture.at(-1)!.date, timezone: 'Asia/Manila', basis: 'Local QA fixture only.', series: fixture, eligibleOrders: fixture.reduce((sum,row)=>sum+row.orders,0), excludedTestPayments: 0, undatedSettlements: 0 };
function Preview() {
  const [snapshot,setSnapshot] = useState<ForecastInputs|null>(null);
  const [label,setLabel] = useState('Loading local QA input');
  const [source,setSource] = useState<'live'|'classroom'>('live');
  useEffect(()=> { void fetch('/__forecast_snapshot').then(response=>response.json()).then(({snapshot})=> {
    setSnapshot(snapshot ?? data); setSource(snapshot?.dataset?.kind === 'synthetic' ? 'classroom' : 'live');
    setLabel(snapshot?.dataset?.kind === 'synthetic' ? 'LOCAL QA · DATABASE CLASSROOM SNAPSHOT · NOT REAL SALES' : snapshot ? 'LOCAL QA · ACTUAL AGGREGATE SNAPSHOT · NO PRODUCTION WRITES' : 'LOCAL QA · SYNTHETIC TEST FIXTURE · NOT PRODUCTION');
  }); },[]);
  const selected=snapshot?.dataset?.kind === 'synthetic' && source === 'live' ? null : snapshot;
  return <main style={{ maxWidth: 1280, padding: 16, margin: 'auto' }}><p>{label}</p><ForecastSourceControl source={source} disabled={!snapshot} onChange={setSource}/><ForecastView key={source} source={source} data={selected} loading={!snapshot} error="" refresh={() => {}} /></main>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
