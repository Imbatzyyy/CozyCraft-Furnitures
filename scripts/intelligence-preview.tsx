import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import { ForecastView, type ForecastInputs } from '../src/features/admin/intelligence/ForecastPanel';
import { forecastFixture } from '../src/test/forecast-fixtures';
import '../src/styles/index.css';
const fixture = forecastFixture();
const data: ForecastInputs = { version: 2, generatedAt: '2026-09-27T00:00:00Z', through: fixture.at(-1)!.date, timezone: 'Asia/Manila', basis: 'Local QA fixture only.', series: fixture, eligibleOrders: fixture.reduce((sum,row)=>sum+row.orders,0), excludedTestPayments: 0, undatedSettlements: 0 };
function Preview() {
  const [snapshot,setSnapshot] = useState<ForecastInputs|null>(null);
  const [label,setLabel] = useState('Loading local QA input');
  useEffect(()=> { void fetch('/__forecast_snapshot').then(response=>response.json()).then(({snapshot})=> {
    setSnapshot(snapshot ?? data); setLabel(snapshot ? 'LOCAL QA · ACTUAL AGGREGATE SNAPSHOT · NO PRODUCTION WRITES' : 'LOCAL QA · SYNTHETIC TEST FIXTURE · NOT PRODUCTION');
  }); },[]);
  return <main style={{ maxWidth: 1280, padding: 16, margin: 'auto' }}><p>{label}</p><ForecastView data={snapshot} loading={!snapshot} error="" refresh={() => {}} /></main>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
