import { useCallback, useMemo } from "react";
import { useLocalStorage } from "./useLocalStorage";
import type { AppState, DailyLog } from "../types";
import { todayKey } from "../utils/date";

const initialLog = (date: string): DailyLog => ({
  date,
  meals: [],
  waterMl: 0,
  workouts: [],
  sleep: [],
  supplements: [],
  weights: [],
  measurements: [],
});

const initialState = (): AppState => {
  const today = todayKey();
  return {
    profile: null,
    settings: { language: "en", theme: "dark", unitSystem: "metric" },
    dailyLogs: { [today]: initialLog(today) },
    fridgeItems: [],
    shoppingList: [],
    favoriteMealIds: [],
    coachMessages: [],
    generatedMealPlan: [],
  };
};

export const useNutriTrack = () => {
  const [state, setState] = useLocalStorage<AppState>("nutritrack-ai-state", initialState());
  const today = todayKey();

  const todayLog = state.dailyLogs[today] ?? initialLog(today);

  const ensureToday = useCallback(() => {
    setState((prev) => {
      if (prev.dailyLogs[today]) return prev;
      return {
        ...prev,
        dailyLogs: {
          ...prev.dailyLogs,
          [today]: initialLog(today),
        },
      };
    });
  }, [setState, today]);

  const updateToday = useCallback((updater: (log: DailyLog) => DailyLog) => {
    setState((prev) => {
      const current = prev.dailyLogs[today] ?? initialLog(today);
      return {
        ...prev,
        dailyLogs: {
          ...prev.dailyLogs,
          [today]: updater(current),
        },
      };
    });
  }, [setState, today]);

  const allLogs = useMemo(() => Object.values(state.dailyLogs).sort((a, b) => a.date.localeCompare(b.date)), [state.dailyLogs]);

  return {
    state,
    setState,
    today,
    todayLog,
    allLogs,
    ensureToday,
    updateToday,
  };
};
