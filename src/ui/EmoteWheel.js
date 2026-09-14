export class EmoteWheel {
  constructor(options = {}) {
    this.onSelect =
      options.onSelect ??
      (() => {});

    this.isOpen = false;

    this.emotes = [
  {
    id: 'Sitting1',
    label: 'Sitting',
    file: 'Sitting (1).glb'
  },
  {
    id: 'Sitting',
    label: 'Sit',
    file: 'Sitting.glb'
  },
  {
    id: 'Breakdance',
    label: 'Breakdance',
    file: 'Breakdance Footwork To Idle.glb'
  },
  {
    id: 'RunSwing',
    label: 'Run & Swing',
    file: 'Run And Swing.glb'
  },
  {
    id: 'HipHop2',
    label: 'Hip Hop',
    file: 'Hip Hop Dancing (2).glb'
  },
  {
    id: 'Dancing',
    label: 'Dance',
    file: 'Dancing.glb'
  },
  {
    id: 'HipHop1',
    label: 'Hip Hop 1',
    file: 'Hip Hop Dancing (1).glb'
  },
  {
    id: 'SillyDance',
    label: 'Silly Dance',
    file: 'Silly Dancing.glb'
  }
];

    this.create();
    this.bindEvents();
  }

  // ============================================================
  // CREATE WHEEL
  // ============================================================

  create() {
    // ----------------------------------------------------------
    // Full-screen overlay
    // ----------------------------------------------------------

    this.overlay =
      document.createElement('div');

    this.overlay.style.position = 'fixed';
    this.overlay.style.inset = '0';
    this.overlay.style.display = 'none';
    this.overlay.style.alignItems = 'center';
    this.overlay.style.justifyContent = 'center';
    this.overlay.style.background =
      'rgba(0, 0, 0, 0.30)';
    this.overlay.style.zIndex = '1000';
    this.overlay.style.touchAction = 'none';

    document.body.appendChild(
      this.overlay
    );

    // ----------------------------------------------------------
    // Wheel
    // ----------------------------------------------------------

    this.wheel =
      document.createElement('div');

    this.wheel.style.position = 'relative';
    this.wheel.style.width = '420px';
    this.wheel.style.height = '420px';
    this.wheel.style.borderRadius = '50%';

    this.wheel.style.background =
      'rgba(12, 12, 18, 0.94)';

    this.wheel.style.border =
      '3px solid rgba(255,255,255,0.22)';

    this.wheel.style.boxShadow =
      '0 20px 60px rgba(0,0,0,0.55)';

    this.overlay.appendChild(
      this.wheel
    );

    // ----------------------------------------------------------
    // Center
    // ----------------------------------------------------------

    this.center =
      document.createElement('div');

    this.center.style.position = 'absolute';
    this.center.style.left = '50%';
    this.center.style.top = '50%';
    this.center.style.transform =
      'translate(-50%, -50%)';

    this.center.style.width = '115px';
    this.center.style.height = '115px';

    this.center.style.borderRadius = '50%';

    this.center.style.display = 'flex';
    this.center.style.alignItems = 'center';
    this.center.style.justifyContent = 'center';

    this.center.style.background =
      'rgba(35,35,45,0.95)';

    this.center.style.border =
      '2px solid rgba(255,255,255,0.20)';

    this.center.style.color = 'white';
    this.center.style.fontFamily =
      'Arial, sans-serif';

    this.center.style.fontSize = '15px';
    this.center.style.fontWeight = 'bold';

    this.center.textContent =
      'EMOTES';

    this.wheel.appendChild(
      this.center
    );

    // ----------------------------------------------------------
    // Emote buttons
    // ----------------------------------------------------------

    this.buttons = [];

    const radius = 155;
    const count = this.emotes.length;

    for (
      let i = 0;
      i < count;
      i++
    ) {
      const emote =
        this.emotes[i];

      const angle =
        (-Math.PI / 2) +
        (i / count) *
        Math.PI * 2;

      const x =
        Math.cos(angle) *
        radius;

      const y =
        Math.sin(angle) *
        radius;

      const button =
        document.createElement('button');

      button.type = 'button';

      button.textContent =
        emote.label;

      button.dataset.emote =
        emote.id;

      button.style.position =
        'absolute';

      button.style.left =
        '50%';

      button.style.top =
        '50%';

      button.style.transform =
        `translate(-50%, -50%) translate(${x}px, ${y}px)`;

      button.style.width = '105px';
      button.style.height = '58px';

      button.style.borderRadius =
        '14px';

      button.style.border =
        '1px solid rgba(255,255,255,0.22)';

      button.style.background =
        'rgba(30,30,40,0.96)';

      button.style.color =
        'white';

      button.style.fontFamily =
        'Arial, sans-serif';

      button.style.fontSize =
        '13px';

      button.style.fontWeight =
        'bold';

      button.style.cursor =
        'pointer';

      button.style.userSelect =
        'none';

      button.style.touchAction =
        'manipulation';

      button.style.transition =
        'transform 0.12s ease, background 0.12s ease';

      // --------------------------------------------------------
      // Hover
      // --------------------------------------------------------

      button.addEventListener(
        'pointerenter',
        () => {
          button.style.background =
            'rgba(75,75,95,0.98)';

          button.style.transform =
            `translate(-50%, -50%) translate(${x}px, ${y}px) scale(1.10)`;

          this.center.textContent =
            emote.label;
        }
      );

      button.addEventListener(
        'pointerleave',
        () => {
          button.style.background =
            'rgba(30,30,40,0.96)';

          button.style.transform =
            `translate(-50%, -50%) translate(${x}px, ${y}px)`;

          this.center.textContent =
            'EMOTES';
        }
      );

      // --------------------------------------------------------
      // Click / touch
      // --------------------------------------------------------

      button.addEventListener(
        'pointerdown',
        (event) => {
          event.stopPropagation();

          this.select(
            emote
          );
        }
      );

      this.wheel.appendChild(
        button
      );

      this.buttons.push(
        button
      );
    }
  }

  // ============================================================
  // EVENTS
  // ============================================================

  bindEvents() {
    // ----------------------------------------------------------
    // E = open / close
    // ----------------------------------------------------------

    window.addEventListener(
      'keydown',
      (event) => {
        if (
          event.code === 'KeyE' &&
          !event.repeat
        ) {
          event.preventDefault();

          this.toggle();
        }

        if (
          event.code === 'Escape'
        ) {
          this.close();
        }
      }
    );

    // ----------------------------------------------------------
    // Click / tap outside wheel
    // ----------------------------------------------------------

    this.overlay.addEventListener(
      'pointerdown',
      (event) => {
        if (
          event.target ===
          this.overlay
        ) {
          this.close();
        }
      }
    );
  }

  // ============================================================
  // SELECT EMOTE
  // ============================================================

  select(emote) {
    this.close();

    this.onSelect(
      emote
    );
  }

  // ============================================================
  // OPEN
  // ============================================================

  open() {
    if (this.isOpen) {
      return;
    }

    this.isOpen = true;

    this.overlay.style.display =
      'flex';

    this.center.textContent =
      'EMOTES';
  }

  // ============================================================
  // CLOSE
  // ============================================================

  close() {
    if (!this.isOpen) {
      return;
    }

    this.isOpen = false;

    this.overlay.style.display =
      'none';
  }

  // ============================================================
  // TOGGLE
  // ============================================================

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }
}