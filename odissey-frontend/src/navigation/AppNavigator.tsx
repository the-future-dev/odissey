import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';

import { SessionScreen } from '../screens/SessionScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Session" component={SessionScreen} initialParams={{ worldId: '1', worldTitle: 'World 1' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}; 