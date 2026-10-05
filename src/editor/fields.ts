import { LIMITS, type WidgetType } from '../../shared/schema'

export interface Field {
  key: string
  label: string
  max: number
  multiline?: boolean
}

/** One generic field table per widget type: drives both the Inspector editors and the read-only Detail view. */
export const FIELDS: Record<WidgetType, Field[]> = {
  photo: [
    { key: 'title', label: 'Title', max: LIMITS.photoTitle },
    { key: 'caption', label: 'Caption', max: LIMITS.caption, multiline: true },
  ],
  note: [{ key: 'text', label: 'Text', max: LIMITS.noteText, multiline: true }],
  wanted: [
    { key: 'name', label: 'Name', max: LIMITS.short },
    { key: 'alias', label: 'Alias', max: LIMITS.short },
    { key: 'crime', label: 'Crime', max: LIMITS.short },
    { key: 'description', label: 'Description', max: LIMITS.description, multiline: true },
    { key: 'reward', label: 'Reward', max: LIMITS.short },
  ],
  paper: [{ key: 'content', label: 'Content', max: LIMITS.paperContent, multiline: true }],
}
export const STATUSES = ['claim', 'disputed', 'verified', 'speculation'] as const
