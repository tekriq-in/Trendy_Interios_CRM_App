import { BadRequestException } from '@nestjs/common';
import { DashboardService } from '../src/modules/dashboard/dashboard.service';

type RangeFn = (period: { from?: string; to?: string }) => Record<string, Date> | null;

describe('DashboardService.getActivityRange', () => {
  // The method is private and pure (no model access), so we exercise it directly.
  const service = new DashboardService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  const range: RangeFn = (period) =>
    (service as unknown as { getActivityRange: RangeFn }).getActivityRange(period);

  it('returns null when no period is given', () => {
    expect(range({})).toBeNull();
  });

  it('builds an inclusive-from, exclusive-to range in UTC', () => {
    const result = range({ from: '2026-11-01', to: '2026-11-30' });
    expect(result?.$gte).toEqual(new Date('2026-11-01T00:00:00.000Z'));
    // "to" is inclusive for the user, so the upper bound is the next midnight.
    expect(result?.$lt).toEqual(new Date('2026-12-01T00:00:00.000Z'));
  });

  it('supports an open-ended range with only "from"', () => {
    const result = range({ from: '2026-11-01' });
    expect(result).toEqual({ $gte: new Date('2026-11-01T00:00:00.000Z') });
  });

  it('supports an open-ended range with only "to"', () => {
    const result = range({ to: '2026-11-01' });
    expect(result).toEqual({ $lt: new Date('2026-11-02T00:00:00.000Z') });
  });

  it('accepts a single-day range', () => {
    const result = range({ from: '2026-11-17', to: '2026-11-17' });
    expect(result?.$gte).toEqual(new Date('2026-11-17T00:00:00.000Z'));
    expect(result?.$lt).toEqual(new Date('2026-11-18T00:00:00.000Z'));
  });

  it('rolls over month and year boundaries for the exclusive upper bound', () => {
    expect(range({ to: '2026-12-31' })?.$lt).toEqual(new Date('2027-01-01T00:00:00.000Z'));
  });

  it.each(['2026-1-01', '01-11-2026', 'yesterday', '2026-11-01T00:00:00Z'])(
    'rejects malformed date %s',
    (bad) => {
      expect(() => range({ from: bad })).toThrow(BadRequestException);
    },
  );

  it('rejects calendar-invalid dates such as 2026-02-30', () => {
    expect(() => range({ from: '2026-02-30' })).toThrow(BadRequestException);
  });

  it('rejects a range where from is after to', () => {
    expect(() => range({ from: '2026-11-30', to: '2026-11-01' })).toThrow(
      'dashboard.invalid_date_range',
    );
  });
});
