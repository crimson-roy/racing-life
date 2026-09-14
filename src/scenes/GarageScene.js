import Phaser from 'phaser';
import { careerState } from '../state/careerState.js';

const COLORS = {
  bg: 0x0b0e12,
  panel: 0x151a21,
  panel2: 0x1c222b,
  panel3: 0x11161c,
  border: 0x2a323d,
  text: 0xf4f6f8,
  muted: 0x8d97a3,
  accent: 0xe53935,
  accentHover: 0xff4f4a,
  gold: 0xffcf52,
  green: 0x42d17d,
  disabled: 0x303640
};

// Finite garage roster. Performance numbers are display-only for now.
const CARS = [
  { name: 'Crimson Bolt', color: 0xe53935, price: 0, speed: 52, acceleration: 50, handling: 50, braking: 48 },
  { name: 'Azure Sprint', color: 0x3388ff, price: 3000, speed: 54, acceleration: 52, handling: 51, braking: 50 },
  { name: 'Emerald Viper', color: 0x24b36b, price: 4500, speed: 56, acceleration: 54, handling: 53, braking: 51 },
  { name: 'Solar Rush', color: 0xf1c40f, price: 6000, speed: 58, acceleration: 56, handling: 54, braking: 53 },
  { name: 'Purple Comet', color: 0x9b59ff, price: 7500, speed: 60, acceleration: 58, handling: 56, braking: 55 },
  { name: 'Arctic GT', color: 0xf2f5f7, price: 9000, speed: 62, acceleration: 60, handling: 58, braking: 57 },
  { name: 'Obsidian X', color: 0x20242a, price: 10500, speed: 64, acceleration: 62, handling: 60, braking: 59 },
  { name: 'Copper Drift', color: 0xa66a3f, price: 12000, speed: 66, acceleration: 64, handling: 62, braking: 61 },
  { name: 'Orange Apex', color: 0xff7a18, price: 13500, speed: 68, acceleration: 66, handling: 64, braking: 63 }
];

function hex(value) {
  return `#${value.toString(16).padStart(6, '0')}`;
}

export class GarageScene extends Phaser.Scene {
  constructor() {
    super('GarageScene');
    this.carIndex = 0;
    this.isTransitioning = false;
  }

  create() {
    this.ensureGarageState();
    const savedIndex = Number.isInteger(careerState.garage.selectedCarIndex)
      ? careerState.garage.selectedCarIndex
      : 0;
    this.carIndex = Phaser.Math.Clamp(savedIndex, 0, CARS.length - 1);

    this.cameras.main.setBackgroundColor(hex(COLORS.bg));
    this.drawBackground();
    this.drawHeader();
    this.drawShowroom();
    this.drawFooter();
    this.setupInput();
    this.refreshGarage();
  }

  ensureGarageState() {
    if (!careerState.garage || typeof careerState.garage !== 'object') {
      careerState.garage = {};
    }

    if (!Array.isArray(careerState.garage.ownedCars)) {
      careerState.garage.ownedCars = [0];
    } else if (!careerState.garage.ownedCars.includes(0)) {
      careerState.garage.ownedCars.unshift(0);
    }

    if (!Number.isInteger(careerState.garage.selectedCarIndex)) {
      careerState.garage.selectedCarIndex = 0;
    }
  }

  drawBackground() {
    const glow = this.add.graphics();
    glow.fillStyle(0x151a21, 1);
    glow.fillCircle(790, 90, 260);
    glow.fillStyle(0x0b0e12, 1);
    glow.fillCircle(790, 90, 190);

    const grid = this.add.graphics();
    grid.lineStyle(1, 0x171c23, 0.55);
    for (let x = 0; x <= 960; x += 40) grid.lineBetween(x, 0, x, 690);
    for (let y = 0; y <= 690; y += 40) grid.lineBetween(0, y, 960, y);
  }

  drawHeader() {
    this.add.text(40, 30, 'GARAGE', {
      fontFamily: 'Arial', fontSize: 34, fontStyle: 'bold', color: hex(COLORS.text)
    });
    this.add.text(42, 73, 'CHOOSE YOUR RIDE', {
      fontFamily: 'Arial', fontSize: 13, fontStyle: 'bold', color: hex(COLORS.accent)
    });

    this.cashText = this.add.text(920, 34, '', {
      fontFamily: 'Arial', fontSize: 16, fontStyle: 'bold', color: hex(COLORS.gold)
    }).setOrigin(1, 0);

    this.availabilityText = this.add.text(920, 61, '', {
      fontFamily: 'Arial', fontSize: 12, fontStyle: 'bold', color: hex(COLORS.muted)
    }).setOrigin(1, 0);
  }

  drawShowroom() {
    const mainPanel = this.panel(40, 125, 880, 480);
    mainPanel.setDepth(2);

    this.add.text(40, 145, 'YOUR CARS', {
      fontFamily: 'Arial', fontSize: 12, fontStyle: 'bold', color: hex(COLORS.muted)
    });

    this.showcasePanel = this.add.rectangle(95, 210, 540, 320, COLORS.panel3)
      .setStrokeStyle(1, COLORS.border)
      .setDepth(4);

    // Car is intentionally shifted left to leave the stats area on the top-right.
    this.carArt = this.add.graphics().setDepth(12);
    this.carName = this.add.text(365, 482, '', {
      fontFamily: 'Arial', fontSize: 25, fontStyle: 'bold', color: hex(COLORS.text)
    }).setOrigin(0.5).setDepth(13);

    this.carNumber = this.add.text(365, 516, '', {
      fontFamily: 'Arial', fontSize: 11, fontStyle: 'bold', color: hex(COLORS.muted)
    }).setOrigin(0.5).setDepth(13);

    this.priceText = this.add.text(365, 542, '', {
      fontFamily: 'Arial', fontSize: 14, fontStyle: 'bold', color: hex(COLORS.gold)
    }).setOrigin(0.5).setDepth(13);

    this.statsPanel = this.panel(670, 155, 220, 156);
    this.statsPanel.setDepth(6);
    this.add.text(685, 170, 'PERFORMANCE', {
      fontFamily: 'Arial', fontSize: 11, fontStyle: 'bold', color: hex(COLORS.muted)
    });

    this.statTexts = {
      speed: this.add.text(685, 198, '', { fontFamily: 'Arial', fontSize: 12, color: hex(COLORS.text) }),
      acceleration: this.add.text(685, 220, '', { fontFamily: 'Arial', fontSize: 12, color: hex(COLORS.text) }),
      handling: this.add.text(685, 242, '', { fontFamily: 'Arial', fontSize: 12, color: hex(COLORS.text) }),
      braking: this.add.text(685, 264, '', { fontFamily: 'Arial', fontSize: 12, color: hex(COLORS.text) })
    };

    this.leftArrow = this.arrowButton(150, 350, '‹', () => this.changeCar(-1));
    this.rightArrow = this.arrowButton(580, 350, '›', () => this.changeCar(1));

    this.add.text(365, 165, '←  →  OR  CLICK THE ARROWS TO BROWSE', {
      fontFamily: 'Arial', fontSize: 11, fontStyle: 'bold', color: hex(COLORS.muted)
    }).setOrigin(0.5, 0);

    this.statusText = this.add.text(365, 568, '', {
      fontFamily: 'Arial', fontSize: 11, fontStyle: 'bold', color: hex(COLORS.muted)
    }).setOrigin(0.5).setDepth(13);
  }

  arrowButton(x, y, label, callback) {
    const bg = this.add.rectangle(x, y, 58, 76, COLORS.panel2)
      .setStrokeStyle(1, COLORS.border)
      .setOrigin(0.5)
      .setDepth(20)
      .setInteractive({ useHandCursor: true });

    const text = this.add.text(x, y - 4, label, {
      fontFamily: 'Arial', fontSize: 48, fontStyle: 'bold', color: hex(COLORS.text)
    }).setOrigin(0.5).setDepth(21);

    bg.on('pointerover', () => {
      if (bg.input?.enabled) {
        bg.setFillStyle(COLORS.accent);
        text.setColor('#ffffff');
      }
    });
    bg.on('pointerout', () => bg.setFillStyle(COLORS.panel2));
    bg.on('pointerdown', callback);

    bg.labelText = text;
    return bg;
  }

  drawCarAt(graphics, cx, cy, car, alpha = 1, scale = 1) {
    const body = car.color;
    const dark = 0x151a21;
    const glass = 0x9bd7ee;

    graphics.setAlpha(alpha);
    graphics.setScale(scale);
    graphics.fillStyle(0x07090c, 0.5);
    graphics.fillEllipse(cx, cy + 72, 245, 30);

    graphics.fillStyle(body, 1);
    graphics.fillRoundedRect(cx - 115, cy - 18, 230, 90, 28);
    graphics.fillRoundedRect(cx - 88, cy - 60, 176, 62, 30);

    graphics.fillStyle(glass, 0.95);
    graphics.fillRoundedRect(cx - 66, cy - 45, 58, 40, 16);
    graphics.fillRoundedRect(cx + 8, cy - 45, 58, 40, 16);

    graphics.fillStyle(0xffffff, 0.85);
    graphics.fillRect(cx - 5, cy - 14, 10, 72);
    graphics.fillStyle(body, 1);
    graphics.fillRoundedRect(cx - 125, cy + 10, 20, 42, 10);
    graphics.fillRoundedRect(cx + 105, cy + 10, 20, 42, 10);

    graphics.fillStyle(dark, 1);
    graphics.fillCircle(cx - 82, cy + 62, 27);
    graphics.fillCircle(cx + 82, cy + 62, 27);
    graphics.fillStyle(0x707883, 1);
    graphics.fillCircle(cx - 82, cy + 62, 11);
    graphics.fillCircle(cx + 82, cy + 62, 11);
  }

  renderCar(direction = 1, animate = true) {
    const car = CARS[this.carIndex];

    if (!this.carArt) return;
    this.carArt.clear();
    this.carArt.setPosition(0, 0);
    this.carArt.setScale(1);
    this.carArt.setAlpha(1);

    // Keep the art centered around this left-shifted showroom position.
    this.drawCarAt(this.carArt, 365, 342, car, 1, 1);

    this.carName.setText(car.name);
    this.carName.setColor(hex(car.color === 0xf2f5f7 ? COLORS.text : car.color));
    this.carNumber.setText(`${String(this.carIndex + 1).padStart(2, '0')}  /  ${String(CARS.length).padStart(2, '0')}`);
    this.priceText.setText(car.price === 0 ? 'STARTER CAR  •  FREE' : `PRICE  $${car.price.toLocaleString()}`);

    this.statTexts.speed.setText(`Speed         ${car.speed}/100`);
    this.statTexts.acceleration.setText(`Acceleration  ${car.acceleration}/100`);
    this.statTexts.handling.setText(`Handling      ${car.handling}/100`);
    this.statTexts.braking.setText(`Braking       ${car.braking}/100`);

    const owned = careerState.garage.ownedCars.includes(this.carIndex);
    this.statusText.setText(owned ? 'OWNED' : (careerState.money >= car.price ? 'AVAILABLE TO BUY' : 'LOCKED'));
    this.statusText.setColor(owned ? hex(COLORS.green) : hex(COLORS.muted));

    this.updateArrows();
    this.updateBuyButton();

    if (!animate) return;

    this.isTransitioning = true;
    const slide = direction > 0 ? 65 : -65;
    const oldX = 0;

    // Subtle slide + fade out, then the incoming car slides/fades/scales into place.
    this.carArt.setDepth(12);
    this.carArt.setX(oldX);
    this.carArt.setAlpha(1);
    this.carArt.setScale(1);

    this.tweens.add({
      targets: this.carArt,
      x: oldX - slide,
      alpha: 0,
      scale: 0.92,
      duration: 240,
      ease: 'Sine.easeIn',
      onComplete: () => {
        this.carArt.setX(oldX + slide);
        this.carArt.setAlpha(0);
        this.carArt.setScale(1.08);

        this.tweens.add({
          targets: this.carArt,
          x: oldX,
          alpha: 1,
          scale: 1,
          duration: 520,
          ease: 'Cubic.easeOut',
          onComplete: () => { this.isTransitioning = false; }
        });
      }
    });
  }

  changeCar(direction) {
    if (this.isTransitioning) return;

    const nextIndex = this.carIndex + direction;
    if (nextIndex < 0 || nextIndex >= CARS.length) return; // finite carousel, no wraparound

    this.carIndex = nextIndex;
    careerState.garage.selectedCarIndex = this.carIndex;
    this.renderCar(direction, true);
  }

  refreshGarage() {
    this.cashText.setText(`CASH  $${careerState.money.toLocaleString()}`);
    this.availabilityText.setText(`${careerState.garage.ownedCars.length} / ${CARS.length} CARS OWNED`);
    this.renderCar(1, false);
  }

  updateArrows() {
    const canGoLeft = this.carIndex > 0 && !this.isTransitioning;
    const canGoRight = this.carIndex < CARS.length - 1 && !this.isTransitioning;
    this.setArrowState(this.leftArrow, canGoLeft);
    this.setArrowState(this.rightArrow, canGoRight);
  }

  setArrowState(button, enabled) {
    button.input.enabled = enabled;
    button.setAlpha(enabled ? 1 : 0.35);
    button.labelText.setAlpha(enabled ? 1 : 0.35);
  }

  buySelectedCar() {
    const car = CARS[this.carIndex];
    if (careerState.garage.ownedCars.includes(this.carIndex)) return;

    if (careerState.money < car.price) {
      this.flashStatus('INSUFFICIENT FUNDS', COLORS.accent);
      return;
    }

    careerState.money -= car.price;
    careerState.garage.ownedCars.push(this.carIndex);
    this.cashText.setText(`CASH  $${careerState.money.toLocaleString()}`);
    this.availabilityText.setText(`${careerState.garage.ownedCars.length} / ${CARS.length} CARS OWNED`);
    this.flashStatus('CAR PURCHASED', COLORS.green);
    this.updateBuyButton();
  }

  flashStatus(message, color) {
    this.statusText.setText(message);
    this.statusText.setColor(hex(color));
    this.tweens.add({
      targets: this.statusText,
      alpha: 0,
      duration: 100,
      yoyo: true,
      repeat: 3,
      hold: 80,
      onComplete: () => {
        const owned = careerState.garage.ownedCars.includes(this.carIndex);
        this.statusText.setText(owned ? 'OWNED' : (careerState.money >= CARS[this.carIndex].price ? 'AVAILABLE TO BUY' : 'LOCKED'));
        this.statusText.setColor(owned ? hex(COLORS.green) : hex(COLORS.muted));
        this.statusText.setAlpha(1);
      }
    });
  }

  updateBuyButton() {
    if (!this.buyButton) return;

    const car = CARS[this.carIndex];
    const owned = careerState.garage.ownedCars.includes(this.carIndex);
    const canBuy = !owned && careerState.money >= car.price;

    if (this.buyButtonText) {
      this.buyButtonText.setText(owned ? 'OWNED' : `BUY CAR  $${car.price.toLocaleString()}`);
      this.buyButtonText.setColor(hex(owned ? COLORS.muted : COLORS.text));
    }
    this.buyButton.setFillStyle(owned ? COLORS.disabled : (canBuy ? COLORS.accent : COLORS.disabled));
    this.buyButton.input.enabled = !owned && canBuy;
    this.buyButton.setAlpha(owned ? 0.8 : 1);
  }

  setupInput() {
    this.input.keyboard.on('keydown-LEFT', () => this.changeCar(-1));
    this.input.keyboard.on('keydown-RIGHT', () => this.changeCar(1));
    this.input.keyboard.on('keydown-ESC', () => this.scene.start('HubScene'));
  }

  drawFooter() {
    this.sellButton = this.bottomButton(40, 615, 220, 42, 'SELL CAR  •  COMING SOON', false, () => {});
    this.buyButton = this.bottomButton(280, 615, 260, 42, 'BUY CAR', true, () => this.buySelectedCar(), 'buyButtonText');
    this.upgradeButton = this.bottomButton(560, 615, 220, 42, 'UPGRADES  •  COMING SOON', false, () => {});

    this.actionButton(920, 670, 150, 34, '←  CAREER', () => this.scene.start('HubScene'));

    this.add.text(40, 666, '← / → = Change Car     ESC = Return to Career Hub', {
      fontFamily: 'Arial', fontSize: 11, color: hex(COLORS.muted)
    });
  }

  bottomButton(x, y, w, h, label, enabled, callback, textProperty) {
    const bg = this.add.rectangle(x, y, w, h, enabled ? COLORS.accent : COLORS.panel2)
      .setOrigin(0)
      .setStrokeStyle(1, enabled ? COLORS.accentHover : COLORS.border)
      .setInteractive({ useHandCursor: enabled });

    const text = this.add.text(x + w / 2, y + h / 2, label, {
      fontFamily: 'Arial', fontSize: 11, fontStyle: 'bold', color: hex(enabled ? COLORS.text : COLORS.muted)
    }).setOrigin(0.5);

    if (textProperty) this[textProperty] = text;

    if (enabled) {
      bg.on('pointerover', () => bg.setFillStyle(COLORS.accentHover));
      bg.on('pointerout', () => bg.setFillStyle(COLORS.accent));
      bg.on('pointerdown', callback);
    }

    return bg;
  }

  panel(x, y, w, h) {
    const g = this.add.graphics();
    g.fillStyle(COLORS.panel, 1);
    g.fillRoundedRect(x, y, w, h, 16);
    g.lineStyle(1, COLORS.border, 1);
    g.strokeRoundedRect(x, y, w, h, 16);
    return g;
  }

  actionButton(x, y, w, h, label, callback) {
    const bg = this.add.rectangle(x, y, w, h, COLORS.accent)
      .setOrigin(1, 1)
      .setDepth(10)
      .setInteractive({ useHandCursor: true });
    this.add.text(x - w / 2, y - h / 2, label, {
      fontFamily: 'Arial', fontSize: 12, fontStyle: 'bold', color: hex(COLORS.text)
    }).setOrigin(0.5).setDepth(11);
    bg.on('pointerover', () => bg.setFillStyle(COLORS.accentHover));
    bg.on('pointerout', () => bg.setFillStyle(COLORS.accent));
    bg.on('pointerdown', callback);
    return bg;
  }
}
