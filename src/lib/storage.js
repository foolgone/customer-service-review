import { DEFAULT_ANNOTATION, STORAGE_KEYS } from './constants';

export function loadAnnotations() {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.annotations);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    return Object.entries(parsed).reduce((accumulator, [id, value]) => {
      accumulator[id] = normalizeAnnotation(value);
      return accumulator;
    }, {});
  } catch {
    return {};
  }
}

export function saveAnnotations(annotations) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEYS.annotations, JSON.stringify(annotations));
}

export function normalizeAnnotation(value) {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_ANNOTATION };
  }

  const labels = Array.isArray(value.labels) ? value.labels.filter(Boolean) : [];
  const comment = typeof value.comment === 'string' ? value.comment : '';
  const aiLabels = Array.isArray(value.aiLabels) ? value.aiLabels.filter(Boolean) : [];
  const aiReason = typeof value.aiReason === 'string' ? value.aiReason : '';
  const scoreValue = Number.parseInt(value.score, 10);
  const score = Number.isFinite(scoreValue) ? Math.min(5, Math.max(1, scoreValue)) : DEFAULT_ANNOTATION.score;
  const durationValue = Number(value.durationMs);
  const durationMs = Number.isFinite(durationValue) && durationValue > 0 ? Math.floor(durationValue) : 0;

  function normalizeTimestamp(timestamp) {
    if (typeof timestamp !== 'string' || !timestamp.trim()) {
      return '';
    }

    const parsed = new Date(timestamp);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
  }

  return {
    labels,
    comment,
    score,
    aiLabels,
    aiReason,
    aiAt: normalizeTimestamp(value.aiAt),
    reviewedAt: normalizeTimestamp(value.reviewedAt),
    updatedAt: normalizeTimestamp(value.updatedAt),
    startedAt: normalizeTimestamp(value.startedAt),
    durationMs
  };
}

export function readStoredTheme() {
  if (typeof window === 'undefined') {
    return 'system';
  }

  return window.localStorage.getItem(STORAGE_KEYS.theme) || 'system';
}

export function writeStoredTheme(theme) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEYS.theme, theme);
}
