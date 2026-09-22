import { createRoot } from 'react-dom/client';
import { ForecastView, type ForecastInputs } from '../src/features/admin/intelligence/ForecastPanel';
import '../src/styles/index.css';
const data: ForecastInputs = { version: 1, generatedAt: '2026-09-22T00:00:00Z', through: '2026-09-21', timezone: 'Asia/Manila', basis: 'Local QA fixture only.', series: [], eligibleOrders: 0, excludedTestPayments: 72, undatedSettlements: 1 };
createRoot(document.getElementById('root')!).render(<main style={{ maxWidth: 1280, padding: 16, margin: 'auto' }}><p>LOCAL QA · FIXTURES ONLY · NO PRODUCTION WRITES</p><ForecastView data={data} loading={false} error="" refresh={() => {}} /></main>);
