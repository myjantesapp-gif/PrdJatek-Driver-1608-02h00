import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';
import { reloadAppAsync } from 'expo';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

// Fallback does NOT use useSafeAreaInsets — ErrorBoundary may sit above
// SafeAreaProvider in the tree, so the hook would throw a second error.
function ErrorFallback({ error }: { error?: Error }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Une erreur est survenue</Text>
      {__DEV__ && error && <Text style={styles.message}>{error.message}</Text>}
      <TouchableOpacity style={styles.button} onPress={() => reloadAppAsync().catch(() => {})}>
        <Text style={styles.buttonText}>Redémarrer</Text>
      </TouchableOpacity>
    </View>
  );
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (__DEV__) console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 80,
    paddingBottom: 40,
  },
  title: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    color: Colors.textMuted,
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
  },
  button: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: Colors.radius,
  },
  buttonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
});
