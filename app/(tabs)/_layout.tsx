import { Tabs } from 'expo-router';
import { View, StyleSheet, Platform, ColorValue } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { useDriver } from '@/context/DriverContext';
import { LiveOrderAlert } from '@/components/LiveOrderAlert';

function TabBarIcon({ name, color, size }: { name: any; color: ColorValue; size: number }) {
  return <Ionicons name={name} size={size} color={color} />;
}

function ActiveOrderDot() {
  const { activeOrder } = useDriver();
  if (!activeOrder) return null;
  return (
    <View style={styles.activeDot} />
  );
}

function TabsLayout() {
  const { incomingOrder, acceptOrder, declineOrder } = useDriver();
  const insets = useSafeAreaInsets();
  const tabBottomPadding = Platform.OS === 'web' ? 22 : Math.max(insets.bottom, 12);

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: Colors.card,
            borderTopColor: Colors.border,
            borderTopWidth: 1,
            height: 54 + tabBottomPadding,
            paddingBottom: tabBottomPadding,
            paddingTop: 6,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
          },
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: Colors.textMuted,
          tabBarShowLabel: true,
          tabBarLabelStyle: {
            fontFamily: 'Poppins_600SemiBold',
            fontSize: 10,
            marginTop: 1,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            tabBarIcon: ({ color, size }) => (
              <TabBarIcon name="home" color={color} size={size} />
            ),
            tabBarLabel: 'Accueil',
          }}
        />
        <Tabs.Screen
          name="orders"
          options={{
            tabBarIcon: ({ color, size }) => (
              <View>
                <TabBarIcon name="receipt" color={color} size={size} />
                <ActiveOrderDot />
              </View>
            ),
            tabBarLabel: 'Commandes',
          }}
        />
        <Tabs.Screen
          name="map"
          options={{
            tabBarIcon: ({ color, size }) => (
              <TabBarIcon name="navigate" color={color} size={size} />
            ),
            tabBarLabel: 'Carte',
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            tabBarIcon: ({ color, size }) => (
              <TabBarIcon name="time" color={color} size={size} />
            ),
            tabBarLabel: 'Historique',
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            tabBarIcon: ({ color, size }) => (
              <TabBarIcon name="person-circle" color={color} size={size} />
            ),
            tabBarLabel: 'Profil',
          }}
        />
      </Tabs>

      {incomingOrder && (
        <LiveOrderAlert
          order={incomingOrder}
          onAccept={acceptOrder}
          onDecline={declineOrder}
        />
      )}
    </View>
  );
}

export default TabsLayout;

const styles = StyleSheet.create({
  activeDot: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    borderWidth: 1.5,
    borderColor: Colors.card,
  },
});
