# Odissey Backend

A Cloudflare Worker-based backend for the Odissey interactive storytelling application. This backend provides authentication, session management, and AI-powered story interactions using Cloudflare D1 database.

## Features

- **Anonymous Authentication**: Secure token-based authentication without requiring user registration
- **Session Management**: Create and manage personalized story sessions
- **Interactive Storytelling**: AI-powered narrative responses based on user input
- **Multiple Worlds**: Support for different story worlds (Fantasy, Sci-Fi, Mystery)
- **Persistent Storage**: All session data and messages stored in Cloudflare D1 database
- **CORS Support**: Ready for cross-origin requests from frontend applications

## API Endpoints

### Authentication
- `POST /auth/anonymous` - Create anonymous authentication token
- `GET /auth/validate` - Validate existing token

### Sessions
- `POST /sessions/new` - Create new story session
- `POST /sessions/{sessionId}/interact` - Send message and get story response

### Worlds
- `GET /worlds` - List all available story worlds
- `GET /worlds/{worldId}` - Get details for specific world

### Health
- `GET /health` - Health check endpoint

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Cloudflare account
- Wrangler CLI

### Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Initialize the database**:
   ```bash
   ./init-db.sh
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```

4. **Test the API**:
   ```bash
   curl http://localhost:8787/health
   ```

### Deployment

1. **Deploy to Cloudflare**:
   ```bash
   npm run deploy
   ```

2. **Initialize production database**:
   ```bash
   # Uncomment the production line in init-db.sh and run:
   ./init-db.sh
   ```

## Database Schema

The application uses the following database tables:

- **users**: Anonymous user tokens and authentication
- **worlds**: Story world definitions and initial states
- **sessions**: User story sessions with world state
- **messages**: Conversation history between users and narrator

## Configuration

### Environment Variables

The application uses Cloudflare Worker bindings:

- `DB`: D1 Database binding (configured in wrangler.jsonc)

### Database Configuration

Database settings are configured in `wrangler.jsonc`:

```json
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "odissey-db",
      "database_id": "your-database-id"
    }
  ]
}
```

## Development

### Project Structure

```
src/
├── index.ts         # Main worker entry point
├── routes.ts        # API route handlers
├── database.ts      # Database service layer
├── storyService.ts  # AI story generation
├── utils.ts         # Utility functions
└── types.ts         # TypeScript interfaces
```

### Adding New Story Worlds

1. Insert new world data into the `worlds` table:
   ```sql
   INSERT INTO worlds (id, title, description, initial_state) VALUES 
   ('your-world-id', 'World Title', 'Description', 'Initial story text...');
   ```

2. Add world-specific responses in `storyService.ts`

### Database Management

- **Local development**: Uses local D1 instance
- **Production**: Uses Cloudflare D1 database
- **Migrations**: Run `./init-db.sh` to apply schema changes

## API Usage Examples

### Create Anonymous Token
```bash
curl -X POST http://localhost:8787/auth/anonymous \
  -H "Content-Type: application/json"
```

### Create Session
```bash
curl -X POST http://localhost:8787/sessions/new \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"worldId": "fantasy-adventure"}'
```

### Send Message
```bash
curl -X POST http://localhost:8787/sessions/SESSION_ID/interact \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "I enter the forest"}'
```

## Security Features

- Token-based authentication with expiration
- Input sanitization to prevent XSS
- SQL injection protection via prepared statements
- CORS configuration for secure cross-origin requests
- User session isolation

## Performance

- Cloudflare Edge computing for global low latency
- D1 database optimized for read-heavy workloads
- Efficient query patterns with proper indexing
- Automatic cleanup of expired user tokens

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For issues and questions:
- Check the troubleshooting section below
- Review Cloudflare Workers documentation
- Create an issue in the repository

## Troubleshooting

### Common Issues

1. **Database connection errors**: Ensure D1 database is properly configured in wrangler.jsonc
2. **CORS errors**: Check that frontend URL is properly configured
3. **Token validation failures**: Verify token format and expiration

### Logs

View worker logs during development:
```bash
npm run dev
# Logs appear in terminal
```

View production logs:
```bash
wrangler tail
``` 