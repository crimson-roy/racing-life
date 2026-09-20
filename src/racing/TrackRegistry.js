export const TRACKS = {
  barcelona: {
    id: 'barcelona',
    name: 'Barcelona',
    path: '/assets/tracks/gt_racing_2_-_barcelona.glb',
    laps: 3,
    start: null,
    available: true
  },

  glen_canyon_dam: {
    id: 'glen_canyon_dam',
    name: 'Glen Canyon Dam',
    path: '/assets/tracks/gt_racing_2_-_glen_canyon_dam.glb',
    laps: 3,
    start: null,
    available: false
  },

  lake_como: {
    id: 'lake_como',
    name: 'Lake Como',
    path: '/assets/tracks/gt_racing_2_-_lake_como.glb',
    laps: 3,
    start: null,
    available: false
  },

  mount_rainier: {
    id: 'mount_rainier',
    name: 'Mount Rainier',
    path: '/assets/tracks/gt_racing_2_-_mount_rainier.glb',
    laps: 3,
    start: null,
    available: false
  },

  // Identity/content for race five remains TBD in canon. Keep the slot so the
  // confirmed first-to-three flow can represent five races without inventing
  // a circuit or silently falling back to Barcelona.
  track_05: {
    id: 'track_05',
    name: 'Fifth Track',
    path: '/assets/tracks/track_05.glb',
    laps: 3,
    start: null,
    available: false
  }
};

export function getTrack(trackId) {
  return TRACKS[trackId] ?? null;
}

export function isTrackAvailable(trackId) {
  return TRACKS[trackId]?.available === true;
}
