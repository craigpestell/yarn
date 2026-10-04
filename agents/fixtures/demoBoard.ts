import type { Doc } from '../../shared/schema'

/** Neutral public demo: the Dyatlov Pass incident. Hand-authored; no images (so no licence exposure). */
export const DEMO_TITLE = 'Dyatlov Pass incident'

// NOT a fetch time: the content was written from memory and its sources were NOT opened or verified by code.
// A human must open all three source URLs before publishing (Britannica may return 403 to bots).
const RETRIEVED = '2026-10-04T12:00:00.000Z'
const WIKI = { url: 'https://en.wikipedia.org/wiki/Dyatlov_Pass_incident', title: 'Dyatlov Pass incident (Wikipedia)', retrievedAt: RETRIEVED }
const BRITANNICA = { url: 'https://www.britannica.com/event/Dyatlov-Pass-incident', title: 'Dyatlov Pass incident (Britannica)', retrievedAt: RETRIEVED }
const NATURE = {
  url: 'https://www.nature.com/articles/s43247-021-00163-2',
  title: 'Gaume and Puzrin, Communications Earth & Environment (2021)',
  retrievedAt: RETRIEVED,
}

export const DEMO_DOC: Doc = {
  version: 1,
  widgets: [
    {
      id: 'expedition', type: 'paper', x: 0, y: 0, w: 250, h: 260, rotation: -2, status: 'verified', sources: [WIKI, BRITANNICA],
      data: { content: 'THE EXPEDITION\n\nIn late January 1959 a group of ten ski hikers set out in the northern Ural Mountains (then USSR). One, Yuri Yudin, turned back ill. The other nine did not return.' },
    },
    {
      id: 'tent', type: 'note', x: 340, y: 0, w: 200, h: 200, rotation: 3, status: 'verified', sources: [WIKI],
      data: { color: '#fef08a', text: 'THE TENT\n\nFound on 26 Feb 1959 on the slope of Kholat Syakhl: partly collapsed and cut open from the inside. Footprints led down toward the treeline.' },
    },
    {
      id: 'bodies', type: 'paper', x: 680, y: 0, w: 250, h: 260, rotation: 1, status: 'verified', sources: [WIKI, BRITANNICA],
      data: { content: 'THE DISCOVERIES\n\nFive hikers were found near the treeline in the weeks after the tent. Four more were found in May, buried in a ravine, some with severe internal injuries.' },
    },
    {
      id: 'inquiry', type: 'paper', x: 680, y: 340, w: 250, h: 260, rotation: -1, status: 'verified', sources: [WIKI],
      data: { content: 'THE 1959 INQUIRY\n\nSoviet investigators closed the case in May 1959, citing a "compelling natural force", and restricted access to the files.' },
    },
    {
      id: 'reopened', type: 'note', x: 340, y: 340, w: 200, h: 200, rotation: -3, status: 'disputed', sources: [WIKI],
      data: { color: '#bfdbfe', text: 'REOPENED\n\nRussian prosecutors reopened the inquiry in 2019 and later pointed to a snow slide as the most likely cause. Some relatives and researchers dispute this.' },
    },
    {
      id: 'avalanche', type: 'note', x: 0, y: 340, w: 200, h: 200, rotation: 2, status: 'claim', sources: [NATURE],
      data: { color: '#bbf7d0', text: 'AVALANCHE HYPOTHESIS\n\nA 2021 study argued that a delayed slab avalanche, triggered by the cut made for the tent, could explain the damage to the tent and some injuries.' },
    },
    {
      id: 'questions', type: 'note', x: 0, y: 680, w: 200, h: 200, rotation: -2, status: 'disputed', sources: [WIKI, BRITANNICA],
      data: { color: '#fecaca', text: 'OPEN QUESTIONS\n\nWhy the group left the tent in cold weather with little clothing, and how some injuries occurred, are still argued over.' },
    },
    {
      id: 'theories', type: 'note', x: 340, y: 680, w: 200, h: 200, rotation: 4, status: 'speculation', sources: [WIKI],
      data: { color: '#e9d5ff', text: 'OTHER THEORIES\n\nMilitary testing, infrasound and other ideas have been proposed. None has strong supporting evidence.' },
    },
  ],
  edges: [
    { id: 'e1', source: 'expedition', target: 'tent', color: '#e53e3e' },
    { id: 'e2', source: 'tent', target: 'bodies', color: '#e53e3e' },
    { id: 'e3', source: 'bodies', target: 'inquiry', color: '#e53e3e' },
    { id: 'e4', source: 'inquiry', target: 'reopened', color: '#e53e3e' },
    { id: 'e5', source: 'reopened', target: 'avalanche', color: '#e53e3e' },
    { id: 'e6', source: 'tent', target: 'avalanche', color: '#e53e3e' },
    { id: 'e7', source: 'avalanche', target: 'questions', color: '#e53e3e' },
    { id: 'e8', source: 'tent', target: 'theories', color: '#e53e3e' },
  ],
}
