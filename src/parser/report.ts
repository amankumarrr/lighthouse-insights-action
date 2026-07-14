import type { LighthouseReportJson } from '../models/lighthouse';
import { readJsonFile } from '../utils/filesystem';

export async function readLighthouseReport(filePath: string): Promise<LighthouseReportJson> {
  return readJsonFile<LighthouseReportJson>(filePath);
}
