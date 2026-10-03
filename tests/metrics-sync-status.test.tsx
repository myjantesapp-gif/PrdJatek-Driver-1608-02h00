import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatRemoteNumber } from '../lib/driver-metrics';

const driver = vi.hoisted(() => ({
  metricsRefreshing: false,
  metricsSyncError: null as string | null,
  metricsLastSyncAt: null as Date | null,
  refreshEarnings: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/context/DriverContext', () => ({ useDriver: () => driver }));
vi.mock('react-native', () => ({
  View: 'View', Text: 'Text', TouchableOpacity: 'TouchableOpacity',
  ActivityIndicator: 'ActivityIndicator',
  StyleSheet: { create: (styles: unknown) => styles },
}));
import { MetricsSyncStatus } from '../components/MetricsSyncStatus';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('remote metrics synchronization controls', () => {
  let renderer: ReturnType<typeof TestRenderer.create> | undefined;
  afterEach(() => {
    if (renderer) act(() => renderer!.unmount());
    renderer = undefined;
    driver.metricsRefreshing = false;
    driver.metricsSyncError = null;
    driver.metricsLastSyncAt = null;
    vi.clearAllMocks();
  });

  it('shows a failure and lets the driver retry the remote synchronization', async () => {
    driver.metricsSyncError = 'API indisponible';
    driver.metricsLastSyncAt = new Date('2026-10-03T12:00:00Z');
    await act(async () => { renderer = TestRenderer.create(<MetricsSyncStatus />); });
    expect(JSON.stringify(renderer!.toJSON())).toContain('API indisponible');
    expect(JSON.stringify(renderer!.toJSON())).toContain('Dernière synchronisation');
    await act(async () => { renderer!.root.findByType('TouchableOpacity' as never).props.onPress(); });
    expect(driver.refreshEarnings).toHaveBeenCalledTimes(1);
  });

  it('disables duplicate taps while synchronization is in progress', async () => {
    driver.metricsRefreshing = true;
    await act(async () => { renderer = TestRenderer.create(<MetricsSyncStatus />); });
    expect(renderer!.root.findByType('TouchableOpacity' as never).props.disabled).toBe(true);
    expect(renderer!.root.findAllByType('ActivityIndicator' as never)).toHaveLength(1);
  });

  it('displays the last successful remote synchronization', async () => {
    driver.metricsLastSyncAt = new Date('2026-10-03T12:00:00Z');
    await act(async () => { renderer = TestRenderer.create(<MetricsSyncStatus />); });
    expect(JSON.stringify(renderer!.toJSON())).toContain('Chiffres du backend');
    expect(JSON.stringify(renderer!.toJSON())).toContain('actualisés à');
  });

  it('does not invent zero counts or ratings before receiving them', () => {
    expect(formatRemoteNumber(NaN)).toBe('—');
    expect(formatRemoteNumber(0)).toBe('0');
    expect(formatRemoteNumber(4.75, 2)).toBe('4.75');
  });
});