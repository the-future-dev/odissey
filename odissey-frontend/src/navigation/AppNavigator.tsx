import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';

import { SessionScreen } from '../screens/SessionScreen';
import { WorldSelectionScreen } from '../screens/WorldSelectionScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="WorldSelection" component={WorldSelectionScreen} />
        <Stack.Screen name="Session" component={SessionScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}; 