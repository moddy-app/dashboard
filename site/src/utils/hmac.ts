/**
 * @license
 * Copyright 2024 Moddy App
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * HMAC utilities for API request signing
 */

import { API_KEY } from './config.ts';

/**
 * Generates a random UUID v4
 */
export function generateRequestId(): string {
  // Use crypto.randomUUID if available (modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Recursively sorts all object keys alphabetically
 * This ensures consistent JSON serialization for HMAC signing
 */
function sortKeys(obj: any): any {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return obj;
  }
  return Object.keys(obj)
    .sort()
    .reduce((result: any, key: string) => {
      result[key] = sortKeys(obj[key]);
      return result;
    }, {});
}

/**
 * Serializes object to JSON string matching Python's json.dumps() format
 * This adds spaces after : and , to match Python's default separators=(', ', ': ')
 */
function jsonDumps(obj: any): string {
  function serialize(val: any): string {
    if (val === null) return 'null';
    if (typeof val === 'boolean') return val.toString();
    if (typeof val === 'number') return val.toString();
    if (typeof val === 'string') return JSON.stringify(val);
    if (Array.isArray(val)) {
      const items = val.map(v => serialize(v)).join(', ');
      return `[${items}]`;
    }
    if (typeof val === 'object') {
      const keys = Object.keys(val).sort();
      const items = keys.map(k => `${JSON.stringify(k)}: ${serialize(val[k])}`);
      return `{${items.join(', ')}}`;
    }
    return '';
  }

  return serialize(obj);
}

/**
 * Generates HMAC-SHA256 signature for API requests
 * IMPORTANT: Must match Python backend's json.dumps(sort_keys=True) format exactly
 */
export async function generateSignature(requestId: string, body: any = {}): Promise<string> {
  // Create the payload object
  const payloadObj = {
    request_id: requestId,
    body: body
  };

  // Sort all keys recursively and serialize with Python-compatible format
  const sortedPayload = sortKeys(payloadObj);
  const payload = jsonDumps(sortedPayload);

// Convert API_KEY string to Uint8Array
  const encoder = new TextEncoder();
  const keyData = encoder.encode(API_KEY);

  // Import the key for HMAC
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // Sign the payload
  const payloadData = encoder.encode(payload);
  const signature = await crypto.subtle.sign('HMAC', key, payloadData);

  // Convert signature to hex string
  const hashArray = Array.from(new Uint8Array(signature));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
}
