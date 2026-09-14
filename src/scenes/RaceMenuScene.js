import Phaser from 'phaser';
import { careerState } from '../state/careerState.js';

const MAPS = [
  { id: 'desert', name: 'DESERT RUN', subtitle: 'Dust, heat & long straights', sky: 0xb98552, ground: 0xcda56a, road: 0x343434, accent: 0xe7b75b },
  { id: 'city', name: 'CITY CIRCUIT', subtitle: 'Fast streets & tight corners', sky: 0x1e2935, ground: 0x34424e, road: 0x2f3237, accent: 0xe53935 },
  { id: 'forest', name: 'FOREST LOOP', subtitle: 'Technical bends through the trees', sky: 0x2a4b35, ground: 0x477247, road: 0x303336, accent: 0x5bc47b },
  { id: 'mountain', name: 'MOUNTAIN PASS', subtitle: 'Elevation, curves & danger', sky: 0x405269, ground: 0x6f7478, road: 0x303236, accent: 0x8ab4ff }
];

function hex(value) { return `#${value.toString(16).padStart(6, '0')}`; }

export class RaceMenuScene extends Phaser.Scene {
  constructor() {
    super('RaceMenuScene');
  }

  create() {
    this.cameras.main.setBackgroundColor('#0b0e12');
    this.drawBackground();
    this.drawHeader();
    this.drawMapCards();
    this.drawFooter();
  }

  drawBackground() {
    const glow = this.add.graphics();
    glow.fillStyle(0x151a21, 1);
    glow.fillCircle(820, 90, 270);
    glow.fillStyle(0x0b0e12, 1);
    glow.fillCircle(820, 90, 195);

    const grid = this.add.graphics();
    grid.lineStyle(1, 0x171c23, 0.55);
    for (let x = 0; x <= 960; x += 40) grid.lineBetween(x, 0, x, 690);
    for (let y = 0; y <= 690; y += 40) grid.lineBetween(0, y, 960, y);
  }

  drawHeader() {
    this.add.text(40, 30, 'RACE MENU', {
      fontFamily: 'Arial', fontSize: 34, fontStyle: 'bold', color: '#f4f6f8'
    });
    this.add.text(42, 73, 'CHOOSE YOUR TRACK', {
      fontFamily: 'Arial', fontSize: 13, fontStyle: 'bold', color: '#e53935'
    });
    this.add.text(920, 34, `CASH  $${careerState.money.toLocaleString()}`, {
      fontFamily: 'Arial', fontSize: 16, fontStyle: 'bold', color: '#ffcf52'
    }).setOrigin(1, 0);
    this.add.text(920, 61, '5 RACERS  •  3 LAPS', {
      fontFamily: 'Arial', fontSize: 12, fontStyle: 'bold', color: '#8d97a3'
    }).setOrigin(1, 0);
  }

  drawMapCards() {
    const positions = [
      { x: 40, y: 135 },
      { x: 490, y: 135 },
      { x: 40, y: 355 },
      { x: 490, y: 355 }
    ];

    MAPS.forEach((map, i) => this.mapCard(map, positions[i].x, positions[i].y));
  }

  mapCard(map, x, y) {
    const w = 430;
    const h = 190;
    const panel = this.add.rectangle(x, y, w, h, 0x151a21)
      .setOrigin(0)
      .setStrokeStyle(1, 0x2a323d)
      .setInteractive({ useHandCursor: true });

    // Mini track preview.
    const preview = this.add.graphics();
    preview.fillStyle(map.sky, 1);
    preview.fillRect(x + 15, y + 15, w - 30, 105);
    preview.fillStyle(map.ground, 1);
    preview.fillRect(x + 15, y + 15, w - 30, 105);
    preview.fillStyle(map.road, 1);
    preview.fillRoundedRect(x + 75, y + 29, 285, 78, 34);
    preview.lineStyle(2, map.accent, 0.9);
    preview.strokeRoundedRect(x + 75, y + 29, 285, 78, 34);

    this.add.text(x + 20, y + 132, map.name, {
      fontFamily: 'Arial', fontSize: 19, fontStyle: 'bold', color: '#f4f6f8'
    });
    this.add.text(x + 20, y + 160, map.subtitle, {
      fontFamily: 'Arial', fontSize: 11, color: '#8d97a3'
    });
    this.add.text(x + w - 22, y + 151, 'SELECT  →', {
      fontFamily: 'Arial', fontSize: 11, fontStyle: 'bold', color: hex(map.accent)
    }).setOrigin(1, 0);

    panel.on('pointerover', () => panel.setFillStyle(0x1c222b));
    panel.on('pointerout', () => panel.setFillStyle(0x151a21));
    panel.on('pointerdown', () => this.scene.start('RacingScene', { mapId: map.id }));
  }

  drawFooter() {
    const back = this.add.rectangle(40, 625, 150, 40, 0x1c222b)
      .setOrigin(0)
      .setStrokeStyle(1, 0x2a323d)
      .setInteractive({ useHandCursor: true });
    this.add.text(115, 645, '←  CAREER', {
      fontFamily: 'Arial', fontSize: 12, fontStyle: 'bold', color: '#f4f6f8'
    }).setOrigin(0.5);
    back.on('pointerover', () => back.setFillStyle(0x2a323d));
    back.on('pointerout', () => back.setFillStyle(0x1c222b));
    back.on('pointerdown', () => this.scene.start('HubScene'));

    this.add.text(920, 638, 'ESC  =  Return to Career Hub', {
      fontFamily: 'Arial', fontSize: 11, color: '#8d97a3'
    }).setOrigin(1, 0);
    this.input.keyboard.once('keydown-ESC', () => this.scene.start('HubScene'));
  }
}
