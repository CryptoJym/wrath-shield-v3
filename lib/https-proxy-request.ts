/**
 * HTTPS Request with Proxy Support
 *
 * Utility for making HTTPS requests that respect HTTPS_PROXY environment variable.
 * This is needed because Node.js's built-in fetch() doesn't respect proxy settings.
 */

import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import * as tunnel from 'tunnel';
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
    let agent: http.Agent | https.Agent | undefined;

    if (proxyUrl) {
      // Use tunnel for proxy
      const proxy = new URL(proxyUrl);

      console.log('[https-proxy-request] Using proxy:', proxy.hostname, proxy.port);

      const proxyOptions: any = {
        proxy: {
          host: proxy.hostname,
          port: proxy.port ? parseInt(proxy.port) : 80,
        },
      };

      // Add proxy authentication if present
      if (proxy.username || proxy.password) {
        proxyOptions.proxy.proxyAuth = `${proxy.username}:${decodeURIComponent(proxy.password || '')}`;
        console.log('[https-proxy-request] Proxy auth configured');
      }

      // Create tunneling agent
      agent = tunnel.httpsOverHttp(proxyOptions);

      requestOptions = {
        method: options.method || 'GET',
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        headers: options.headers,
        agent: agent,
      };
    } else {
      // Direct connection (no proxy)
      requestOptions = {
        method: options.method || 'GET',
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        headers: options.headers,
      };
    }

    const req = https.request(requestOptions, (res) => {
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
      console.error('[https-proxy-request] Request error:', error);
      reject(error);
    });

    req.end();
  });
}

