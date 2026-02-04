/**
 * K-Means Clustering for Cold-Start Recommendations
 * 
 * Implements K-Means algorithm for geo-location and rent-based
 * property grouping. Used when users have no interaction history.
 * 
 * Academic Purpose: Demonstrates unsupervised learning using:
 * - Euclidean distance calculation
 * - K-Means clustering with geo-spatial features
 * - Min-Max normalization
 */

import { kmeans } from 'ml-kmeans';

export class KMeansClusterer {
  constructor(config = {}) {
    this.numClusters = config.numClusters || 10;
    this.maxIterations = config.maxIterations || 100;
    this.model = null;
    this.clusterMetadata = [];
    this.featureScalers = {
      latitude: { min: 0, max: 0 },
      longitude: { min: 0, max: 0 },
      rent: { min: 0, max: 0 },
    };
  }

  /**
   * Min-Max normalization
   */
  normalizeFeature(value, min, max) {
    if (max === min) return 0.5;
    return (value - min) / (max - min);
  }

  denormalizeFeature(normalizedValue, min, max) {
    return normalizedValue * (max - min) + min;
  }

  /**
   * Calculate feature statistics for scaling
   */
  calculateFeatureStats(properties) {
    const latitudes = properties.map(p => p.latitude || 0).filter(v => v !== 0);
    const longitudes = properties.map(p => p.longitude || 0).filter(v => v !== 0);
    const rents = properties.map(p => p.rent_amount || 0).filter(v => v > 0);

    this.featureScalers.latitude = {
      min: Math.min(...latitudes) || 27.6,
      max: Math.max(...latitudes) || 27.8,
    };

    this.featureScalers.longitude = {
      min: Math.min(...longitudes) || 85.2,
      max: Math.max(...longitudes) || 85.4,
    };

    this.featureScalers.rent = {
      min: Math.min(...rents) || 0,
      max: Math.max(...rents) || 50000,
    };
  }

  /**
   * Get approximate coordinates for cities (fallback)
   */
  getCityCoordinates(city) {
    const cityCoords = {
      'kathmandu': { lat: 27.7172, lon: 85.3240 },
      'lalitpur': { lat: 27.6667, lon: 85.3167 },
      'bhaktapur': { lat: 27.6710, lon: 85.4298 },
      'pokhara': { lat: 28.2096, lon: 83.9856 },
    };
    return cityCoords[city?.toLowerCase()] || { lat: 27.7000, lon: 85.3000 };
  }

  /**
   * Prepare feature vectors for clustering
   */
  prepareFeatureVectors(properties) {
    return properties.map(property => {
      const coords = this.getCityCoordinates(property.city);
      const lat = property.latitude || coords.lat;
      const lon = property.longitude || coords.lon;
      const rent = property.rent_amount || 0;

      return [
        this.normalizeFeature(lat, this.featureScalers.latitude.min, this.featureScalers.latitude.max),
        this.normalizeFeature(lon, this.featureScalers.longitude.min, this.featureScalers.longitude.max),
        this.normalizeFeature(rent, this.featureScalers.rent.min, this.featureScalers.rent.max),
      ];
    });
  }

  /**
   * Calculate Euclidean distance
   */
  euclideanDistance(point1, point2) {
    return Math.sqrt(
      point1.reduce((sum, val, i) => sum + Math.pow(val - point2[i], 2), 0)
    );
  }

  /**
   * Train K-Means model
   */
  fit(properties) {
    console.log(`[K-Means] Training on ${properties.length} properties`);

    // Require at least 10 properties for stable clustering (ml-kmeans library needs sufficient data)
    if (properties.length < 10) {
      console.log(`[K-Means] Too few properties (${properties.length}), need at least 10 for clustering`);
      this.model = null;
      return false;
    }

    if (properties.length < this.numClusters) {
      this.numClusters = Math.max(2, Math.floor(properties.length / 2));
      console.log(`[K-Means] Adjusted clusters to ${this.numClusters}`);
    }

    this.calculateFeatureStats(properties);
    const featureVectors = this.prepareFeatureVectors(properties);

    try {
      this.model = kmeans(featureVectors, this.numClusters, {
        maxIterations: this.maxIterations,
        initialization: 'kmeans++',
      });

      // Assign cluster IDs to properties
      properties.forEach((property, index) => {
        property.clusterId = this.model.clusters[index];
      });

      // Calculate cluster statistics
      this.calculateClusterMetadata(properties);

      console.log(`[K-Means] Training complete. Clusters: ${this.numClusters}, Iterations: ${this.model.iterations}`);
      return true;

    } catch (error) {
      console.error('[K-Means] Training failed:', error);
      this.model = null;
      return false;
    }
  }

  /**
   * Calculate metadata for each cluster
   */
  calculateClusterMetadata(properties) {
    this.clusterMetadata = [];

    for (let clusterId = 0; clusterId < this.numClusters; clusterId++) {
      const clusterProperties = properties.filter(p => p.clusterId === clusterId);

      if (clusterProperties.length === 0) continue;

      const rents = clusterProperties.map(p => p.rent_amount).filter(r => r > 0);
      const cities = clusterProperties.map(p => p.city).filter(c => c);

      const avgRent = rents.length > 0 ? rents.reduce((a, b) => a + b, 0) / rents.length : 0;
      const minRent = rents.length > 0 ? Math.min(...rents) : 0;
      const maxRent = rents.length > 0 ? Math.max(...rents) : 0;

      // Find most common city
      const cityFrequency = {};
      cities.forEach(city => {
        cityFrequency[city] = (cityFrequency[city] || 0) + 1;
      });
      const primaryCity = Object.keys(cityFrequency).reduce((a, b) => 
        cityFrequency[a] > cityFrequency[b] ? a : b, 
        cities[0] || 'Unknown'
      );

      // Centroid in original scale
      const centroid = this.model.centroids[clusterId];
      const centroidLat = this.denormalizeFeature(
        centroid[0], this.featureScalers.latitude.min, this.featureScalers.latitude.max
      );
      const centroidLon = this.denormalizeFeature(
        centroid[1], this.featureScalers.longitude.min, this.featureScalers.longitude.max
      );
      const centroidRent = this.denormalizeFeature(
        centroid[2], this.featureScalers.rent.min, this.featureScalers.rent.max
      );

      this.clusterMetadata.push({
        clusterId,
        propertyCount: clusterProperties.length,
        centroidLatitude: centroidLat,
        centroidLongitude: centroidLon,
        centroidRent: centroidRent,
        avgRent: Math.round(avgRent),
        minRent: Math.round(minRent),
        maxRent: Math.round(maxRent),
        primaryCity: primaryCity,
        propertyIds: clusterProperties.map(p => p.id),
      });
    }
  }

  /**
   * Predict cluster for user preferences
   */
  predict(userPreferences) {
    if (!this.model) {
      throw new Error('Model not trained. Call fit() first.');
    }

    const coords = this.getCityCoordinates(userPreferences.city);
    const lat = userPreferences.latitude || coords.lat;
    const lon = userPreferences.longitude || coords.lon;
    const rent = userPreferences.preferredRent || 
                 ((userPreferences.minRent || 0) + (userPreferences.maxRent || 50000)) / 2;

    const userVector = [
      this.normalizeFeature(lat, this.featureScalers.latitude.min, this.featureScalers.latitude.max),
      this.normalizeFeature(lon, this.featureScalers.longitude.min, this.featureScalers.longitude.max),
      this.normalizeFeature(rent, this.featureScalers.rent.min, this.featureScalers.rent.max),
    ];

    // Find nearest centroid
    let nearestCluster = 0;
    let minDistance = Infinity;

    this.model.centroids.forEach((centroid, index) => {
      const distance = this.euclideanDistance(userVector, centroid);
      if (distance < minDistance) {
        minDistance = distance;
        nearestCluster = index;
      }
    });

    return {
      clusterId: nearestCluster,
      distance: minDistance,
      metadata: this.clusterMetadata[nearestCluster],
    };
  }

  /**
   * Get properties from a specific cluster
   */
  getClusterProperties(clusterId) {
    const metadata = this.clusterMetadata[clusterId];
    return metadata ? metadata.propertyIds : [];
  }
}

export default KMeansClusterer;
