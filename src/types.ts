export interface Env {
  DB: D1Database;
  PASSWORD: string;
}

export type MealSlot =
  | 'sniadanie'
  | 'ii_sniadanie'
  | 'obiad'
  | 'podwieczorek'
  | 'kolacja'
  | 'inne';

export type MealSource = 'hfood' | 'dom' | 'restauracja';

export type RestrictionLevel = 'forbidden' | 'limit' | 'prefer';

export type RestrictionStatus = 'active' | 'testing' | 'cleared' | 'confirmed_trigger';

export type FodmapLevel = 'low' | 'moderate' | 'high' | 'unknown';

export type FiberType = 'soluble' | 'insoluble' | 'mixed' | 'none';

export interface Phase {
  id: number;
  name: string;
  date_from: string;
  date_to: string | null;
  diet_type: string | null;
  notes: string | null;
}

export interface Target {
  id: number;
  phase_id: number;
  metric: string;
  min_value: number | null;
  max_value: number | null;
  source: string | null;
}

export interface FoodGroup {
  id: number;
  code: string;
  name: string;
  provides: string | null;
}

export interface Food {
  id: number;
  name: string;
  group_id: number | null;
  fodmap: FodmapLevel;
  fodmap_note: string | null;
  fermented: number;
  histamine: string | null;
  fiber_type: FiberType | null;
  processed_meat: number;
  refined_oil: number;
  notes: string | null;
}

export interface Restriction {
  id: number;
  food_id: number | null;
  group_id: number | null;
  level: RestrictionLevel;
  reason: string;
  source: string | null;
  date_from: string;
  date_to: string | null;
  status: RestrictionStatus;
  max_amount: string | null;
}

export interface CoverageRule {
  id: number;
  group_id: number;
  min_days_per_week: number | null;
  min_portions_per_day: number | null;
  severity: string;
  rationale: string | null;
  active_from: string | null;
  active_to: string | null;
}

export interface Meal {
  id: number;
  date: string;
  eaten_at: string | null;
  duration_min: number | null;
  slot: MealSlot;
  sitting: number | null;
  source: MealSource;
  external_id: string | null;
  name: string;
  ingredients_raw: string | null;
  kcal: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carbs_g: number | null;
  fiber_g: number | null;
  weight_g: number | null;
  eaten: number;
  eaten_fraction: number;
  notes: string | null;
}

export interface Symptom {
  id: number;
  date: string;
  time: string | null;
  kind: string;
  severity: number | null;
  notes: string | null;
}

export interface Stool {
  id: number;
  date: string;
  time: string | null;
  bristol: number;
  straining: number | null;
  incomplete: number | null;
  floating: number | null;
  notes: string | null;
}

export interface Trial {
  id: number;
  food_id: number;
  planned_date: string | null;
  tested_date: string | null;
  amount: string | null;
  window_hours: number;
  verdict: string | null;
  verdict_note: string | null;
  status: string;
}

export interface DayTotals {
  date: string;
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  fiber_g: number;
  meals_count: number;
}
