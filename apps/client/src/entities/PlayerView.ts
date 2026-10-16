import { cocoFlightKey, cocoFlightFrame } from "../animation/cocoFlight.js";
import { SERVER_HZ, ticksFor } from "../../../../packages/shared/src/constants.js";
import { siegSprintKey, siegSprintFrame } from "../animation/siegSprint.js";
import { siegPushKey, siegPushFrame } from "../animation/siegPush.js";
import { combatDirection } from "../animation/combat.js";
import { actionFrame, siegAttackMetadata } from "../animation/siegAttack.js";
import { effectPresentationProfiles } from "../assets/effectPresentation.js";
import {
  defenseClip,
  defenseKey,
  wardEnvelope,
  wardRotation,
} from "../animation/defense.js";
import { PlayerPresentation } from "../animation/PlayerPresentation.js";
import {
  heavyKey,
  heavyAnimationKey,
  heavyRow,
  combatKey,
  actionClip,
} from "../animation/combat.js";
import { ensureAppearanceTexture } from "../assets/appearanceTextures.js";
import { effectColor } from "../assets/palettes.js";
import type Phaser from "phaser";
import type { Player } from "../../../../packages/shared/src/gameTypes.js";
import {
  animationKey,
  heroAssets,
  textureKey,
  type MovementMode,
} from "../animation/definitions.js";
import {
  selectAnimation,
  resolveHeroAnimation,
  stickyCardinal,
  cardinalOf,
  type Cardinal,
  type VisualHints,
} from "../animation/selectAnimation.js";
import { characterVisuals } from "../assets/characterVisuals.js";
export type CharacterRendering = "geometric" | "sprite";
export class PlayerView {
  private presentation = new PlayerPresentation();
  private lastPresentationTime: number | null = null;
  private presentationTime = 0;
  private combatSequence = -1;
  private basicObservation: Record<string, unknown> | null = null;
  private defenseSprite: Phaser.GameObjects.Image | null = null;
  private previousHit = 0;
  private effects: Phaser.GameObjects.Image | null = null;
  private sprite: Phaser.GameObjects.Sprite | null = null;
  private graphics: Phaser.GameObjects.Graphics;
  private previousHP: number | undefined;
  private hurtUntil = 0;
  private appearanceTexture = "";
  private role: Player["role"] = null;
  private cardinal: Cardinal | null = null;
  constructor(private scene: Phaser.Scene) {
    this.graphics = scene.add.graphics();
  }
  update(
    player: Readonly<Player>,
    motion: Readonly<Player>,
    position: { x: number; y: number },
    mode: MovementMode,
    rendering: CharacterRendering,
    hints: VisualHints = {},
    observeWard?: (state: WardObservation) => void,
  ) {
    const realNow = this.scene.time.now;
    this.presentationTime =
      this.lastPresentationTime === null
        ? realNow
        : this.presentationTime +
          Math.max(0, realNow - this.lastPresentationTime) *
            (hints.timeScale ?? 1);
    this.lastPresentationTime = realNow;
    const now = this.presentationTime;
    const defensiveHit =
      !!player.defensiveHit && player.defensiveHit.seq > this.previousHit;
    this.previousHit = player.defensiveHit?.seq ?? 0;
    if (
      this.previousHP !== undefined &&
      player.hp < this.previousHP &&
      !defensiveHit
    )
      this.hurtUntil = now + 250;
    this.previousHP = player.hp;
    const hurt = now < this.hurtUntil;
    const role = player.role;
    if (role !== this.role) {
      this.sprite?.destroy();
      this.defenseSprite?.destroy();
      this.defenseSprite = null;
      this.effects?.destroy();
      this.effects = null;
      this.presentation = new PlayerPresentation();
      this.sprite = null;
      this.role = role;
    }
    const presentation = this.presentation.update(
      player,
      mode,
      now,
      hints.serverTick ?? player.combat?.startedTick ?? 0,
      hurt,
      motion,
    );
    const combat = presentation.kind === "combat" ? presentation : null;
    const pushing =
      role === "OATH" &&
      player.actionState === "push" &&
      player.hp > 0 &&
      !hurt &&
      presentation.kind === "locomotion";
    const sprinting =
      role === "OATH" &&
      (player.sprintRemaining ?? 0) > 0 &&
      Math.hypot(motion.vx, motion.vy) > 1 &&
      player.hp > 0 &&
      !hurt &&
      presentation.kind === "locomotion";
    const flying =
      role === "EMBER" && (player.flightRemaining ?? 0) > 0 && player.hp > 0;
    const defense =
      pushing || sprinting || flying
        ? {
            phase: "loop" as const,
            direction: combatDirection(motion.facing),
            elapsedMs: now,
            impact: false,
          }
        : presentation.kind === "defense"
          ? presentation
          : null;
    const charge = presentation.kind === "charge" ? presentation : null;
    const direction = combat?.direction || charge?.direction;
    // Warm the attack palette while idle/walking to avoid a red fallback frame
    // when an already-customized Sieg starts his next confirmed attack.
    if (role === "OATH" && rendering === "sprite")
      ensureAppearanceTexture(this.scene, role, player.appearance, "basic");
    if (role === "OATH" && rendering === "sprite")
      ensureAppearanceTexture(this.scene, role, player.appearance, "push");
    const basic = role === "OATH" && combat?.action.kind === "sword";
    this.basicObservation = null;
    const siegHeavy =
      role === "OATH" && (!!charge || combat?.action.kind === "heavy");

    const selected = selectAnimation(
      {
        ...motion,
        actionState:
          presentation.kind === "defeated" || presentation.kind === "hurt"
            ? "hurt"
            : player.actionState === "attack" ||
                player.actionState === "heavyCharge"
              ? "idle"
              : role === "EMBER" && defense
                ? "idle"
                : player.actionState,
      },
      mode,
      { ...hints, hurt },
    );
    const travel = motion.movementIntent ?? { x: motion.vx, y: motion.vy };
    const state =
      mode === "TOP_DOWN"
        ? stickyCardinal(
            selected,
            this.cardinal,
            travel.x || travel.y
              ? travel
              : { x: Math.cos(motion.facing), y: Math.sin(motion.facing) },
          )
        : selected;
    this.cardinal = cardinalOf(state) ?? this.cardinal;
    const wardStart =
      role === "EMBER" &&
      (defense?.phase === "start" || hints.slowTimeStarting);
    const spellStartDirection =
      defense?.direction ?? combatDirection(motion.facing);
    const bodyMode = role === "EMBER" && defense ? "TOP_DOWN" : mode;
    const resolved = role
      ? resolveHeroAnimation(
          role,
          bodyMode,
          charge ? "idle" : state,
          charge
            ? { right: 0, left: Math.PI, down: Math.PI / 2, up: -Math.PI / 2 }[
                charge.direction
              ]
            : motion.facing,
        )
      : null;
    const key = wardStart
      ? combatKey("EMBER", spellStartDirection, "cast")
      : siegHeavy
        ? heavyAnimationKey(direction!, !!charge)
        : role && combat
          ? combatKey(role, combat.direction, combat.action.kind)
          : role && resolved
            ? animationKey(role, bodyMode, resolved)
            : "";
    const useSprite =
      rendering === "sprite" &&
      !!role &&
      this.scene.textures.exists(textureKey(role)) &&
      this.scene.anims.exists(key);
    if (useSprite && role) {
      const visual = characterVisuals[role];
      if (this.sprite) this.sprite.anims.timeScale = hints.timeScale ?? 1;
      this.appearanceTexture = ensureAppearanceTexture(
        this.scene,
        role,
        player.appearance,
        basic
          ? "basic"
          : siegHeavy
            ? "heavy"
            : combat || wardStart
              ? "combat"
              : "base",
      );
      if (!this.sprite) {
        this.sprite = this.scene.add
          .sprite(position.x, position.y, textureKey(role))
          .setOrigin(visual.origin.x, visual.origin.y);
        // Animations retain their canonical keys and clocks. Replace only the
        // displayed texture after Phaser advances a frame, including held clips.
        this.sprite.on("animationupdate", () => this.applyAppearance());
      }
      this.sprite
        .setVisible(true)
        .setPosition(position.x + visual.offset.x, position.y + visual.offset.y)
        .setOrigin(
          0.5,
          combat || siegHeavy || wardStart ? 96 / 128 : visual.origin.y,
        )
        .setScale(visual.scale)
        .setFlipX(
          siegHeavy || basic
            ? false
            : mode === "PLATFORMER" && Math.cos(motion.facing) < 0,
        )
        .setDepth(mode === "TOP_DOWN" ? position.y : 10);
      this.sprite.anims.timeScale = hints.timeScale ?? 1;
      // Ignore the same animation instead of restarting it each render frame.
      // A completed one-shot stays on its final frame until semantic state changes.
      if (
        this.sprite.anims.currentAnim?.key !== key ||
        (combat && this.combatSequence !== combat.action.seq)
      ) {
        const previous = this.sprite.anims.currentAnim?.key ?? "";
        // Turning mid-stride keeps the step phase instead of restarting the cycle.
        const stride =
          !combat && previous.includes(":walk_") && key.includes(":walk_")
            ? this.sprite.anims.currentFrame?.index
            : undefined;
        this.sprite.play(
          stride ? { key, startFrame: stride - 1 } : key,
        );
        if (combat) this.combatSequence = combat.action.seq;
      }
      if (combat) {
        const c = actionClip(role, combat.direction, combat.action.kind);
        const frame = actionFrame(c, combat.elapsedMs);
        this.sprite.setFrame(frame);
        if (basic) {
          const d = combat.direction;
          const metadata =
            siegAttackMetadata.directions[d].frames[frame - c.start];
          this.basicObservation = {
            direction: combat.direction,
            acceptedSeq: combat.action.seq,
            serverTick: hints.serverTick,
            elapsedMs: combat.elapsedMs,
            playbackRate: combat.playbackRate ?? 1,
            sourceRect: metadata.rect,
            sourcePivot: metadata.pivot,
            canvasPivot: siegAttackMetadata.pivot,
            durationMs: c.durationMs,
            frameIndex: frame - c.start,
          };
        }
      }
      if (wardStart)
        this.sprite.setFrame(
          actionClip("EMBER", spellStartDirection, "cast").start,
        );
      if (siegHeavy && charge)
        this.sprite.setFrame(
          heavyRow(charge.direction) + (charge.ticks < ticksFor(0.13) ? 0 : 1),
        );
      this.applyAppearance();
      if (hurt) this.sprite.setTint(0xff9999);
      else this.sprite.clearTint();
    } else this.sprite?.setVisible(false);
    if (useSprite && role === "EMBER" && combat) {
      const effectsKey = ensureAppearanceTexture(
        this.scene,
        role,
        player.appearance,
        "effects",
      );
      if (!this.effects)
        this.effects = this.scene.add.image(position.x, position.y, effectsKey);
      this.effects
        .setTexture(effectsKey, this.sprite!.frame.name)
        .setVisible(true)
        .setOrigin(0.5, 96 / 128)
        .setPosition(
          position.x + characterVisuals[role].offset.x,
          position.y + characterVisuals[role].offset.y,
        )
        .setScale(characterVisuals[role].scale)
        .setDepth(position.y + 0.5);
    } else this.effects?.setVisible(false);
    const defenseArtwork =
      rendering === "sprite" &&
      !!role &&
      !!defense &&
      this.scene.textures.exists(
        flying
          ? cocoFlightKey
          : sprinting
            ? siegSprintKey
            : pushing
              ? siegPushKey
              : defenseKey(role),
      );
    if (defenseArtwork && role && defense) {
      const moving =
        Math.hypot(motion.vx, mode === "TOP_DOWN" ? motion.vy : 0) > 1;
      const c = defenseClip(role, defense.phase, defense.direction, moving);
      const frame = flying
        ? cocoFlightFrame(defense.direction, now)
        : sprinting
          ? siegSprintFrame(defense.direction, now)
          : pushing
            ? siegPushFrame(defense.direction, now)
            : (c.heldFrame ??
              c.start +
                (defense.phase === "loop"
                  ? Math.floor((defense.elapsedMs * c.fps) / 1000) % c.count
                  : Math.min(
                      c.count - 1,
                      Math.floor((defense.elapsedMs * c.fps) / 1000),
                    )));
      const texture = ensureAppearanceTexture(
        this.scene,
        role,
        player.appearance,
        flying ? "flight" : sprinting ? "sprint" : pushing ? "push" : "defense",
      );
      if (!this.defenseSprite)
        this.defenseSprite = this.scene.add.image(
          position.x,
          position.y,
          texture,
        );
      const ward =
        role === "EMBER" && !flying
          ? wardEnvelope(defense.phase, defense.elapsedMs, c.durationMs, now)
          : null;
      this.defenseSprite
        .setRotation(ward ? wardRotation(now) : 0)
        .setAlpha(ward?.alpha ?? 1)
        .setTexture(texture, frame)
        .setVisible(true)
        .setOrigin(
          0.5,
          ward
            ? effectPresentationProfiles.ward.centerOnCoco
              ? 0.5
              : 70 / 128
            : 96 / 128,
        )
        .setPosition(
          position.x +
            characterVisuals[role].offset.x +
            (ward ? effectPresentationProfiles.ward.offsetX : 0),
          position.y +
            (ward ? effectPresentationProfiles.ward.offsetY : 0) +
            characterVisuals[role].offset.y -
            (ward ? 26 * characterVisuals[role].scale : 0),
        )
        .setScale(
          characterVisuals[role].scale *
            (ward?.scale ?? 1) *
            (ward ? effectPresentationProfiles.ward.scale : 1),
        )
        .setFlipX(false)
        .setDepth((mode === "TOP_DOWN" ? position.y : 10) + (ward ? 0.5 : 0));
      if (role === "OATH" || flying) this.sprite?.setVisible(false);
    } else this.defenseSprite?.setVisible(false);
    const g = this.graphics;
    g.clear();
    g.setDepth(mode === "TOP_DOWN" ? position.y + 1 : 11);
    if (!useSprite && !(defenseArtwork && role === "OATH")) {
      g.fillStyle(hurt ? 0xff9999 : role === "OATH" ? 0xe4b56b : 0xc5a1f5);
      if (role === "OATH")
        g.fillRoundedRect(position.x - 13, position.y - 17, 26, 34, 4);
      else g.fillCircle(position.x, position.y, 14);
      g.lineStyle(3, 0xffffff);
      g.lineBetween(
        position.x,
        position.y,
        position.x + Math.cos(motion.facing) * 25,
        position.y + Math.sin(motion.facing) * 25,
      );
    }
    if (charge) {
      const progress = charge.progress;
      g.lineStyle(2, 0xff5544, 0.35 + 0.6 * progress);
      g.strokeCircle(position.x, position.y, 18 + progress * 9);
      g.fillStyle(0x301c22);
      g.fillRect(position.x - 18, position.y + 20, 36, 3);
      g.fillStyle(progress >= 1 ? 0xffdd9c : 0xf05c4d);
      g.fillRect(position.x - 18, position.y + 20, 36 * progress, 3);
      for (let n = 0; n < 5; n++) {
        const a = now / 180 + (n * Math.PI * 2) / 5;
        g.fillStyle(0xffa16a, 0.4 + progress * 0.5);
        g.fillRect(
          position.x + Math.cos(a) * (22 - progress * 10),
          position.y + Math.sin(a) * (22 - progress * 10),
          2,
          2,
        );
      }
    }
    if (combat?.action.kind === "heavy" && !siegHeavy) {
      // Unsupplied vertical heavy poses retain directional basic art plus a larger visual arc.
      const t = combat.elapsedMs / 500,
        a = combat.action.facing;
      if (t < 0.8) {
        g.lineStyle(3, 0xff634f, 1 - t);
        g.beginPath();
        g.arc(position.x, position.y, 34, a - 1 + t, a + 1 + t);
        g.strokePath();
      }
    }
    if (
      player.actionState === "guard" &&
      (!defense ||
        rendering === "geometric" ||
        !role ||
        !this.scene.textures.exists(
          flying
            ? cocoFlightKey
            : sprinting
              ? siegSprintKey
              : pushing
                ? siegPushKey
                : defenseKey(role),
        ))
    ) {
      g.lineStyle(
        2,
        role === "EMBER"
          ? effectColor(player.appearance?.effectPalette)
          : 0x90d9ef,
      );
      g.strokeCircle(position.x, position.y, 23);
    }
    if (
      defenseArtwork &&
      !pushing &&
      !sprinting &&
      defense?.phase === "loop" &&
      role === "OATH" &&
      (defense.direction === "left" || defense.direction === "right")
    ) {
      const side = defense.direction === "left" ? -1 : 1;
      const pulse = 0.1 + 0.06 * Math.sin(now / 380);
      g.lineStyle(1, 0xffe4ae, pulse);
      g.strokeCircle(position.x + side * 12, position.y - 4, 6);
    }
    if (
      defense?.phase === "loop" &&
      role === "EMBER" &&
      rendering === "sprite"
    ) {
      const a = now / 450;
      g.fillStyle(effectColor(player.appearance?.effectPalette), 0.7);
      g.fillCircle(
        position.x + Math.cos(a) * 23,
        position.y - 11 + Math.sin(a) * 26,
        1.2,
      );
    }
    if (defense?.impact && role === "EMBER") {
      const t = (now % 250) / 250;
      g.lineStyle(3, effectColor(player.appearance?.effectPalette), 1 - t);
      g.strokeCircle(position.x, position.y - 11, 23 + t * 12);
    }

    g.fillStyle(0xe05260);
    g.fillRect(
      position.x - 18,
      useSprite && role
        ? position.y +
            characterVisuals[role].offset.y -
            heroAssets[role].frameHeight *
              characterVisuals[role].origin.y *
              characterVisuals[role].scale -
            6
        : position.y - 28,
      36 * Math.max(0, Math.min(1, player.hp / player.maxHp)),
      4,
    );
    if (observeWard && role === "EMBER")
      observeWard({
        kind: presentation.kind,
        phase: defense?.phase ?? null,
        elapsedMs: defense?.elapsedMs ?? null,
        visible: this.defenseSprite?.visible ?? false,
        alpha: this.defenseSprite?.alpha ?? 0,
        x: this.defenseSprite?.x ?? null,
        y: this.defenseSprite?.y ?? null,
        scaleX: this.defenseSprite?.scaleX ?? null,
        texture: this.defenseSprite?.texture.key ?? null,
        frame: this.defenseSprite?.frame.name ?? null,
      });
  }
  inspectCombat() {
    const s = this.sprite;
    return s
      ? {
          texture: s.texture.key,
          frame: s.frame.name,
          animation: s.anims.currentAnim?.key,
          flipX: s.flipX,
          x: s.x,
          y: s.y,
          originX: s.originX,
          originY: s.originY,
          scale: s.scaleX,
          visible: s.visible,
          ...this.basicObservation,
        }
      : null;
  }
  private applyAppearance() {
    if (
      this.sprite &&
      this.appearanceTexture &&
      this.sprite.texture.key !== this.appearanceTexture
    )
      this.sprite.setTexture(this.appearanceTexture, this.sprite.frame.name);
  }
  temporalPose() {
    const body = this.defenseSprite?.visible
      ? this.defenseSprite
      : this.sprite?.visible
        ? this.sprite
        : null;
    return body
      ? {
          texture: body.texture.key,
          frame: body.frame.name,
          x: body.x,
          y: body.y,
          originX: body.originX,
          originY: body.originY,
          scaleX: body.scaleX,
          scaleY: body.scaleY,
          flipX: body.flipX,
        }
      : null;
  }
  destroy() {
    this.defenseSprite?.destroy();
    this.sprite?.destroy();
    this.effects?.destroy();
    this.graphics.destroy();
  }
}

export interface WardObservation {
  kind: string;
  phase: string | null;
  elapsedMs: number | null;
  visible: boolean;
  alpha: number;
  x: number | null;
  y: number | null;
  scaleX: number | null;
  texture: string | null;
  frame: string | number | null;
}
