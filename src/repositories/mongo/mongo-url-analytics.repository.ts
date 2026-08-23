import { Collection } from 'mongodb';
import { IUrlAnalyticsRepository } from '../interfaces/url-analytics.repository.interface.js';
import { getMongoDb } from '../../config/mongo.js';

export interface MongoClickEventDocument {
  url_id: string;
  clicked_at: Date;
}

export class MongoUrlAnalyticsRepository implements IUrlAnalyticsRepository {
  private get collection(): Collection<MongoClickEventDocument> {
    return getMongoDb().collection<MongoClickEventDocument>('url_click_events');
  }

  async recordClick(urlId: string): Promise<void> {
    await this.collection.insertOne({
      url_id: urlId,
      clicked_at: new Date(),
    });
  }

  async countClicks(urlId: string): Promise<number> {
    return await this.collection.countDocuments({ url_id: urlId });
  }
}
