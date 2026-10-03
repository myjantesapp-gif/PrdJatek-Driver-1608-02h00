import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Order } from '../context/DriverContext';
import type { DeliveryStatus } from '../lib/delivery-state';

const driver = vi.hoisted(() => ({
  activeOrder: null as Order | null,
  terminalOrder: null,
  updateOrderStatus: vi.fn().mockResolvedValue(true),
  validateOTP: vi.fn().mockResolvedValue(false),
}));
vi.mock('@/context/DriverContext', () => ({ useDriver: () => driver }));
vi.mock('react-native', () => ({
  View: 'View', Text: 'Text', ScrollView: 'ScrollView',
  TouchableOpacity: 'TouchableOpacity', ActivityIndicator: 'ActivityIndicator',
  StyleSheet: { create: (styles: unknown) => styles },
  Platform: { OS: 'web' }, Linking: {}, Alert: {},
}));
vi.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: '501' }),
  router: { back: vi.fn() },
}));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));
vi.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons', MaterialCommunityIcons: 'MaterialCommunityIcons',
}));
vi.mock('expo-haptics', () => ({}));
vi.mock('@/components/OTPInput', () => ({ OTPInput: 'OTPInput' }));

import OrderDetailScreen from '../app/order/[id]';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function order(status: DeliveryStatus): Order {
  return {
    id: '501', apiId: 501, reference: 'CMD-501', status,
    restaurant: { name: 'Restaurant', address: '', phone: '', lat: 0, lng: 0 },
    customer: { name: 'Client', address: '', phone: '', lat: 0, lng: 0 },
    items: [], earnings: 0, distance: 0, estimatedPickup: 0,
    estimatedDelivery: 0, otp: '', tip: 0, createdAt: '2026-10-03',
  };
}

describe('order detail strict driver actions', () => {
  let renderer: ReturnType<typeof TestRenderer.create> | undefined;
  afterEach(() => {
    if (renderer) act(() => renderer!.unmount());
    renderer = undefined;
    vi.clearAllMocks();
  });

  it('displays the remote total in MAD instead of inventing a subtotal from items', async () => {
    driver.activeOrder = {
      ...order('accepted'),
      earnings: 25.5,
      total: 99.75,
      items: [{ name: 'Article', quantity: 2, price: 1.5 }],
    };
    await act(async () => { renderer = TestRenderer.create(<OrderDetailScreen />); });
    const rendered = JSON.stringify(renderer!.toJSON());
    expect(rendered).toContain('99.75 MAD');
    expect(rendered).toContain('25.50 MAD');
    expect(rendered).not.toContain('€');
  });

  it('does not invent a total when the remote order omits it', async () => {
    driver.activeOrder = order('accepted');
    await act(async () => { renderer = TestRenderer.create(<OrderDetailScreen />); });
    expect(JSON.stringify(renderer!.toJSON())).toContain('Montant indisponible');
  });

  it.each([
    ['accepted', 'Je suis au restaurant', 'at_restaurant'],
    ['at_restaurant', 'Commande récupérée', 'picked_up'],
    ['picked_up', 'En route vers le client', 'en_route'],
    ['en_route', 'Je suis arrivé chez le client', 'delivering'],
  ] as const)('shows only the next action from %s and keeps OTP hidden', async (status, label, next) => {
    driver.activeOrder = order(status);
    await act(async () => { renderer = TestRenderer.create(<OrderDetailScreen />); });
    expect(renderer!.root.findAllByType('OTPInput' as never)).toHaveLength(0);
    const action = renderer!.root.findAllByType('TouchableOpacity' as never).find(button =>
      button.findAllByType('Text' as never).some(text => text.props.children === label),
    );
    expect(action).toBeDefined();
    await act(async () => { await action!.props.onPress(); });
    expect(driver.updateOrderStatus).toHaveBeenCalledWith('501', next);
    expect(driver.validateOTP).not.toHaveBeenCalled();
  });

  it('shows OTP only at the customer, and submits through confirmation rather than PATCH', async () => {
    driver.activeOrder = order('delivering');
    await act(async () => { renderer = TestRenderer.create(<OrderDetailScreen />); });
    const otp = renderer!.root.findByType('OTPInput' as never);
    expect(otp.props.length).toBe(4);
    await act(async () => { await otp.props.onComplete('7364'); });
    expect(driver.validateOTP).toHaveBeenCalledWith('501', '7364');
    expect(driver.updateOrderStatus).not.toHaveBeenCalled();
  });

  it.each(['completed', 'cancelled'] as const)('hides OTP after %s', async status => {
    driver.activeOrder = order(status);
    await act(async () => { renderer = TestRenderer.create(<OrderDetailScreen />); });
    expect(renderer!.root.findAllByType('OTPInput' as never)).toHaveLength(0);
  });
});