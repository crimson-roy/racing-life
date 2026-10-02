const DEFAULT_DOOR_STATE = Object.freeze({
  exists: true,
  open: false,
  broken: false,
  detached: false,
  jammed: false,
  blockedOutside: false,
  blockedInside: false,
  handlePresent: true
});

const DEFAULT_WINDOW_STATE = Object.freeze({
  exists: true,
  state: 'intact'
});

export class VehicleRuntimeState {
  constructor(profile) {
    this.profile = profile;

    this.speed = 0;
    this.grounded = true;
    this.flipped = false;
    this.tiltRadians = 0;

    this.doors = {};
    this.windows = {};
    this.seats = {};

    for (const doorId of Object.keys(profile?.doors ?? {})) {
      this.doors[doorId] = { ...DEFAULT_DOOR_STATE };
    }

    for (const windowId of Object.keys(profile?.windows ?? {})) {
      this.windows[windowId] = { ...DEFAULT_WINDOW_STATE };
    }

    for (const seatId of Object.keys(profile?.seats ?? {})) {
      this.seats[seatId] = {
        occupied: false,
        occupantId: null
      };
    }
  }

  getDoor(doorId) {
    return this.doors[doorId] ?? null;
  }

  getWindow(windowId) {
    return this.windows[windowId] ?? null;
  }

  getSeat(seatId) {
    return this.seats[seatId] ?? null;
  }

  patchDoor(doorId, patch) {
    const door = this.getDoor(doorId);

    if (!door) {
      return false;
    }

    Object.assign(door, patch);
    return true;
  }

  patchWindow(windowId, patch) {
    const windowState = this.getWindow(windowId);

    if (!windowState) {
      return false;
    }

    Object.assign(windowState, patch);
    return true;
  }

  setSeatOccupant(seatId, occupantId = null) {
    const seat = this.getSeat(seatId);

    if (!seat) {
      return false;
    }

    seat.occupied = Boolean(occupantId);
    seat.occupantId = occupantId;
    return true;
  }
}
