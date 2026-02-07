/**
 * ML Recommendation Service
 * 
 * Main service integrating TF-IDF content-based filtering and K-Means clustering
 * for property recommendations.
 * 
 * Academic Features:
 * - Content-Based Filtering using TF-IDF and Cosine Similarity
 * - Cold-Start Solution using K-Means Geo-Clustering
 * - Hybrid Recommendations combining multiple approaches
 * - Explainable AI with matching feature explanations
 */

import { query } from "../config/database.js";
import { TFIDFVectorizer } from "../ml-recommendation/tfidf-vectorizer.js";
import { KMeansClusterer } from "../ml-recommendation/kmeans-clusterer.js";
import { MLUserInteraction } from "../models/MLUserInteraction.js";
import { MLUserPreference } from "../models/MLUserPreference.js";
import { MLRecommendation } from "../models/MLRecommendation.js";

export class MLRecommendationService {
  constructor() {
    this.tfidfVectorizer = null;
    this.kmeansClusterer = null;
    this.propertyVectors = [];
    this.isModelTrained = false;
  }

  /**
   * Train ML models on all active properties
   */
  async trainModels() {
    try {
      console.log('[ML-Service] Starting model training...');

      // Fetch all active properties
      const propertiesResult = await query(`
        SELECT l.*, u.name AS landlord_name
        FROM listings l
        JOIN users u ON l.landlord_id = u.id
        WHERE l.status = 'active'
        ORDER BY l.created_at DESC
      `);

      const properties = propertiesResult.rows;
      console.log(`[ML-Service] Training on ${properties.length} properties`);

      if (properties.length < 3) {
        console.warn('[ML-Service] Not enough properties for training (minimum 3 required)');
        return false;
      }

      // Train TF-IDF Vectorizer
      this.tfidfVectorizer = new TFIDFVectorizer({
        maxFeatures: 500,
        minDocFrequency: 2,
      });
      this.tfidfVectorizer.fit(properties);

      // Generate feature vectors for all properties
      this.propertyVectors = properties.map(property => ({
        listingId: property.id,
        vector: this.tfidfVectorizer.transform(property),
        property: property,
      }));

      // Save feature vectors to database
      await this.saveFeatureVectors(this.propertyVectors);

      // Train K-Means Clusterer
      this.kmeansClusterer = new KMeansClusterer({
        numClusters: Math.min(10, Math.floor(properties.length / 5)),
        maxIterations: 100,
      });
      const kmeansSuccess = this.kmeansClusterer.fit(properties);

      // Save cluster data only if K-Means trained successfully
      if (kmeansSuccess && this.kmeansClusterer.clusterMetadata) {
        await this.saveClusters(this.kmeansClusterer);
      }

      this.isModelTrained = true;
      console.log('[ML-Service] Model training complete');
      
      return {
        success: true,
        stats: {
          totalProperties: properties.length,
          tfidfVectors: this.propertyVectors.length,
          clusters: kmeansSuccess ? this.kmeansClusterer.clusterMetadata?.length || 0 : 0,
          kmeansEnabled: kmeansSuccess
        }
      };

    } catch (error) {
      console.error('[ML-Service] Model training failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Save feature vectors to database
   */
  async saveFeatureVectors(propertyVectors) {
    try {
      for (const item of propertyVectors) {
        const property = item.property;
        const text = `
          INSERT INTO property_feature_vectors (
            listing_id, tfidf_vector, normalized_rent, normalized_bedrooms,
            normalized_bathrooms, latitude, longitude, geo_cluster_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (listing_id)
          DO UPDATE SET
            tfidf_vector = EXCLUDED.tfidf_vector,
            normalized_rent = EXCLUDED.normalized_rent,
            normalized_bedrooms = EXCLUDED.normalized_bedrooms,
            normalized_bathrooms = EXCLUDED.normalized_bathrooms,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            geo_cluster_id = EXCLUDED.geo_cluster_id,
            last_computed = CURRENT_TIMESTAMP
        `;

        await query(text, [
          property.id,
          JSON.stringify(item.vector),
          property.rent_amount / 100000, // Normalize to 0-1 scale
          property.bedrooms / 10,
          property.bathrooms / 10,
          property.latitude || null,
          property.longitude || null,
          property.clusterId || null,
        ]);
      }
    } catch (error) {
      console.error('[ML-Service] Error saving feature vectors:', error);
    }
  }

  /**
   * Save cluster data to database
   */
  async saveClusters(clusterer) {
    try {
      for (const cluster of clusterer.clusterMetadata) {
        const text = `
          INSERT INTO geo_clusters (
            cluster_id, centroid_latitude, centroid_longitude, centroid_rent,
            property_count, avg_rent, min_rent, max_rent, primary_city
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (cluster_id)
          DO UPDATE SET
            centroid_latitude = EXCLUDED.centroid_latitude,
            centroid_longitude = EXCLUDED.centroid_longitude,
            centroid_rent = EXCLUDED.centroid_rent,
            property_count = EXCLUDED.property_count,
            avg_rent = EXCLUDED.avg_rent,
            min_rent = EXCLUDED.min_rent,
            max_rent = EXCLUDED.max_rent,
            primary_city = EXCLUDED.primary_city,
            last_computed = CURRENT_TIMESTAMP
        `;

        await query(text, [
          cluster.clusterId,
          cluster.centroidLatitude,
          cluster.centroidLongitude,
          cluster.centroidRent,
          cluster.propertyCount,
          cluster.avgRent,
          cluster.minRent,
          cluster.maxRent,
          cluster.primaryCity,
        ]);
      }
    } catch (error) {
      console.error('[ML-Service] Error saving clusters:', error);
    }
  }

  /**
   * Build user preference profile from interaction history
   */
  async buildUserPreferenceProfile(userId) {
    try {
      console.log(`[ML-Service] Building preference profile for user ${userId}`);

      const searches = await MLUserInteraction.getUserSearchHistory(userId, 50);
      const views = await MLUserInteraction.getUserPropertyViews(userId, 100);
      const favorites = await query(
        'SELECT l.* FROM favorites f JOIN listings l ON f.listing_id = l.id WHERE f.user_id = $1',
        [userId]
      );

      if (searches.length === 0 && views.length === 0 && favorites.rows.length === 0) {
        console.log(`[ML-Service] No interaction history for user ${userId}`);
        return null;
      }

      // Aggregate preferences from searches
      const cities = {};
      const propertyTypes = {};
      const amenities = {};
      let rentSum = 0, rentCount = 0, minRent = Infinity, maxRent = 0;
      let bedroomsSum = 0, bedroomsCount = 0;

      searches.forEach(search => {
        if (search.city) cities[search.city] = (cities[search.city] || 0) + 1;
        if (search.property_type) propertyTypes[search.property_type] = (propertyTypes[search.property_type] || 0) + 1;
        if (search.amenities) {
          search.amenities.forEach(a => amenities[a] = (amenities[a] || 0) + 1);
        }
        if (search.min_rent) minRent = Math.min(minRent, search.min_rent);
        if (search.max_rent) maxRent = Math.max(maxRent, search.max_rent);
        if (search.bedrooms) {
          bedroomsSum += search.bedrooms;
          bedroomsCount++;
        }
      });

      // Aggregate from viewed properties
      views.forEach(view => {
        if (view.city) cities[view.city] = (cities[view.city] || 0) + 2; // Weight views more
        if (view.type) propertyTypes[view.type] = (propertyTypes[view.type] || 0) + 2;
        if (view.rent_amount) {
          rentSum += view.rent_amount;
          rentCount++;
        }
      });

      // Create virtual property representing user preferences
      const userPreferenceProperty = {
        title: 'User Preference Profile',
        description: `User prefers properties in ${Object.keys(cities).join(', ')}`,
        city: Object.keys(cities).sort((a, b) => cities[b] - cities[a])[0],
        rent_amount: rentCount > 0 ? rentSum / rentCount : (minRent + maxRent) / 2,
        bedrooms: bedroomsCount > 0 ? Math.round(bedroomsSum / bedroomsCount) : null,
        type: Object.keys(propertyTypes).sort((a, b) => propertyTypes[b] - propertyTypes[a])[0],
        amenities: Object.keys(amenities).sort((a, b) => amenities[b] - amenities[a]).slice(0, 5),
      };

      // Generate TF-IDF vector for user
      if (!this.isModelTrained) {
        await this.trainModels();
      }

      const userVector = this.tfidfVectorizer.transform(userPreferenceProperty);

      // Save profile
      await MLUserPreference.upsertProfile(userId, {
        preferredCities: Object.keys(cities).sort((a, b) => cities[b] - cities[a]),
        preferredMinRent: minRent === Infinity ? null : minRent,
        preferredMaxRent: maxRent === 0 ? null : maxRent,
        preferredBedrooms: bedroomsCount > 0 ? Math.round(bedroomsSum / bedroomsCount) : null,
        preferredPropertyTypes: Object.keys(propertyTypes).sort((a, b) => propertyTypes[b] - propertyTypes[a]),
        preferredAmenities: Object.keys(amenities).sort((a, b) => amenities[b] - amenities[a]),
        tfidfVector: userVector,
        totalSearches: searches.length,
        totalViews: views.length,
      });

      return userVector;

    } catch (error) {
      console.error('[ML-Service] Error building user profile:', error);
      return null;
    }
  }

  /**
   * Generate content-based recommendations using TF-IDF
   */
  async generateContentBasedRecommendations(userId, topN = 20) {
    try {
      console.log(`[ML-Service] Generating content-based recommendations for user ${userId}`);

      // Build or get user profile
      let userVector = await this.buildUserPreferenceProfile(userId);
      
      if (!userVector) {
        const profile = await MLUserPreference.getProfile(userId);
        if (profile && profile.tfidf_vector) {
          userVector = profile.tfidf_vector;
        } else {
          console.log('[ML-Service] No user profile available');
          return [];
        }
      }

      if (!this.isModelTrained) {
        await this.trainModels();
      }

      // Find similar properties
      const similarities = this.tfidfVectorizer.findSimilar(userVector, this.propertyVectors, topN * 2);

      // Filter out already viewed properties
      const viewedIds = new Set();
      const views = await MLUserInteraction.getUserPropertyViews(userId, 100);
      views.forEach(v => viewedIds.add(v.listing_id));

      const recommendations = [];
      for (const sim of similarities) {
        if (viewedIds.has(sim.listingId)) continue;
        if (sim.similarity < 0.3) continue; // Minimum similarity threshold

        const property = this.propertyVectors.find(p => p.listingId === sim.listingId)?.property;
        if (!property) continue;

        // Create recommendation
        await MLRecommendation.create(userId, sim.listingId, {
          type: 'content_based',
          confidenceScore: sim.similarity,
          similarityScore: sim.similarity,
          matchingFeatures: {
            city: property.city,
            rent: property.rent_amount,
            bedrooms: property.bedrooms,
            type: property.type,
          },
          explanation: this.generateExplanation(property, sim.similarity),
        });

        recommendations.push({
          ...property,
          similarity: sim.similarity,
          type: 'content_based',
        });

        if (recommendations.length >= topN) break;
      }

      console.log(`[ML-Service] Generated ${recommendations.length} content-based recommendations`);
      return recommendations;

    } catch (error) {
      console.error('[ML-Service] Error generating content-based recommendations:', error);
      return [];
    }
  }

  /**
   * Generate cold-start recommendations using K-Means clustering
   */
  async generateColdStartRecommendations(userId, userPreferences, topN = 20) {
    try {
      console.log(`[ML-Service] Generating cold-start recommendations for user ${userId}`);

      if (!this.isModelTrained) {
        await this.trainModels();
      }

      // Predict user's cluster
      const clusterPrediction = this.kmeansClusterer.predict(userPreferences);
      console.log(`[ML-Service] User assigned to cluster ${clusterPrediction.clusterId}`);

      // Get properties from the cluster
      const propertyIds = clusterPrediction.metadata.propertyIds || [];
      
      if (propertyIds.length === 0) {
        console.log('[ML-Service] No properties in predicted cluster');
        return [];
      }

      // Fetch property details
      const result = await query(
        `SELECT l.*, u.name AS landlord_name
         FROM listings l
         JOIN users u ON l.landlord_id = u.id
         WHERE l.id = ANY($1) AND l.status = 'active'
         ORDER BY l.created_at DESC
         LIMIT $2`,
        [propertyIds, topN]
      );

      const recommendations = [];
      for (const property of result.rows) {
        // Create recommendation
        await MLRecommendation.create(userId, property.id, {
          type: 'cold_start_geo',
          confidenceScore: 1 - clusterPrediction.distance,
          similarityScore: 1 - clusterPrediction.distance,
          matchingFeatures: {
            cluster: clusterPrediction.clusterId,
            city: property.city,
            avgRent: clusterPrediction.metadata.avgRent,
          },
          explanation: `Property in ${property.city} matching your location and budget preferences (Avg rent: Rs. ${clusterPrediction.metadata.avgRent})`,
        });

        recommendations.push({
          ...property,
          cluster: clusterPrediction.clusterId,
          type: 'cold_start_geo',
        });
      }

      console.log(`[ML-Service] Generated ${recommendations.length} cold-start recommendations`);
      return recommendations;

    } catch (error) {
      console.error('[ML-Service] Error generating cold-start recommendations:', error);
      return [];
    }
  }

  /**
   * Generate recommendations for a user (hybrid approach)
   */
  async generateRecommendations(userId, userPreferences = {}) {
    try {
      // Check if user has sufficient interaction history
      const hasSufficientHistory = await MLUserInteraction.hasSufficientHistory(userId, 3);

      let recommendations = [];

      if (hasSufficientHistory) {
        // Use content-based filtering
        recommendations = await this.generateContentBasedRecommendations(userId, 20);
      } else {
        // Use cold-start clustering
        recommendations = await this.generateColdStartRecommendations(userId, userPreferences, 20);
      }

      return recommendations;

    } catch (error) {
      console.error('[ML-Service] Error generating recommendations:', error);
      return [];
    }
  }

  /**
   * Generate explanation for recommendation
   */
  generateExplanation(property, similarityScore) {
    const score = (similarityScore * 100).toFixed(0);
    return `${score}% match based on your search history and preferences. Located in ${property.city}, ${property.bedrooms} bedrooms, Rs. ${property.rent_amount}/month.`;
  }
}

// Singleton instance
const mlRecommendationService = new MLRecommendationService();
export default mlRecommendationService;
