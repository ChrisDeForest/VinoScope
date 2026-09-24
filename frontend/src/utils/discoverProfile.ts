import type { RecommendationAnswers } from "../types/wine";

const STORAGE_KEY = "vinoscope-discover-profile";

export function clearStoredProfile(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* Storage can be unavailable. */ }
}

export function getStoredProfile(): RecommendationAnswers | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as RecommendationAnswers;
  } catch {
    return null;
  }
}

export function setStoredProfile(answers: RecommendationAnswers): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
  } catch {
    // localStorage unavailable — the profile just won't persist this session
  }
}
