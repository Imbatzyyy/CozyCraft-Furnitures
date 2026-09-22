import { buildForecast, type DailyObservation } from "./forecast";
self.onmessage = (event: MessageEvent<{ rows: DailyObservation[]; metric: "sales" | "orders"; horizon: 7 | 14 }>) => {
  try { self.postMessage({ result: buildForecast(event.data.rows, event.data.metric, event.data.horizon) }); }
  catch { self.postMessage({ error: "The forecast could not be calculated. Please retry." }); }
};
