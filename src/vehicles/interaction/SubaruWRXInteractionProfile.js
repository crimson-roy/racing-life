import { VehicleInteractionProfile } from './VehicleInteractionProfile.js';

export const SUBARU_WRX_INTERACTION_PROFILE =
  new VehicleInteractionProfile({
    id: 'subaru-wrx',
    type: 'car',
    displayName: 'Subaru WRX',

    seats: {
      driver: {
        role: 'driver',
        entryDoors: ['front-left'],
        exitDoors: ['front-left'],
        adjacentSeats: ['front-passenger']
      },

      'front-passenger': {
        role: 'passenger',
        entryDoors: ['front-right'],
        exitDoors: ['front-right'],
        adjacentSeats: ['driver']
      },

      'rear-left': {
        role: 'passenger',
        entryDoors: ['rear-left'],
        exitDoors: ['rear-left'],
        adjacentSeats: ['rear-right']
      },

      'rear-right': {
        role: 'passenger',
        entryDoors: ['rear-right'],
        exitDoors: ['rear-right'],
        adjacentSeats: ['rear-left']
      }
    },

    doors: {
      'front-left': {
        nodeNames: [
          'Animate_Door_FrontLeft',
          'DoorLF'
        ],
        openAngleDegrees: -68
      },

      'front-right': {
        nodeNames: [
          'Animate_Door_FrontRight',
          'DoorRF'
        ]
      },

      'rear-left': {
        nodeNames: [
          'Animate_Door_RearLeft',
          'DoorLR'
        ]
      },

      'rear-right': {
        nodeNames: [
          'Animate_Door_RearRight',
          'DoorRR'
        ]
      }
    },

    windows: {
      'front-left': {},
      'front-right': {},
      'rear-left': {},
      'rear-right': {},
      windshield: {},
      rear: {}
    },

    traversal: {
      seatToSeat: {
        'front-passenger>driver': {
          enabled: true,
          animation: 'slide-front-passenger-to-driver'
        },

        'driver>front-passenger': {
          enabled: true,
          animation: 'slide-driver-to-front-passenger'
        }
      }
    },

    animation: {
      enterDriver: 'Entering Car.glb',
      exitDriver: 'Exiting Car.glb',
      driving: 'Driving.glb'
    }
  });
