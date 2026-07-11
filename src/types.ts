export type Language = "en" | "sr";
export type Theme = "dark" | "light";
export type UnitSystem = "metric" | "imperial";

export type Gender = "male" | "female";
export type Goal = "lose" | "maintain" | "gain";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "veryActive";
export type MealCategory = "breakfast" | "lunch" | "dinner" | "snacks" | "drinks";

export interface UserProfile {
  name: string;
  age: number;
  gender: Gender;
  heightCm: number;
  currentWeightKg: number;
  goalWeightKg: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  weeklyGoalKg: number;
  bmi: number;
  bmr: number;
  tdee: number;
  recommendedCalories: number;
  proteinGoal: number;
  carbGoal: number;
  fatGoal: number;
  waterGoalMl: number;
}

export interface NutritionValues {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
}

export interface FoodEntry {
  id: string;
  nameEn: string;
  nameSr: string;
  aliases: string[];
  defaultUnit: UnitName;
  gramsPerUnit: Partial<Record<UnitName, number>>;
  nutritionPer100g: NutritionValues;
}

export type UnitName = "g" | "piece" | "cup" | "ml" | "tbsp" | "tsp" | "slice";

export interface MealItem {
  foodId: string;
  foodNameEn: string;
  foodNameSr: string;
  quantity: number;
  unit: UnitName;
  grams: number;
  nutrition: NutritionValues;
}

export interface Meal {
  id: string;
  category: MealCategory;
  note: string;
  createdAt: string;
  items: MealItem[];
  nutrition: NutritionValues;
  source: "manual" | "ai" | "photo";
  favorite: boolean;
}

export interface WorkoutEntry {
  id: string;
  type: "strength" | "cardio" | "walking" | "running" | "cycling";
  durationMin: number;
  caloriesBurned: number;
  note: string;
}

export interface MeasurementEntry {
  id: string;
  waist: number;
  chest: number;
  arms: number;
  legs: number;
  hips: number;
  bodyFat: number;
}

export interface SleepEntry {
  id: string;
  hours: number;
}

export interface SupplementEntry {
  id: string;
  name: string;
  dose: string;
  taken: boolean;
}

export interface WeightEntry {
  id: string;
  weightKg: number;
}

export interface DailyLog {
  date: string;
  meals: Meal[];
  waterMl: number;
  workouts: WorkoutEntry[];
  sleep: SleepEntry[];
  supplements: SupplementEntry[];
  weights: WeightEntry[];
  measurements: MeasurementEntry[];
  aiDailyReview?: string;
}

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: string;
  category: string;
  checked: boolean;
}

export interface CoachMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
}

export interface MealPlanItem {
  id: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  title: string;
  ingredients: string[];
  estimatedNutrition: NutritionValues;
}

export interface AppSettings {
  language: Language;
  theme: Theme;
  unitSystem: UnitSystem;
}

export interface AppState {
  profile: UserProfile | null;
  settings: AppSettings;
  dailyLogs: Record<string, DailyLog>;
  fridgeItems: string[];
  shoppingList: ShoppingItem[];
  favoriteMealIds: string[];
  coachMessages: CoachMessage[];
  generatedMealPlan: MealPlanItem[];
}
