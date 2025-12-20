/**
 * Seed Chapa keys from environment variables into system settings
 *
 * Usage:
 *   CHAPA_SECRET_KEY=xxx CHAPA_PUBLIC_KEY=xxx CHAPA_WEBHOOK_SECRET=xxx npm run seed:chapa
 *
 * Or set in .env.local:
 *   CHAPA_SECRET_KEY=CHASECK_TEST-...
 *   CHAPA_PUBLIC_KEY=CHAPUBK_TEST-...
 *   CHAPA_WEBHOOK_SECRET=...
 */

// Use relative path for script execution
import { getSystemSettings, updateSystemSettings } from '../src/lib/settings/system-settings';

async function seedChapaKeys() {
  try {
    console.log('🌱 Seeding Chapa keys...');

    const secretKey = process.env.CHAPA_SECRET_KEY;
    const publicKey = process.env.CHAPA_PUBLIC_KEY;
    const webhookSecret = process.env.CHAPA_WEBHOOK_SECRET;

    if (!secretKey && !publicKey && !webhookSecret) {
      console.warn('⚠️  No Chapa keys found in environment variables.');
      console.log('Set CHAPA_SECRET_KEY, CHAPA_PUBLIC_KEY, and/or CHAPA_WEBHOOK_SECRET');
      process.exit(0);
    }

    // Get current settings
    const settings = await getSystemSettings();

    // Update Chapa settings
    const updatedChapa = {
      ...settings.integrations.paymentProviders.chapa,
      enabled: settings.integrations.paymentProviders.chapa.enabled || false,
      ...(secretKey && { apiKey: secretKey }),
      ...(publicKey && { publicKey: publicKey }),
      ...(webhookSecret && { webhookSecret: webhookSecret }),
    };

    // Update settings
    await updateSystemSettings({
      integrations: {
        paymentProviders: {
          ...settings.integrations.paymentProviders,
          chapa: updatedChapa,
        },
      },
    } as any);

    console.log('✅ Chapa keys seeded successfully!');
    console.log('   - Secret Key:', secretKey ? '✓ Set' : '✗ Not set');
    console.log('   - Public Key:', publicKey ? '✓ Set' : '✗ Not set');
    console.log('   - Webhook Secret:', webhookSecret ? '✓ Set' : '✗ Not set');
    console.log('   - Enabled:', updatedChapa.enabled ? 'Yes' : 'No');

    // Close database connection
    const { getDb } = await import('../src/lib/db');
    const db = await getDb();
    await db.client.close();

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding Chapa keys:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  seedChapaKeys();
}

export { seedChapaKeys };
