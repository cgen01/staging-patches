export interface PR {
  number: number;
  title: string;
  created_at: string;
  html_url: string;
  status: "open" | "merged";
  author: string;
}

export interface TertileData {
  label: string;
  key: string;
  count: number;
  prs: PR[];
}

// Returns the tertile key for a given date within a specific display year.
// T3 spans Oct {year} – Jan {year+1}, so Jan PRs belong to the *previous* year's T3.
export function getTertileForDate(dateStr: string, displayYear: number): "T1" | "T2" | "T3" | null {
  const date = new Date(dateStr);
  const prYear = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1; // 1-12

  // Jan of next year → this year's T3
  if (prYear === displayYear + 1 && month === 1) return "T3";
  // Jan of display year → belongs to previous year's T3, exclude
  if (prYear === displayYear && month === 1) return null;
  // Normal months within the display year
  if (prYear !== displayYear) return null;

  if (month >= 2 && month <= 5) return "T1";
  if (month >= 6 && month <= 9) return "T2";
  // Oct-Dec
  return "T3";
}

export function getTertileLabel(key: string): string {
  switch (key) {
    case "T1":
      return "T1 (Feb-May)";
    case "T2":
      return "T2 (Jun-Sep)";
    case "T3":
      return "T3 (Oct-Jan)";
    default:
      return key;
  }
}

export interface CumulativeRow {
  month: string;
  [yearKey: string]: number | string;
}

// Months ordered Feb-Jan to match tertile boundaries (T1: Feb-May, T2: Jun-Sep, T3: Oct-Jan)
const TERTILE_MONTHS = [
  { name: "Feb", month: 1 },
  { name: "Mar", month: 2 },
  { name: "Apr", month: 3 },
  { name: "May", month: 4 },
  { name: "Jun", month: 5 },
  { name: "Jul", month: 6 },
  { name: "Aug", month: 7 },
  { name: "Sep", month: 8 },
  { name: "Oct", month: 9 },
  { name: "Nov", month: 10 },
  { name: "Dec", month: 11 },
  { name: "Jan", month: 0 },
];

export function accumulateByMonthMultiYear(
  prsByYear: { year: number; prs: PR[] }[]
): CumulativeRow[] {
  // For each display year, count PRs per slot: Feb {year} - Dec {year} + Jan {year+1}
  const yearSlotCounts: Record<number, number[]> = {};
  for (const { year, prs } of prsByYear) {
    const slots = new Array(12).fill(0);
    for (const pr of prs) {
      const date = new Date(pr.created_at);
      const prYear = date.getUTCFullYear();
      const prMonth = date.getUTCMonth(); // 0-11

      // Jan of next year → last slot
      if (prYear === year + 1 && prMonth === 0) {
        slots[11]++;
      } else if (prYear === year && prMonth >= 1) {
        // Feb(1)=slot 0, Mar(2)=slot 1, ... Dec(11)=slot 10
        slots[prMonth - 1]++;
      }
    }
    yearSlotCounts[year] = slots;
  }

  return TERTILE_MONTHS.map((m, i) => {
    const row: CumulativeRow = { month: m.name };
    for (const { year } of prsByYear) {
      let running = 0;
      for (let j = 0; j <= i; j++) {
        running += yearSlotCounts[year][j];
      }
      row[String(year)] = running;
    }
    return row;
  });
}

export function groupByTertile(prs: PR[], displayYear: number): TertileData[] {
  const groups: Record<string, PR[]> = { T1: [], T2: [], T3: [] };

  for (const pr of prs) {
    const tertile = getTertileForDate(pr.created_at, displayYear);
    if (tertile) {
      groups[tertile].push(pr);
    }
  }

  return (["T1", "T2", "T3"] as const).map((key) => ({
    label: getTertileLabel(key),
    key,
    count: groups[key].length,
    prs: groups[key].sort((a, b) => {
      if (a.status !== b.status) return a.status === "open" ? -1 : 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }),
  }));
}
