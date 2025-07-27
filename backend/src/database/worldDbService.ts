import { World } from './db-types';
import { Logger } from '../utils/logger';
// type D1Database should be provided by your environment (e.g., Cloudflare D1)

export class WorldDbService {
  constructor(private db: D1Database) {
    Logger.info('WorldDbService initialized', {
      component: 'WorldDbService',
      operation: 'INIT'
    });
  }
  async getWorldById(worldId: string): Promise<World | null> {
    return await this.db
      .prepare('SELECT * FROM worlds WHERE id = ?')
      .bind(worldId)
      .first<World>();
  }

  async getAllWorlds(): Promise<World[]> {
    const result = await this.db
      .prepare('SELECT * FROM worlds ORDER BY id ASC')
      .all<World>();
    return result.results || [];
  }

  async createWorld(id: string, title: string, description?: string): Promise<World> {
    const result = await this.db
      .prepare('INSERT INTO worlds (id, title, description) VALUES (?, ?, ?) RETURNING *')
      .bind(id, title, description || null)
      .first<World>();
    if (!result) {
      throw new Error('Failed to create world');
    }
    return result;
  }
}
