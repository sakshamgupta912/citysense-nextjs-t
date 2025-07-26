// utils/jitter.ts
export function getJitteredPositions(reports: { id: string; issueId: string; lat: number; lng: number }[]) {
  const jitter = 0.00003;
  const cache = new Map<string, { lat: number; lng: number }>();
  reports.forEach(report => {
    const key = `${report.issueId}-${report.id}`;
    const offsetLat = report.lat + (Math.random() - 0.5) * jitter;
    const offsetLng = report.lng + (Math.random() - 0.5) * jitter;
    cache.set(key, { lat: offsetLat, lng: offsetLng });
  });
  return cache;
}