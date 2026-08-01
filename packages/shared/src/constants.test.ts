import { describe, it, expect } from 'vitest';
import {
  HEARTBEAT_INTERVAL_MS,
  STALE_THRESHOLD_MS,
  BACKLOG_COLUMN_ID,
  COMPLETED_COLUMN_ID,
  CRON_PRESETS,
} from './constants.js';

describe('constants', () => {
  it('HEARTBEAT_INTERVAL_MS is 5000', () => {
    expect(HEARTBEAT_INTERVAL_MS).toBe(5000);
  });

  it('STALE_THRESHOLD_MS is 10000', () => {
    expect(STALE_THRESHOLD_MS).toBe(10000);
  });

  it('STALE_THRESHOLD_MS is greater than HEARTBEAT_INTERVAL_MS', () => {
    expect(STALE_THRESHOLD_MS).toBeGreaterThan(HEARTBEAT_INTERVAL_MS);
  });

  it('BACKLOG_COLUMN_ID is "__backlog__"', () => {
    expect(BACKLOG_COLUMN_ID).toBe('__backlog__');
  });

  it('COMPLETED_COLUMN_ID is "__completed__"', () => {
    expect(COMPLETED_COLUMN_ID).toBe('__completed__');
  });

  it('BACKLOG_COLUMN_ID and COMPLETED_COLUMN_ID are different', () => {
    expect(BACKLOG_COLUMN_ID).not.toBe(COMPLETED_COLUMN_ID);
  });

  describe('CRON_PRESETS', () => {
    it('is an array', () => {
      expect(Array.isArray(CRON_PRESETS)).toBe(true);
    });

    it('has at least one entry', () => {
      expect(CRON_PRESETS.length).toBeGreaterThan(0);
    });

    it('every entry has a label and a value string', () => {
      for (const preset of CRON_PRESETS) {
        expect(preset).toHaveProperty('label');
        expect(preset).toHaveProperty('value');
        expect(typeof preset.label).toBe('string');
        expect(typeof preset.value).toBe('string');
        expect(preset.label.length).toBeGreaterThan(0);
        expect(preset.value.length).toBeGreaterThan(0);
      }
    });

    it('contains expected presets', () => {
      const values = CRON_PRESETS.map((p) => p.value);
      expect(values).toContain('* * * * *');
      expect(values).toContain('0 9 * * *');
      expect(values).toContain('0 9 * * 1');
    });

    it('contains "Every minute" label', () => {
      const labels = CRON_PRESETS.map((p) => p.label);
      expect(labels).toContain('Every minute');
    });
  });
});
