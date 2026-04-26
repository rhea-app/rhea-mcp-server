#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { RheaClient } from './client.js';

const PLATFORM_ENUM = ['reddit', 'youtube', 'instagram', 'tiktok', 'news', 'twitter'];
const TOPIC_STATUS_ENUM = ['active', 'paused', 'archived'];

const TOOLS = [
  // ── Profile ──────────────────────────────────────────────────────────────
  {
    name: 'rhea_get_profile',
    description: 'Get the authenticated user\'s profile (id, email, status, created_at).',
    inputSchema: { type: 'object', properties: {} },
  },

  // ── Topics ────────────────────────────────────────────────────────────────
  {
    name: 'rhea_list_topics',
    description: 'List all monitoring topics for the authenticated user. Supports pagination and filtering by status.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 1, maximum: 100, description: 'Max topics to return (default 20)' },
        after: { type: 'integer', description: 'Pagination cursor — topic ID from the previous page\'s next_cursor' },
        status: { type: 'string', enum: TOPIC_STATUS_ENUM, description: 'Filter by topic status' },
      },
    },
  },
  {
    name: 'rhea_get_topic',
    description: 'Get a single topic by its ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'integer', description: 'Topic ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'rhea_create_topic',
    description: 'Create a new monitoring topic with a name, keywords to track, and an optional status.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 255, description: 'Display name for the topic' },
        keywords: {
          type: 'array',
          items: { type: 'string', minLength: 1 },
          minItems: 1,
          maxItems: 50,
          description: 'Keywords to monitor across platforms',
        },
        status: { type: 'string', enum: TOPIC_STATUS_ENUM, description: 'Initial status (default: active)' },
      },
      required: ['name', 'keywords'],
    },
  },
  {
    name: 'rhea_update_topic',
    description: 'Update a topic\'s name, keywords, or status.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'integer', description: 'Topic ID' },
        name: { type: 'string', minLength: 1, maxLength: 255 },
        keywords: { type: 'array', items: { type: 'string', minLength: 1 }, minItems: 1, maxItems: 50 },
        status: { type: 'string', enum: TOPIC_STATUS_ENUM },
      },
      required: ['id'],
    },
  },
  {
    name: 'rhea_delete_topic',
    description: 'Permanently delete a topic and all its associated data.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'integer', description: 'Topic ID to delete' },
      },
      required: ['id'],
    },
  },

  // ── Platforms ─────────────────────────────────────────────────────────────
  {
    name: 'rhea_list_platforms',
    description: 'List all platforms configured for a topic (e.g. reddit, youtube).',
    inputSchema: {
      type: 'object',
      properties: {
        topicId: { type: 'integer', description: 'Topic ID' },
      },
      required: ['topicId'],
    },
  },
  {
    name: 'rhea_get_platform',
    description: 'Get the configuration for a specific platform on a topic.',
    inputSchema: {
      type: 'object',
      properties: {
        topicId: { type: 'integer', description: 'Topic ID' },
        platform: { type: 'string', enum: PLATFORM_ENUM },
      },
      required: ['topicId', 'platform'],
    },
  },
  {
    name: 'rhea_add_platform',
    description: 'Add a platform to a topic so it starts being monitored.',
    inputSchema: {
      type: 'object',
      properties: {
        topicId: { type: 'integer', description: 'Topic ID' },
        platform: { type: 'string', enum: PLATFORM_ENUM },
        refresh_interval_minutes: {
          type: 'integer',
          minimum: 1,
          maximum: 10080,
          description: 'How often to scrape this platform in minutes (default 360)',
        },
        enabled: { type: 'boolean', description: 'Whether scraping is active (default true)' },
      },
      required: ['topicId', 'platform'],
    },
  },
  {
    name: 'rhea_update_platform',
    description: 'Update the refresh interval or enabled state of a platform on a topic.',
    inputSchema: {
      type: 'object',
      properties: {
        topicId: { type: 'integer', description: 'Topic ID' },
        platform: { type: 'string', enum: PLATFORM_ENUM },
        refresh_interval_minutes: { type: 'integer', minimum: 1, maximum: 10080 },
        enabled: { type: 'boolean' },
      },
      required: ['topicId', 'platform'],
    },
  },
  {
    name: 'rhea_delete_platform',
    description: 'Remove a platform from a topic, stopping monitoring on that platform.',
    inputSchema: {
      type: 'object',
      properties: {
        topicId: { type: 'integer', description: 'Topic ID' },
        platform: { type: 'string', enum: PLATFORM_ENUM },
      },
      required: ['topicId', 'platform'],
    },
  },

  // ── Sentiment ─────────────────────────────────────────────────────────────
  {
    name: 'rhea_get_sentiment_scores',
    description:
      'Retrieve individual post-level sentiment scores for a topic within a time range. ' +
      'Each record includes the score (-1 to 1), emotion, summary, engagement, and source URL. ' +
      'Supports pagination via the next_cursor field.',
    inputSchema: {
      type: 'object',
      properties: {
        topicId: { type: 'integer', description: 'Topic ID' },
        from: { type: 'string', format: 'date-time', description: 'Start of range (ISO 8601)' },
        to: { type: 'string', format: 'date-time', description: 'End of range (ISO 8601)' },
        platform: { type: 'string', enum: PLATFORM_ENUM, description: 'Filter to a specific platform' },
        after: { type: 'string', description: 'Pagination cursor from previous response\'s next_cursor' },
        limit: { type: 'integer', minimum: 1, maximum: 500, description: 'Max records to return (default 100)' },
      },
      required: ['topicId', 'from', 'to'],
    },
  },
  {
    name: 'rhea_get_sentiment_hourly',
    description:
      'Get hourly-aggregated sentiment for a topic within a time range. ' +
      'Returns avg/min/max score, post count, and total engagement per hour bucket.',
    inputSchema: {
      type: 'object',
      properties: {
        topicId: { type: 'integer', description: 'Topic ID' },
        from: { type: 'string', format: 'date-time', description: 'Start of range (ISO 8601)' },
        to: { type: 'string', format: 'date-time', description: 'End of range (ISO 8601)' },
        platform: { type: 'string', enum: PLATFORM_ENUM, description: 'Filter to a specific platform' },
      },
      required: ['topicId', 'from', 'to'],
    },
  },
  {
    name: 'rhea_get_sentiment_daily',
    description:
      'Get daily-aggregated sentiment for a topic within a time range. ' +
      'Returns avg/min/max score, post count, and total engagement per day bucket.',
    inputSchema: {
      type: 'object',
      properties: {
        topicId: { type: 'integer', description: 'Topic ID' },
        from: { type: 'string', format: 'date-time', description: 'Start of range (ISO 8601)' },
        to: { type: 'string', format: 'date-time', description: 'End of range (ISO 8601)' },
        platform: { type: 'string', enum: PLATFORM_ENUM, description: 'Filter to a specific platform' },
      },
      required: ['topicId', 'from', 'to'],
    },
  },
  {
    name: 'rhea_get_sentiment_spikes',
    description:
      'Get detected sentiment spikes (sudden score changes) for a topic. ' +
      'Each spike includes the delta, score before/after, platform, and whether an alert was sent.',
    inputSchema: {
      type: 'object',
      properties: {
        topicId: { type: 'integer', description: 'Topic ID' },
        from: { type: 'string', format: 'date-time', description: 'Start of detection window (ISO 8601)' },
        to: { type: 'string', format: 'date-time', description: 'End of detection window (ISO 8601)' },
        alerted: { type: 'boolean', description: 'If true, return only spikes that triggered an alert' },
        limit: { type: 'integer', minimum: 1, maximum: 100, description: 'Max spikes to return (default 20)' },
      },
      required: ['topicId'],
    },
  },

  // ── Scrape Jobs ───────────────────────────────────────────────────────────
  {
    name: 'rhea_list_scrape_jobs',
    description: 'List scrape jobs for a topic. Useful for debugging data freshness.',
    inputSchema: {
      type: 'object',
      properties: {
        topicId: { type: 'integer', description: 'Topic ID' },
        limit: { type: 'integer', minimum: 1, maximum: 100, description: 'Max jobs to return (default 20)' },
        after: { type: 'integer', description: 'Pagination cursor' },
        status: {
          type: 'string',
          enum: ['pending', 'running', 'completed', 'failed'],
          description: 'Filter by job status',
        },
        platform: { type: 'string', enum: PLATFORM_ENUM, description: 'Filter by platform' },
      },
      required: ['topicId'],
    },
  },
];

// ── Handlers dispatch map ─────────────────────────────────────────────────────

function buildHandlers(client) {
  return {
    rhea_get_profile: () => client.getProfile(),

    rhea_list_topics: (a) => client.listTopics(a),
    rhea_get_topic: ({ id }) => client.getTopic(id),
    rhea_create_topic: (a) => client.createTopic(a),
    rhea_update_topic: ({ id, ...rest }) => client.updateTopic(id, rest),
    rhea_delete_topic: ({ id }) => client.deleteTopic(id),

    rhea_list_platforms: ({ topicId }) => client.listPlatforms(topicId),
    rhea_get_platform: ({ topicId, platform }) => client.getPlatform(topicId, platform),
    rhea_add_platform: ({ topicId, ...rest }) => client.addPlatform(topicId, rest),
    rhea_update_platform: ({ topicId, platform, ...rest }) => client.updatePlatform(topicId, platform, rest),
    rhea_delete_platform: ({ topicId, platform }) => client.deletePlatform(topicId, platform),

    rhea_get_sentiment_scores: ({ topicId, ...rest }) => client.getSentimentScores(topicId, rest),
    rhea_get_sentiment_hourly: ({ topicId, ...rest }) => client.getSentimentHourly(topicId, rest),
    rhea_get_sentiment_daily: ({ topicId, ...rest }) => client.getSentimentDaily(topicId, rest),
    rhea_get_sentiment_spikes: ({ topicId, ...rest }) => client.getSentimentSpikes(topicId, rest),

    rhea_list_scrape_jobs: ({ topicId, ...rest }) => client.listScrapeJobs(topicId, rest),
  };
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

async function main() {
  // Layer 1: fail fast if token is missing
  const client = new RheaClient();

  // Layer 2: validate the token against the live API before accepting connections
  try {
    await client.getProfile();
  } catch (err) {
    const msg = err instanceof McpError ? err.message : String(err);
    process.stderr.write(`rhea-mcp-server: token validation failed — ${msg}\n`);
    process.exit(1);
  }

  const server = new Server(
    { name: 'rhea-mcp-server', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  const handlers = buildHandlers(client);

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const handler = handlers[name];
    if (!handler) {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
    const result = await handler(args ?? {});
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`rhea-mcp-server: fatal error — ${err.message}\n`);
  process.exit(1);
});
