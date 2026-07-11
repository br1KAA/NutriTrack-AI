import type { ActivityLevel, Gender, Goal, NutritionValues, UserProfile } from "../types";
import type { FoodEntry, Meal, UnitName } from "../types";

export const zeroNutrition = (): NutritionValues => ({
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
  sugar: 0,
});

export const addNutrition = (a: NutritionValues, b: NutritionValues): NutritionValues => ({
  calories: a.calories + b.calories,
  protein: a.protein + b.protein,
  carbs: a.carbs + b.carbs,
  fat: a.fat + b.fat,
  fiber: a.fiber + b.fiber,
  sugar: a.sugar + b.sugar,
});

export const roundNutrition = (n: NutritionValues): NutritionValues => ({
  calories: Math.round(n.calories),
  protein: Number(n.protein.toFixed(1)),
  carbs: Number(n.carbs.toFixed(1)),
  fat: Number(n.fat.toFixed(1)),
  fiber: Number(n.fiber.toFixed(1)),
  sugar: Number(n.sugar.toFixed(1)),
});

const activityMultiplier: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  veryActive: 1.9,
};

export const calculateBmr = (gender: Gender, weightKg: number, heightCm: number, age: number) => {
  if (gender === "male") {
    return 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  }
  return 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
};

export const calculateBmi = (weightKg: number, heightCm: number) => {
  const hM = heightCm / 100;
  return weightKg / (hM * hM);
};

export const goalCaloriesAdjustment = (goal: Goal, weeklyGoalKg: number) => {
  const delta = (weeklyGoalKg * 7700) / 7;
  if (goal === "lose") return -delta;
  if (goal === "gain") return delta;
  return 0;
};

export const calculateProfile = (input: Omit<UserProfile, "bmi" | "bmr" | "tdee" | "recommendedCalories" | "proteinGoal" | "carbGoal" | "fatGoal" | "waterGoalMl">): UserProfile => {
  const bmi = calculateBmi(input.currentWeightKg, input.heightCm);
  const bmr = calculateBmr(input.gender, input.currentWeightKg, input.heightCm, input.age);
  const tdee = bmr * activityMultiplier[input.activityLevel];
  const recommendedCalories = Math.max(1200, tdee + goalCaloriesAdjustment(input.goal, input.weeklyGoalKg));

  const proteinMultiplier = input.goal === "gain" ? 2 : 1.7;
  const proteinGoal = input.currentWeightKg * proteinMultiplier;
  const fatGoal = (recommendedCalories * 0.28) / 9;
  const carbGoal = (recommendedCalories - proteinGoal * 4 - fatGoal * 9) / 4;
  const waterGoalMl = Math.round(input.currentWeightKg * 35);

  return {
    ...input,
    bmi: Number(bmi.toFixed(1)),
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    recommendedCalories: Math.round(recommendedCalories),
    proteinGoal: Math.round(proteinGoal),
    carbGoal: Math.round(carbGoal),
    fatGoal: Math.round(fatGoal),
    waterGoalMl,
  };
};

export const convertToGrams = (food: FoodEntry, quantity: number, unit: UnitName) => {
  if (unit === "g") return quantity;
  if (unit === "ml") return quantity;
  return quantity * (food.gramsPerUnit[unit] ?? 1);
};

export const estimateNutrition = (food: FoodEntry, grams: number): NutritionValues => {
  const ratio = grams / 100;
  return roundNutrition({
    calories: food.nutritionPer100g.calories * ratio,
    protein: food.nutritionPer100g.protein * ratio,
    carbs: food.nutritionPer100g.carbs * ratio,
    fat: food.nutritionPer100g.fat * ratio,
    fiber: food.nutritionPer100g.fiber * ratio,
    sugar: food.nutritionPer100g.sugar * ratio,
  });
};

export const mealTotal = (meal: Meal) => meal.items.reduce((acc, item) => addNutrition(acc, item.nutrition), zeroNutrition());
