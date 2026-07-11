import { nutritionDatabase } from "../data/nutritionDatabase";
import type { CoachMessage, Goal, Language, Meal, MealCategory, MealItem, NutritionValues, UserProfile } from "../types";
import { addNutrition, convertToGrams, estimateNutrition, roundNutrition, zeroNutrition } from "../utils/nutrition";

const numberWords: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  jedan: 1,
  dva: 2,
  tri: 3,
  cetiri: 4,
  pet: 5,
  sest: 6,
  sedam: 7,
  osam: 8,
  devet: 9,
  deset: 10,
};

const categoryHints: Record<MealCategory, string[]> = {
  breakfast: ["breakfast", "dorucak", "morning", "jutro"],
  lunch: ["lunch", "rucak", "noon"],
  dinner: ["dinner", "vecera", "night"],
  snacks: ["snack", "uzina"],
  drinks: ["drink", "pice", "juice", "sok", "water", "voda"],
};

export const guessMealCategory = (text: string): MealCategory => {
  const normalized = text.toLowerCase();
  for (const [category, words] of Object.entries(categoryHints) as [MealCategory, string[]][]) {
    if (words.some((word) => normalized.includes(word))) {
      return category;
    }
  }
  return "lunch";
};

const parseQuantity = (segment: string) => {
  const numeric = segment.match(/(\d+(?:\.\d+)?)/);
  if (numeric) return Number(numeric[1]);
  const fromWord = Object.entries(numberWords).find(([word]) => segment.includes(word));
  return fromWord ? fromWord[1] : 1;
};

const parseUnit = (segment: string): MealItem["unit"] => {
  if (/\b(g|gram|grams|gr|grama)\b/.test(segment)) return "g";
  if (/\b(ml)\b/.test(segment)) return "ml";
  if (/\b(cup|cups|solja|solje)\b/.test(segment)) return "cup";
  if (/\b(tbsp|tablespoon|kasika)\b/.test(segment)) return "tbsp";
  if (/\b(tsp|teaspoon|kasicica)\b/.test(segment)) return "tsp";
  if (/\b(slice|slices|kriska|kriske)\b/.test(segment)) return "slice";
  return "piece";
};

export const parseNaturalLanguageMeal = (text: string): { category: MealCategory; items: MealItem[]; nutrition: NutritionValues } => {
  const normalized = text.toLowerCase();
  const items: MealItem[] = [];

  nutritionDatabase.forEach((food) => {
    const found = [food.nameEn.toLowerCase(), food.nameSr.toLowerCase(), ...food.aliases.map((a) => a.toLowerCase())].find((token) => normalized.includes(token));
    if (!found) return;

    const index = normalized.indexOf(found);
    const fragment = normalized.slice(Math.max(0, index - 20), index + found.length + 20);
    const quantity = parseQuantity(fragment);
    const unit = parseUnit(fragment);
    const grams = convertToGrams(food, quantity, unit);

    items.push({
      foodId: food.id,
      foodNameEn: food.nameEn,
      foodNameSr: food.nameSr,
      quantity,
      unit,
      grams,
      nutrition: estimateNutrition(food, grams),
    });
  });

  if (items.length === 0) {
    const fallback = nutritionDatabase.find((f) => f.id === "burrito") ?? nutritionDatabase[0];
    const grams = convertToGrams(fallback, 1, fallback.defaultUnit);
    items.push({
      foodId: fallback.id,
      foodNameEn: fallback.nameEn,
      foodNameSr: fallback.nameSr,
      quantity: 1,
      unit: fallback.defaultUnit,
      grams,
      nutrition: estimateNutrition(fallback, grams),
    });
  }

  const nutrition = roundNutrition(items.reduce((acc, item) => addNutrition(acc, item.nutrition), zeroNutrition()));
  return { category: guessMealCategory(text), items, nutrition };
};

export const analyzeMealPhoto = (fileName: string): { detectedFoods: string[]; nutrition: NutritionValues; confidence: number } => {
  const seed = fileName.length % 10;
  const options = ["chicken_breast", "rice_cooked", "broccoli", "egg", "bread_white", "salmon", "potato"];
  const picked = options.slice(0, Math.max(2, seed % 4 + 2));
  const detectedFoods = picked
    .map((id) => nutritionDatabase.find((food) => food.id === id))
    .filter((f): f is NonNullable<typeof f> => Boolean(f));

  const nutrition = roundNutrition(
    detectedFoods.reduce((acc, food) => addNutrition(acc, estimateNutrition(food, convertToGrams(food, 1, food.defaultUnit))), zeroNutrition())
  );

  return {
    detectedFoods: detectedFoods.map((f) => f.nameEn),
    nutrition,
    confidence: 0.62 + (seed % 35) / 100,
  };
};

export const generateCoachReply = (question: string, profile: UserProfile | null, nutritionToday: NutritionValues, goal: Goal, language: Language): string => {
  const q = question.toLowerCase();
  if (!profile) {
    return language === "sr"
      ? "Prvo popunite profil da bih dao personalizovane preporuke."
      : "Complete your profile first so I can tailor nutrition advice.";
  }
  if (q.includes("protein")) {
    const remaining = Math.max(0, profile.proteinGoal - nutritionToday.protein);
    return language === "sr"
      ? `Danas vam treba jos oko ${Math.round(remaining)}g proteina. Probajte jaja, grcki jogurt, piletinu, tunjevinu i whey.`
      : `You still need about ${Math.round(remaining)}g protein today. Try eggs, greek yogurt, chicken, tuna, and whey.`;
  }
  if (q.includes("cheap") || q.includes("budget")) {
    return language === "sr"
      ? "Budzet plan: ovas + mleko + banana za dorucak, piletina i pirinac za rucak, jaja i krompir za veceru, jogurt kao uzina."
      : "Budget plan: oats + milk + banana breakfast, chicken-rice lunch, eggs + potatoes dinner, yogurt snack.";
  }
  if (q.includes("1000")) {
    return language === "sr"
      ? "Ideja za dorucak od 1000 kcal: ovsena kasa sa mlekom, kikiriki puter, banana, plus 3 jaja i integralni tost."
      : "1000 kcal breakfast idea: oatmeal with milk, peanut butter, banana, plus 3 eggs and whole wheat toast.";
  }
  if (q.includes("missing") || q.includes("nutrient")) {
    const fiberLow = nutritionToday.fiber < 25;
    const waterHint = profile.waterGoalMl > 0 ? (language === "sr" ? `Cilj je ${profile.waterGoalMl}ml vode.` : `Target ${profile.waterGoalMl}ml water.`) : language === "sr" ? "Povecajte unos vode." : "Increase water.";
    return fiberLow
      ? language === "sr"
        ? `Unos vlakana je nizak danas. Dodajte pasulj, ovsene pahuljice, voce i povrce. ${waterHint}`
        : `Fiber is low today. Add beans, oats, fruit, and vegetables. ${waterHint}`
      : language === "sr"
        ? `Odlican balans nutrijenata. ${waterHint}`
        : `Great nutrient balance. ${waterHint}`;
  }
  if (goal === "lose") {
    return language === "sr"
      ? "Fokusirajte se na obroke velikog volumena i visokog proteina: posno meso, povrce, supe, jogurt i voce."
      : "Focus on high-volume, high-protein meals: lean meats, vegetables, soups, yogurt, and fruit.";
  }
  if (goal === "gain") {
    return language === "sr"
      ? "Koristite kalorijski guste obroke: pirinac, ovas, mlecne proizvode, orasaste putere i cesce proteinske obroke."
      : "Use calorie-dense meals: rice, oats, dairy, nut butter, and frequent protein feedings.";
  }
  return language === "sr"
    ? "Ideja za balansiran dan: protein u svakom obroku, povrce dva puta, voda tokom dana i planirana uzina."
    : "Balanced day idea: protein at each meal, vegetables twice, water through the day, and a planned snack.";
};

export const generateDailyReview = (nutrition: NutritionValues, profile: UserProfile | null, waterMl: number, language: Language): string => {
  if (!profile) return language === "sr" ? "Profil nije dostupan." : "Profile unavailable.";
  const lines = [
    language === "sr" ? `Danas ste uneli ${Math.round(nutrition.calories)} kcal.` : `Today you consumed ${Math.round(nutrition.calories)} kcal.`,
    nutrition.protein >= profile.proteinGoal
      ? language === "sr"
        ? "Cilj proteina je ispunjen."
        : "Protein goal reached."
      : language === "sr"
        ? "Cilj proteina je ispod plana."
        : "Protein goal was below target.",
    nutrition.carbs >= profile.carbGoal
      ? language === "sr"
        ? "Cilj ugljenih hidrata je ispunjen."
        : "Carbs target reached."
      : language === "sr"
        ? "Ugljeni hidrati su blago ispod cilja."
        : "Carbs were slightly below target.",
    waterMl >= profile.waterGoalMl
      ? language === "sr"
        ? "Unos vode je dostigao cilj."
        : "Water intake met your goal."
      : language === "sr"
        ? "Unos vode je bio nizak."
        : "Water intake was low.",
    nutrition.fiber >= 25
      ? language === "sr"
        ? "Unos vlakana je bio dobar."
        : "Fiber intake was strong."
      : language === "sr"
        ? "Unos vlakana moze biti bolji."
        : "Fiber intake could be improved.",
    language === "sr"
      ? "Sutra: prioritet je dorucak bogat proteinom i 2 porcije povrca pre vecere."
      : "Tomorrow: prioritize one protein-rich breakfast and 2 servings of vegetables before dinner.",
  ];
  return lines.join(" ");
};

export const nextCoachMessage = (id: string, role: CoachMessage["role"], text: string): CoachMessage => ({
  id,
  role,
  text,
  createdAt: new Date().toISOString(),
});

export const duplicateMeal = (meal: Meal): Meal => ({
  ...meal,
  id: crypto.randomUUID(),
  createdAt: new Date().toISOString(),
});
