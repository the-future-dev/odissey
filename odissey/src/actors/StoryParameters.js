import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@story_parameters';

const saveStoryParameters = async (values: Record<string, string>) => {
  try {
    const serializedValues = JSON.stringify(values);

    if (Platform.OS === 'web') {
      localStorage.setItem(STORAGE_KEY, serializedValues);
    } else {
      await AsyncStorage.setItem(STORAGE_KEY, serializedValues);
    }
  } catch (error) {
    console.error('Failed to save parameters', error);
    if (Platform.OS !== 'web') {
      Alert.alert('Error', 'Failed to save parameters. Please try again.');
    }
  }
};

const loadStoryParameters = async (): Promise<Record<string, string>> => {
  try {
    if (Platform.OS === 'web') {
      const savedParameters = localStorage.getItem(STORAGE_KEY);
      return savedParameters ? JSON.parse(savedParameters) : {};
    } else {
      const savedParameters = await AsyncStorage.getItem(STORAGE_KEY);
      return savedParameters ? JSON.parse(savedParameters) : {};
    }
  } catch (error) {
    console.error('Failed to load parameters', error);
    return {};
  }
};

export { saveStoryParameters, loadStoryParameters }; 