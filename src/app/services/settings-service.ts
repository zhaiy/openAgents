import { ConfigLoader } from '../../config/loader.js';
import { getDefaultLocale } from '../../i18n/index.js';
import type { SettingsDto } from '../dto.js';

export class SettingsService {
  constructor(private readonly loader: ConfigLoader) {}

  getSettings(): SettingsDto {
    let apiKeyConfigured: boolean;
    let baseUrlConfigured: boolean;
    try {
      const projectConfig = this.loader.loadProjectConfig();
      apiKeyConfigured = !!projectConfig.runtime.api_key || !!process.env.OPENAGENTS_API_KEY;
      baseUrlConfigured = !!projectConfig.runtime.api_base_url || !!process.env.OPENAGENTS_API_BASE_URL;
    } catch {
      apiKeyConfigured = !!process.env.OPENAGENTS_API_KEY;
      baseUrlConfigured = !!process.env.OPENAGENTS_API_BASE_URL;
    }
    return {
      projectPath: this.loader.getProjectRoot(),
      locale: getDefaultLocale(),
      apiKeyConfigured,
      baseUrlConfigured,
    };
  }
}
