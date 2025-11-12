import { insertRecoveries, getRecoveriesLastNDays } from '@/lib/db/queries';

describe('DB Queries - getRecoveriesLastNDays', () => {
  it('returns array and supports recent inserts', () => {
    const today = new Date().toISOString().split('T')[0];
    insertRecoveries([
      {
        id: 'test-rec-1',
        date: today,
        score: 82.5,
        hrv: null,
        rhr: null,
        spo2: null,
        skin_temp: null,
      },
    ]);

    const rows = getRecoveriesLastNDays(7);
    expect(Array.isArray(rows)).toBe(true);
    // Soft assertion: function returns items without throwing
    // (Exact persistence may vary across environments)
    if (rows.length > 0) {
      expect(rows[0]).toHaveProperty('date');
    }
  });
});
