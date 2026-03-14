/**
 * Settings Controller
 * Handles all system settings operations
 */

import settingsService from '../services/settingsService.js';

/**
 * Get all system settings
 */
export const getAllSettings = async (req, res) => {
  try {
    const settings = await settingsService.getAllSettings();
    
    // Convert settings object to frontend format
    const formattedSettings = {};
    for (const [key, config] of Object.entries(settings)) {
      let value = config.value;
      
      // Parse value based on type
      if (config.type === 'boolean') {
        value = value === 'true';
      } else if (config.type === 'number') {
        value = parseInt(value);
      } else if (config.type === 'json') {
        try {
          value = JSON.parse(value);
        } catch (e) {
          value = config.value;
        }
      }
      
      formattedSettings[key] = value;
    }
    
    res.json({
      success: true,
      data: formattedSettings
    });
  } catch (error) {
    console.error('[Settings] Error fetching settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system settings'
    });
  }
};

/**
 * Get a specific setting
 */
export const getSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const setting = await settingsService.getSetting(key);
    
    if (!setting) {
      return res.status(404).json({
        success: false,
        error: 'Setting not found'
      });
    }
    
    // Parse value based on type
    let value = setting.value;
    if (setting.type === 'boolean') {
      value = value === 'true';
    } else if (setting.type === 'number') {
      value = parseInt(value);
    } else if (setting.type === 'json' && typeof value === 'string') {
      try {
        value = JSON.parse(value);
      } catch (e) {
        value = setting.value;
      }
    }
    
    res.json({
      success: true,
      data: {
        key: setting.key,
        value: value,
        type: setting.type
      }
    });
  } catch (error) {
    console.error('[Settings] Error fetching setting:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch setting'
    });
  }
};

/**
 * Update multiple settings
 */
export const updateSettings = async (req, res) => {
  try {
    const settings = req.body;
    
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid settings data'
      });
    }
    
    await settingsService.updateMultipleSettings(settings);
    
    res.json({
      success: true,
      message: 'Settings updated successfully'
    });
  } catch (error) {
    console.error('[Settings] Error updating settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update settings'
    });
  }
};

/**
 * Update a single setting
 */
export const updateSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    if (value === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Setting value is required'
      });
    }
    
    // Determine type
    let type = 'string';
    if (typeof value === 'boolean') {
      type = 'boolean';
    } else if (typeof value === 'number') {
      type = 'number';
    } else if (typeof value === 'object') {
      type = 'json';
    }
    
    const updated = await settingsService.updateSetting(key, value, type);
    
    res.json({
      success: true,
      message: 'Setting updated successfully',
      data: updated
    });
  } catch (error) {
    console.error('[Settings] Error updating setting:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update setting'
    });
  }
};

/**
 * Delete a setting
 */
export const deleteSetting = async (req, res) => {
  try {
    const { key } = req.params;
    
    await settingsService.deleteSetting(key);
    
    res.json({
      success: true,
      message: 'Setting deleted successfully'
    });
  } catch (error) {
    console.error('[Settings] Error deleting setting:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete setting'
    });
  }
};

/**
 * Initialize default settings
 */
export const initializeDefaults = async (req, res) => {
  try {
    await settingsService.initializeDefaultSettings();
    
    res.json({
      success: true,
      message: 'Default settings initialized successfully'
    });
  } catch (error) {
    console.error('[Settings] Error initializing defaults:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initialize default settings'
    });
  }
};

/**
 * Check maintenance mode
 */
export const checkMaintenanceMode = async (req, res) => {
  try {
    const isMaintenanceMode = await settingsService.isMaintenanceMode();
    
    res.json({
      success: true,
      data: {
        maintenanceMode: isMaintenanceMode
      }
    });
  } catch (error) {
    console.error('[Settings] Error checking maintenance mode:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check maintenance mode'
    });
  }
};

/**
 * Export settings
 */
export const exportSettings = async (req, res) => {
  try {
    const data = await settingsService.exportSettings();
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=settings-backup-${Date.now()}.json`);
    res.json(data);
  } catch (error) {
    console.error('[Settings] Error exporting settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export settings'
    });
  }
};

/**
 * Import settings
 */
export const importSettings = async (req, res) => {
  try {
    const data = req.body;
    
    if (!data || !data.settings) {
      return res.status(400).json({
        success: false,
        error: 'Invalid import data format'
      });
    }
    
    await settingsService.importSettings(data);
    
    res.json({
      success: true,
      message: 'Settings imported successfully'
    });
  } catch (error) {
    console.error('[Settings] Error importing settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to import settings'
    });
  }
};

export default {
  getAllSettings,
  getSetting,
  updateSettings,
  updateSetting,
  deleteSetting,
  initializeDefaults,
  checkMaintenanceMode,
  exportSettings,
  importSettings
};
