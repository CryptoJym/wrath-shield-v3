import { GET, POST } from '../../../../app/api/reps/route';

describe('/api/reps route', () => {
  test('GET returns plans', async () => {
    const res = await GET();
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.plans)).toBe(true);
  });

  test('POST validates input', async () => {
    // @ts-ignore - emulate Request
    const res = await POST({ json: async () => ({}) });
    const data = await res.json();
    expect(data.success).toBe(false);
  });
});
