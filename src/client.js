import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

const BASE_URL = 'https://rhea-api-gateway-development.up.railway.app';

export class RheaClient {
  #token;

  constructor() {
    const token = process.env.RHEA_API_TOKEN;
    if (!token) {
      throw new Error('RHEA_API_TOKEN environment variable is required');
    }
    this.#token = token;
  }

  async #request(method, path, { query, body } = {}) {
    const url = new URL(path, BASE_URL);

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const init = {
      method,
      headers: { Authorization: `Bearer ${this.#token}` },
    };

    if (body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }

    const res = await fetch(url, init);

    if (!res.ok) {
      let message = res.statusText;
      try {
        const err = await res.json();
        message = err.message ?? err.error ?? message;
      } catch {
        // use statusText fallback
      }

      if (res.status === 401) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Rhea API: unauthorized — check your RHEA_API_TOKEN (${message})`
        );
      }

      throw new McpError(ErrorCode.InternalError, `Rhea API ${res.status}: ${message}`);
    }

    if (res.status === 204) return null;
    return res.json();
  }

  // Profile
  getProfile() {
    return this.#request('GET', '/v1/profiles/me');
  }

  // Topics
  listTopics({ limit, after, status } = {}) {
    return this.#request('GET', '/v1/topics', { query: { limit, after, status } });
  }

  createTopic(body) {
    return this.#request('POST', '/v1/topics', { body });
  }

  getTopic(id) {
    return this.#request('GET', `/v1/topics/${id}`);
  }

  updateTopic(id, body) {
    return this.#request('PATCH', `/v1/topics/${id}`, { body });
  }

  deleteTopic(id) {
    return this.#request('DELETE', `/v1/topics/${id}`);
  }

  // Platforms
  listPlatforms(topicId) {
    return this.#request('GET', `/v1/topics/${topicId}/platforms`);
  }

  addPlatform(topicId, body) {
    return this.#request('POST', `/v1/topics/${topicId}/platforms`, { body });
  }

  getPlatform(topicId, platform) {
    return this.#request('GET', `/v1/topics/${topicId}/platforms/${platform}`);
  }

  updatePlatform(topicId, platform, body) {
    return this.#request('PATCH', `/v1/topics/${topicId}/platforms/${platform}`, { body });
  }

  deletePlatform(topicId, platform) {
    return this.#request('DELETE', `/v1/topics/${topicId}/platforms/${platform}`);
  }

  // Sentiment
  getSentimentScores(topicId, { from, to, platform, after, limit } = {}) {
    return this.#request('GET', `/v1/topics/${topicId}/sentiment/scores`, {
      query: { from, to, platform, after, limit },
    });
  }

  getSentimentHourly(topicId, { from, to, platform } = {}) {
    return this.#request('GET', `/v1/topics/${topicId}/sentiment/hourly`, {
      query: { from, to, platform },
    });
  }

  getSentimentDaily(topicId, { from, to, platform } = {}) {
    return this.#request('GET', `/v1/topics/${topicId}/sentiment/daily`, {
      query: { from, to, platform },
    });
  }

  getSentimentSpikes(topicId, { from, to, alerted, limit } = {}) {
    return this.#request('GET', `/v1/topics/${topicId}/sentiment/spikes`, {
      query: {
        from,
        to,
        alerted: alerted !== undefined ? String(alerted) : undefined,
        limit,
      },
    });
  }

  // Scrape jobs
  listScrapeJobs(topicId, { limit, after, status, platform } = {}) {
    return this.#request('GET', `/v1/topics/${topicId}/scrape-jobs`, {
      query: { limit, after, status, platform },
    });
  }
}
