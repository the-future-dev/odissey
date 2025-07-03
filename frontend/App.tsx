import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AppNavigator } from './src/navigation/AppNavigator';
import { SessionProvider } from './src/contexts/SessionContext';

export default function App() {
  return (
    <>
      <SessionProvider>
        <AppNavigator />
      </SessionProvider>
      <StatusBar style="auto" />
    </>
  );
}
