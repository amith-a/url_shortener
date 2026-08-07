import { UrlController } from '../controllers/url.controller';
import { UrlRepository } from '../repositories/url.repository';
import { UrlService } from '../services/url.service';

const repository = new UrlRepository();
const service = new UrlService(repository);
const controller = new UrlController(service);

export { controller };