import { RaceScene3D as BaseRaceScene3D } from './RaceScene3DLegacy.js';
import { RaceRuntime } from '../racing/RaceRuntime.js';
import { RaceSceneRuntimeBridge } from '../racing/RaceSceneRuntimeBridge.js';
import { getActiveMatchManager } from '../racing/MatchManager.js';
import { getTrack, isTrackAvailable } from '../racing/TrackRegistry.js';
import { applyRaceResult } from '../state/careerState.js';

export class RaceScene3DRuntime extends BaseRaceScene3D {
  constructor(options = {}) {
    super(options);

    this.matchManager = options.matchManager ?? getActiveMatchManager();
    this.applyCareerResult = options.applyCareerResult ?? applyRaceResult;
    this.onRaceCompletion = options.onRaceCompletion ?? null;
    this.raceSessionCompleted = false;

    if (this.runtimeBridge) {
      this.runtimeBridge.matchManager = this.matchManager;
      this.runtimeBridge.applyCareerResult = this.applyCareerResult;
      this.runtimeBridge.onCompletion = (completion) => {
        this.raceSessionCompleted = true;
        this.showRaceCompletion(completion);
        this.onRaceCompletion?.(completion);
      };
    }
  }

  createCars() {
    super.createCars();

    const track = getTrack(this.session.trackId);
    if (!track) {
      throw new Error(`Unknown race track "${this.session.trackId}".`);
    }

    this.raceRuntime = new RaceRuntime({
      trackId: this.session.trackId,
      totalLaps: track.laps
    });

    this.runtimeBridge = new RaceSceneRuntimeBridge({ runtime: this.raceRuntime });
    this.runtimeSetup = this.runtimeBridge.load();
    this.runtimeFrameDt = 0;

    const basePlayerDrive = this.playerCar.drive.bind(this.playerCar);
    this.playerCar.drive = (throttle, brake, steering, dt) => {
      basePlayerDrive(throttle, brake, steering, dt);
      this.runtimeFrameDt = dt;
    };
  }

  loadTrack() {
    const track = getTrack(this.session.trackId);
    if (!track) {
      this.setStatus(`Unknown track: ${this.session.trackId} · Esc returns home`);
      return;
    }

    if (!isTrackAvailable(track.id)) {
      // Do not let GLTFLoader fail and then create a fake empty-grid race. The
      // confirmed match may reference circuits whose licensed GLBs have not
      // been added yet; that is an asset blocker, not a playable race.
      this.setStatus(`${track.name} asset not installed · race ${this.session.raceNumber} is blocked · Esc returns home`);
      return;
    }

    super.loadTrack();
  }

  readStatus() {
    this.advanceRuntimeAfterCollision(this.runtimeFrameDt);
    super.readStatus();
  }

  advanceRuntimeAfterCollision(dt) {
    if (this.setupMode || !this.runtimeBridge || this.raceSessionCompleted) return;
    if (!this.raceRuntime.recordingLine && !this.runtimeBridge.started) return;

    const opponentBefore = this.opponentCar.position.clone();
    const opponentYawBefore = this.opponentCar.rotation.y;

    if (this.runtimeBridge.started) {
      this.raceRuntime.driveOpponent(this.opponentCar, dt);
      const grounded = this.snapCarToSurface(this.opponentCar);
      const swept = grounded ? this.getSweptVehicleCollision(this.opponentCar, opponentBefore) : null;
      const pedestrian = grounded ? this.getPedestrianZoneCollision(this.opponentCar) : null;
      const box = grounded ? this.getCarObjectCollision(this.opponentCar) : null;

      if (!grounded || swept || pedestrian || box) {
        this.opponentCar.position.copy(opponentBefore);
        this.opponentCar.rotation.y = opponentYawBefore;
        this.opponentCar.speed = 0;
      }
    }

    const { snapshot } = this.runtimeBridge.update({
      playerCar: this.playerCar,
      opponentCar: this.opponentCar,
      dt,
      driveOpponent: false,
      details: { raceNumber: this.session.raceNumber }
    });
    this.updateRaceHud(snapshot);
  }

  createOverlay() {
    super.createOverlay();
    const panel = document.createElement('div');
    panel.id = 'race-runtime-panel';
    Object.assign(panel.style, {
      position: 'absolute', right: '18px', bottom: '18px', width: '300px',
      padding: '12px 14px', borderRadius: '12px', background: 'rgba(7,10,14,.82)',
      border: '1px solid rgba(255,255,255,.12)', fontSize: '12px', lineHeight: '1.5', pointerEvents: 'none'
    });
    panel.innerHTML = `
      <strong>P0 Race Runtime</strong><br>
      L = start/finish racing-line recording · X = clear line<br>
      Drive the full lap while recording, returning to the grid/start point.
      <div id="race-runtime-status" style="margin-top:6px;opacity:.78">No authored racing line.</div>
      <div id="race-runtime-result" style="margin-top:8px;font-weight:800"></div>
    `;
    this.ui.appendChild(panel);
    this.runtimeStatusElement = panel.querySelector('#race-runtime-status');
    this.runtimeResultElement = panel.querySelector('#race-runtime-result');
    this.updateRaceHud();
  }

  bindEvents() {
    super.bindEvents();
    this.handleRuntimeKeyDown = (event) => {
      if (event.repeat || !this.runtimeBridge) return;
      if ((event.code === 'KeyL' || event.code === 'KeyX') && this.raceSessionCompleted) {
        this.setStatus('Race result already committed · Esc returns home for the next match race.');
        return;
      }
      if (event.code === 'KeyL') {
        if (this.raceRuntime.recordingLine) {
          const count = this.runtimeBridge.finishAuthoring();
          this.setStatus(count >= 2 ? `Racing line saved · ${count} points · C overview then C starts race` : 'Racing line needs at least two spaced points.');
        } else {
          this.runtimeBridge.beginAuthoring(this.playerCar?.position);
          this.setStatus('Recording racing line · drive a full lap · L saves');
        }
        this.updateRaceHud();
      }
      if (event.code === 'KeyX') {
        this.runtimeBridge.clearAuthoring();
        this.setStatus('Racing line cleared.');
        this.updateRaceHud();
      }
    };
    window.addEventListener('keydown', this.handleRuntimeKeyDown);
  }

  applyInitialGrid(center, size) {
    const runtimeGrid = this.runtimeBridge?.load()?.grid ?? null;
    if (runtimeGrid) {
      this.setCarsFromSpawn(runtimeGrid);
      if (!this.setupMode) this.updateCamera(true);
      return;
    }
    super.applyInitialGrid(center, size);
  }

  saveGridFromPlayer() {
    if (!this.runtimeBridge) {
      super.saveGridFromPlayer();
      return;
    }
    const midpoint = this.playerCar.position.clone().add(this.opponentCar.position).multiplyScalar(0.5);
    const spawn = { x: midpoint.x, y: midpoint.y, z: midpoint.z, yaw: this.playerCar.rotation.y };
    this.runtimeBridge.saveGrid(spawn);
    this.setStatus('Grid saved in unified track setup.');
  }

  toggleSetupMode() {
    const track = getTrack(this.session.trackId);
    if (!track || !isTrackAvailable(track.id)) {
      this.setStatus(`${track?.name ?? this.session.trackId} asset not installed · cannot start this race · Esc returns home`);
      return;
    }

    const wasSetup = this.setupMode;
    super.toggleSetupMode();
    if (wasSetup && !this.setupMode && this.runtimeBridge) {
      if (this.raceSessionCompleted) {
        this.setStatus('Race complete · result locked · Esc returns home for the next match race.');
        this.updateRaceHud();
        return;
      }
      const hud = this.runtimeBridge.getHudState();
      if (hud.ready) {
        this.runtimeBridge.start(performance.now());
        if (this.runtimeResultElement) this.runtimeResultElement.textContent = '';
        this.setStatus(`Race started · ${hud.racingLinePointCount} authored points · ${hud.totalLaps} laps`);
      } else {
        this.setStatus('Driving mode · press L to author the racing line · C returns to overview');
      }
      this.updateRaceHud();
    }
  }

  updateRaceHud(snapshot = null) {
    if (!this.runtimeStatusElement || !this.runtimeBridge) return;
    const hud = snapshot ?? this.runtimeBridge.getHudState();
    const player = hud.player;
    const opponent = hud.opponent;
    const playerLap = player ? Math.min(hud.totalLaps, player.lap) : 0;
    const opponentLap = opponent ? Math.min(hud.totalLaps, opponent.lap) : 0;
    this.runtimeStatusElement.textContent = this.raceSessionCompleted
      ? 'RESULT LOCKED · Esc returns home for the next match race'
      : hud.recordingLine
        ? `RECORDING · ${hud.authoredPointCount} points`
        : hud.ready
          ? `Line ${hud.racingLinePointCount} pts · Player lap ${playerLap}/${hud.totalLaps} · AI lap ${opponentLap}/${hud.totalLaps}`
          : 'No authored racing line · press L, then drive the route.';
  }

  showRaceCompletion(completion) {
    if (!completion || !this.runtimeResultElement) return;
    const winner = completion.winnerSide === 'A' ? 'PLAYER' : 'OPPONENT';
    const order = completion.classification.join(' → ');
    const summary = completion.matchSummary;
    const score = summary ? ` · MATCH ${summary.scoreA}-${summary.scoreB}` : '';
    const matchEnd = summary?.completed ? ` · ${summary.winner === 'A' ? 'AZURE' : 'CRIMSON'} WINS MATCH` : '';
    const next = summary?.completed ? ' · MATCH COMPLETE' : ' · ESC → NEXT RACE';
    this.runtimeResultElement.textContent = `${winner} WINS · ${order}${score}${matchEnd}${next}`;
    this.updateRaceHud();
  }

  dispose() {
    if (this.handleRuntimeKeyDown) window.removeEventListener('keydown', this.handleRuntimeKeyDown);
    super.dispose();
  }
}
