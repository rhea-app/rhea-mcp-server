# rhea-mcp-server

An [MCP](https://modelcontextprotocol.io) server that exposes the [Rhea](https://rhea.app) sentiment-analysis API as tools, so AI assistants like Claude can monitor topics, query sentiment data, and manage platform configurations on your behalf.

## Requirements

- Node.js >= 18
- A Rhea API token

## Installation

```bash
npm install
```

## Configuration

Set your Rhea API token as an environment variable before starting the server:

```bash
export RHEA_API_TOKEN=your_token_here
```

The server validates the token against the live API on startup and exits immediately if it is missing or invalid.

## Running

```bash
# Production
npm start

# Development (auto-restarts on file changes)
npm run dev
```

The server communicates over **stdio** using the MCP protocol.

## Using with Claude Desktop

Add the following to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "rhea": {
      "command": "node",
      "args": ["/path/to/rhea-mcp-server/src/index.js"],
      "env": {
        "RHEA_API_TOKEN": "your_token_here"
      }
    }
  }
}
```

## Available Tools

### Profile

| Tool | Description |
|------|-------------|
| `rhea_get_profile` | Get the authenticated user's profile (id, email, status, created_at) |

### Topics

| Tool | Description |
|------|-------------|
| `rhea_list_topics` | List all monitoring topics; supports pagination and status filtering |
| `rhea_get_topic` | Get a single topic by ID |
| `rhea_create_topic` | Create a topic with a name and keywords to track |
| `rhea_update_topic` | Update a topic's name, keywords, or status |
| `rhea_delete_topic` | Permanently delete a topic and all its data |

### Platforms

Each topic can monitor one or more platforms: `reddit`, `youtube`, `instagram`, `tiktok`, `news`, `twitter`.

| Tool | Description |
|------|-------------|
| `rhea_list_platforms` | List all platforms configured for a topic |
| `rhea_get_platform` | Get configuration for a specific platform on a topic |
| `rhea_add_platform` | Add a platform to a topic (starts monitoring) |
| `rhea_update_platform` | Update refresh interval or enabled state for a platform |
| `rhea_delete_platform` | Remove a platform from a topic (stops monitoring) |

### Sentiment

| Tool | Description |
|------|-------------|
| `rhea_get_sentiment_scores` | Per-post sentiment scores (−1 to 1) with emotion, summary, engagement, and source URL; paginated |
| `rhea_get_sentiment_hourly` | Hourly-aggregated sentiment: avg/min/max score, post count, engagement |
| `rhea_get_sentiment_daily` | Daily-aggregated sentiment: avg/min/max score, post count, engagement |
| `rhea_get_sentiment_spikes` | Detected sentiment spikes with delta, before/after scores, and alert status |

### Scrape Jobs

| Tool | Description |
|------|-------------|
| `rhea_list_scrape_jobs` | List scrape jobs for a topic; useful for debugging data freshness |
