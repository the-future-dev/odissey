import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { 
  useAudioRecorder, 
  useAudioRecorderState, 
  useAudioPlayer,
  useAudioPlayerStatus,
  AudioModule,
  RecordingPresets,
  setAudioModeAsync 
} from 'expo-audio';
import { BottomTabParamList } from '../types';
import { WorldGenerationAPI } from '../api/worldGeneration';

type Props = BottomTabScreenProps<BottomTabParamList, 'WorldGeneration'>;

interface AudioState {
  isLoading: boolean;
  hasResponse: boolean;
  permissionGranted: boolean;
  hasRecording: boolean; // Track if we have a recording ready to send
}

export const WorldGenerationScreen: React.FC<Props> = ({ navigation }) => {
  const [audioState, setAudioState] = useState<AudioState>({
    isLoading: false,
    hasResponse: false,
    permissionGranted: false,
    hasRecording: false,
  });
  // Recording setup
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);
  
  // Response audio playback setup - initially no source
  const [responseAudioSource, setResponseAudioSource] = useState<string | null>(null);
  const responsePlayer = useAudioPlayer(responseAudioSource);
  const playerStatus = useAudioPlayerStatus(responsePlayer);

  useEffect(() => {
    setupAudio();
    return () => {
      cleanupAudio();
    };
  }, []);

  // Handle audio completion - reset when audio finishes playing
  useEffect(() => {
    if (playerStatus && playerStatus.didJustFinish) {
      resetToInitialState();
    }
  }, [playerStatus?.didJustFinish]);

  const setupAudio = async () => {
    try {
      // Request recording permissions
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert('Permission Required', 'Permission to access microphone was denied');
        return;
      }

      // Set audio mode for recording and playback
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });

      setAudioState(prev => ({ ...prev, permissionGranted: true }));
    } catch (error) {
      console.error('Error setting up audio:', error);
      Alert.alert('Error', 'Failed to set up audio. Please check permissions.');
    }
  };

  const cleanupAudio = () => {
    // Cleanup response audio URL if it exists
    if (responseAudioSource) {
      URL.revokeObjectURL(responseAudioSource);
    }
  };

  const resetToInitialState = () => {
    // Clean up response audio
    if (responseAudioSource) {
      URL.revokeObjectURL(responseAudioSource);
      setResponseAudioSource(null);
    }
    
    // Reset all state
    setAudioState(prev => ({
      ...prev,
      isLoading: false,
      hasResponse: false,
      hasRecording: false
    }));
  };

  const startRecording = async () => {
    try {
      if (!audioState.permissionGranted) {
        Alert.alert('Error', 'Microphone permission not granted');
        return;
      }

      // Clear any previous response and reset recording state
      setAudioState(prev => ({ ...prev, hasResponse: false, hasRecording: false }));
      
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    try {
      await audioRecorder.stop();
      // Set that we now have a recording ready to send
      setAudioState(prev => ({ ...prev, hasRecording: true }));
    } catch (error) {
      console.error('Error stopping recording:', error);
      Alert.alert('Error', 'Failed to stop recording.');
    }
  };

  const sendAudio = async () => {
    try {
      if (!audioRecorder.uri) {
        Alert.alert('Error', 'No recording to send.');
        return;
      }

      setAudioState(prev => ({ ...prev, isLoading: true }));

      // Convert recording to blob for API call
      const response = await fetch(audioRecorder.uri);
      const audioBlob = await response.blob();

      // Clear the recorder to go back to zero state (this clears audioRecorder.uri)
      await audioRecorder.prepareToRecordAsync();

      // Send to backend and get response
      const responseBlob = await WorldGenerationAPI.interact(audioBlob);

      // Debug: Inspect received audio response
      console.log('[WorldGen] Received audio response:', responseBlob);
      console.log('[WorldGen] Type:', responseBlob.type);
      console.log('[WorldGen] Size:', responseBlob.size);
      const arrayBuffer = await responseBlob.arrayBuffer();
      const byteArray = new Uint8Array(arrayBuffer);
      const header = Array.from(byteArray.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ');
      console.log('[WorldGen] First 16 bytes (hex):', header);
      const textHeader = String.fromCharCode(...byteArray.slice(0, 8));
      console.log('[WorldGen] First 8 bytes (ASCII):', textHeader);
      if (textHeader.startsWith('{')) {
        // Looks like JSON, not audio
        try {
          const jsonText = new TextDecoder('utf-8').decode(byteArray);
          console.log('[WorldGen] ERROR: Received JSON instead of audio:', jsonText);
        } catch (e) {
          console.log('[WorldGen] ERROR: Received non-audio, could not decode as JSON.');
        }
      } else if (!textHeader.startsWith('RIFF')) {
        console.log('[WorldGen] WARNING: Audio does not start with RIFF header, may not be WAV.');
      } else {
        console.log('[WorldGen] Audio response appears to be WAV format.');
      }

      // Clean up any existing response audio URL
      if (responseAudioSource) {
        URL.revokeObjectURL(responseAudioSource);
      }

      // Create URL for new response audio
      const responseUrl = URL.createObjectURL(responseBlob);
      setResponseAudioSource(responseUrl);

      setAudioState(prev => ({ 
        ...prev, 
        isLoading: false, 
        hasResponse: true,
        hasRecording: false // Reset to zero state after successful send
      }));

    } catch (error) {
      console.error('Error sending audio:', error);
      setAudioState(prev => ({ ...prev, isLoading: false, hasRecording: false }));
      Alert.alert('Error', 'Failed to send audio. Please try again.');
    }
  };

  const toggleResponseAudio = () => {
    try {
      if (!responsePlayer || !responseAudioSource) return;

      if (playerStatus?.playing) {
        responsePlayer.pause();
      } else {
        responsePlayer.play();
      }
    } catch (error) {
      console.error('Error toggling audio playback:', error);
      Alert.alert('Error', 'Failed to control audio playback.');
    }
  };

  const handleBottomButtonPress = async () => {
    if (recorderState.isRecording) {
      // Recording state => stop recording, show send icon
      await stopRecording();
    } else if (audioState.hasRecording) {
      // Has recording, not sent => send to backend, go back to zero state
      await sendAudio();
    } else {
      // Zero state => start recording
      await startRecording();
    }
  };

  const getBottomButtonIcon = () => {
    // Recording finished but not sent => show send icon
    if (audioState.hasRecording && !recorderState.isRecording) {
      return '>'; // Send icon
    }
    // Zero state or recording => show microphone
    return '🎤'; // Microphone icon
  };

  const getBottomButtonColor = () => {
    if (recorderState.isRecording) {
      return '#EF4444'; // Red when recording
    }
    return '#8B5CF6'; // Purple default
  };

  const getStatusText = () => {
    if (recorderState.isRecording) {
      return 'Recording... Press the button to stop';
    } else if (audioState.hasRecording) {
      return 'Press send to submit your recording';
    } else {
      return 'Press the microphone to start recording your world description';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>World Generation Engine</Text>
        <Text style={styles.subtitle}>Create your own adventure worlds</Text>
        
        {/* Response Audio Controls - Top Right */}
        <View style={styles.responseContainer}>
          {audioState.isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#8B5CF6" />
              <Text style={styles.loadingText}>Processing...</Text>
            </View>
          )}
          
          {audioState.hasResponse && (
            <TouchableOpacity 
              style={styles.responseButton}
              onPress={toggleResponseAudio}
            >
              <Text style={styles.responseButtonText}>
                {playerStatus?.playing ? '⏸️' : '▶️'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>🎙️</Text>
          <Text style={styles.description}>
            {getStatusText()}
          </Text>
        </View>
      </View>

      {/* Fixed Bottom Button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[styles.bottomButton, { backgroundColor: getBottomButtonColor() }]}
          onPress={handleBottomButtonPress}
          disabled={audioState.isLoading}
        >
          <Text style={styles.bottomButtonText}>
            {getBottomButtonIcon()}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    marginBottom: 40,
    textAlign: 'center',
  },
  placeholder: {
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    maxWidth: 300,
  },
  placeholderText: {
    fontSize: 48,
    marginBottom: 20,
  },
  description: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  responseContainer: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 1,
  },
  loadingContainer: {
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 12,
    color: '#64748B',
  },
  responseButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  responseButtonText: {
    fontSize: 24,
    color: 'white',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  bottomButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  bottomButtonText: {
    fontSize: 32,
    color: 'white',
    fontWeight: 'bold',
  },
}); 