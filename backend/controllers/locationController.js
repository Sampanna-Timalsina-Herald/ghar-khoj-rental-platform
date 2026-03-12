import UserLocation from '../models/UserLocation.js';
import { UserPreferences } from '../models/UserPreferences.js';
import { User } from '../models/User.js';

const mapLocationRow = (row) => ({
  id: row.id,
  userId: row.user_id,
  label: row.label,
  city: row.city,
  fullAddress: row.full_address,
  latitude: Number(row.latitude),
  longitude: Number(row.longitude),
  radiusKm: row.radius_km ? Number(row.radius_km) : null,
  isPrimary: row.is_primary,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const updatePreferenceLocations = async (userId, locations) => {
  const cityList = Array.from(
    new Set(
      (locations || [])
        .map((loc) => loc.city)
        .filter((c) => typeof c === 'string' && c.trim().length > 0)
    )
  );

  // Preserve other preference values while ensuring has_set_preferences is true when locations exist
  await UserPreferences.upsert(userId, {
    locations: cityList,
    hasSetPreferences: cityList.length > 0,
  });
};

const syncUserCityFromPrimary = async (userId) => {
  try {
    const primary = await UserLocation.getPrimary(userId);
    const city = primary?.city || null;
    await User.update(userId, { city });
  } catch (err) {
    console.error('[LOCATIONS] Failed to sync user city from primary location:', err.message);
  }
};

export const listLocations = async (req, res) => {
  try {
    const userId = req.user.userId;
    const locations = await UserLocation.getByUser(userId);

    res.json({
      success: true,
      data: locations.map(mapLocationRow),
    });
  } catch (error) {
    console.error('[LOCATIONS] Failed to list locations:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch locations' });
  }
};

export const getStatus = async (req, res) => {
  try {
    const userId = req.user.userId;
    const primary = await UserLocation.getPrimary(userId);
    const hasLocation = Boolean(primary);

    res.json({
      success: true,
      data: {
        hasLocation,
        primaryLocation: primary ? mapLocationRow(primary) : null,
      },
    });
  } catch (error) {
    console.error('[LOCATIONS] Failed to fetch status:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch location status' });
  }
};

export const createLocation = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { label, city, full_address, fullAddress, latitude, longitude, radius_km, radiusKm, is_primary, isPrimary } = req.body;

    const latNum = Number(latitude);
    const lngNum = Number(longitude);
    const radiusNum = radiusKm ?? radius_km ?? 20;

    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
      return res.status(400).json({ success: false, error: 'Valid latitude and longitude are required' });
    }

    const location = await UserLocation.create(userId, {
      label: label || 'Primary',
      city: city || null,
      fullAddress: fullAddress ?? full_address ?? null,
      latitude: latNum,
      longitude: lngNum,
      radiusKm: radiusNum ? Number(radiusNum) : 20,
      isPrimary: isPrimary ?? is_primary ?? false,
    });

    const allLocations = await UserLocation.getByUser(userId);
    await updatePreferenceLocations(userId, allLocations);
    await syncUserCityFromPrimary(userId);

    res.status(201).json({
      success: true,
      message: 'Location saved successfully',
      data: mapLocationRow(location),
    });
  } catch (error) {
    console.error('[LOCATIONS] Failed to create location:', error.message);
    res.status(500).json({ success: false, error: 'Failed to save location' });
  }
};

export const updateLocation = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { locationId } = req.params;
    const updates = req.body || {};

    if (updates.latitude !== undefined && !Number.isFinite(Number(updates.latitude))) {
      return res.status(400).json({ success: false, error: 'Invalid latitude' });
    }
    if (updates.longitude !== undefined && !Number.isFinite(Number(updates.longitude))) {
      return res.status(400).json({ success: false, error: 'Invalid longitude' });
    }

    const updated = await UserLocation.update(locationId, userId, {
      ...updates,
      fullAddress: updates.fullAddress ?? updates.full_address,
      radiusKm: updates.radiusKm ?? updates.radius_km,
      isPrimary: updates.isPrimary ?? updates.is_primary,
    });

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Location not found' });
    }

    const allLocations = await UserLocation.getByUser(userId);
    await updatePreferenceLocations(userId, allLocations);
  await syncUserCityFromPrimary(userId);

    res.json({
      success: true,
      message: 'Location updated successfully',
      data: mapLocationRow(updated),
    });
  } catch (error) {
    console.error('[LOCATIONS] Failed to update location:', error.message);
    res.status(500).json({ success: false, error: 'Failed to update location' });
  }
};

export const setPrimaryLocation = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { locationId } = req.params;

    const updated = await UserLocation.setPrimary(locationId, userId);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Location not found' });
    }

    const allLocations = await UserLocation.getByUser(userId);
    await updatePreferenceLocations(userId, allLocations);
    await syncUserCityFromPrimary(userId);

    res.json({
      success: true,
      message: 'Primary location updated',
      data: mapLocationRow(updated),
    });
  } catch (error) {
    console.error('[LOCATIONS] Failed to set primary location:', error.message);
    res.status(500).json({ success: false, error: 'Failed to set primary location' });
  }
};

export const deleteLocation = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { locationId } = req.params;

    const deleted = await UserLocation.delete(locationId, userId);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Location not found' });
    }

    const allLocations = await UserLocation.getByUser(userId);
    await updatePreferenceLocations(userId, allLocations);
    await syncUserCityFromPrimary(userId);

    res.json({
      success: true,
      message: 'Location removed',
      data: mapLocationRow(deleted),
    });
  } catch (error) {
    console.error('[LOCATIONS] Failed to delete location:', error.message);
    res.status(500).json({ success: false, error: 'Failed to delete location' });
  }
};

export default {
  listLocations,
  getStatus,
  createLocation,
  updateLocation,
  setPrimaryLocation,
  deleteLocation,
};
