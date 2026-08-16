export interface IUrlAnalyticsRepository {
  recordClick(urlId: string): Promise<void>;
  countClicks(urlId: string): Promise<number>;
}
