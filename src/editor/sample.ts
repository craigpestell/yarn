import { DocSchema } from '../../shared/schema'

export const SAMPLE_TITLE = 'The Lantern Island Mystery'

/** Neutral, entirely fictional demo board loaded on first run. */
export const SAMPLE_DOC = DocSchema.parse({
  version: 1,
  widgets: [
    { id: 'w-keeper', type: 'photo', x: 60, y: 60, w: 200, h: 240, rotation: -4, data: { title: 'The keeper', caption: 'Last seen Tuesday' } },
    { id: 'w-lamp', type: 'photo', x: 820, y: 40, w: 200, h: 240, rotation: 6, data: { title: 'Lantern room', caption: 'Lamp found dark' } },
    { id: 'w-note1', type: 'note', x: 440, y: 300, w: 200, h: 200, rotation: 3, data: { text: 'Logbook ends mid-sentence.\nWho wrote the last line?', color: '#fef08a' } },
    { id: 'w-wanted', type: 'wanted', x: 1220, y: 260, w: 220, h: 300, rotation: -2, data: { name: 'Captain Ardent', alias: 'The Tide Merchant', crime: 'Selling fog charts', description: 'Last seen with a brass compass and a borrowed boat.', reward: '50 silver gulls' } },
    { id: 'w-paper', type: 'paper', x: 60, y: 520, w: 250, h: 300, rotation: 1, data: { content: 'Ferry timetable\n\nMon: 9:10\nTue: cancelled\nWed: 9:10 (late)' }, sources: [{ url: 'https://example.com/fictional/ferry', title: 'Fictional ferry timetable', retrievedAt: '2026-01-01T00:00:00Z' }] },
    { id: 'w-note2', type: 'note', x: 460, y: 640, w: 200, h: 200, rotation: -3, status: 'speculation', data: { text: 'Was the ferry cancelled on purpose?', color: '#bfdbfe' } },
    { id: 'w-photo3', type: 'photo', x: 860, y: 500, w: 200, h: 240, rotation: 5, data: { title: 'Harbor at dawn', caption: 'Footprints on the pier' } },
  ],
  edges: [
    { id: 'e1', source: 'w-keeper', target: 'w-note1' },
    { id: 'e2', source: 'w-note1', target: 'w-lamp' },
    { id: 'e3', source: 'w-lamp', target: 'w-wanted' },
    { id: 'e4', source: 'w-keeper', target: 'w-paper' },
    { id: 'e5', source: 'w-paper', target: 'w-note2' },
    { id: 'e6', source: 'w-note2', target: 'w-photo3' },
    { id: 'e7', source: 'w-photo3', target: 'w-wanted' },
  ],
})
