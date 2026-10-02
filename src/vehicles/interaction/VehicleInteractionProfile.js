export class VehicleInteractionProfile {
  constructor({
    id,
    type = 'car',
    displayName = id,
    seats = {},
    doors = {},
    windows = {},
    traversal = {},
    animation = {}
  }) {
    if (!id) {
      throw new Error('VehicleInteractionProfile requires an id.');
    }

    this.id = id;
    this.type = type;
    this.displayName = displayName;
    this.seats = seats;
    this.doors = doors;
    this.windows = windows;
    this.traversal = traversal;
    this.animation = animation;
  }

  getSeat(seatId) {
    return this.seats[seatId] ?? null;
  }

  getDoor(doorId) {
    return this.doors[doorId] ?? null;
  }

  getWindow(windowId) {
    return this.windows[windowId] ?? null;
  }
}
