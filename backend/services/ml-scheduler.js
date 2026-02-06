/**
 * ML Scheduler Service
 * 
 * Periodically trains ML models and generates recommendations for users
 * with sufficient interaction history.
 */

import mlRecommendationService from './ml-recommendation-service.js';
import { MLUserInteraction } from '../models/MLUserInteraction.js';
import { MLRecommendation } from '../models/MLRecommendation.js';
import { query } from '../config/database.js';

class MLScheduler {
  constructor() {
    this.isTraining = false;
    this.isGenerating = false;
    this.trainingInterval = null;
    this.generationInterval = null;
  }

  /**
   * Start the ML scheduler
   */
  start() {
    console.log('[ML Scheduler] Starting ML recommendation scheduler...');
    
    // Train models every 6 hours
    this.trainingInterval = setInterval(() => {
      this.trainModels();
    }, 6 * 60 * 60 * 1000); // 6 hours

    // Generate recommendations every 30 minutes
    this.generationInterval = setInterval(() => {
      this.generateRecommendations();
    }, 30 * 60 * 1000); // 30 minutes

    // Initial training and generation
    setTimeout(() => this.trainModels(), 5000); // Train after 5 seconds
    setTimeout(() => this.generateRecommendations(), 60000); // Generate after 1 minute
    
    console.log('[ML Scheduler] Scheduler started - Training every 6 hours, Recommendations every 30 minutes');
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.trainingInterval) {
      clearInterval(this.trainingInterval);
      this.trainingInterval = null;
    }
    if (this.generationInterval) {
      clearInterval(this.generationInterval);
      this.generationInterval = null;
    }
    console.log('[ML Scheduler] Scheduler stopped');
  }

  /**
   * Train ML models
   */
  async trainModels() {
    if (this.isTraining) {
      console.log('[ML Scheduler] Training already in progress, skipping...');
      return;
    }

    try {
      this.isTraining = true;
      console.log('[ML Scheduler] Starting ML model training...');
      
      const result = await mlRecommendationService.trainModels();
      
      if (result.success) {
        console.log(`[ML Scheduler] Model training completed successfully:`, {
          properties: result.stats.totalProperties,
          tfidf_vectors: result.stats.tfidfVectors,
          clusters: result.stats.clusters
        });
      } else {
        console.error('[ML Scheduler] Model training failed:', result.error);
      }
    } catch (error) {
      console.error('[ML Scheduler] Error during model training:', error);
    } finally {
      this.isTraining = false;
    }
  }

  /**
   * Generate recommendations for active users
   */
  async generateRecommendations() {
    if (this.isGenerating) {
      console.log('[ML Scheduler] Recommendation generation already in progress, skipping...');
      return;
    }

    try {
      this.isGenerating = true;
      console.log('[ML Scheduler] Starting recommendation generation...');

      // Get all users with sufficient interaction history (at least 3 interactions)
      const usersResult = await query(`
        SELECT DISTINCT ui.user_id, u.email, u.name
        FROM user_search_interactions ui
        JOIN users u ON u.id = ui.user_id
        WHERE ui.created_at > NOW() - INTERVAL '30 days'
        GROUP BY ui.user_id, u.email, u.name
        HAVING COUNT(*) >= 3
        LIMIT 100
      `);

      const activeUsers = usersResult.rows;
      console.log(`[ML Scheduler] Found ${activeUsers.length} active users for recommendations`);

      let successCount = 0;
      let failCount = 0;

      // Generate recommendations for each active user
      for (const user of activeUsers) {
        try {
          const recommendations = await mlRecommendationService.generateRecommendations(
            user.user_id,
            10 // Generate 10 recommendations per user
          );

          if (recommendations && recommendations.length > 0) {
            successCount++;
            console.log(`[ML Scheduler] Generated ${recommendations.length} recommendations for user ${user.firstname || user.email}`);
          }
        } catch (error) {
          failCount++;
          console.error(`[ML Scheduler] Failed to generate recommendations for user ${user.user_id}:`, error.message);
        }
      }

      console.log(`[ML Scheduler] Recommendation generation completed: ${successCount} successful, ${failCount} failed`);

      // Clean up old recommendations (older than 7 days)
      await MLRecommendation.deleteExpired(7);
      console.log('[ML Scheduler] Old recommendations cleaned up');

    } catch (error) {
      console.error('[ML Scheduler] Error during recommendation generation:', error);
    } finally {
      this.isGenerating = false;
    }
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.trainingInterval !== null && this.generationInterval !== null,
      isTraining: this.isTraining,
      isGenerating: this.isGenerating,
      trainingInterval: '6 hours',
      generationInterval: '30 minutes'
    };
  }
}

// Singleton instance
const mlScheduler = new MLScheduler();
export default mlScheduler;
