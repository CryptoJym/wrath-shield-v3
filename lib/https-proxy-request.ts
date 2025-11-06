/**
 * HTTPS Request with Proxy Support
 *
 * Utility for making HTTPS requests that respect HTTPS_PROXY environment variable.
 * This is needed because Node.js's built-in fetch() doesn't respect proxy settings.
 */

import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import { ensureServerOnly } from './server-only-guard';

// Prevent client-side imports
ensureServerOnly('lib/https-proxy-request');

export interface HttpsRequestOptions {
  method?: string;
  headers?: Record<string, string>;
}

export interface HttpsResponse {
  status: number;
  data: string;
}

/**
 * Make HTTPS request with automatic proxy support and redirect following
 * Respects HTTPS_PROXY and HTTP_PROXY environment variables
 */
export function httpsRequest(
  url: string,
  options: HttpsRequestOptions = {},
  redirectCount: number = 0
): Promise<HttpsResponse> {
  const MAX_REDIRECTS = 10;

  if (redirectCount >= MAX_REDIRECTS) {
    return Promise.reject(new Error('Too many redirects'));
  }

  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;

    let requestOptions: https.RequestOptions;
    let protocol: typeof https | typeof http;

    if (proxyUrl) {
      // Use proxy with CONNECT tunneling for HTTPS
      const proxy = new URL(proxyUrl);

      // For HTTPS requests through HTTP proxy, use CONNECT method
      const proxyAuthHeader: Record<string, string> = {};
      if (proxy.username || proxy.password) {
        console.log('[https-proxy-request] Proxy username:', proxy.username);
        console.log('[https-proxy-request] Proxy password length:', (proxy.password || '').length);
        const auth = Buffer.from(`${proxy.username}:${decodeURIComponent(proxy.password || '')}`).toString('base64');
        proxyAuthHeader['Proxy-Authorization'] = `Basic ${auth}`;
        console.log('[https-proxy-request] Proxy-Authorization set (Base64 length):', auth.length);
      }

      // Create CONNECT tunnel to destination
      const connectOptions: http.RequestOptions = {
        method: 'CONNECT',
        hostname: proxy.hostname,
        port: proxy.port ? parseInt(proxy.port) : 80,
        path: `${urlObj.hostname}:${urlObj.port || 443}`,
        headers: {
          ...proxyAuthHeader,
          'Host': `${urlObj.hostname}:${urlObj.port || 443}`,
          'User-Agent': 'Node.js HTTPS Client',
          'Proxy-Connection': 'Keep-Alive',
        },
      };

      console.log('[https-proxy-request] CONNECT request:', {
        method: connectOptions.method,
        hostname: connectOptions.hostname,
        port: connectOptions.port,
        path: connectOptions.path,
        headers: Object.keys(connectOptions.headers),
      });

      const connectReq = http.request(connectOptions);

      // Handle CONNECT errors (non-200 responses come via 'response' event, not 'connect')
      connectReq.on('response', (res) => {
        console.log('[https-proxy-request] CONNECT failed with response event:', res.statusCode, res.statusMessage);
        let errorBody = '';
        res.on('data', (chunk) => {
          errorBody += chunk.toString();
        });
        res.on('end', () => {
          console.log('[https-proxy-request] Error body:', errorBody);
          reject(new Error(`Proxy CONNECT failed: ${res.statusCode} ${res.statusMessage} - ${errorBody}`));
        });
      });

      connectReq.on('connect', (connectRes, socket) => {
        console.log('[https-proxy-request] CONNECT successful:', connectRes.statusCode, connectRes.statusMessage);

        if (connectRes.statusCode !== 200) {
          reject(new Error(`Proxy CONNECT failed: ${connectRes.statusCode} ${connectRes.statusMessage}`));
          return;
        }

        // Now make the actual HTTPS request through the tunnel
        const httpsOptions: https.RequestOptions = {
          method: options.method || 'GET',
          socket: socket,
          path: urlObj.pathname + urlObj.search,
          headers: {
            ...options.headers,
            Host: urlObj.hostname,
          },
        };

        const httpsReq = https.request(httpsOptions, (res) => {
          // Handle redirects
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            const redirectUrl = new URL(res.headers.location, url).toString();
            console.log(`[https-proxy-request] Following redirect to: ${redirectUrl}`);

            // Follow redirect
            httpsRequest(redirectUrl, options, redirectCount + 1)
              .then(resolve)
              .catch(reject);
            return;
          }

          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            resolve({
              status: res.statusCode || 0,
              data,
            });
          });
        });

        httpsReq.on('error', (error) => {
          reject(error);
        });

        httpsReq.end();
      });

      connectReq.on('error', (error) => {
        reject(error);
      });

      connectReq.end();
      return; // Exit early - we're handling the response in the CONNECT callback
    } else {
      // Direct connection (no proxy)
      protocol = https;
      requestOptions = {
        method: options.method || 'GET',
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        headers: options.headers,
      };
    }

    const req = protocol.request(requestOptions, (res) => {
      // Handle redirects
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, url).toString();
        console.log(`[https-proxy-request] Following redirect to: ${redirectUrl}`);

        // Follow redirect
        httpsRequest(redirectUrl, options, redirectCount + 1)
          .then(resolve)
          .catch(reject);
        return;
      }

      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode || 0,
          data,
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}
