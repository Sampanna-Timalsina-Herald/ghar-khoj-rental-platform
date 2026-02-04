/**
 * TF-IDF Vectorizer for Content-Based Filtering
 * 
 * Implements Term Frequency-Inverse Document Frequency vectorization
 * for property recommendation using natural language processing.
 * 
 * Academic Purpose: Demonstrates ML-based content filtering using:
 * - Text preprocessing and tokenization
 * - TF-IDF calculation
 * - Cosine similarity computation
 */

import natural from 'natural';
const { TfIdf, WordTokenizer, PorterStemmer } = natural;

export class TFIDFVectorizer {
  constructor(config = {}) {
    this.maxFeatures = config.maxFeatures || 500;
    this.minDocFrequency = config.minDocFrequency || 2;
    this.vocabulary = new Map();
    this.idfScores = new Map();
    this.documentCount = 0;
  }

  /**
   * Preprocess and tokenize text
   */
  preprocessText(text) {
    if (!text || typeof text !== 'string') return [];

    const tokenizer = new WordTokenizer();
    let tokens = tokenizer.tokenize(text.toLowerCase());

    // Remove short tokens and apply stemming
    tokens = tokens
      .filter(token => token.length > 2 && !/^\d+$/.test(token))
      .map(token => PorterStemmer.stem(token));

    return tokens;
  }

  /**
   * Extract features from property listing
   */
  extractPropertyFeatures(property) {
    const features = [];

    // Text features from title and description
    if (property.title) {
      features.push(...this.preprocessText(property.title));
    }
    if (property.description) {
      features.push(...this.preprocessText(property.description));
    }

    // Location features
    if (property.city) {
      features.push(`city_${property.city.toLowerCase().replace(/\s+/g, '_')}`);
    }
    if (property.college_name) {
      features.push(`college_${property.college_name.toLowerCase().replace(/\s+/g, '_')}`);
    }

    // Structured features
    if (property.bedrooms) features.push(`bedrooms_${property.bedrooms}`);
    if (property.bathrooms) features.push(`bathrooms_${property.bathrooms}`);
    if (property.type) features.push(`type_${property.type.toLowerCase()}`);
    if (property.furnished) features.push(`furnished_${property.furnished.toLowerCase()}`);

    // Amenities
    if (property.amenities && Array.isArray(property.amenities)) {
      property.amenities.forEach(amenity => {
        features.push(`amenity_${amenity.toLowerCase().replace(/\s+/g, '_')}`);
      });
    }

    // Price range bucket
    if (property.rent_amount) {
      const rentBucket = this.getRentBucket(property.rent_amount);
      features.push(`rent_${rentBucket}`);
    }

    return features;
  }

  getRentBucket(rent) {
    if (rent < 5000) return 'very_low';
    if (rent < 10000) return 'low';
    if (rent < 20000) return 'medium';
    if (rent < 30000) return 'high';
    return 'very_high';
  }

  /**
   * Fit vectorizer on property corpus
   */
  fit(properties) {
    console.log(`[TF-IDF] Fitting vectorizer on ${properties.length} properties`);

    this.documentCount = properties.length;
    const termFrequencies = new Map();

    // Calculate document frequencies
    properties.forEach(property => {
      const features = this.extractPropertyFeatures(property);
      const uniqueTerms = new Set(features);

      uniqueTerms.forEach(term => {
        termFrequencies.set(term, (termFrequencies.get(term) || 0) + 1);
      });
    });

    // Filter terms by document frequency
    const minDocs = this.minDocFrequency;
    const maxDocs = Math.floor(this.documentCount * 0.8);

    const filteredTerms = Array.from(termFrequencies.entries())
      .filter(([term, freq]) => freq >= minDocs && freq <= maxDocs)
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.maxFeatures)
      .map(([term]) => term);

    // Build vocabulary and calculate IDF scores
    filteredTerms.forEach((term, index) => {
      this.vocabulary.set(term, index);
      const docCount = termFrequencies.get(term) || 0;
      const idf = Math.log((this.documentCount + 1) / (docCount + 1)) + 1;
      this.idfScores.set(term, idf);
    });

    console.log(`[TF-IDF] Vocabulary built with ${this.vocabulary.size} terms`);
  }

  /**
   * Transform property to TF-IDF vector
   */
  transform(property) {
    const features = this.extractPropertyFeatures(property);
    const vector = new Array(this.vocabulary.size).fill(0);

    // Calculate term frequencies
    const termCounts = new Map();
    features.forEach(term => {
      termCounts.set(term, (termCounts.get(term) || 0) + 1);
    });

    // Calculate TF-IDF scores
    termCounts.forEach((count, term) => {
      if (this.vocabulary.has(term)) {
        const index = this.vocabulary.get(term);
        const tf = count / features.length;
        const idf = this.idfScores.get(term) || 1;
        vector[index] = tf * idf;
      }
    });

    // L2 normalization
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] /= magnitude;
      }
    }

    return vector;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(vectorA, vectorB) {
    if (vectorA.length !== vectorB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      magnitudeA += vectorA[i] * vectorA[i];
      magnitudeB += vectorB[i] * vectorB[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) return 0;

    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Find top N most similar properties
   */
  findSimilar(userVector, propertyVectors, topN = 20) {
    const similarities = propertyVectors.map((item) => ({
      listingId: item.listingId,
      similarity: this.cosineSimilarity(userVector, item.vector),
    }));

    // Sort by similarity (descending) and return top N
    similarities.sort((a, b) => b.similarity - a.similarity);
    return similarities.slice(0, topN);
  }
}

export default TFIDFVectorizer;
