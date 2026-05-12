export type CategorySuggestion = {
  category: string;
  rationale: string;
  amazon_fit: number;
  dtc_potential: number;
  meta_ad_likelihood: number;
  brand_density: number;
  example_brands: string[];
};

export type BrandRecord = {
  id?: number;
  scan_id: number;
  brand_name: string;
  domain: string;
  homepage_title?: string | null;
  meta_description?: string | null;
  product_category?: string | null;
  amazon_url?: string | null;
  shopify_detected?: 0 | 1;
  socials_json?: string | null;
  raw_sources_json?: string | null;
  status?: BrandStatus;
  category_fit?: number;
  semrush_organic_traffic?: number | null;
  semrush_paid_traffic?: number | null;
  semrush_keywords?: number | null;
  traffic_score?: number | null;
  meta_ads_found?: 0 | 1 | null;
  meta_active_ad_count?: number | null;
  meta_confidence?: number | null;
  meta_main_offer?: string | null;
  meta_creative_types?: string | null;
  meta_top_hooks?: string | null;
  meta_ads_score?: number | null;
  meta_ad_library_url?: string | null;
  best_email?: string | null;
  email_confidence?: number | null;
  hunter_emails_json?: string | null;
  hunter_company_json?: string | null;
  contact_score?: number | null;
  amazon_dtc_score?: number | null;
  lead_score?: number | null;
  last_checked?: string | null;
  user_status?: string | null;
  user_notes?: string | null;
  user_updated_at?: string | null;
  has_drafts?: boolean;
  has_sent_drafts?: boolean;
  created_at?: string;
};

export type BrandStatus =
  | 'New'
  | 'Qualified'
  | 'Has Live Ads'
  | 'No Ads Found'
  | 'Needs Review'
  | 'Bad Fit'
  | 'Contact Found'
  | 'Contact Missing';

export type ScanRecord = {
  id: number;
  category: string;
  created_at: string;
  status: 'running' | 'discovered' | 'enriched' | 'complete' | 'error';
  notes?: string | null;
};
