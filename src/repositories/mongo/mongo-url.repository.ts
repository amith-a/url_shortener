import { Collection, MongoError } from 'mongodb';
import { CreateUrlDto } from '../../dto/create-url.dto.js';
import { UrlDto } from '../../dto/url.dto.js';
import { IUrlRepository } from '../interfaces/url.repository.interface.js';
import { getMongoDb } from '../../config/mongo.js';
import { ConflictError } from '../../errors/conflict.error.js';

export interface MongoUrlDocument {
  _id: string;
  original_url: string;
  short_code: string;
  created_at: Date;
  expires_at: Date | null;
  user_id: string;
}

export class MongoUrlRepository implements IUrlRepository {
  private get collection(): Collection<MongoUrlDocument> {
    return getMongoDb().collection<MongoUrlDocument>('urls');
  }

  async create(urlData: CreateUrlDto): Promise<UrlDto> {
    const doc: MongoUrlDocument = {
      _id: urlData.id,
      short_code: urlData.shortCode,
      original_url: urlData.originalUrl,
      created_at: new Date(),
      expires_at: urlData.expiresAt,
      user_id: urlData.userId,
    };

    try {
      await this.collection.insertOne(doc);
      return this.mapToDto(doc);
    } catch (err: unknown) {
      if (err instanceof MongoError && err.code === 11000) {
        throw new ConflictError('Short code already in use');
      }
      if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === 11000) {
        throw new ConflictError('Short code already in use');
      }
      throw err;
    }
  }

  async findByShortCode(shortCode: string): Promise<UrlDto | null> {
    const doc = await this.collection.findOne({ short_code: shortCode });
    if (!doc) {
      return null;
    }
    return this.mapToDto(doc);
  }

  async deleteByIdAndUserId(
    id: string,
    userId: string
  ): Promise<string | null> {
    const doc = await this.collection.findOneAndDelete({
      _id: id,
      user_id: userId,
    });
    return doc?.short_code ?? null;
  }

  async findByIdAndUserId(id: string, userId: string): Promise<UrlDto | null> {
    const doc = await this.collection.findOne({
      _id: id,
      user_id: userId,
    });
    if (!doc) {
      return null;
    }
    return this.mapToDto(doc);
  }

  async listByUserId(
    userId: string,
    limit: number,
    offset: number
  ): Promise<UrlDto[]> {
    const docs = await this.collection
      .find({ user_id: userId })
      .sort({ created_at: -1, _id: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    return docs.map((doc) => this.mapToDto(doc));
  }

  async countByUserId(userId: string): Promise<number> {
    return await this.collection.countDocuments({ user_id: userId });
  }

  async deleteExpiredUrls(): Promise<string[]> {
    const now = new Date();
    const filter = {
      expires_at: { $ne: null, $lte: now },
    };

    const expiredDocs = await this.collection
      .find(filter, { projection: { short_code: 1 } })
      .toArray();

    if (expiredDocs.length === 0) {
      return [];
    }

    await this.collection.deleteMany(filter);

    return expiredDocs.map((doc) => doc.short_code);
  }

  private mapToDto(doc: MongoUrlDocument): UrlDto {
    return {
      id: doc._id,
      shortCode: doc.short_code,
      originalUrl: doc.original_url,
      createdAt: doc.created_at,
      expiresAt: doc.expires_at,
    };
  }
}
