import type { MacroCategory, MomentMode } from './experience';

export type IntentSourceType =
  | 'instagram_link'
  | 'tiktok_link'
  | 'youtube_link'
  | 'web_link'
  | 'screenshot'
  | 'manual_note'
  | 'catalog_bookmark';

export type IntentProcessingStatus =
  | 'PROCESSING'
  | 'COMPLETED'
  | 'NEEDS_CONFIRMATION'
  | 'UNIDENTIFIED'
  | 'ERROR'
  | 'UNAVAILABLE';

export type IntentStatus = 'SAVED' | 'PLANNED' | 'VISITED' | 'ARCHIVED';

export interface IntentVaultItem {
  id: string;
  user_id?: string;
  title: string;
  source_type: IntentSourceType;
  source_url?: string;
  image_preview_data_url?: string;
  notes?: string;
  category_tag?: MacroCategory;
  neighborhood_tag?: string;
  moment_tag?: MomentMode;
  linked_venue_id?: string;
  linked_venue_name?: string;
  status: IntentStatus;
  processing_status: IntentProcessingStatus;
  processing_message?: string;
  created_at: string;
  updated_at: string;
}

export interface IntentPatternInsight {
  id: string;
  kind: 'neighborhood' | 'category';
  label: string;
  count: number;
  summary: string;
  suggested_prompt: string;
}

export interface IntentAnalysisResult {
  processing_status: IntentProcessingStatus;
  processing_message: string;
  suggested_title?: string;
  suggested_neighborhood?: string;
  suggested_category?: MacroCategory;
  suggested_notes?: string;
  suggested_venue_id?: string;
  source_domain?: string;
}
