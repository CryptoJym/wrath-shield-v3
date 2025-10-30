import { recordHit, getHits, getPlans, getDue, completeRep } from '../../lib/phraseReps';

describe('phrase reps planner', () => {
  test('schedules reps after 3 hits within 7 days', () => {
    const now = Date.now();
    recordHit('assured phrase', now - 24*60*60*1000);
    recordHit('assured phrase', now - 2*60*60*1000);
    recordHit('assured phrase', now - 1*60*1000);

    const plans = getPlans(now);
    const plan = plans.find(p => p.phrase === 'assured phrase');
    expect(plan).toBeTruthy();
    expect(plan!.times.length).toBe(3);
  });

  test('due reps reflect current time', () => {
    const now = Date.now();
    // a distinct phrase to avoid previous plan coupling
    recordHit('coach me', now - 60*1000);
    recordHit('coach me', now - 30*1000);
    recordHit('coach me', now);
    const due = getDue(now);
    const plan = due.find(p => p.phrase === 'coach me');
    expect(plan).toBeTruthy();
    expect(plan!.times.length).toBeGreaterThanOrEqual(1);
  });

  test('completeRep removes scheduled time and cleans plan when empty', () => {
    const now = Date.now();
    recordHit('finish', now);
    recordHit('finish', now);
    recordHit('finish', now);
    const plan0 = getPlans(now).find(p=>p.phrase==='finish')!;
    const len0 = plan0.times.length;
    const first = plan0.times[0];
    expect(completeRep('finish', first)).toBe(true);
    const after = getPlans(now).find(p=>p.phrase==='finish')!;
    // One less time
    expect(after.times.length).toBe(len0 - 1);
  });
});
