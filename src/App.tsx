import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { GlassPanel, Button, Input, Select, ProgressBar, Stat, LineChart } from "./components/ui";
import { nutritionDatabase } from "./data/nutritionDatabase";
import { t, localizeMealCategory } from "./i18n";
import { useNutriTrack } from "./hooks/useNutriTrack";
import { analyzeMealPhoto, duplicateMeal, generateCoachReply, generateDailyReview, nextCoachMessage, parseNaturalLanguageMeal } from "./services/ai";
import type { ActivityLevel, Goal, Meal, MealCategory, MealPlanItem, UnitName, UserProfile } from "./types";
import { lastNDates, previousDateKey } from "./utils/date";
import { addNutrition, calculateProfile, convertToGrams, estimateNutrition, roundNutrition, zeroNutrition } from "./utils/nutrition";

type Tab = "dashboard" | "nutrition" | "planner" | "fridge" | "trackers" | "history" | "statistics" | "settings";

const mealCategories: MealCategory[] = ["breakfast", "lunch", "dinner", "snacks", "drinks"];
const units: UnitName[] = ["g", "piece", "cup", "ml", "tbsp", "tsp", "slice"];

const tabs: Tab[] = ["dashboard", "nutrition", "planner", "fridge", "trackers", "history", "statistics", "settings"];

const safeParse = (value: string, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export default function App() {
  const { state, setState, today, todayLog, allLogs, ensureToday, updateToday } = useNutriTrack();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [now, setNow] = useState(Date.now());
  const [setup, setSetup] = useState({
    name: "",
    age: "30",
    gender: "male",
    heightCm: "175",
    currentWeightKg: "78",
    goalWeightKg: "72",
    activityLevel: "moderate",
    goal: "lose",
    weeklyGoalKg: "0.5",
  });

  const language = state.settings.language;

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    ensureToday();
  }, [today, ensureToday, now]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", state.settings.theme === "dark");
  }, [state.settings.theme]);

  const nutritionToday = useMemo(() => {
    return roundNutrition(todayLog.meals.reduce((acc, meal) => addNutrition(acc, meal.nutrition), zeroNutrition()));
  }, [todayLog.meals]);

  const caloriesGoal = state.profile?.recommendedCalories ?? 0;
  const proteinGoal = state.profile?.proteinGoal ?? 0;
  const carbGoal = state.profile?.carbGoal ?? 0;
  const fatGoal = state.profile?.fatGoal ?? 0;

  const streak = useMemo(() => {
    let count = 0;
    const keys = Object.keys(state.dailyLogs).sort().reverse();
    for (const key of keys) {
      const log = state.dailyLogs[key];
      if (log.meals.length > 0 || log.waterMl > 0 || log.workouts.length > 0) count += 1;
      else break;
    }
    return count;
  }, [state.dailyLogs]);

  const weeklyAverageCalories = useMemo(() => {
    const days = lastNDates(7).map((d) => state.dailyLogs[d]).filter(Boolean);
    if (days.length === 0) return 0;
    const total = days.reduce((sum, log) => sum + log.meals.reduce((s, meal) => s + meal.nutrition.calories, 0), 0);
    return Math.round(total / days.length);
  }, [state.dailyLogs]);

  const latestWeight = todayLog.weights[todayLog.weights.length - 1]?.weightKg ?? state.profile?.currentWeightKg ?? 0;
  const goalProgress = state.profile
    ? Math.min(
        100,
        Math.max(
          0,
          ((state.profile.goal === "lose" ? state.profile.currentWeightKg - latestWeight : latestWeight - state.profile.currentWeightKg) /
            Math.max(0.1, Math.abs(state.profile.currentWeightKg - state.profile.goalWeightKg))) *
            100
        )
      )
    : 0;

  const [manualCategory, setManualCategory] = useState<MealCategory>("breakfast");
  const [manualFoodId, setManualFoodId] = useState(nutritionDatabase[0]?.id ?? "");
  const [manualQuantity, setManualQuantity] = useState("1");
  const [manualUnit, setManualUnit] = useState<UnitName>("piece");
  const [manualNote, setManualNote] = useState("");

  const [aiText, setAiText] = useState("");
  const [photoResult, setPhotoResult] = useState<{ foods: string[]; calories: number; protein: number; carbs: number; fat: number; fiber: number; confidence: number } | null>(null);
  const [showCoach, setShowCoach] = useState(false);
  const [coachInput, setCoachInput] = useState("");
  const [showPhotoTool, setShowPhotoTool] = useState(false);
  const [fridgeInput, setFridgeInput] = useState("");
  const [supplementDraft, setSupplementDraft] = useState({ name: "", dose: "" });

  const addManualMeal = () => {
    const food = nutritionDatabase.find((f) => f.id === manualFoodId);
    if (!food) return;
    const quantity = Math.max(0.1, safeParse(manualQuantity, 1));
    const grams = convertToGrams(food, quantity, manualUnit);
    const item = {
      foodId: food.id,
      foodNameEn: food.nameEn,
      foodNameSr: food.nameSr,
      quantity,
      unit: manualUnit,
      grams,
      nutrition: estimateNutrition(food, grams),
    };
    const meal: Meal = {
      id: crypto.randomUUID(),
      category: manualCategory,
      note: manualNote,
      createdAt: new Date().toISOString(),
      items: [item],
      nutrition: item.nutrition,
      source: "manual",
      favorite: false,
    };
    updateToday((log) => ({ ...log, meals: [meal, ...log.meals] }));
    setManualNote("");
  };

  const addAiMeal = () => {
    if (!aiText.trim()) return;
    const parsed = parseNaturalLanguageMeal(aiText);
    const meal: Meal = {
      id: crypto.randomUUID(),
      category: parsed.category,
      note: aiText,
      createdAt: new Date().toISOString(),
      items: parsed.items,
      nutrition: parsed.nutrition,
      source: "ai",
      favorite: false,
    };
    updateToday((log) => ({ ...log, meals: [meal, ...log.meals] }));
    setAiText("");
  };

  const addPhotoMeal = () => {
    if (!photoResult) return;
    const meal: Meal = {
      id: crypto.randomUUID(),
      category: "lunch",
      note: "Photo analysis",
      createdAt: new Date().toISOString(),
      items: photoResult.foods.map((name) => {
        const food = nutritionDatabase.find((entry) => entry.nameEn === name) ?? nutritionDatabase[0];
        const grams = convertToGrams(food, 1, food.defaultUnit);
        return {
          foodId: food.id,
          foodNameEn: food.nameEn,
          foodNameSr: food.nameSr,
          quantity: 1,
          unit: food.defaultUnit,
          grams,
          nutrition: estimateNutrition(food, grams),
        };
      }),
      nutrition: { calories: photoResult.calories, protein: photoResult.protein, carbs: photoResult.carbs, fat: photoResult.fat, fiber: photoResult.fiber, sugar: 0 },
      source: "photo",
      favorite: false,
    };
    updateToday((log) => ({ ...log, meals: [meal, ...log.meals] }));
    setPhotoResult(null);
    setShowPhotoTool(false);
  };

  const removeMeal = (id: string) => updateToday((log) => ({ ...log, meals: log.meals.filter((meal) => meal.id !== id) }));

  const toggleFavorite = (id: string) => {
    updateToday((log) => ({
      ...log,
      meals: log.meals.map((meal) => (meal.id === id ? { ...meal, favorite: !meal.favorite } : meal)),
    }));
  };

  const duplicateLoggedMeal = (id: string) => {
    const meal = todayLog.meals.find((entry) => entry.id === id);
    if (!meal) return;
    updateToday((log) => ({ ...log, meals: [duplicateMeal(meal), ...log.meals] }));
  };

  const saveProfile = () => {
    const profile: UserProfile = calculateProfile({
      name: setup.name,
      age: safeParse(setup.age, 30),
      gender: setup.gender as "male" | "female",
      heightCm: safeParse(setup.heightCm, 175),
      currentWeightKg: safeParse(setup.currentWeightKg, 78),
      goalWeightKg: safeParse(setup.goalWeightKg, 72),
      activityLevel: setup.activityLevel as ActivityLevel,
      goal: setup.goal as Goal,
      weeklyGoalKg: safeParse(setup.weeklyGoalKg, 0.5),
    });
    setState((prev) => ({ ...prev, profile }));
  };

  const addWater = (amount: number) => updateToday((log) => ({ ...log, waterMl: log.waterMl + amount }));
  const addWeight = (kg: number) => updateToday((log) => ({ ...log, weights: [...log.weights, { id: crypto.randomUUID(), weightKg: kg }] }));

  const runCoach = () => {
    if (!coachInput.trim()) return;
    const userMessage = nextCoachMessage(crypto.randomUUID(), "user", coachInput);
    const answer = generateCoachReply(coachInput, state.profile, nutritionToday, state.profile?.goal ?? "maintain", language);
    const assistantMessage = nextCoachMessage(crypto.randomUUID(), "assistant", answer);
    setState((prev) => ({ ...prev, coachMessages: [...prev.coachMessages, userMessage, assistantMessage] }));
    setCoachInput("");
  };

  const generatePlan = () => {
    const favorites = todayLog.meals.filter((meal) => meal.favorite).flatMap((meal) => meal.items.map((item) => item.foodNameEn));
    const fridge = state.fridgeItems;
    const base = (type: MealPlanItem["mealType"], title: string, ingredients: string[], calories: number, protein: number, carbs: number, fat: number): MealPlanItem => ({
      id: crypto.randomUUID(),
      mealType: type,
      title,
      ingredients,
      estimatedNutrition: { calories, protein, carbs, fat, fiber: 5, sugar: 5 },
    });

    const plan = [
      base("breakfast", "Protein Oats Bowl", ["Oats", "Milk", "Banana", "Whey"], 520, 36, 62, 14),
      base("lunch", "Chicken Rice Plate", ["Chicken Breast", "Rice", "Broccoli", "Olive Oil"], 680, 48, 72, 19),
      base("dinner", "Salmon Potato Combo", ["Salmon", "Potato", "Spinach"], 610, 41, 46, 24),
      base("snack", "Greek Yogurt Mix", ["Greek Yogurt", "Blueberries", "Almonds"], 320, 22, 26, 14),
    ].map((entry) => ({ ...entry, ingredients: [...entry.ingredients, ...favorites.slice(0, 1), ...fridge.slice(0, 1)].filter(Boolean) }));
    setState((prev) => ({ ...prev, generatedMealPlan: plan }));
  };

  const fridgeIdeas = useMemo(() => {
    const has = (item: string) => state.fridgeItems.some((i) => i.toLowerCase().includes(item));
    const ideas = [
      { type: "breakfast", title: "Egg Oat Scramble", needs: ["eggs", "oats", "milk"] },
      { type: "lunch", title: "Chicken Rice Bowl", needs: ["chicken", "rice", "vegetables"] },
      { type: "dinner", title: "Yogurt Chicken Wrap", needs: ["chicken", "yogurt", "bread"] },
      { type: "snack", title: "Banana Peanut Yogurt", needs: ["banana", "peanut", "yogurt"] },
    ];
    return ideas.map((idea) => {
      const missing = idea.needs.filter((n) => !has(n));
      return { ...idea, missing };
    });
  }, [state.fridgeItems]);

  const generateShopping = () => {
    const fromPlan = state.generatedMealPlan.flatMap((meal) => meal.ingredients);
    const missing = fridgeIdeas.flatMap((idea) => idea.missing);
    const merged = [...new Set([...fromPlan, ...missing])].filter(Boolean);
    const list = merged.map((name) => ({ id: crypto.randomUUID(), name, quantity: "1", category: "General", checked: false }));
    setState((prev) => ({ ...prev, shoppingList: list }));
  };

  const weeklyWeights = lastNDates(30).map((date) => state.dailyLogs[date]?.weights.at(-1)?.weightKg ?? 0).filter((v) => v > 0);
  const weeklyCalories = lastNDates(14).map((date) => state.dailyLogs[date]?.meals.reduce((sum, meal) => sum + meal.nutrition.calories, 0) ?? 0);
  const weeklyProtein = lastNDates(14).map((date) => state.dailyLogs[date]?.meals.reduce((sum, meal) => sum + meal.nutrition.protein, 0) ?? 0);
  const weeklyWater = lastNDates(14).map((date) => state.dailyLogs[date]?.waterMl ?? 0);

  const generateReview = () => {
    const review = generateDailyReview(nutritionToday, state.profile, todayLog.waterMl, language);
    updateToday((log) => ({ ...log, aiDailyReview: review }));
  };

  const quickAddYesterday = () => {
    const yesterday = state.dailyLogs[previousDateKey(today)];
    if (!yesterday || yesterday.meals.length === 0) return;
    const cloned = yesterday.meals.map((meal) => ({ ...duplicateMeal(meal), favorite: meal.favorite }));
    updateToday((log) => ({ ...log, meals: [...cloned, ...log.meals] }));
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "nutritrack-ai-export.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const next = JSON.parse(String(reader.result));
        if (!next.dailyLogs || !next.settings) return;
        setState(next);
      } catch {
        return;
      }
    };
    reader.readAsText(file);
  };

  const resetApplication = () => {
    if (!window.confirm(t(language, "resetConfirm"))) return;
    localStorage.removeItem("nutritrack-ai-state");
    window.location.reload();
  };

  const bg = state.settings.theme === "dark" ? "bg-[#05070f] text-zinc-100" : "bg-zinc-50 text-zinc-900";

  return (
    <div className={`${bg} min-h-screen transition-colors`}>
      <header className="sticky top-0 z-20 border-b border-white/10 bg-black/30 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/80">AI Nutrition Platform</p>
            <h1 className="text-xl font-semibold">{t(language, "appName")}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={state.settings.language}
              onChange={(event) => setState((prev) => ({ ...prev, settings: { ...prev.settings, language: event.target.value as "en" | "sr" } }))}
              className="w-28"
            >
              <option value="en">{t(language, "english")}</option>
              <option value="sr">{t(language, "serbian")}</option>
            </Select>
            <Button onClick={() => setShowCoach(true)}>{t(language, "openAiCoach")}</Button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl flex-wrap gap-2 px-4 pb-3">
          {tabs.map((entry) => (
            <button
              key={entry}
              onClick={() => setTab(entry)}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${tab === entry ? "bg-cyan-400/20 text-cyan-200" : "text-zinc-300 hover:bg-white/10"}`}
            >
              {t(language, `nav${entry.charAt(0).toUpperCase()}${entry.slice(1)}`)}
            </button>
          ))}
        </nav>
      </header>

      {!state.profile ? (
        <main className="mx-auto max-w-4xl p-4">
          <GlassPanel className="space-y-4 p-6">
            <h2 className="text-2xl font-semibold">{t(language, "setupTitle")}</h2>
            <p className="text-sm text-zinc-400">{t(language, "setupSubtitle")}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input placeholder={t(language, "name")} value={setup.name} onChange={(e) => setSetup((prev) => ({ ...prev, name: e.target.value }))} />
              <Input type="number" placeholder={t(language, "age")} value={setup.age} onChange={(e) => setSetup((prev) => ({ ...prev, age: e.target.value }))} />
              <Select value={setup.gender} onChange={(e) => setSetup((prev) => ({ ...prev, gender: e.target.value }))}>
                <option value="male">{t(language, "male")}</option>
                <option value="female">{t(language, "female")}</option>
              </Select>
              <Input type="number" placeholder={t(language, "height")} value={setup.heightCm} onChange={(e) => setSetup((prev) => ({ ...prev, heightCm: e.target.value }))} />
              <Input type="number" placeholder={t(language, "currentWeight")} value={setup.currentWeightKg} onChange={(e) => setSetup((prev) => ({ ...prev, currentWeightKg: e.target.value }))} />
              <Input type="number" placeholder={t(language, "goalWeight")} value={setup.goalWeightKg} onChange={(e) => setSetup((prev) => ({ ...prev, goalWeightKg: e.target.value }))} />
              <Select value={setup.activityLevel} onChange={(e) => setSetup((prev) => ({ ...prev, activityLevel: e.target.value }))}>
                <option value="sedentary">{t(language, "sedentary")}</option>
                <option value="light">{t(language, "lightActive")}</option>
                <option value="moderate">{t(language, "moderateActive")}</option>
                <option value="active">{t(language, "active")}</option>
                <option value="veryActive">{t(language, "veryActive")}</option>
              </Select>
              <Select value={setup.goal} onChange={(e) => setSetup((prev) => ({ ...prev, goal: e.target.value }))}>
                <option value="lose">{t(language, "loseWeight")}</option>
                <option value="maintain">{t(language, "maintainWeight")}</option>
                <option value="gain">{t(language, "gainWeight")}</option>
              </Select>
              <Input type="number" placeholder={t(language, "weeklyGoalSpeed")} value={setup.weeklyGoalKg} onChange={(e) => setSetup((prev) => ({ ...prev, weeklyGoalKg: e.target.value }))} />
            </div>

            <GlassPanel className="grid gap-2 sm:grid-cols-2">
              {(() => {
                const calculated = calculateProfile({
                  name: setup.name || "User",
                  age: safeParse(setup.age, 30),
                  gender: setup.gender as "male" | "female",
                  heightCm: safeParse(setup.heightCm, 175),
                  currentWeightKg: safeParse(setup.currentWeightKg, 78),
                  goalWeightKg: safeParse(setup.goalWeightKg, 72),
                  activityLevel: setup.activityLevel as ActivityLevel,
                  goal: setup.goal as Goal,
                  weeklyGoalKg: safeParse(setup.weeklyGoalKg, 0.5),
                });
                return (
                  <>
                    <Stat label={t(language, "bmi")} value={String(calculated.bmi)} sub={t(language, "explanationBmi")} />
                    <Stat label={t(language, "bmr")} value={`${calculated.bmr}`} sub={t(language, "explanationBmr")} />
                    <Stat label={t(language, "tdee")} value={`${calculated.tdee}`} sub={t(language, "explanationTdee")} />
                    <Stat label={t(language, "recommendedCalories")} value={`${calculated.recommendedCalories}`} sub={t(language, "explanationMacros")} />
                  </>
                );
              })()}
            </GlassPanel>
            <Button className="w-full" onClick={saveProfile}>
              {t(language, "createProfile")}
            </Button>
          </GlassPanel>
        </main>
      ) : (
        <main className="mx-auto grid max-w-7xl gap-4 p-4">
          {tab === "dashboard" && (
            <>
              <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
                <GlassPanel className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-semibold">{t(language, "today")}</h2>
                    <Button onClick={quickAddYesterday}>{t(language, "quickAddYesterday")}</Button>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="mx-auto flex h-52 w-52 items-center justify-center rounded-full border border-cyan-400/30 bg-black/20">
                      <div className="text-center">
                        <p className="text-4xl font-bold text-cyan-300">{Math.round(nutritionToday.calories)}</p>
                        <p className="text-xs text-zinc-400">/ {caloriesGoal} kcal</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Stat label={t(language, "caloriesConsumed")} value={`${Math.round(nutritionToday.calories)} kcal`} />
                      <Stat label={t(language, "caloriesRemaining")} value={`${Math.max(0, caloriesGoal - Math.round(nutritionToday.calories))} kcal`} />
                      <Stat label={t(language, "dailyStreak")} value={`${streak}`} />
                      <Stat label={t(language, "weeklyAverage")} value={`${weeklyAverageCalories} kcal`} />
                    </div>
                  </div>
                  <ProgressBar value={nutritionToday.calories} max={Math.max(1, caloriesGoal)} />
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-zinc-400">Protein</p>
                      <ProgressBar value={nutritionToday.protein} max={Math.max(1, proteinGoal)} />
                      <p className="text-xs text-zinc-400">{nutritionToday.protein.toFixed(1)}g / {proteinGoal}g</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400">Carbs</p>
                      <ProgressBar value={nutritionToday.carbs} max={Math.max(1, carbGoal)} />
                      <p className="text-xs text-zinc-400">{nutritionToday.carbs.toFixed(1)}g / {carbGoal}g</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400">Fat</p>
                      <ProgressBar value={nutritionToday.fat} max={Math.max(1, fatGoal)} />
                      <p className="text-xs text-zinc-400">{nutritionToday.fat.toFixed(1)}g / {fatGoal}g</p>
                    </div>
                  </div>
                </GlassPanel>

                <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="grid gap-4">
                  <GlassPanel>
                    <h3 className="mb-2 text-lg font-semibold">{t(language, "aiRecommendation")}</h3>
                    <p className="text-sm text-zinc-300">{generateCoachReply("what should I eat today", state.profile, nutritionToday, state.profile.goal, language)}</p>
                  </GlassPanel>
                  <GlassPanel>
                    <h3 className="mb-2 text-lg font-semibold">{t(language, "goalProgress")}</h3>
                    <ProgressBar value={goalProgress} max={100} />
                    <p className="mt-2 text-sm text-zinc-400">{goalProgress.toFixed(1)}%</p>
                  </GlassPanel>
                  <GlassPanel>
                    <h3 className="mb-2 text-lg font-semibold">{t(language, "waterIntake")}</h3>
                    <ProgressBar value={todayLog.waterMl} max={Math.max(1, state.profile.waterGoalMl)} />
                    <p className="mt-2 text-sm text-zinc-400">{todayLog.waterMl} / {state.profile.waterGoalMl} ml</p>
                    <div className="mt-3 flex gap-2">
                      <Button onClick={() => addWater(250)}>+250ml</Button>
                      <Button onClick={() => addWater(500)}>+500ml</Button>
                    </div>
                  </GlassPanel>
                </motion.div>
              </motion.section>

              <GlassPanel>
                <h3 className="mb-3 text-lg font-semibold">{t(language, "todaysMeals")}</h3>
                <div className="grid gap-2">
                  {todayLog.meals.length === 0 && <p className="text-sm text-zinc-400">{t(language, "noMeals")}</p>}
                  {todayLog.meals.slice(0, 5).map((meal) => (
                    <div key={meal.id} className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium">{meal.items.map((item) => (language === "sr" ? item.foodNameSr : item.foodNameEn)).join(", ")}</p>
                        <p className="text-xs text-zinc-400">{localizeMealCategory(language, meal.category)} - {Math.round(meal.nutrition.calories)} kcal</p>
                      </div>
                      <div className="flex gap-1">
                        <Button onClick={() => duplicateLoggedMeal(meal.id)}>{t(language, "duplicate")}</Button>
                        <Button onClick={() => toggleFavorite(meal.id)}>{meal.favorite ? "★" : "☆"}</Button>
                        <Button onClick={() => removeMeal(meal.id)}>{t(language, "delete")}</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassPanel>
            </>
          )}

          {tab === "nutrition" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <GlassPanel className="space-y-3">
                <h2 className="text-xl font-semibold">{t(language, "quickAddMeal")}</h2>
                <Select value={manualCategory} onChange={(e) => setManualCategory(e.target.value as MealCategory)}>
                  {mealCategories.map((c) => <option key={c} value={c}>{localizeMealCategory(language, c)}</option>)}
                </Select>
                <Select value={manualFoodId} onChange={(e) => setManualFoodId(e.target.value)}>
                  {nutritionDatabase.map((food) => (
                    <option key={food.id} value={food.id}>{language === "sr" ? food.nameSr : food.nameEn}</option>
                  ))}
                </Select>
                <div className="grid grid-cols-2 gap-2">
                  <Input value={manualQuantity} onChange={(e) => setManualQuantity(e.target.value)} type="number" placeholder={t(language, "quantity")} />
                  <Select value={manualUnit} onChange={(e) => setManualUnit(e.target.value as UnitName)}>
                    {units.map((u) => <option key={u} value={u}>{u}</option>)}
                  </Select>
                </div>
                <Input value={manualNote} onChange={(e) => setManualNote(e.target.value)} placeholder={t(language, "note")} />
                <Button className="w-full" onClick={addManualMeal}>{t(language, "add")}</Button>
              </GlassPanel>

              <GlassPanel className="space-y-3">
                <h2 className="text-xl font-semibold">{t(language, "aiFoodLogger")}</h2>
                <Input value={aiText} onChange={(e) => setAiText(e.target.value)} placeholder={t(language, "aiFoodPlaceholder")} />
                <Button className="w-full" onClick={addAiMeal}>{t(language, "parseMeal")}</Button>
                <Button className="w-full" onClick={() => setShowPhotoTool((prev) => !prev)}>{t(language, "analyzePhoto")}</Button>
                {showPhotoTool && (
                  <div className="space-y-2">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        const result = analyzeMealPhoto(file.name);
                        setPhotoResult({
                          foods: result.detectedFoods,
                          calories: result.nutrition.calories,
                          protein: result.nutrition.protein,
                          carbs: result.nutrition.carbs,
                          fat: result.nutrition.fat,
                          fiber: result.nutrition.fiber,
                          confidence: result.confidence,
                        });
                      }}
                    />
                    {photoResult && (
                      <div className="space-y-2 rounded-xl border border-white/10 p-3">
                        <p className="text-sm">{t(language, "photoResult")}: {photoResult.foods.join(", ")}</p>
                        <p className="text-xs text-zinc-400">{t(language, "confidence")}: {(photoResult.confidence * 100).toFixed(0)}%</p>
                        <Input type="number" value={photoResult.calories} onChange={(e) => setPhotoResult((prev) => (prev ? { ...prev, calories: safeParse(e.target.value) } : prev))} />
                        <Button onClick={addPhotoMeal}>{t(language, "add")}</Button>
                      </div>
                    )}
                  </div>
                )}
              </GlassPanel>

              <GlassPanel className="lg:col-span-2">
                <h3 className="mb-3 text-lg font-semibold">{t(language, "todaysMeals")}</h3>
                <div className="grid gap-2">
                  {todayLog.meals.map((meal) => (
                    <div key={meal.id} className="rounded-xl border border-white/10 p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{localizeMealCategory(language, meal.category)} - {Math.round(meal.nutrition.calories)} kcal</p>
                        <div className="flex gap-1">
                          <Button onClick={() => duplicateLoggedMeal(meal.id)}>{t(language, "duplicate")}</Button>
                          <Button onClick={() => toggleFavorite(meal.id)}>{meal.favorite ? t(language, "removeFromFavorites") : t(language, "addToFavorites")}</Button>
                          <Button onClick={() => removeMeal(meal.id)}>{t(language, "delete")}</Button>
                        </div>
                      </div>
                      <p className="text-xs text-zinc-400">{meal.items.map((item) => (language === "sr" ? item.foodNameSr : item.foodNameEn)).join(", ")}</p>
                    </div>
                  ))}
                </div>
              </GlassPanel>
            </div>
          )}

          {tab === "planner" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <GlassPanel className="space-y-3">
                <h2 className="text-xl font-semibold">{t(language, "mealPlanner")}</h2>
                <p className="text-sm text-zinc-400">{t(language, "caloriesRemainingLabel")}: {Math.max(0, caloriesGoal - Math.round(nutritionToday.calories))}</p>
                <p className="text-sm text-zinc-400">{t(language, "proteinRemainingLabel")}: {Math.max(0, proteinGoal - Math.round(nutritionToday.protein))}g</p>
                <Button className="w-full" onClick={generatePlan}>{t(language, "generatePlan")}</Button>
              </GlassPanel>
              <GlassPanel>
                <h3 className="mb-2 text-lg font-semibold">{t(language, "shoppingList")}</h3>
                <Button onClick={generateShopping}>{t(language, "autoGenerateShopping")}</Button>
                <div className="mt-3 grid gap-2">
                  {state.shoppingList.map((item) => (
                    <label key={item.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() =>
                          setState((prev) => ({
                            ...prev,
                            shoppingList: prev.shoppingList.map((entry) => (entry.id === item.id ? { ...entry, checked: !entry.checked } : entry)),
                          }))
                        }
                      />
                      <span>{item.name} ({item.quantity})</span>
                    </label>
                  ))}
                </div>
              </GlassPanel>
              <GlassPanel className="lg:col-span-2">
                <h3 className="mb-3 text-lg font-semibold">{t(language, "mealPlanner")}</h3>
                <div className="grid gap-2 md:grid-cols-2">
                  {state.generatedMealPlan.map((meal) => (
                    <div key={meal.id} className="rounded-xl border border-white/10 p-3">
                      <p className="font-medium">{meal.title}</p>
                      <p className="text-xs text-zinc-400">{meal.mealType}</p>
                      <p className="text-sm text-zinc-300">{meal.ingredients.join(", ")}</p>
                      <p className="text-xs text-zinc-400">{Math.round(meal.estimatedNutrition.calories)} kcal, {meal.estimatedNutrition.protein}g protein</p>
                    </div>
                  ))}
                </div>
              </GlassPanel>
            </div>
          )}

          {tab === "fridge" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <GlassPanel className="space-y-3">
                <h2 className="text-xl font-semibold">{t(language, "myFridge")}</h2>
                <div className="flex gap-2">
                  <Input value={fridgeInput} onChange={(e) => setFridgeInput(e.target.value)} placeholder={t(language, "addIngredient")} />
                  <Button
                    onClick={() => {
                      if (!fridgeInput.trim()) return;
                      setState((prev) => ({ ...prev, fridgeItems: [...prev.fridgeItems, fridgeInput.trim()] }));
                      setFridgeInput("");
                    }}
                  >
                    {t(language, "add")}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {state.fridgeItems.map((item, idx) => (
                    <button
                      key={`${item}-${idx}`}
                      className="rounded-lg border border-white/10 px-2 py-1 text-xs"
                      onClick={() => setState((prev) => ({ ...prev, fridgeItems: prev.fridgeItems.filter((_, i) => i !== idx) }))}
                    >
                      {item} x
                    </button>
                  ))}
                </div>
              </GlassPanel>
              <GlassPanel>
                <h3 className="mb-3 text-lg font-semibold">{t(language, "fridgeIdeas")}</h3>
                <div className="grid gap-2">
                  {fridgeIdeas.map((idea) => (
                    <div key={idea.title} className="rounded-xl border border-white/10 p-3">
                      <p className="font-medium">{idea.title}</p>
                      <p className="text-xs text-zinc-400">{t(language, "missingIngredients")}: {idea.missing.join(", ") || "-"}</p>
                    </div>
                  ))}
                </div>
              </GlassPanel>
            </div>
          )}

          {tab === "trackers" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <GlassPanel className="space-y-3">
                <h3 className="text-lg font-semibold">{t(language, "waterTracker")}</h3>
                <ProgressBar value={todayLog.waterMl} max={Math.max(1, state.profile.waterGoalMl)} />
                <div className="flex gap-2">
                  <Button onClick={() => addWater(250)}>{t(language, "addWater")} 250ml</Button>
                  <Button onClick={() => addWater(500)}>{t(language, "addWater")} 500ml</Button>
                </div>
              </GlassPanel>
              <GlassPanel className="space-y-3">
                <h3 className="text-lg font-semibold">{t(language, "weightTracker")}</h3>
                <div className="flex gap-2">
                  <Input type="number" placeholder="kg" id="weight-input" />
                  <Button
                    onClick={() => {
                      const input = document.getElementById("weight-input") as HTMLInputElement | null;
                      if (!input) return;
                      addWeight(safeParse(input.value, state.profile?.currentWeightKg ?? 0));
                      input.value = "";
                    }}
                  >
                    {t(language, "add")}
                  </Button>
                </div>
                <LineChart values={weeklyWeights.length > 0 ? weeklyWeights : [0]} />
              </GlassPanel>
              <GlassPanel className="space-y-3">
                <h3 className="text-lg font-semibold">{t(language, "bodyMeasurements")}</h3>
                <div className="grid grid-cols-3 gap-2">
                  <Input id="waist" placeholder="Waist" type="number" />
                  <Input id="chest" placeholder="Chest" type="number" />
                  <Input id="arms" placeholder="Arms" type="number" />
                  <Input id="legs" placeholder="Legs" type="number" />
                  <Input id="hips" placeholder="Hips" type="number" />
                  <Input id="bodyFat" placeholder="Body Fat %" type="number" />
                </div>
                <Button
                  onClick={() => {
                    const get = (id: string) => safeParse((document.getElementById(id) as HTMLInputElement | null)?.value ?? "0");
                    updateToday((log) => ({
                      ...log,
                      measurements: [
                        ...log.measurements,
                        {
                          id: crypto.randomUUID(),
                          waist: get("waist"),
                          chest: get("chest"),
                          arms: get("arms"),
                          legs: get("legs"),
                          hips: get("hips"),
                          bodyFat: get("bodyFat"),
                        },
                      ],
                    }));
                  }}
                >
                  {t(language, "add")}
                </Button>
              </GlassPanel>
              <GlassPanel className="space-y-3">
                <h3 className="text-lg font-semibold">{t(language, "workoutTracker")}</h3>
                <div className="grid grid-cols-2 gap-2">
                  <Select id="workoutType">
                    <option value="strength">Strength</option>
                    <option value="cardio">Cardio</option>
                    <option value="walking">Walking</option>
                    <option value="running">Running</option>
                    <option value="cycling">Cycling</option>
                  </Select>
                  <Input id="workoutDuration" placeholder="Minutes" type="number" />
                  <Input id="workoutCalories" placeholder="Calories burned" type="number" />
                  <Input id="workoutNote" placeholder={t(language, "note")} />
                </div>
                <Button
                  onClick={() => {
                    const type = (document.getElementById("workoutType") as HTMLSelectElement | null)?.value ?? "cardio";
                    const duration = safeParse((document.getElementById("workoutDuration") as HTMLInputElement | null)?.value ?? "0");
                    const calories = safeParse((document.getElementById("workoutCalories") as HTMLInputElement | null)?.value ?? "0");
                    const note = (document.getElementById("workoutNote") as HTMLInputElement | null)?.value ?? "";
                    updateToday((log) => ({
                      ...log,
                      workouts: [...log.workouts, { id: crypto.randomUUID(), type: type as "strength" | "cardio" | "walking" | "running" | "cycling", durationMin: duration, caloriesBurned: calories, note }],
                    }));
                  }}
                >
                  {t(language, "add")}
                </Button>
              </GlassPanel>
              <GlassPanel className="space-y-3">
                <h3 className="text-lg font-semibold">{t(language, "sleepTracker")}</h3>
                <div className="flex gap-2">
                  <Input id="sleepHours" placeholder="Hours" type="number" />
                  <Button
                    onClick={() => {
                      const hours = safeParse((document.getElementById("sleepHours") as HTMLInputElement | null)?.value ?? "0");
                      updateToday((log) => ({ ...log, sleep: [...log.sleep, { id: crypto.randomUUID(), hours }] }));
                    }}
                  >
                    {t(language, "add")}
                  </Button>
                </div>
              </GlassPanel>
              <GlassPanel className="space-y-3">
                <h3 className="text-lg font-semibold">{t(language, "supplements")}</h3>
                <div className="flex gap-2">
                  <Input value={supplementDraft.name} onChange={(e) => setSupplementDraft((prev) => ({ ...prev, name: e.target.value }))} placeholder="Protein / Creatine / Omega 3" />
                  <Input value={supplementDraft.dose} onChange={(e) => setSupplementDraft((prev) => ({ ...prev, dose: e.target.value }))} placeholder="5g" />
                  <Button
                    onClick={() => {
                      if (!supplementDraft.name.trim()) return;
                      updateToday((log) => ({ ...log, supplements: [...log.supplements, { id: crypto.randomUUID(), name: supplementDraft.name, dose: supplementDraft.dose, taken: false }] }));
                      setSupplementDraft({ name: "", dose: "" });
                    }}
                  >
                    {t(language, "add")}
                  </Button>
                </div>
                {todayLog.supplements.map((supplement) => (
                  <label key={supplement.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={supplement.taken}
                      onChange={() =>
                        updateToday((log) => ({
                          ...log,
                          supplements: log.supplements.map((entry) => (entry.id === supplement.id ? { ...entry, taken: !entry.taken } : entry)),
                        }))
                      }
                    />
                    {supplement.name} ({supplement.dose})
                  </label>
                ))}
              </GlassPanel>
            </div>
          )}

          {tab === "history" && (
            <div className="grid gap-4">
              <GlassPanel>
                <h2 className="mb-3 text-xl font-semibold">{t(language, "calendar")}</h2>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {allLogs.slice().reverse().map((log) => {
                    const dayNutrition = log.meals.reduce((acc, meal) => addNutrition(acc, meal.nutrition), zeroNutrition());
                    return (
                      <div key={log.date} className="rounded-xl border border-white/10 p-3">
                        <p className="font-medium">{log.date}</p>
                        <p className="text-xs text-zinc-400">{Math.round(dayNutrition.calories)} kcal, {Math.round(dayNutrition.protein)}g protein</p>
                        <p className="text-xs text-zinc-400">Water: {log.waterMl}ml, Workouts: {log.workouts.length}</p>
                      </div>
                    );
                  })}
                </div>
              </GlassPanel>
              <GlassPanel>
                <h3 className="mb-2 text-lg font-semibold">{t(language, "generatedReview")}</h3>
                <Button onClick={generateReview}>{t(language, "generatedReview")}</Button>
                <p className="mt-3 text-sm text-zinc-300">{todayLog.aiDailyReview ?? t(language, "noData")}</p>
              </GlassPanel>
            </div>
          )}

          {tab === "statistics" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <GlassPanel>
                <h3 className="mb-2 text-lg font-semibold">Calories</h3>
                <LineChart values={weeklyCalories} />
              </GlassPanel>
              <GlassPanel>
                <h3 className="mb-2 text-lg font-semibold">Protein</h3>
                <LineChart values={weeklyProtein} />
              </GlassPanel>
              <GlassPanel>
                <h3 className="mb-2 text-lg font-semibold">Water</h3>
                <LineChart values={weeklyWater} />
              </GlassPanel>
              <GlassPanel>
                <h3 className="mb-2 text-lg font-semibold">Weight</h3>
                <LineChart values={weeklyWeights.length > 0 ? weeklyWeights : [0]} />
              </GlassPanel>
              <GlassPanel className="lg:col-span-2 grid gap-3 sm:grid-cols-3">
                <Stat label={t(language, "consistency")} value={`${Math.round((Object.values(state.dailyLogs).filter((d) => d.meals.length > 0).length / Math.max(Object.keys(state.dailyLogs).length, 1)) * 100)}%`} />
                <Stat label={t(language, "longestStreak")} value={`${streak}`} />
                <Stat label={t(language, "weeklyReport")} value={`${weeklyAverageCalories} kcal avg`} />
              </GlassPanel>
            </div>
          )}

          {tab === "settings" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <GlassPanel className="space-y-3">
                <h2 className="text-xl font-semibold">{t(language, "settings")}</h2>
                <Input
                  value={state.profile.name}
                  onChange={(e) => setState((prev) => ({ ...prev, profile: prev.profile ? { ...prev.profile, name: e.target.value } : prev.profile }))}
                  placeholder={t(language, "name")}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    value={state.settings.language}
                    onChange={(e) => setState((prev) => ({ ...prev, settings: { ...prev.settings, language: e.target.value as "en" | "sr" } }))}
                  >
                    <option value="en">{t(language, "english")}</option>
                    <option value="sr">{t(language, "serbian")}</option>
                  </Select>
                  <Select
                    value={state.settings.theme}
                    onChange={(e) => setState((prev) => ({ ...prev, settings: { ...prev.settings, theme: e.target.value as "dark" | "light" } }))}
                  >
                    <option value="dark">{t(language, "dark")}</option>
                    <option value="light">{t(language, "light")}</option>
                  </Select>
                </div>
                <Select
                  value={state.settings.unitSystem}
                  onChange={(e) => setState((prev) => ({ ...prev, settings: { ...prev.settings, unitSystem: e.target.value as "metric" | "imperial" } }))}
                >
                  <option value="metric">{t(language, "metric")}</option>
                  <option value="imperial">{t(language, "imperial")}</option>
                </Select>
              </GlassPanel>

              <GlassPanel className="space-y-3">
                <h3 className="text-lg font-semibold">Data</h3>
                <Button className="w-full" onClick={exportJson}>{t(language, "exportJson")}</Button>
                <Input type="file" accept="application/json" onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
                <Button className="w-full" onClick={resetApplication}>{t(language, "resetApp")}</Button>
                <div className="space-y-2">
                  <h4 className="font-medium">{t(language, "achievements")}</h4>
                  <p className="text-sm text-zinc-400">{streak >= 7 ? "7-day consistency badge unlocked" : "Reach 7 days streak for consistency badge"}</p>
                  <p className="text-sm text-zinc-400">{nutritionToday.protein >= proteinGoal ? "Protein target badge unlocked" : "Hit your protein target to unlock badge"}</p>
                </div>
              </GlassPanel>
            </div>
          )}
        </main>
      )}

      {showCoach && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/50 p-4 sm:place-items-center">
          <GlassPanel className="h-[70vh] w-full max-w-xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{t(language, "aiCoach")}</h3>
              <Button onClick={() => setShowCoach(false)}>{t(language, "close")}</Button>
            </div>
            <div className="h-[50vh] space-y-2 overflow-y-auto rounded-xl border border-white/10 p-2">
              {state.coachMessages.map((message) => (
                <div key={message.id} className={`rounded-xl p-2 text-sm ${message.role === "user" ? "ml-12 bg-cyan-400/20" : "mr-12 bg-white/10"}`}>
                  {message.text}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={coachInput} onChange={(e) => setCoachInput(e.target.value)} placeholder={t(language, "coachPlaceholder")} />
              <Button onClick={runCoach}>{t(language, "send")}</Button>
            </div>
          </GlassPanel>
        </div>
      )}
    </div>
  );
}
