const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game Settings
let POOL_WIDTH = canvas.width;
let POOL_HEIGHT = canvas.height;
const PLAYER_WIDTH = 15;
const PLAYER_HEIGHT = 30;
const PLAYER_COLLISION_RADIUS = Math.max(PLAYER_WIDTH, PLAYER_HEIGHT) / 2;

const PUCK_RADIUS = 6;
const GOAL_WIDTH = 100;
const GOAL_DEPTH = 15;
const PLAYER_BASE_SPEED = 1.6;
const AI_SPEED_FACTOR = 0.9;
const PUCK_FRICTION = 0.975;
const PLAYER_FRICTION = 0.90;
const STICK_VISUAL_LENGTH = 15; // How long the stick looks
const STICK_REACH = PLAYER_COLLISION_RADIUS + STICK_VISUAL_LENGTH * 0.8; // Effective reach slightly less than visual
const BASE_FLICK_FORCE = 2.5;
const GOAL_SHOT_FORCE = 4.5;
const POSSESSION_PULL_FORCE = 0.9;
const POSSESSION_DAMPING = 0.02;
const MAX_BREATH = 100;
const MIN_BREATH_SECONDS = 15;
const MAX_BREATH_SECONDS = 30;
const BREATH_RECOVERY_RATE = 1.8;
const BREATH_CONSUMPTION_RATE = 0.6;
const AI_DIVE_THRESHOLD_DIST = POOL_WIDTH * 0.35;
const AI_SURFACE_THRESHOLD_BREATH = 25;
const AI_GOAL_ATTRACTION_PUSH = 0.8;
const AI_GOAL_ATTRACTION_CHASE = 0.3;
const AI_LOW_BREATH_FLICK_THRESHOLD = AI_SURFACE_THRESHOLD_BREATH * 1.3;
const AI_AVOIDANCE_DISTANCE = PLAYER_COLLISION_RADIUS * 6;
const AI_LATERAL_MANEUVER_THRESHOLD = PLAYER_COLLISION_RADIUS * 3.5;
const AI_LATERAL_MANEUVER_ANGLE = Math.PI / 4.5;
const AI_AVOIDANCE_WEIGHT = 0.35;
const AI_TEAMMATE_ATTRACTION_WEIGHT = 0.2;
const AI_FORMATION_WEIGHT = 0.3;
const AI_GOAL_SHOT_RANGE = GOAL_DEPTH * 6;
const AI_DEFENSIVE_ZONE_X_FACTOR = 0.3;
const PUCK_COLLISION_DAMPEN = 0.2;
const PLAYER_REPULSION_FORCE = 0.05;
const NUM_PLAYERS_PER_TEAM = 6;
const FORMATION_ROLES = ['LF', 'CF', 'RF', 'LB', 'CB', 'RB'];
const LEFT_HANDED_PROBABILITY = 0.1;
const START_COUNTDOWN_SECONDS = 3;
const INITIAL_PUCK_RACE_COMMITMENT = POOL_WIDTH * 0.20;
const START_POS_Y_SPREAD = PLAYER_HEIGHT * 1.2;
const WING_SIDE_THRESHOLD = POOL_HEIGHT * 0.35;

// Game State
let players = [];
let puck;
let score = { white: 0, black: 0 };
let gameState = 'INITIALIZING';
let gamePaused = false;
let animationFrameId;
let countdownTimer = START_COUNTDOWN_SECONDS;
let countdownIntervalId = null;
let sortedPlayerList = [];

// UI Elements
const scoreWhiteEl = document.getElementById('scoreWhite');
const scoreBlackEl = document.getElementById('scoreBlack');
const resetButton = document.getElementById('resetButton');
const messageOverlay = document.getElementById('messageOverlay');
const messageText = document.getElementById('messageText');
const countdownText = document.getElementById('countdownText');
const continueButton = document.getElementById('continueButton');
const statusBoardBody = document.getElementById('statusBoardBody');

// --- Utility Functions ---
function distance(x1, y1, x2, y2) {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return Math.sqrt(dx * dx + dy * dy);
}

function angle(x1, y1, x2, y2) {
    return Math.atan2(y2 - y1, x2 - x1);
}

function normalizeAngle(angle) {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle <= -Math.PI) angle += 2 * Math.PI;
    return angle;
}

// --- Classes ---

class GameObject {
    constructor(x, y, width, height, collisionRadius, color) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.width = width;
        this.height = height;
        this.radius = collisionRadius;
        this.color = color;
        this.friction = 1;
        this.angle = 0;
    }

    applyForce(fx, fy) {
        this.vx += fx;
        this.vy += fy;
    }

    update(friction) {
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= friction;
        this.vy *= friction;

        const speedSq = this.vx * this.vx + this.vy * this.vy;
        if (speedSq > 0.01) {
            this.angle = Math.atan2(this.vy, this.vx);
        }

        if (Math.abs(this.vx) < 0.01) this.vx = 0;
        if (Math.abs(this.vy) < 0.01) this.vy = 0;

        // Pool boundary collision
        if (this.x - this.radius < 0) { this.x = this.radius; this.vx *= -0.5; }
        if (this.x + this.radius > POOL_WIDTH) { this.x = POOL_WIDTH - this.radius; this.vx *= -0.5; }
        if (this.y - this.radius < 0) { this.y = this.radius; this.vy *= -0.5; }
        if (this.y + this.radius > POOL_HEIGHT) { this.y = POOL_HEIGHT - this.radius; this.vy *= -0.5; }
    }

    drawCircle() {
         if (!ctx) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();
    }

     drawRectangle() {
         if (!ctx) return;
         ctx.save();
         ctx.translate(this.x, this.y);
         ctx.rotate(this.angle);
         ctx.fillStyle = this.color;
         ctx.fillRect(-this.height / 2, -this.width / 2, this.height, this.width);
         ctx.restore();
     }
}

class Puck extends GameObject {
    constructor(x, y) {
        super(x, y, PUCK_RADIUS * 2, PUCK_RADIUS * 2, PUCK_RADIUS, '#ff4500');
        this.friction = PUCK_FRICTION;
        this.possessor = null;
    }

    update(players) {
         if (this.possessor && this.possessor.isUnderwater) {
             // *** Calculate target position at the stick tip ***
             const p = this.possessor;
             const stickSideOffset = (p.width / 2 + 2) * p.stickSide;
             const stickForwardOffset = p.height * 0.4;
             const stickTipLength = STICK_VISUAL_LENGTH + this.radius; // Target slightly beyond visual tip

             // Calculate stick tip position relative to player center, then rotate
             const localStickTipX = stickForwardOffset + stickTipLength;
             const localStickTipY = stickSideOffset;

             const cosA = Math.cos(p.angle);
             const sinA = Math.sin(p.angle);

             const targetX = p.x + localStickTipX * cosA - localStickTipY * sinA;
             const targetY = p.y + localStickTipX * sinA + localStickTipY * cosA;

             // Apply strong force towards stick tip
             const dx = targetX - this.x;
             const dy = targetY - this.y;
             this.vx += dx * POSSESSION_PULL_FORCE;
             this.vy += dy * POSSESSION_PULL_FORCE;
             this.vx *= POSSESSION_DAMPING; // Dampen velocity heavily
             this.vy *= POSSESSION_DAMPING;
         } else {
             if (this.possessor && !this.possessor.isUnderwater) {
                 this.possessor = null;
             }
             super.update(this.friction);

             // Puck-Player Collision (when loose)
             players.forEach(player => {
                 if (player.isUnderwater) {
                     const d = distance(this.x, this.y, player.x, player.y);
                     // Check against player's collision radius
                     if (d < this.radius + player.radius) {
                         const impactAngle = angle(player.x, player.y, this.x, this.y);
                         const totalSpeed = Math.sqrt(this.vx**2 + this.vy**2);
                         this.vx = Math.cos(impactAngle) * totalSpeed * PUCK_COLLISION_DAMPEN;
                         this.vy = Math.sin(impactAngle) * totalSpeed * PUCK_COLLISION_DAMPEN;
                         this.vx += player.vx * 0.1;
                         this.vy += player.vy * 0.1;
                     }
                 }
             });
         }
         // Bounds check
         if (this.x - this.radius < 0) { this.x = this.radius; this.vx = 0; }
         if (this.x + this.radius > POOL_WIDTH) { this.x = POOL_WIDTH - this.radius; this.vx = 0; }
         if (this.y - this.radius < 0) { this.y = this.radius; this.vy = 0; }
         if (this.y + this.radius > POOL_HEIGHT) { this.y = POOL_HEIGHT - this.radius; this.vy = 0; }
    }

     draw() {
        if (!ctx) return;
        ctx.globalAlpha = 1.0;
        this.drawCircle();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.closePath();
        ctx.globalAlpha = 1.0;
    }
}

class Player extends GameObject {
    constructor(x, y, team, role) {
        const color = team === 'white' ? '#f0f0f0' : '#1f2937';
        super(x, y, PLAYER_WIDTH, PLAYER_HEIGHT, PLAYER_COLLISION_RADIUS, color);
        this.team = team;
        this.role = role;
        this.breath = MAX_BREATH; // Internal unit
        this.isUnderwater = false;
        this.friction = PLAYER_FRICTION;
        this.stickColor = team === 'white' ? '#d1d5db' : '#4b5563';
        this.currentState = 'Initializing';
        this.strategy = 'Positioning';
        this.baseSpeed = PLAYER_BASE_SPEED * (0.85 + Math.random() * 0.3);
        this.flickStrength = 0.5 + Math.random();
        this.handedness = Math.random() < LEFT_HANDED_PROBABILITY ? 'L' : 'R';
        this.stickSide = this.handedness === 'R' ? 1 : -1;
        this.angle = team === 'white' ? 0 : Math.PI;
        this.initialDiveTargetMet = false;
        this.maxBreathSeconds = MIN_BREATH_SECONDS + Math.random() * (MAX_BREATH_SECONDS - MIN_BREATH_SECONDS);
    }

    manageBreath() {
        if (this.isUnderwater) {
            // Consumption logic remains the same (internal units)
            this.breath -= BREATH_CONSUMPTION_RATE;
            if (this.breath <= 0) {
                this.breath = 0;
                this.surface();
            }
        } else {
            // Recovery logic remains the same (internal units, capped at MAX_BREATH)
            const speedFactor = Math.sqrt(this.vx*this.vx + this.vy*this.vy) / this.baseSpeed;
            const recoveryMultiplier = Math.max(0, 1 - speedFactor * 1.5);
            this.breath += BREATH_RECOVERY_RATE * recoveryMultiplier;
            if (this.breath > MAX_BREATH) {
                this.breath = MAX_BREATH;
            }
        }
    }

    dive() {
        // *** Can only dive if breath is FULL (internal 100) ***
        if (this.breath >= MAX_BREATH && !this.isUnderwater) {
            this.isUnderwater = true;
            this.initialDiveTargetMet = false;
        }
    }

    surface() {
        this.isUnderwater = false;
        if (puck && puck.possessor === this) {
            puck.possessor = null;
        }
    }

    getFormationPosition(puck, players) {
        const sideMultiplier = this.team === 'white' ? 1 : -1;
        const poolCenterY = POOL_HEIGHT / 2;
        const ownDefensiveZoneX = POOL_WIDTH * (this.team === 'white' ? 0.2 : 0.8);
        const ownMidfieldX = POOL_WIDTH * (this.team === 'white' ? 0.4 : 0.6);
        const opponentMidfieldX = POOL_WIDTH * (this.team === 'white' ? 0.6 : 0.4);
        const puckInOwnHalf = (this.team === 'white' && puck.x < POOL_WIDTH / 2) || (this.team === 'black' && puck.x > POOL_WIDTH / 2);

        let baseX;
        if (this.role.includes('B')) {
            baseX = puckInOwnHalf ? ownDefensiveZoneX : ownMidfieldX;
        } else {
            baseX = puckInOwnHalf ? ownMidfieldX : opponentMidfieldX;
        }

        let baseY = poolCenterY;
        const roleYOffset = POOL_HEIGHT * 0.3;
        const roleXOffset = POOL_WIDTH * 0.15;

        if (this.role.includes('F')) baseY -= roleYOffset * 0.5;
        if (this.role.includes('B')) baseY += roleYOffset * 0.5;
        if (this.role.includes('L')) baseY -= roleXOffset;
        if (this.role.includes('R')) baseY += roleXOffset;

        let targetX = baseX + (Math.random() - 0.5) * 50;
        let targetY = baseY + (Math.random() - 0.5) * 50;
        targetX = Math.max(this.radius, Math.min(POOL_WIDTH - this.radius, targetX));
        targetY = Math.max(this.radius, Math.min(POOL_HEIGHT - this.radius, targetY));
        return { x: targetX, y: targetY };
    }


    // --- AI Logic ---
    updateAI(puck, players) {
        if (!puck || gameState !== 'RUNNING') return;

        const distToPuck = distance(this.x, this.y, puck.x, puck.y);
        const isPossessing = puck.possessor === this;
        const opponentHasPuck = puck.possessor && puck.possessor.team !== this.team;
        const speed = this.baseSpeed * AI_SPEED_FACTOR;
        const opponentGoalX = this.team === 'white' ? POOL_WIDTH : 0;
        const opponentGoalY = POOL_HEIGHT / 2;
        const ownGoalX = this.team === 'white' ? 0 : POOL_WIDTH;
        const ownGoalY = POOL_HEIGHT / 2;
        const ownDefensiveLine = POOL_WIDTH * (this.team === 'white' ? AI_DEFENSIVE_ZONE_X_FACTOR : 1 - AI_DEFENSIVE_ZONE_X_FACTOR);
        const puckInDefensiveZone = (this.team === 'white' && puck.x < ownDefensiveLine) || (this.team === 'black' && puck.x > ownDefensiveLine);
        const puckInGoalZone = (this.team === 'white' && puck.x < GOAL_DEPTH + PUCK_RADIUS) || (this.team === 'black' && puck.x > POOL_WIDTH - GOAL_DEPTH - PUCK_RADIUS);

        // --- Priority 1: Surface if critically low on breath ---
        if (this.isUnderwater && this.breath < AI_SURFACE_THRESHOLD_BREATH) {
            this.strategy = 'Surfacing';
            this.currentState = 'Critical Breath';
            this.surface();
            return;
        }

        // --- Priority 2: Low Breath Flick (if underwater & possessing) ---
        if (this.isUnderwater && isPossessing && this.breath < AI_LOW_BREATH_FLICK_THRESHOLD) {
            this.strategy = 'Flick Puck';
            this.currentState = 'Low Breath Flick';
            const flickAngle = angle(this.x, this.y, opponentGoalX, opponentGoalY);
            const actualFlickForce = BASE_FLICK_FORCE * this.flickStrength;
            puck.possessor = null;
            puck.applyForce(Math.cos(flickAngle) * actualFlickForce, Math.sin(flickAngle) * actualFlickForce);
            this.applyForce(-Math.cos(flickAngle) * actualFlickForce * 0.1, -Math.sin(flickAngle) * actualFlickForce * 0.1);
            return;
        }


        // --- Surface Logic ---
        if (!this.isUnderwater) {
            this.strategy = 'Recover/Reposition';
            // *** Condition to dive: MUST have full breath (100) ***
            const canDive = this.breath >= MAX_BREATH;
            const shouldDiveOffensively = canDive && distToPuck < AI_DIVE_THRESHOLD_DIST && !opponentHasPuck && !puckInDefensiveZone;
            const loosePuckNearGoal = !puck.possessor && puckInDefensiveZone && distance(this.x, this.y, puck.x, puck.y) < AI_DIVE_THRESHOLD_DIST * 2;
            const shouldDiveDefensively = canDive && ( (opponentHasPuck && distance(this.x, this.y, puck.possessor.x, puck.possessor.y) < AI_DIVE_THRESHOLD_DIST * 1.5) || loosePuckNearGoal );

            // *** Backs follow forwards initially ***
            if (this.strategy === 'Follow Forward' && !this.initialDiveTargetMet) {
               // ... (following logic remains the same) ...
                let targetPlayer = null;
                let correspondingRole = '';
                if (this.role === 'LB') correspondingRole = 'LF';
                else if (this.role === 'RB') correspondingRole = 'RF';
                else if (this.role === 'CB') correspondingRole = 'CF';

                if (correspondingRole) {
                    targetPlayer = players.find(p => p.team === this.team && p.role === correspondingRole);
                }

                if (targetPlayer) {
                    this.currentState = 'Following Forward';
                    const targetX = targetPlayer.x - Math.cos(targetPlayer.angle) * PLAYER_HEIGHT;
                    const targetY = targetPlayer.y - Math.sin(targetPlayer.angle) * PLAYER_HEIGHT;
                    const dx = targetX - this.x;
                    const dy = targetY - this.y;
                    const distToTarget = Math.sqrt(dx*dx + dy*dy);
                    const speedMultiplier = 0.6;
                    if (distToTarget > this.radius * 2) {
                         const moveX = (dx / distToTarget) * speed * speedMultiplier;
                         const moveY = (dy / distToTarget) * speed * speedMultiplier;
                         this.applyForce(moveX * 0.1, moveY * 0.1);
                    } else {
                        this.vx *= 0.8; this.vy *= 0.8;
                    }
                    if (targetPlayer.isUnderwater || (puck.possessor && puck.possessor.team !== this.team && puckInDefensiveZone)) {
                        this.initialDiveTargetMet = true; // Stop following
                        this.strategy = 'Positioning';
                    }
                } else {
                     this.strategy = 'Positioning'; // Fallback
                }
            }
            // *** Normal surface positioning/diving logic ***
            else if (shouldDiveOffensively || shouldDiveDefensively) {
                this.dive(); // Dive function now implicitly checks for full breath
                if(this.isUnderwater) { // Check if dive was successful
                   this.currentState = shouldDiveDefensively ? 'Diving (Defensive)' : 'Diving for Puck';
                } else {
                    // If dive failed (not full breath), continue recovery/positioning
                    this.currentState = 'Recovering Breath'; // Force recovery state
                    // Continue moving towards formation slowly
                    const formationPos = this.getFormationPosition(puck, players);
                    const dx = formationPos.x - this.x;
                    const dy = formationPos.y - this.y;
                    const distToTarget = Math.sqrt(dx*dx + dy*dy);
                    if (distToTarget > this.radius * 2) {
                        const moveX = (dx / distToTarget) * speed * 0.2; // Slow recovery speed
                        const moveY = (dy / distToTarget) * speed * 0.2;
                        this.applyForce(moveX * 0.1, moveY * 0.1);
                    } else {
                        this.vx *= 0.8; this.vy *= 0.8;
                    }
                }
            } else { // Stay surfaced and recover/position
                this.currentState = this.breath < MAX_BREATH ? 'Recovering Breath' : 'Positioning (Surface)'; // Explicitly recover if not full
                const formationPos = this.getFormationPosition(puck, players);
                const dx = formationPos.x - this.x;
                const dy = formationPos.y - this.y;
                const distToTarget = Math.sqrt(dx*dx + dy*dy);
                const speedMultiplier = this.currentState === 'Recovering Breath' ? 0.2 : 0.5;
                if (distToTarget > this.radius * 2) {
                     const moveX = (dx / distToTarget) * speed * speedMultiplier;
                     const moveY = (dy / distToTarget) * speed * speedMultiplier;
                     this.applyForce(moveX * 0.1, moveY * 0.1);
                } else {
                    this.vx *= 0.8; this.vy *= 0.8;
                }
            }
            return; // End AI logic if surfaced
        }

        // --- Underwater Logic ---
        if (this.isUnderwater) {
            let moveAngle = 0;
            let forceMagnitude = speed * 0.15; // Default force

            // *** Initial Dive Commitment ***
            if (this.strategy === 'Race for Puck' && !this.initialDiveTargetMet) {
                const centerPuckX = POOL_WIDTH / 2;
                const centerPuckY = POOL_HEIGHT / 2;
                const distToCenterTarget = distance(this.x, this.y, centerPuckX, centerPuckY);
                const puckMovedFromCenter = distance(puck.x, puck.y, centerPuckX, centerPuckY) > PUCK_RADIUS * 5;

                // Only race if puck is still near center and player hasn't reached commitment distance
                if (distToCenterTarget > INITIAL_PUCK_RACE_COMMITMENT && !puckMovedFromCenter) {
                     this.currentState = 'Racing for Puck';
                     moveAngle = angle(this.x, this.y, centerPuckX, centerPuckY);
                     forceMagnitude = speed * 0.22; // Faster during race
                     this.applyForce(Math.cos(moveAngle) * forceMagnitude, Math.sin(moveAngle) * forceMagnitude);
                     return; // Override other logic during initial race
                } else {
                     this.initialDiveTargetMet = true; // Reached close enough or puck moved
                     this.strategy = 'Get Puck/Position'; // Transition strategy
                     this.currentState = 'Chasing/Positioning'; // Sensible default state
                }
            }


            if (isPossessing) {
                 // --- Pushing Puck ---
                 forceMagnitude = speed * 0.18;
                 let targetAngle;
                 const distToOppGoal = distance(this.x, this.y, opponentGoalX, opponentGoalY);
                 const isInOwnHalf = (this.team === 'white' && this.x < POOL_WIDTH / 2) || (this.team === 'black' && this.x > POOL_WIDTH / 2);

                 // *** Goal Shot Logic ***
                 if (!isInOwnHalf && distToOppGoal < AI_GOAL_SHOT_RANGE) {
                     this.strategy = 'Shoot on Goal';
                     this.currentState = 'Shooting';
                     targetAngle = angle(this.x, this.y, opponentGoalX, opponentGoalY);
                     const shotForce = GOAL_SHOT_FORCE * this.flickStrength;
                     puck.possessor = null;
                     puck.applyForce(Math.cos(targetAngle) * shotForce, Math.sin(targetAngle) * shotForce);
                     this.applyForce(-Math.cos(targetAngle) * shotForce * 0.05, -Math.sin(targetAngle) * shotForce * 0.05);
                     return;
                 }
                 // *** Clearing / Attacking Logic ***
                 else if (isInOwnHalf || puckInGoalZone) { // Also clear if in own goal zone
                     this.strategy = 'Clear Puck';
                     this.currentState = 'Clearing Puck';
                     const targetY = this.y < POOL_HEIGHT / 2 ? 0 + this.radius : POOL_HEIGHT - this.radius;
                     targetAngle = angle(this.x, this.y, this.x + (opponentGoalX - this.x)*0.1, targetY);
                 } else {
                     this.strategy = 'Attack Goal';
                     this.currentState = 'Pushing to Goal';
                     targetAngle = angle(this.x, this.y, opponentGoalX, opponentGoalY);
                 }

                 // Opponent Avoidance & Lateral Maneuver
                 let nearestOpponentDist = Infinity;
                 let nearestOpponent = null;
                 players.forEach(other => {
                     if (other.team !== this.team && other.isUnderwater) {
                         const d = distance(this.x, this.y, other.x, other.y);
                         if (d < nearestOpponentDist) {
                             nearestOpponentDist = d;
                             nearestOpponent = other;
                         }
                     }
                 });

                 if (nearestOpponent && nearestOpponentDist < AI_AVOIDANCE_DISTANCE) {
                      const angleToOpponent = angle(this.x, this.y, nearestOpponent.x, nearestOpponent.y);
                      let angleAway = angleToOpponent + Math.PI;

                      if (nearestOpponentDist < AI_LATERAL_MANEUVER_THRESHOLD) {
                           this.currentState = 'Pushing (Maneuvering)';
                           const angleDiff = normalizeAngle(angleAway - targetAngle);
                           const lateralAngle = targetAngle + (angleDiff > 0 ? AI_LATERAL_MANEUVER_ANGLE : -AI_LATERAL_MANEUVER_ANGLE);
                           const lateralWeight = 0.6;
                           const targetVecX = Math.cos(targetAngle) * (1-lateralWeight);
                           const targetVecY = Math.sin(targetAngle) * (1-lateralWeight);
                           const lateralVecX = Math.cos(lateralAngle) * lateralWeight;
                           const lateralVecY = Math.sin(lateralAngle) * lateralWeight;
                           moveAngle = Math.atan2(targetVecY + lateralVecY, targetVecX + lateralVecX);

                      } else {
                           this.currentState = 'Pushing (Avoiding)';
                           const avoidanceWeight = (1 - (nearestOpponentDist / AI_AVOIDANCE_DISTANCE)) * AI_AVOIDANCE_WEIGHT;
                           const targetVecX = Math.cos(targetAngle);
                           const targetVecY = Math.sin(targetAngle);
                           const avoidVecX = Math.cos(angleAway) * avoidanceWeight;
                           const avoidVecY = Math.sin(angleAway) * avoidanceWeight;
                           moveAngle = Math.atan2(targetVecY + avoidVecY, targetVecX + avoidVecX);
                      }
                 } else {
                      moveAngle = targetAngle;
                 }

            } else if (opponentHasPuck) {
                // --- Defensive Logic (Underwater) ---
                 // *** Aggressive defense if puck is near own goal ***
                if (puckInDefensiveZone || puckInGoalZone) {
                     this.strategy = 'Defend Goal (Aggressive)';
                     this.currentState = 'Pressuring Carrier';
                     moveAngle = angle(this.x, this.y, puck.possessor.x, puck.possessor.y);
                }
                // Standard defensive positioning otherwise
                else if (this.role.includes('B')) {
                    this.strategy = 'Defend Goal';
                    this.currentState = 'Intercepting';
                    const interceptDist = PLAYER_HEIGHT * 1.5;
                    const angleToGoal = angle(puck.possessor.x, puck.possessor.y, ownGoalX, ownGoalY);
                    const targetX = puck.possessor.x + Math.cos(angleToGoal) * interceptDist;
                    const targetY = puck.possessor.y + Math.sin(angleToGoal) * interceptDist;
                    moveAngle = angle(this.x, this.y, targetX, targetY);
                } else {
                    this.strategy = 'Pressure Puck';
                    this.currentState = 'Pressuring Carrier';
                    moveAngle = angle(this.x, this.y, puck.possessor.x, puck.possessor.y);
                }

            } else { // Puck is loose
                 // --- Loose Puck / Positioning Underwater ---
                 // *** Prioritize puck if it's near own goal ***
                 if (puckInDefensiveZone || puckInGoalZone) {
                     this.strategy = 'Defend Loose Puck';
                     this.currentState = 'Chasing (Defensive)';
                     moveAngle = angle(this.x, this.y, puck.x, puck.y);
                 } else {
                     // *** Wing Rotation Logic ***
                     const puckIsLeft = puck.y < POOL_HEIGHT / 2 - WING_SIDE_THRESHOLD;
                     const puckIsRight = puck.y > POOL_HEIGHT / 2 + WING_SIDE_THRESHOLD;
                     const isOnWing = this.role.includes('L') || this.role.includes('R');
                     let isOffWing = false;
                     if (isOnWing) {
                         if ((this.role.includes('L') && puckIsRight) || (this.role.includes('R') && puckIsLeft)) {
                             isOffWing = true;
                         }
                     }

                     if (isOffWing) {
                         this.strategy = 'Recover Off-Wing';
                         this.currentState = 'Repositioning Center';
                         const formationPos = this.getFormationPosition(puck, players);
                         const targetX = (this.x + formationPos.x) * 0.5;
                         const targetY = (this.y + POOL_HEIGHT / 2) * 0.5;
                         moveAngle = angle(this.x, this.y, targetX, targetY);
                         if (this.breath < MAX_BREATH * 0.6) {
                              this.strategy = 'Surfacing (Off-Wing)';
                              this.surface();
                              return;
                         }
                     } else {
                         // Normal loose puck behavior (balance chasing and formation)
                         this.strategy = 'Get Puck/Position';
                         this.currentState = 'Chasing/Positioning';
                         const angleToPuck = angle(this.x, this.y, puck.x, puck.y);
                         let puckVecX = Math.cos(angleToPuck);
                         let puckVecY = Math.sin(angleToPuck);
                         let puckWeight = 1.0;

                         const formationPos = this.getFormationPosition(puck, players);
                         const angleToFormation = angle(this.x, this.y, formationPos.x, formationPos.y);
                         let formationVecX = Math.cos(angleToFormation);
                         let formationVecY = Math.sin(angleToFormation);
                         let formationWeight = AI_FORMATION_WEIGHT * Math.min(1, distToPuck / (POOL_WIDTH * 0.25));

                         if (this.role.includes('B')) {
                             formationWeight *= 1.8;
                         }
                         puckWeight = 1.0 - formationWeight;

                         let finalVecX = puckVecX * puckWeight + formationVecX * formationWeight;
                         let finalVecY = puckVecY * puckWeight + formationVecY * formationWeight;
                         moveAngle = Math.atan2(finalVecY, finalVecX);
                     }
                 }
            }

            // Apply the calculated force
            this.applyForce(Math.cos(moveAngle) * forceMagnitude, Math.sin(moveAngle) * forceMagnitude);
        }
    }


    update() {
        super.update(this.friction);
        this.manageBreath();
    }

    draw() {
         if (!ctx) return;
        ctx.globalAlpha = this.isUnderwater ? 1.0 : 0.35;

        // --- Draw Rotated Rectangle ---
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Draw Body
        ctx.fillStyle = this.color;
        ctx.strokeStyle = this.team === 'white' ? '#555' : '#ccc';
        ctx.lineWidth = 1;
        ctx.fillRect(-this.height / 2, -this.width / 2, this.height, this.width);
        ctx.strokeRect(-this.height / 2, -this.width / 2, this.height, this.width);

        // Draw Role Text
        ctx.fillStyle = this.team === 'white' ? '#000000' : '#FFFFFF';
        ctx.font = 'bold 9px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.role, 0, 0);

        ctx.restore();


        // --- Draw Stick Visual (if underwater) ---
        if (this.isUnderwater) {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.angle);

            const stickSideOffset = (this.width / 2 + 2) * this.stickSide;
            const stickForwardOffset = this.height * 0.4;
            const stickLength = 15; // Increased stick visual length

            ctx.beginPath();
            ctx.moveTo(stickForwardOffset, stickSideOffset);
            ctx.lineTo(stickForwardOffset + stickLength, stickSideOffset);

            ctx.strokeStyle = this.stickColor;
            ctx.lineWidth = 4;
            ctx.stroke();
            ctx.restore();
        }

        ctx.globalAlpha = 1.0;
    }
}

// --- Game Functions ---

function showMessage(text, showButton = true, isCountdown = false) {
    messageText.textContent = text;
    messageText.style.display = isCountdown ? 'none' : 'block';
    countdownText.style.display = isCountdown ? 'block' : 'none';
    continueButton.style.display = showButton ? 'inline-block' : 'none';
    messageOverlay.classList.add('visible');
    gamePaused = true;
}

function hideMessage() {
    messageOverlay.classList.remove('visible');
    // gamePaused = false; // Let calling function manage pause state
}

function startCountdown() {
    countdownTimer = START_COUNTDOWN_SECONDS;
    countdownText.textContent = countdownTimer;
    showMessage("Get Ready!", false, true);

    if (countdownIntervalId) clearInterval(countdownIntervalId);

    countdownIntervalId = setInterval(() => {
        countdownTimer--;
        if (countdownTimer > 0) {
            countdownText.textContent = countdownTimer;
        } else {
            clearInterval(countdownIntervalId);
            countdownIntervalId = null;
            hideMessage();
            startGame();
        }
    }, 1000);
}

function startGame() {
     console.log("Starting game after countdown!");
     gameState = 'RUNNING';
     gamePaused = false;

     players.forEach(player => {
         if (player.role.includes('F')) {
             player.dive();
             player.strategy = 'Race for Puck';
             player.currentState = 'Diving for Puck';
             player.initialDiveTargetMet = false;
         } else {
             player.strategy = 'Follow Forward';
             player.currentState = 'Waiting (Surface)';
             player.initialDiveTargetMet = true;
         }
     });

     if (!animationFrameId) {
         gameLoop();
     }
}


function initGame() {
    console.log("Initializing game...");
    gameState = 'INITIALIZING';
    gamePaused = false;
    if (countdownIntervalId) clearInterval(countdownIntervalId);
    countdownIntervalId = null;
     if (animationFrameId) cancelAnimationFrame(animationFrameId);
     animationFrameId = null;

    hideMessage();
    score = { white: 0, black: 0 };
    updateScoreboard();
    players = [];
    sortedPlayerList = [];

    // Create players temporarily before assigning roles
    let tempPlayers = { white: [], black: [] };
    let roleIndex = 0;
    for (let team of ['white', 'black']) {
         roleIndex = 0;
         for (let i = 0; i < NUM_PLAYERS_PER_TEAM; i++) {
             const role = FORMATION_ROLES[roleIndex % FORMATION_ROLES.length];
             const player = new Player(0, 0, team, role); // Temp position
             tempPlayers[team].push(player);
             roleIndex++;
         }
    }

    // *** Assign strongest players to center roles ***
    for (let team of ['white', 'black']) {
         let forwards = tempPlayers[team].filter(p => p.role.includes('F'));
         let backs = tempPlayers[team].filter(p => p.role.includes('B'));

         // Assign Center Forward
         if (forwards.length >= 3) {
             forwards.sort((a, b) => (b.baseSpeed * b.flickStrength) - (a.baseSpeed * a.flickStrength)); // Sort descending by strength
             let currentCF = forwards.find(p => p.role === 'CF');
             if (currentCF && forwards[0] !== currentCF) { // If strongest isn't already CF
                 let strongestRole = forwards[0].role;
                 forwards[0].role = 'CF'; // Assign strongest to CF
                 currentCF.role = strongestRole; // Assign old CF the strongest's original role
                 console.log(`${team} CF assigned to player originally ${strongestRole}`);
             }
         }
         // Assign Center Back
         if (backs.length >= 3) {
              backs.sort((a, b) => (b.baseSpeed * b.flickStrength) - (a.baseSpeed * a.flickStrength)); // Sort descending by strength
              let currentCB = backs.find(p => p.role === 'CB');
              if (currentCB && backs[0] !== currentCB) { // If strongest isn't already CB
                  let strongestRole = backs[0].role;
                  backs[0].role = 'CB'; // Assign strongest to CB
                  currentCB.role = strongestRole; // Assign old CB the strongest's original role
                  console.log(`${team} CB assigned to player originally ${strongestRole}`);
              }
         }
         players = players.concat(tempPlayers[team]); // Add processed team players to main list
    }


    puck = new Puck(POOL_WIDTH / 2, POOL_HEIGHT / 2);
    puck.possessor = null;

    sortPlayersForStatus(); // Sort players for consistent status display *after* role assignment

    console.log(`Game Initialized. Players: ${players.length}. Setting up for pre-start.`);
    resetPositions(); // Position players at walls based on final role
    gameState = 'PRE_START';
    updateStatusBoard();
    drawInitialState(); // Draw the initial frame
    startCountdown(); // Start the countdown
}

// Function to draw the initial state
function drawInitialState() {
     if (!ctx) return;
     ctx.clearRect(0, 0, POOL_WIDTH, POOL_HEIGHT);
     drawGoals();
     drawCenterLine();
     players.forEach(player => player.draw());
     if (puck) puck.draw();
}


function resetPositions(isGoalReset = false) {
     console.log("Resetting positions...");
     if (!puck) {
         puck = new Puck(POOL_WIDTH / 2, POOL_HEIGHT / 2);
     }
     puck.possessor = null;

     const centerGoalY = POOL_HEIGHT / 2;

     players.forEach((player) => {
         const startX = player.team === 'white' ? player.radius + 5 : POOL_WIDTH - player.radius - 5;
         let startY = centerGoalY;

         // *** Calculate Y based on final assigned role ***
         switch (player.role) {
             case 'CF': startY = centerGoalY; break;
             case 'LF': startY = centerGoalY - START_POS_Y_SPREAD * 1; break;
             case 'RF': startY = centerGoalY + START_POS_Y_SPREAD * 1; break;
             case 'LB': startY = centerGoalY - START_POS_Y_SPREAD * 2; break;
             case 'CB': startY = centerGoalY + START_POS_Y_SPREAD * 2; break;
             case 'RB': startY = centerGoalY + START_POS_Y_SPREAD * 3; break;
             default:
                  startY = centerGoalY + (Math.random() - 0.5) * POOL_HEIGHT * 0.4;
                  break;
         }
         startY = Math.max(player.radius + 2, Math.min(POOL_HEIGHT - player.radius - 2, startY));

         player.x = startX;
         player.y = startY;
         player.vx = 0;
         player.vy = 0;
         player.angle = player.team === 'white' ? 0 : Math.PI;
         player.surface();
         player.breath = MAX_BREATH;
         player.currentState = 'Waiting at Wall';
         player.strategy = 'Positioning';
         player.initialDiveTargetMet = false;
     });

    puck.x = POOL_WIDTH / 2;
    puck.y = POOL_HEIGHT / 2;
    puck.vx = 0;
    puck.vy = 0;

    if (isGoalReset) {
        console.log("Goal reset: Starting countdown.");
        gameState = 'PRE_START';
        updateStatusBoard();
        drawInitialState();
        startCountdown();
    } else {
         updateStatusBoard();
    }
}


function updateScoreboard() {
    scoreWhiteEl.textContent = score.white;
    scoreBlackEl.textContent = score.black;
}

// Function to sort players for status board
function sortPlayersForStatus() {
     const roleOrder = FORMATION_ROLES;
     // Sort a copy of the players array
     sortedPlayerList = [...players].sort((a, b) => {
         if (a.team < b.team) return -1;
         if (a.team > b.team) return 1;
         const roleAIndex = roleOrder.indexOf(a.role);
         const roleBIndex = roleOrder.indexOf(b.role);
         return roleAIndex - roleBIndex;
     });
}


function updateStatusBoard() {
    if (!statusBoardBody) return;
    statusBoardBody.innerHTML = '';

    // Iterate over the pre-sorted list
    sortedPlayerList.forEach(player => {
        const row = statusBoardBody.insertRow();
        row.insertCell().textContent = player.team.charAt(0).toUpperCase() + player.team.slice(1);
        row.cells[0].className = player.team === 'white' ? 'team-white-text' : 'team-black-text';
        row.insertCell().textContent = player.role;
        row.insertCell().textContent = player.handedness;
        row.insertCell().textContent = player.isUnderwater ? 'Bottom' : 'Surface';
        row.insertCell().textContent = player.strategy;
        row.insertCell().textContent = player.currentState;
        // *** Calculate and display approx breath seconds based on individual max ***
        const approxBreathSeconds = (player.breath / MAX_BREATH) * player.maxBreathSeconds;
        row.insertCell().textContent = `${approxBreathSeconds.toFixed(1)}s`;
        row.insertCell().textContent = player.maxBreathSeconds.toFixed(1); // Display Max Breath
        row.insertCell().textContent = player.baseSpeed.toFixed(1);
        row.insertCell().textContent = player.flickStrength.toFixed(1);
    });
}


function checkCollisions() {
     if (!puck) return;

    // Player-Puck Possession Check
    players.forEach(player => {
        if (!player.isUnderwater) return;

        // Calculate stick tip position (simplified for collision check)
        const stickForwardOffset = player.height * 0.5 + STICK_VISUAL_LENGTH * 0.5; // Approx center of stick length
        const stickSideOffset = (player.width / 2) * player.stickSide;
        const stickTipX = player.x + Math.cos(player.angle) * stickForwardOffset - Math.sin(player.angle) * stickSideOffset;
        const stickTipY = player.y + Math.sin(player.angle) * stickForwardOffset + Math.cos(player.angle) * stickSideOffset;

        // Check distance from puck to stick tip area
        const dist = distance(stickTipX, stickTipY, puck.x, puck.y);
        const reachRadius = STICK_VISUAL_LENGTH * 0.5 + puck.radius; // Effective reach area around stick tip

        if (dist < reachRadius) {
            if (!puck.possessor || puck.possessor.team !== player.team) {
                 if(puck.possessor) {
                     puck.possessor.applyForce((puck.possessor.x - player.x) * 0.05, (puck.possessor.y - player.y) * 0.05);
                 }
                 puck.possessor = player;
                 // Puck velocity is now heavily dampened when possessed, no need to add player velocity here
            }
        }
    });

     // Player-Player Repulsion (Underwater Only)
     for (let i = 0; i < players.length; i++) {
         for (let j = i + 1; j < players.length; j++) {
             const p1 = players[i];
             const p2 = players[j];

             if (!p1.isUnderwater || !p2.isUnderwater) continue;

             const dist = distance(p1.x, p1.y, p2.x, p2.y);
             const minDist = p1.radius + p2.radius + 3;

             if (dist < minDist && dist > 0.1) {
                 const angleBetween = angle(p1.x, p1.y, p2.x, p2.y);
                 const overlap = minDist - dist;
                 const force = overlap * PLAYER_REPULSION_FORCE;

                 p1.applyForce(-Math.cos(angleBetween) * force, -Math.sin(angleBetween) * force);
                 p2.applyForce(Math.cos(angleBetween) * force, Math.sin(angleBetween) * force);
             }
         }
     }
     // Puck-Player collision (loose puck) handled in Puck.update()
}

function checkGoal() {
     if (!puck || gameState !== 'RUNNING') return false;

     const goalYMin = (POOL_HEIGHT / 2) - (GOAL_WIDTH / 2);
     const goalYMax = (POOL_HEIGHT / 2) + (GOAL_WIDTH / 2);
     let goalScored = false;

     // *** Goal Check: Puck's relevant edge must be past the goal line depth ***
     const goalLineLeft = GOAL_DEPTH;
     const goalLineRight = POOL_WIDTH - GOAL_DEPTH;

     // Black scores on left goal (Puck's right edge past line)
     if (puck.x + puck.radius < goalLineLeft && puck.y > goalYMin && puck.y < goalYMax) {
         score.black++;
         goalScored = true;
         showMessage(`Goal for Black Team! (${score.white}-${score.black})`, true);
     }
     // White scores on right goal (Puck's left edge past line)
     else if (puck.x - puck.radius > goalLineRight && puck.y > goalYMin && puck.y < goalYMax) {
         score.white++;
         goalScored = true;
         showMessage(`Goal for White Team! (${score.white}-${score.black})`, true);
     }


     if (goalScored) {
         updateScoreboard();
         gameState = 'PAUSED';
         gamePaused = true;
         cancelAnimationFrame(animationFrameId);
         animationFrameId = null;
         return true;
     }
     return false;
}

function drawGoals() {
     if (!ctx) return;
    const goalY = (POOL_HEIGHT / 2) - (GOAL_WIDTH / 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.fillRect(0, goalY, GOAL_DEPTH, GOAL_WIDTH);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, goalY, GOAL_DEPTH, GOAL_WIDTH);
    ctx.fillRect(POOL_WIDTH - GOAL_DEPTH, goalY, GOAL_DEPTH, GOAL_WIDTH);
     ctx.strokeStyle = '#000000';
     ctx.lineWidth = 2;
     ctx.strokeRect(POOL_WIDTH - GOAL_DEPTH, goalY, GOAL_DEPTH, GOAL_WIDTH);
}

function drawCenterLine() {
     if (!ctx) return;
     ctx.beginPath();
     ctx.moveTo(POOL_WIDTH / 2, 0);
     ctx.lineTo(POOL_WIDTH / 2, POOL_HEIGHT);
     ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
     ctx.lineWidth = 1;
     ctx.setLineDash([5, 5]);
     ctx.stroke();
     ctx.setLineDash([]);
}


function gameLoop() {
    if (gameState !== 'RUNNING' || gamePaused) {
         if (gameState === 'PRE_START' || gamePaused) {
             drawInitialState(); // Keep drawing static or paused state
             if (!animationFrameId) animationFrameId = requestAnimationFrame(gameLoop);
         } else {
             cancelAnimationFrame(animationFrameId);
             animationFrameId = null;
         }
         return;
    }

     if (!ctx) { console.error("Canvas context lost!"); gameState = 'STOPPED'; return; }

    ctx.clearRect(0, 0, POOL_WIDTH, POOL_HEIGHT);

    // --- Draw Background ---
    drawGoals();
    drawCenterLine();

    // --- Update ---
    players.forEach(player => {
        player.updateAI(puck, players);
        player.update();
    });
     if (puck) puck.update(players);
    checkCollisions();
    const goalJustScored = checkGoal();

    // --- Draw ---
    players.sort((a, b) => a.isUnderwater - b.isUnderwater);
    players.forEach(player => player.draw());
     if (puck) puck.draw();

    // --- Update UI ---
    updateStatusBoard();

    // --- Request Next Frame ---
     if (gameState === 'RUNNING' && !gamePaused) {
        animationFrameId = requestAnimationFrame(gameLoop);
     } else {
         animationFrameId = null;
     }
}

// --- Event Listeners ---
resetButton.addEventListener('click', () => {
     console.log("Reset button clicked");
     gameState = 'STOPPED';
     gamePaused = false;
     if (countdownIntervalId) clearInterval(countdownIntervalId);
     countdownIntervalId = null;
     cancelAnimationFrame(animationFrameId);
     animationFrameId = null;
     setTimeout(() => { initGame(); }, 0);
});

continueButton.addEventListener('click', () => {
    if (gameState === 'PAUSED') {
         console.log("Continue button clicked after goal.");
         hideMessage();
         resetPositions(true); // Pass true to indicate it's a goal reset -> starts countdown
    }
});

 // --- Resize Handling ---
 function resizeCanvas() {
     console.log("Resizing canvas...");
    const container = canvas.parentNode;
     if (!container) return;
    const containerWidth = container.clientWidth;
    const aspectRatio = 800 / 500;
    canvas.width = containerWidth;
    canvas.height = containerWidth / aspectRatio;
    POOL_WIDTH = canvas.width;
    POOL_HEIGHT = canvas.height;
     console.log(`Canvas resized to: ${POOL_WIDTH}x${POOL_HEIGHT}`);

     if (ctx) {
         drawInitialState();
         updateStatusBoard();
     }
}
window.addEventListener('resize', resizeCanvas);

// --- Initial Game Start ---
window.onload = () => {
     console.log("Window loaded.");
     try {
         resizeCanvas();
         console.log("Initial resize complete.");
         initGame(); // Sets up pre-start and starts countdown
     } catch (error) {
         console.error("Error during initial setup:", error);
         const uiContainer = document.getElementById('ui-container');
         if (uiContainer) {
             uiContainer.innerHTML = "<p class='text-red-600 font-bold'>Error loading game. Please check console (F12).</p>";
         }
     }
};
