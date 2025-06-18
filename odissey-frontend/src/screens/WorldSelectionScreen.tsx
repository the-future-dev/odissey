import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { API_URL } from '../config';
import { TokenManager } from '../api/SessionApi';
import { handleResponse } from '../api/api';

type Props = NativeStackScreenProps<RootStackParamList, 'WorldSelection'>;

interface World {
  id: string;
  title: string;
  description: string | null;
  genre?: string;
}

export const WorldSelectionScreen: React.FC<Props> = ({ navigation }) => {
  const [worlds, setWorlds] = useState<World[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadWorlds();
  }, []);

  const loadWorlds = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = await TokenManager.getValidToken();
      const response = await fetch(`${API_URL}/worlds`, {
        headers: { 
          'Authorization': `Bearer ${token}`
        }
      });
      
      const worldsData = await handleResponse(response);
      setWorlds(worldsData);
    } catch (error) {
      console.error('Failed to load worlds:', error);
      setError('Failed to load worlds. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const selectWorld = (world: World) => {
    navigation.navigate('Session', { 
      worldId: world.id, 
      worldTitle: world.title 
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text style={styles.loadingText}>Loading worlds...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadWorlds}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Choose Your Adventure</Text>
        <Text style={styles.subtitle}>Select a world to begin your story</Text>
      </View>

      <ScrollView style={styles.worldsContainer} showsVerticalScrollIndicator={false}>
        {worlds.map((world) => (
          <TouchableOpacity
            key={world.id}
            style={styles.worldCard}
            onPress={() => selectWorld(world)}
          >
            <Text style={styles.worldTitle}>{world.title}</Text>
            {world.genre && (
              <Text style={styles.worldGenre}>{world.genre.toUpperCase()}</Text>
            )}
            {world.description && (
              <Text style={styles.worldDescription}>{world.description}</Text>
            )}
            <View style={styles.playButton}>
              <Text style={styles.playButtonText}>Start Adventure →</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: 'white',
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1E293B',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
  },
  worldsContainer: {
    flex: 1,
    padding: 20,
  },
  worldCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  worldTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 8,
  },
  worldGenre: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8B5CF6',
    backgroundColor: '#F3F4F6',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  worldDescription: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    marginBottom: 16,
  },
  playButton: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  playButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748B',
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '600',
  },
}); 