import { NextRequest } from 'next/server';
import { GET } from '@/app/api/analysis/psych/route';
import * as queries from '@/lib/db/queries';

jest.mock('@/lib/db/queries', () => ({
  getPsychSignalsLastNDays: jest.fn(),
  getRecoveriesLastNDays: jest.fn(),
  getLatestPsychSignal: jest.fn(),
}));

describe('Psych API Route', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns JSON series when series=1', async () => {
    (queries.getPsychSignalsLastNDays as jest.Mock).mockReturnValue([
      { id: 'a', date: '2025-11-11', records: 10, words: 100, vocab: 50, ttr: 0.5, sentiment_score: 0.1, pos_terms: 5, neg_terms: 3 },
    ]);
    const req = new NextRequest('http://localhost:3000/api/analysis/psych?series=1&days=14');
    const res = await GET(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(Array.isArray(data.series)).toBe(true);
    expect(data.series[0].date).toBe('2025-11-11');
  });

  it('returns CSV when export=csv', async () => {
    (queries.getPsychSignalsLastNDays as jest.Mock).mockReturnValue([
      { id: 'a', date: '2025-11-10', records: 5, words: 80, vocab: 40, ttr: 0.5, sentiment_score: 0.2, pos_terms: 3, neg_terms: 1 },
      { id: 'b', date: '2025-11-11', records: 7, words: 120, vocab: 60, ttr: 0.5, sentiment_score: 0.3, pos_terms: 4, neg_terms: 1 },
    ]);
    (queries.getRecoveriesLastNDays as jest.Mock).mockReturnValue([
      { id: 'r1', date: '2025-11-10', score: 80, hrv: null, rhr: null, spo2: null, skin_temp: null },
      { id: 'r2', date: '2025-11-11', score: 85, hrv: null, rhr: null, spo2: null, skin_temp: null },
    ]);
    const req = new NextRequest('http://localhost:3000/api/analysis/psych?series=1&days=14&export=csv');
    const res = await GET(req);
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/csv');
    expect(text.split('\n')[0]).toContain('date,records,words');
    expect(text).toContain('2025-11-10');
    expect(text).toContain('2025-11-11');
  });
});

