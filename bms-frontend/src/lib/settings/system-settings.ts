import type { Collection, Db, Document } from 'mongodb';
import { getDb } from '@/lib/db';

const SYSTEM_SETTINGS_COLLECTION_NAME = 'systemSettings';

export interface SystemSettings {
  _id?: string;
  general: {
    appName: string;
    appUrl: string;
    supportEmail: string;
    supportPhone: string;
  };
  security: {
    sessionTimeout: number; // hours
    requireMfa: boolean;
    passwordMinLength: number;
    passwordRequireUppercase: boolean;
    passwordRequireLowercase: boolean;
    passwordRequireNumbers: boolean;
    passwordRequireSpecialChars: boolean;
  };
  notifications: {
    emailEnabled: boolean;
    smsEnabled: boolean;
    whatsappEnabled: boolean;
    emailFrom: string;
    emailProvider?: string;
    smsProvider?: string;
  };
  maintenance: {
    maintenanceMode: boolean;
    maintenanceMessage: string;
  };
  integrations: {
    paymentProviders: {
      telebirr: {
        enabled: boolean;
        apiKey?: string;
        apiSecret?: string;
        merchantId?: string;
      };
      cbeBirr: {
        enabled: boolean;
        apiKey?: string;
        apiSecret?: string;
        merchantId?: string;
      };
      chapa: {
        enabled: boolean;
        apiKey?: string;
        publicKey?: string;
      };
      helloCash: {
        enabled: boolean;
        apiKey?: string;
        apiSecret?: string;
      };
    };
  };
  featureFlags: {
    [key: string]: boolean | Record<string, boolean>;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

const DEFAULT_SETTINGS: Omit<SystemSettings, '_id'> = {
  general: {
    appName: 'BMS',
    appUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
    supportEmail: 'support@example.com',
    supportPhone: '+251911111111',
  },
  security: {
    sessionTimeout: 24,
    requireMfa: false,
    passwordMinLength: 8,
    passwordRequireUppercase: true,
    passwordRequireLowercase: true,
    passwordRequireNumbers: true,
    passwordRequireSpecialChars: true,
  },
  notifications: {
    emailEnabled: true,
    smsEnabled: false,
    whatsappEnabled: false,
    emailFrom: 'noreply@example.com',
  },
  maintenance: {
    maintenanceMode: false,
    maintenanceMessage: 'System is under maintenance. Please check back later.',
  },
  integrations: {
    paymentProviders: {
      telebirr: {
        enabled: false,
      },
      cbeBirr: {
        enabled: false,
      },
      chapa: {
        enabled: false,
      },
      helloCash: {
        enabled: false,
      },
    },
  },
  featureFlags: {},
};

export async function getSystemSettingsCollection(): Promise<Collection<SystemSettings>> {
  const db = await getDb();
  return db.collection<SystemSettings>(SYSTEM_SETTINGS_COLLECTION_NAME);
}

export async function getSystemSettings(): Promise<SystemSettings> {
  const collection = await getSystemSettingsCollection();
  const settings = await collection.findOne({});

  if (!settings) {
    // Create default settings
    const now = new Date();
    const defaultDoc = {
      ...DEFAULT_SETTINGS,
      createdAt: now,
      updatedAt: now,
    };
    await collection.insertOne(defaultDoc as Document);
    return defaultDoc as SystemSettings;
  }

  // Merge with defaults to ensure all fields exist
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    general: { ...DEFAULT_SETTINGS.general, ...settings.general },
    security: { ...DEFAULT_SETTINGS.security, ...settings.security },
    notifications: { ...DEFAULT_SETTINGS.notifications, ...settings.notifications },
    maintenance: { ...DEFAULT_SETTINGS.maintenance, ...settings.maintenance },
    integrations: {
      paymentProviders: {
        ...DEFAULT_SETTINGS.integrations.paymentProviders,
        ...settings.integrations?.paymentProviders,
      },
    },
    featureFlags: { ...DEFAULT_SETTINGS.featureFlags, ...settings.featureFlags },
  };
}

export async function updateSystemSettings(
  updates: Partial<SystemSettings>,
): Promise<SystemSettings> {
  const collection = await getSystemSettingsCollection();
  const now = new Date();

  // Remove _id from updates if present
  const { _id, ...updateData } = updates;

  const result = await collection.findOneAndUpdate(
    {},
    {
      $set: {
        ...updateData,
        updatedAt: now,
      },
    },
    {
      upsert: true,
      returnDocument: 'after',
    },
  );

  if (!result) {
    throw new Error('Failed to update system settings');
  }

  return result as SystemSettings;
}

export async function updateSystemSettingsSection(
  section: keyof Omit<SystemSettings, '_id' | 'createdAt' | 'updatedAt'>,
  sectionData: SystemSettings[keyof Omit<SystemSettings, '_id' | 'createdAt' | 'updatedAt'>],
): Promise<SystemSettings> {
  return updateSystemSettings({
    [section]: sectionData,
  } as Partial<SystemSettings>);
}





