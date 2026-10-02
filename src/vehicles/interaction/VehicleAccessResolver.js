export class VehicleAccessResolver {
  static canUseDoor(runtimeState, doorId, direction = 'outside') {
    const door = runtimeState?.getDoor?.(doorId);

    if (!door || !door.exists || door.detached) {
      return {
        usable: false,
        reason: 'door-missing'
      };
    }

    if (door.jammed) {
      return {
        usable: false,
        reason: 'door-jammed'
      };
    }

    if (
      direction === 'outside' &&
      door.blockedOutside
    ) {
      return {
        usable: false,
        reason: 'outside-blocked'
      };
    }

    if (
      direction === 'inside' &&
      door.blockedInside
    ) {
      return {
        usable: false,
        reason: 'inside-blocked'
      };
    }

    if (
      !door.open &&
      !door.handlePresent &&
      direction === 'outside'
    ) {
      return {
        usable: false,
        reason: 'outside-handle-missing'
      };
    }

    return {
      usable: true,
      reason: null
    };
  }

  static resolveSeatEntry(profile, runtimeState, targetSeatId) {
    const seat = profile?.getSeat?.(targetSeatId);
    const seatState = runtimeState?.getSeat?.(targetSeatId);

    if (!seat || !seatState) {
      return {
        ok: false,
        reason: 'seat-not-found',
        route: []
      };
    }

    if (seatState.occupied) {
      return {
        ok: false,
        reason: 'seat-occupied',
        route: []
      };
    }

    for (const doorId of seat.entryDoors ?? []) {
      const result = this.canUseDoor(
        runtimeState,
        doorId,
        'outside'
      );

      if (result.usable) {
        return {
          ok: true,
          reason: null,
          route: [
            {
              type: 'door-entry',
              doorId,
              seatId: targetSeatId
            }
          ]
        };
      }
    }

    return {
      ok: false,
      reason: 'no-valid-entry-route',
      route: []
    };
  }

  static resolveSeatExit(profile, runtimeState, sourceSeatId) {
    const seat = profile?.getSeat?.(sourceSeatId);

    if (!seat) {
      return {
        ok: false,
        reason: 'seat-not-found',
        route: []
      };
    }

    for (const doorId of seat.exitDoors ?? seat.entryDoors ?? []) {
      const result = this.canUseDoor(
        runtimeState,
        doorId,
        'inside'
      );

      if (result.usable) {
        return {
          ok: true,
          reason: null,
          route: [
            {
              type: 'door-exit',
              doorId,
              seatId: sourceSeatId
            }
          ]
        };
      }
    }

    return {
      ok: false,
      reason: 'no-valid-exit-route',
      route: []
    };
  }
}
