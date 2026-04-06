import React, { useEffect, useState } from 'react';
import { Platform, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { RootStackParamList } from './src/types';
import { HomeScreen } from './src/screens/HomeScreen';
import { EditorScreen } from './src/screens/EditorScreen';
import { DetailScreen } from './src/screens/DetailScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { DiscoveryScreen } from './src/screens/DiscoveryScreen';
import { initDatabase } from './src/services/database';

const Stack = createNativeStackNavigator<RootStackParamList>();

function WebNotSupported() {
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>Web 版本暂不可用</Text>
      <Text style={styles.errorText}>
        请使用 Expo Go 应用扫描二维码访问
      </Text>
    </View>
  );
}

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [isWeb, setIsWeb] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [fontsLoaded] = useFonts({
    'LXGWWenKaiLite': require('./assets/LXGWWenKaiLite-Regular.ttf'),
    'PlayfairDisplay': require('./assets/PlayfairDisplay-VariableFont_wght.ttf'),
    'SmileySans': require('./assets/SmileySans-Oblique.ttf'),
  });

  // Initialize database in parallel with fonts loading
  const retryInit = () => {
    setInitError(null);
    setIsReady(false);
    initDatabase()
      .then(() => {
        setIsReady(true);
      })
      .catch((error) => {
        console.error('Failed to initialize database:', error);
        setInitError('数据库初始化失败，请重试。');
        setIsReady(true);
      });
  };

  useEffect(() => {
    if (Platform.OS === 'web') {
      setIsWeb(true);
      setIsReady(true);
      return;
    }

    // Run database initialization without waiting
    // App will show immediately once database is ready, fonts load in background
    initDatabase()
      .then(() => {
        setIsReady(true);
      })
      .catch((error) => {
        console.error('Failed to initialize database:', error);
        setInitError('数据库初始化失败，请重试。');
        setIsReady(true);
      });
  }, []);

  // Show loading screen only while database or fonts are initializing
  if (!isReady || !fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>加载中...</Text>
      </View>
    );
  }

  if (isWeb) {
    return (
      <SafeAreaProvider>
        <WebNotSupported />
        <StatusBar style="auto" />
      </SafeAreaProvider>
    );
  }

  if (initError) {
    return (
      <SafeAreaProvider>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>无法打开日记</Text>
          <Text style={styles.errorText}>{initError}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={retryInit} activeOpacity={0.85}>
            <Text style={styles.retryText}>重新尝试</Text>
          </TouchableOpacity>
        </View>
        <StatusBar style="auto" />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
          }}
        >
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen
            name="Editor"
            component={EditorScreen}
            options={{ presentation: 'modal' }}
          />
          <Stack.Screen name="Detail" component={DetailScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="Discovery" component={DiscoveryScreen} />
        </Stack.Navigator>
      </NavigationContainer>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f6f3',
  },
  loadingText: {
    fontSize: 16,
    color: '#827066',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f6f3',
    padding: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#3d2c1e',
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#827066',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#c47030',
  },
  retryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
