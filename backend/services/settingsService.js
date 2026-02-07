/**
 * System Settings Service
 * Handles platform configuration and administrative settings
 */

import db from '../config/database.js';

class SettingsService {
  /**
   * Get all system settings
   */
  async getAllSettings() {
    try {
      // Get settings from database
      const result = await db.query(`
        SELECT * FROM system_settings 
        WHERE is_active = TRUE 
        ORDER BY setting_key
      `);

      // Convert array of settings to object
      const settings = {};
      result.rows.forEach(row => {
        settings[row.setting_key] = {
          value: row.setting_value,
          type: row.setting_type,
          description: row.description,
          updated_at: row.updated_at
        };
      });

      return settings;
    } catch (error) {
      console.error('[Settings] Error fetching settings:', error);
      // Return default settings if table doesn't exist
      return this.getDefaultSettings();
    }
  }

  /**
   * Get a specific setting by key
   */
  async getSetting(key) {
    try {
      const result = await db.query(
        `SELECT * FROM system_settings WHERE setting_key = $1 AND is_active = TRUE`,
        [key]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return {
        key: result.rows[0].setting_key,
        value: result.rows[0].setting_value,
        type: result.rows[0].setting_type,
        description: result.rows[0].description
      };
    } catch (error) {
      console.error('[Settings] Error fetching setting:', error);
      return null;
    }
  }

  /**
   * Update a setting
   */
  async updateSetting(key, value, type = 'string') {
    try {
      const result = await db.query(
        `INSERT INTO system_settings (setting_key, setting_value, setting_type, is_active)
         VALUES ($1, $2, $3, TRUE)
         ON CONFLICT (setting_key) 
         DO UPDATE SET 
           setting_value = $2,
           setting_type = $3,
           updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [key, String(value), type]
      );

      return result.rows[0];
    } catch (error) {
      console.error('[Settings] Error updating setting:', error);
      throw error;
    }
  }

  /**
   * Update multiple settings at once
   */
  async updateMultipleSettings(settingsObj) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');

      const updatedSettings = [];

      for (const [key, value] of Object.entries(settingsObj)) {
        // Determine type
        let type = 'string';
        let settingValue = value;

        if (typeof value === 'boolean') {
          type = 'boolean';
          settingValue = value.toString();
        } else if (typeof value === 'number') {
          type = 'number';
          settingValue = value.toString();
        } else if (typeof value === 'object') {
          type = 'json';
          settingValue = JSON.stringify(value);
        }

        const result = await client.query(
          `INSERT INTO system_settings (setting_key, setting_value, setting_type, is_active)
           VALUES ($1, $2, $3, TRUE)
           ON CONFLICT (setting_key) 
           DO UPDATE SET 
             setting_value = $2,
             setting_type = $3,
             updated_at = CURRENT_TIMESTAMP
           RETURNING *`,
          [key, settingValue, type]
        );

        updatedSettings.push(result.rows[0]);
      }

      await client.query('COMMIT');
      return updatedSettings;

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[Settings] Error updating multiple settings:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete a setting
   */
  async deleteSetting(key) {
    try {
      const result = await db.query(
        `UPDATE system_settings SET is_active = FALSE WHERE setting_key = $1 RETURNING *`,
        [key]
      );

      return result.rows[0];
    } catch (error) {
      console.error('[Settings] Error deleting setting:', error);
      throw error;
    }
  }

  /**
   * Initialize default settings
   */
  async initializeDefaultSettings() {
    const defaults = this.getDefaultSettings();

    try {
      for (const [key, config] of Object.entries(defaults)) {
        await this.updateSetting(key, config.value, config.type);
      }

      console.log('[Settings] Default settings initialized');
      return true;
    } catch (error) {
      console.error('[Settings] Error initializing default settings:', error);
      return false;
    }
  }

  /**
   * Get default settings structure
   */
  getDefaultSettings() {
    return {
      siteName: {
        value: 'KhojGhar',
        type: 'string',
        description: 'Platform name displayed to users'
      },
      siteDescription: {
        value: 'Find your perfect home',
        type: 'string',
        description: 'Platform description'
      },
      maintenanceMode: {
        value: 'false',
        type: 'boolean',
        description: 'Enable maintenance mode'
      },
      enableNotifications: {
        value: 'true',
        type: 'boolean',
        description: 'Enable email and push notifications'
      },
      requireEmailVerification: {
        value: 'true',
        type: 'boolean',
        description: 'Require email verification for new users'
      },
      enableTwoFactor: {
        value: 'false',
        type: 'boolean',
        description: 'Enable two-factor authentication'
      },
      maxListingsPerUser: {
        value: '10',
        type: 'number',
        description: 'Maximum listings per user'
      },
      listingApprovalRequired: {
        value: 'true',
        type: 'boolean',
        description: 'Require admin approval for listings'
      },
      autoRejectionDays: {
        value: '30',
        type: 'number',
        description: 'Days before auto-rejecting unapproved listings'
      },
      maintenanceMessage: {
        value: 'Site is under maintenance. Please try again later.',
        type: 'string',
        description: 'Message shown during maintenance mode'
      },
      enableNewListingAlerts: {
        value: 'true',
        type: 'boolean',
        description: 'Alert users about new matching listings'
      },
      enableMessageNotifications: {
        value: 'true',
        type: 'boolean',
        description: 'Notify users about new messages'
      }
    };
  }

  /**
   * Check if maintenance mode is enabled
   */
  async isMaintenanceMode() {
    try {
      const setting = await this.getSetting('maintenanceMode');
      return setting ? setting.value === 'true' : false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Export settings as JSON
   */
  async exportSettings() {
    try {
      const settings = await this.getAllSettings();
      return {
        exported_at: new Date().toISOString(),
        settings,
        version: '1.0'
      };
    } catch (error) {
      console.error('[Settings] Error exporting settings:', error);
      throw error;
    }
  }

  /**
   * Import settings from JSON
   */
  async importSettings(data) {
    try {
      if (!data.settings) {
        throw new Error('Invalid settings data format');
      }

      const settingsObj = {};
      for (const [key, config] of Object.entries(data.settings)) {
        settingsObj[key] = config.value;
      }

      await this.updateMultipleSettings(settingsObj);

      console.log('[Settings] Settings imported successfully');
      return true;
    } catch (error) {
      console.error('[Settings] Error importing settings:', error);
      throw error;
    }
  }
}

export default new SettingsService();
