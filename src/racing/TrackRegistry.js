export const TRACKS = {
  track_01: {
    id: 'track_01',
    name: 'Track 01',
    path: '/assets/tracks/track_01.glb',
    laps: 3,
    start: null
  },
  track_02: {
    id: 'track_02',
    name: 'Track 02',
    path: '/assets/tracks/track_02.glb',
    laps: 3,
    start: null
  },
  track_03: {
    id: 'track_03',
    name: 'Track 03',
    path: '/assets/tracks/track_03.glb',
    laps: 3,
    start: null
  },
  track_04: {
    id: 'track_04',
    name: 'Track 04',
    path: '/assets/tracks/track_04.glb',
    laps: 3,
    start: null
  },
  track_05: {
    id: 'track_05',
    name: 'Track 05',
    path: '/assets/tracks/track_05.glb',
    laps: 3,
    start: null
  }
};

export function getTrack(trackId) {
  return TRACKS[trackId] ?? TRACKS.track_01;
}
