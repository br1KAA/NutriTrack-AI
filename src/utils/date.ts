export const todayKey = () => new Date().toISOString().slice(0, 10);

export const previousDateKey = (dateKey: string) => {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
};

export const lastNDates = (days: number): string[] => {
  const base = new Date();
  return Array.from({ length: days }, (_, index) => {
    const d = new Date(base);
    d.setDate(base.getDate() - (days - 1 - index));
    return d.toISOString().slice(0, 10);
  });
};
