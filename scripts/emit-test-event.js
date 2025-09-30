#!/usr/bin/env node

/**
 * Test script for emitting email events to local development
 */

const { handleEmailEvent } = require('../src/email-worker');

// Mock Cloud Event for testing
const mockCloudEvent = {
  data: {
    message: {
      data: Buffer.from(JSON.stringify({
        delivery_id: `test-${Date.now()}`,
        type: 'verification_code',
        recipient: 'test@example.com',
        template: 'verification-code',
        payload: {
          verification_code: '123456',
          provider: 'google',
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
        },
        attachments: [],
        metadata: {
          correlation_id: 'test-correlation-123',
          priority: 'high'
        }
      })).toString('base64')
    }
  },
  source: 'test-script',
  type: 'google.cloud.pubsub.topic.v1.messagePublished'
};

async function runTest() {
  console.log('🧪 Testing email worker with mock event...');
  console.log('📧 Recipient: test@example.com');
  console.log('📋 Template: verification-code');
  console.log('🔢 Code: 123456');
  console.log('');

  try {
    await handleEmailEvent(mockCloudEvent);
    console.log('✅ Test completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run test if called directly
if (require.main === module) {
  runTest();
}

module.exports = { mockCloudEvent, runTest };