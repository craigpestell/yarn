import type { Doc } from '../../shared/schema'

/** Neutral public demo: the Dyatlov Pass incident. Hand-authored; its two images are public-domain Wikimedia Commons files, each with its Commons page as the licence source. */
export const DEMO_TITLE = 'Dyatlov Pass incident'

// NOT a fetch time: the content was written from memory and its sources were NOT opened or verified by code.
// A human must open all three source URLs before publishing.
const RETRIEVED = '2026-10-04T12:00:00.000Z'
const WIKI = { url: 'https://en.wikipedia.org/wiki/Dyatlov_Pass_incident', title: 'Dyatlov Pass incident (Wikipedia)', retrievedAt: RETRIEVED }
const HISTORY = { url: 'https://www.history.com/articles/dyatlov-pass-incident-soviet-hiker-death-mystery', title: 'The Dyatlov Pass Incident (History.com)', retrievedAt: RETRIEVED }
const NATURE = {
  url: 'https://www.nature.com/articles/s43247-020-00081-8',
  title: 'Gaume and Puzrin, Communications Earth & Environment (2021)',
  retrievedAt: RETRIEVED,
}

const TENT_PHOTO = {
  url: 'https://commons.wikimedia.org/wiki/File:Dyatlov_Pass_incident_02.jpg',
  title: 'File:Dyatlov Pass incident 02.jpg (Wikimedia Commons)',
  retrievedAt: RETRIEVED,
  license: 'Public domain',
  attribution: 'Soviet investigators, 1959 (unknown author), via Wikimedia Commons',
}
const CASE_FILE = {
  url: 'https://commons.wikimedia.org/wiki/File:Dyatlov.Volume_1.Original_cover.jpg',
  title: 'File:Dyatlov.Volume 1.Original cover.jpg (Wikimedia Commons)',
  retrievedAt: RETRIEVED,
  license: 'Public domain',
  attribution: 'Прокуратура Свердловской области, СССР, via Wikimedia Commons',
}

export const DEMO_DOC: Doc = {
  version: 1,
  widgets: [
    {
      id: 'expedition', type: 'paper', x: 0, y: 0, w: 250, h: 260, rotation: -2, status: 'verified', sources: [WIKI, HISTORY],
      data: { content: 'THE EXPEDITION\n\nIn late January 1959 a group of ten ski hikers set out in the northern Ural Mountains (then USSR). One, Yuri Yudin, turned back ill. The other nine did not return.' },
    },
    {
      id: 'tent', type: 'note', x: 340, y: 0, w: 200, h: 200, rotation: 3, status: 'verified', sources: [WIKI],
      data: { color: '#fef08a', text: 'THE TENT\n\nFound on 26 Feb 1959 on the slope of Kholat Syakhl: partly collapsed and cut open from the inside. Footprints led down toward the treeline.' },
    },
    {
      id: 'bodies', type: 'paper', x: 680, y: 0, w: 250, h: 260, rotation: 1, status: 'verified', sources: [WIKI, HISTORY],
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
      id: 'questions', type: 'note', x: 0, y: 680, w: 200, h: 200, rotation: -2, status: 'disputed', sources: [WIKI, HISTORY],
      data: { color: '#fecaca', text: 'OPEN QUESTIONS\n\nWhy the group left the tent in cold weather with little clothing, and how some injuries occurred, are still argued over.' },
    },
    {
      id: 'theories', type: 'note', x: 340, y: 680, w: 200, h: 200, rotation: 4, status: 'speculation', sources: [WIKI],
      data: { color: '#e9d5ff', text: 'OTHER THEORIES\n\nMilitary testing, infrasound and other ideas have been proposed. None has strong supporting evidence.' },
    },
    {
      id: 'tent-photo', type: 'photo', x: 340, y: -340, w: 220, h: 260, rotation: -3, sources: [TENT_PHOTO],
      data: { title: 'The tent, 26 Feb 1959', caption: 'Photographed by the search party', image: 'https://upload.wikimedia.org/wikipedia/commons/7/71/Dyatlov_Pass_incident_02.jpg' },
    },
    {
      id: 'case-file', type: 'photo', x: 680, y: 680, w: 220, h: 300, rotation: 2, sources: [CASE_FILE],
      data: { title: 'The case file', caption: 'Cover of volume 1 of the 1959 criminal case', image: 'https://upload.wikimedia.org/wikipedia/commons/6/6c/Dyatlov.Volume_1.Original_cover.jpg' },
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
    { id: 'e9', source: 'tent', target: 'tent-photo', color: '#e53e3e' },
    { id: 'e10', source: 'inquiry', target: 'case-file', color: '#e53e3e' },
  ],
}
