import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList, Chapter, GetChaptersResponse } from '../types';
import { GoogleTokenManager, getChapters } from '../api';

type Props = NativeStackScreenProps<RootStackParamList, 'Chapters'>;

export const ChaptersScreen: React.FC<Props> = ({ route, navigation }) => {
  const { sessionId, worldTitle } = route.params;
  const [chapters, setChapters] = useState<GetChaptersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAuthAndLoadChapters();
  }, [sessionId]);

  const checkAuthAndLoadChapters = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Check if user is authenticated first
      const authResult = await GoogleTokenManager.checkExistingAuth();
      if (!authResult.isAuthenticated) {
        // Redirect to authentication
        navigation.replace('GoogleAuth');
        return;
      }
      
      // User is authenticated, load chapters
      const token = await GoogleTokenManager.getValidToken();
      
      if (!token) {
        navigation.replace('GoogleAuth');
        return;
      }
      
      const chaptersData = await getChapters(token, sessionId);
      setChapters(chaptersData);
    } catch (error) {
      console.error('Failed to load chapters:', error);
      // If there's an auth error, redirect to login
      if (error instanceof Error && error.message.includes('authentication')) {
        navigation.replace('GoogleAuth');
      } else {
        setError('Failed to load chapters. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadChapters = async () => {
    await checkAuthAndLoadChapters();
  };

  const renderChapter = (chapter: Chapter, index: number) => {
    const isHistory = chapter.status === 'history';
    const isCurrent = chapter.status === 'current';
    const isFuture = chapter.status === 'future';

    return (
      <View
        key={chapter.id}
        style={[
          styles.chapterCard,
          isHistory && styles.historyCard,
          isCurrent && styles.currentCard,
          isFuture && styles.futureCard,
        ]}
      >
        <View style={styles.chapterHeader}>
          <View style={[
            styles.chapterNumber,
            isHistory && styles.historyNumber,
            isCurrent && styles.currentNumber,
            isFuture && styles.futureNumber,
          ]}>
            <Text style={[
              styles.chapterNumberText,
              isHistory && styles.historyNumberText,
              isCurrent && styles.currentNumberText,
              isFuture && styles.futureNumberText,
            ]}>
              {chapter.chapter_number}
            </Text>
          </View>
          <View style={styles.chapterStatus}>
            <Text style={[
              styles.statusText,
              isHistory && styles.historyStatusText,
              isCurrent && styles.currentStatusText,
              isFuture && styles.futureStatusText,
            ]}>
              {isCurrent ? 'Current' : isHistory ? 'Completed' : 'Future'}
            </Text>
          </View>
        </View>
        
        <Text style={[
          styles.chapterTitle,
          isHistory && styles.historyTitle,
          isCurrent && styles.currentTitle,
          isFuture && styles.futureTitle,
        ]}>
          {chapter.title}
        </Text>
        
        <Text style={[
          styles.chapterDescription,
          isHistory && styles.historyDescription,
          isCurrent && styles.currentDescription,
          isFuture && styles.futureDescription,
        ]}>
          {chapter.description}
        </Text>
        
        {isCurrent && (
          <View style={styles.currentIndicator}>
            <Ionicons name="play-circle" size={16} color="#8B5CF6" />
            <Text style={styles.currentIndicatorText}>In Progress</Text>
          </View>
        )}
      </View>
    );
  };

  // Loading state
  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text style={styles.loadingText}>Loading chapters...</Text>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadChapters}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Main content
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color="#8B5CF6" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {worldTitle ? `${worldTitle} - Chapters` : 'Chapters'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        style={styles.chaptersContainer} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Chapter Summary */}
        <View style={styles.summaryContainer}>
          <Text style={styles.summaryTitle}>Chapter Overview</Text>
          <View style={styles.summaryStats}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{chapters?.history.length || 0}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{chapters?.current ? 1 : 0}</Text>
              <Text style={styles.statLabel}>Current</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{chapters?.future.length || 0}</Text>
              <Text style={styles.statLabel}>Future</Text>
            </View>
          </View>
        </View>

        {/* Chapters List */}
        <View style={styles.chaptersSection}>
          {/* History Chapters */}
          {chapters?.history.map((chapter, index) => renderChapter(chapter, index))}
          
          {/* Current Chapter */}
          {chapters?.current && renderChapter(chapters.current, 0)}
          
          {/* Future Chapters */}
          {chapters?.future.map((chapter, index) => renderChapter(chapter, index))}
        </View>

        {/* Empty State */}
        {!chapters?.history.length && !chapters?.current && !chapters?.future.length && (
          <View style={styles.emptyState}>
            <Ionicons name="book-outline" size={64} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No Chapters Yet</Text>
            <Text style={styles.emptyDescription}>Start your adventure to see chapters appear here!</Text>
          </View>
        )}
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
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 20,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    flex: 1,
  },
  backButtonText: {
    fontSize: 16,
    color: '#8B5CF6',
    marginLeft: 4,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    flex: 2,
    textAlign: 'center',
  },
  headerSpacer: {
    flex: 1,
  },
  chaptersContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  summaryContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 16,
    textAlign: 'center',
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#8B5CF6',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chaptersSection: {
    marginBottom: 20,
  },
  chapterCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  // History chapter styles
  historyCard: {
    backgroundColor: '#F8F9FA',
    borderLeftWidth: 4,
    borderLeftColor: '#6B7280',
  },
  // Current chapter styles
  currentCard: {
    backgroundColor: '#EFF6FF',
    borderLeftWidth: 4,
    borderLeftColor: '#8B5CF6',
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.1,
  },
  // Future chapter styles
  futureCard: {
    backgroundColor: '#F0FDF4',
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  chapterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  chapterNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E5E7EB',
  },
  historyNumber: {
    backgroundColor: '#9CA3AF',
  },
  currentNumber: {
    backgroundColor: '#8B5CF6',
  },
  futureNumber: {
    backgroundColor: '#10B981',
  },
  chapterNumberText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
  },
  historyNumberText: {
    color: 'white',
  },
  currentNumberText: {
    color: 'white',
  },
  futureNumberText: {
    color: 'white',
  },
  chapterStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  historyStatusText: {
    color: '#6B7280',
  },
  currentStatusText: {
    color: '#8B5CF6',
  },
  futureStatusText: {
    color: '#10B981',
  },
  chapterTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 8,
  },
  historyTitle: {
    color: '#6B7280',
  },
  currentTitle: {
    color: '#1E293B',
  },
  futureTitle: {
    color: '#064E3B',
  },
  chapterDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#64748B',
    marginBottom: 8,
  },
  historyDescription: {
    color: '#9CA3AF',
  },
  currentDescription: {
    color: '#475569',
  },
  futureDescription: {
    color: '#047857',
  },
  currentIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  currentIndicatorText: {
    fontSize: 12,
    color: '#8B5CF6',
    marginLeft: 4,
    fontWeight: '500',
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
    paddingHorizontal: 20,
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
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#64748B',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
}); 