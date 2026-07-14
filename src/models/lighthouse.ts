export interface ManifestSummary {
  performance: number | null;
  accessibility: number | null;
  'best-practices': number | null;
  seo: number | null;
}

export interface ManifestResult {
  url: string;
  isRepresentativeRun?: boolean;
  htmlPath?: string;
  jsonPath?: string;
  summary: ManifestSummary;
}

export interface BundleSizes {
  totalBundleSizeMb: number;
  unusedBundleSizeMb: number;
}

export interface PageScores {
  urlDisplay: string;
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  totalBundleSize: number;
  unusedBundleSize: number;
}

export interface PageReportRow {
  url: string;
  urlDisplay: string;
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  totalBundleSize: number;
  unusedBundleSize: number;
}

export interface ActionInputs {
  urls: string[];
  paths: string[];
  productionDomain: string;
  stagingDomain: string;
  defaultDomain: string;
  configPath: string;
  resultsPath: string;
  productionReport: string;
  uploadSummary: boolean;
  uploadReport: boolean;
  uploadRawResults: boolean;
  reportArtifactName: string;
  rawResultsArtifactName: string;
  importantPaths: Set<string>;
}

export interface TreemapNode {
  resourceBytes?: number;
  unusedBytes?: number;
}

export interface LighthouseReportJson {
  audits?: {
    'script-treemap-data'?: {
      details?: {
        nodes?: TreemapNode[];
      };
    };
  };
}
