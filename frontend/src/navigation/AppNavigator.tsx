import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { RootStackParamList } from '../types';

import { GoogleAuthScreen } from '../screens/GoogleAuthScreen';
import { SessionScreen } from '../screens/SessionScreen';
import { WorldSelectionScreen } from '../screens/WorldSelectionScreen';
import { ChaptersScreen } from '../screens/ChaptersScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator: React.FC = () => {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <Stack.Navigator 
          initialRouteName="GoogleAuth"
          screenOptions={{ 
            headerShown: false,
            animation: 'slide_from_right'
          }}
        >
          <Stack.Screen name="GoogleAuth" component={GoogleAuthScreen} />
          <Stack.Screen name="WorldSelection" component={WorldSelectionScreen} />
          <Stack.Screen name="Session" component={SessionScreen} />
          <Stack.Screen name="Chapters" component={ChaptersScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}; 