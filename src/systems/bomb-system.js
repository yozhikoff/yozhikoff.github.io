// 💣 Bomb System - Complete bomb mechanics for NCA Dino Game
// Handles throwing, physics, collisions, explosions, and rendering

export class BombSystem {
    constructor(game) {
        this.game = game;
        this.bombs = [];
        this.explosions = [];
        this.destroyedAreas = new Set();
        
        // Bomb configuration (restored to original values)
        this.bombCooldown = 200; // ms between bombs
        this.bombThrowSpeed = 235; // pixels/second
        this.bombThrowHeight = -2; // Initial upward velocity (was -8, changed to original -2)
        this.bombGravity = 82.8; // Gravity for bomb physics (was 15, changed to original 82.8)
        this.explosionRadius = 20; // NCA pixels
        this.explosionDuration = 250; // 250ms (was 3000ms, changed to original 250ms)
        
        this.lastBombTime = 0;
    }

    throwBomb() {
        const now = performance.now();
        const timeSinceLastBomb = now - this.lastBombTime;
        
        // Check cooldown
        if (timeSinceLastBomb < this.bombCooldown) {
            console.log(`💣 Bomb on cooldown! ${((this.bombCooldown - timeSinceLastBomb) / 1000).toFixed(1)}s remaining`);
            return;
        }
        
        // Calculate bomb starting position (ahead of dino)
        const dinoGameX = this.game.gameWidth * this.game.dinoPosition;
        const dinoGameY = this.game.gameHeight - ((this.game.height - 1 - this.game.dinoGroundY) * this.game.pixelScale) - ((this.game.dinoGroundY - this.game.dinoY) * this.game.pixelScale) - this.game.dinoHeight;
        
        // Create new bomb object
        const bomb = {
            id: Date.now() + Math.random(), // Unique ID
            x: dinoGameX + this.game.dinoWidth * 0.5, // Start closer to dino
            y: dinoGameY + this.game.dinoHeight / 2, // Start at dino center height
            velocityX: this.bombThrowSpeed, // Bomb's own velocity
            velocityY: this.bombThrowHeight, // Initial upward velocity
            worldX: this.game.worldOffset / this.game.pixelScale + (dinoGameX + this.game.dinoWidth) / this.game.pixelScale,
            startTime: now,
            active: true
        };
        
        this.bombs.push(bomb);
        this.lastBombTime = now;
        
        // Apply score penalty: -50 points (but can't exceed current score)
        const currentBaseScore = Math.floor(this.game.worldOffset / this.game.pixelScale);
        const maxAllowedPenalties = currentBaseScore;
        this.game.scorePenalties = Math.min(this.game.scorePenalties + 50, maxAllowedPenalties);
        
        // Show penalty animation
        this.showScorePenalty();
        
        console.log(`💣 BOMB THROWN! Score penalty: -50 (new score: ${this.game.score}). Screen: (${bomb.x.toFixed(1)}, ${bomb.y.toFixed(1)}), World NCA: ${bomb.worldX.toFixed(1)}, WorldOffset: ${this.game.worldOffset.toFixed(1)}, WindowStart: ${this.game.windowStartX}`);
    }
    
    showScorePenalty() {
        // Reset animation by hiding and showing again
        this.game.scorePenalty.style.display = 'none';
        this.game.scorePenalty.style.animation = 'none';
        
        // Force reflow to reset animation
        this.game.scorePenalty.offsetHeight;
        
        // Show with animation
        this.game.scorePenalty.style.display = 'block';
        this.game.scorePenalty.style.animation = 'penalty-fade 2s ease-out forwards';
        
        // Hide after animation completes
        setTimeout(() => {
            this.game.scorePenalty.style.display = 'none';
        }, 2000);
    }

    updateBombs(deltaTime) {
        if (!this.game.currentState) return;
        
        // Update all active bombs
        for (let i = this.bombs.length - 1; i >= 0; i--) {
            const bomb = this.bombs[i];
            if (!bomb.active) continue;
            
            // Update bomb physics
            bomb.x += bomb.velocityX * deltaTime;
            bomb.y += bomb.velocityY * deltaTime;
            bomb.velocityY += this.bombGravity * deltaTime; // Apply gravity
            bomb.worldX += (bomb.velocityX / this.game.pixelScale) * deltaTime;
            
            // Check if bomb hits a cactus during flight
            if (this.checkBombCactusCollision(bomb)) {
                console.log(`💥 BOMB HIT CACTUS MID-FLIGHT!`);
                this.explodeBomb(bomb);
                this.bombs.splice(i, 1); // Remove bomb
                continue; // Skip ground check since bomb already exploded
            }
            
            // Check if bomb hits ground
            const groundLevelY = this.game.gameHeight - ((this.game.height - 1 - this.game.dinoGroundY) * this.game.pixelScale);
            
            // Check if bomb is off-screen or hits ground
            if (bomb.x > this.game.gameWidth + 100 || bomb.y > groundLevelY) {
                // BOOM! Explode the bomb
                this.explodeBomb(bomb);
                this.bombs.splice(i, 1); // Remove bomb
            }
        }
    }

    checkBombCactusCollision(bomb) {
        // Create bomb bounding box for collision detection
        const bombSize = 12; // Bomb collision size in pixels
        const bombBox = {
            x: bomb.x - bombSize/2,
            y: bomb.y - bombSize/2,
            width: bombSize,
            height: bombSize
        };
        
        // Convert bomb position to canvas coordinates for cactus collision
        const bombCanvasY = bomb.y - (this.game.gameHeight - this.game.canvas.height);
        const bombCanvasBox = {
            x: bomb.x,
            y: bombCanvasY,
            width: bombSize,
            height: bombSize
        };
        
        // Check collision with all cactus bounding boxes
        for (const cactus of this.game.cactusBoundingBoxes) {
            if (this.game.boundingBoxesCollide(bombCanvasBox, cactus)) {
                console.log(`💥 Bomb collision with cactus at (${cactus.x}, ${cactus.y})`);
                return true;
            }
        }
        return false;
    }

    explodeBomb(bomb) {
        if (!this.game.currentState) return;
        
        // Use bomb's current screen position to find terrain location
        const bombScreenX = bomb.x;
        const bombNCAX = Math.round(bombScreenX / this.game.pixelScale);
        
        // Find where this screen position maps to in the terrain array
        const viewStartX = Math.floor(this.game.worldOffset / this.game.pixelScale);
        const visibleStartX = Math.max(0, viewStartX - this.game.windowStartX);
        const terrainX = visibleStartX + bombNCAX;
        
        const explosionNCAX = terrainX + 3; // Move 3 pixels to the right
        const explosionNCAY = this.game.dinoGroundY; // Explode at ground level
        
        console.log(`💥 FIXED EXPLOSION: BombScreen=${bombScreenX.toFixed(1)}px, BombNCA=${bombNCAX}, ViewStart=${viewStartX}, VisibleStart=${visibleStartX}, TerrainX=${terrainX}, WindowStart=${this.game.windowStartX}, FinalNCA=(${explosionNCAX}, ${explosionNCAY})`);
        
        // Zero out all channels within explosion radius
        const batch = 0;
        for (let deltaY = -this.explosionRadius; deltaY <= this.explosionRadius; deltaY++) {
            for (let deltaX = -this.explosionRadius; deltaX <= this.explosionRadius; deltaX++) {
                const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                if (distance <= this.explosionRadius) {
                    const targetX = explosionNCAX + deltaX;
                    const targetY = explosionNCAY + deltaY;
                    
                    // Check bounds
                    if (targetX >= 0 && targetX < this.game.currentWidth && 
                        targetY >= 0 && targetY < this.game.height) {
                        
                        // Zero ALL channels (complete terrain destruction!)
                        for (let channel = 0; channel < this.game.channels; channel++) {
                            this.game.currentState.set(batch, channel, targetY, targetX, 0.0);
                        }
                        
                        // Track destroyed area for cactus removal using WORLD coordinates
                        const worldX = this.game.windowStartX + targetX;
                        this.destroyedAreas.add(`${worldX},${targetY}`);
                        
                        // Debug log terrain destruction
                        if (deltaX === 0 && deltaY === 0) {
                            console.log(`💥 CENTER DESTROYED at NCA (${targetX}, ${targetY})`);
                        }
                    }
                }
            }
        }
        
        console.log(`💥 Terrain destroyed in ${this.explosionRadius} NCA pixel radius!`);
        
        // Create explosion visual effect
        const explosionPixels = [];
        const numPixels = Math.floor(this.explosionRadius * this.explosionRadius * 4);
        
        for (let i = 0; i < numPixels; i++) {
            // Random position within explosion radius
            const angle = Math.random() * 2 * Math.PI;
            const distance = Math.random() * this.explosionRadius;
            const deltaX = Math.cos(angle) * distance;
            const deltaY = Math.sin(angle) * distance;
            
            // Random color from explosion palette
            const colorChoices = ['red', 'orange', 'yellow', 'black', 'gray'];
            const baseColor = colorChoices[Math.floor(Math.random() * colorChoices.length)];
            
            explosionPixels.push({
                deltaX: deltaX,
                deltaY: deltaY,
                baseColor: baseColor,
                jitterSeed: Math.random() // For color jitter animation
            });
        }
        
        const explosion = {
            worldX: bomb.worldX, // Store WORLD coordinates so explosion moves with screen
            screenY: bomb.y, // Y doesn't scroll, so screen Y is fine
            pixels: explosionPixels,
            startTime: performance.now(),
            duration: this.explosionDuration,
            active: true
        };
        this.explosions.push(explosion);
    }

    updateExplosions(deltaTime) {
        // Update all active explosions
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const explosion = this.explosions[i];
            if (!explosion.active) continue;
            
            const now = performance.now();
            const elapsed = now - explosion.startTime;
            
            // Remove expired explosions
            if (elapsed >= explosion.duration) {
                this.explosions.splice(i, 1);
            }
        }
    }

    drawBombs(overlayCtx, gameWidth, gameHeight) {
        // Draw all active bombs on the overlay
        for (const bomb of this.bombs) {
            if (!bomb.active) continue;
            
            const screenX = bomb.x;
            const screenY = bomb.y;
            
            // Only draw if on screen
            if (screenX >= -20 && screenX <= gameWidth + 20 && 
                screenY >= -20 && screenY <= gameHeight + 20) {
                
                // Draw bomb as emoji 💣
                overlayCtx.font = '24px Arial';
                overlayCtx.textAlign = 'center';
                overlayCtx.textBaseline = 'middle';
                overlayCtx.fillText('💣', screenX, screenY);
                
                // Debug info if debug boxes are enabled
                if (this.game.showDebugBoxes) {
                    overlayCtx.fillStyle = '#000000';
                    overlayCtx.font = '10px Arial';
                    overlayCtx.textAlign = 'center';
                    overlayCtx.fillText(
                        `(${bomb.worldX.toFixed(0)})`,
                        screenX,
                        screenY - 15
                    );
                }
            }
        }
    }

    drawExplosions(ctx, gameWidth, gameHeight, worldOffset, pixelScale) {
        // Draw all active explosions as random scattered pixels
        for (const explosion of this.explosions) {
            if (!explosion.active) continue;
            
            const now = performance.now();
            const elapsed = now - explosion.startTime;
            const progress = elapsed / explosion.duration; // 0 to 1
            
            // Convert world coordinates to current screen position - explosion moves with terrain!
            const explosionScreenX = (explosion.worldX * pixelScale) - worldOffset;
            const explosionScreenY = explosion.screenY;
            
            // Only draw if explosion center is somewhat visible
            if (explosionScreenX >= -100 && explosionScreenX <= gameWidth + 100 && 
                explosionScreenY >= -100 && explosionScreenY <= gameHeight + 100) {
                
                // Convert to canvas coordinates
                const canvasX = explosionScreenX;
                const canvasY = explosionScreenY - (gameHeight - ctx.canvas.height);
                
                // Draw each random pixel
                for (const pixel of explosion.pixels) {
                    // Apply pixel offset IN SCREEN COORDINATES
                    const pixelCanvasX = canvasX + (pixel.deltaX * pixelScale);
                    const pixelCanvasY = canvasY + (pixel.deltaY * pixelScale);
                    
                    // Skip if pixel is off canvas
                    if (pixelCanvasX < -pixelScale || pixelCanvasX > ctx.canvas.width + pixelScale || 
                        pixelCanvasY < -pixelScale || pixelCanvasY > ctx.canvas.height + pixelScale) continue;
                    
                    // Create color with jitter animation
                    const jitter = 0.5 + 0.5 * Math.sin((elapsed / 100) + pixel.jitterSeed * 10);
                    let color;
                    
                    switch (pixel.baseColor) {
                        case 'red':
                            color = `rgb(${Math.floor(255 * jitter)}, ${Math.floor(50 * jitter)}, 0)`;
                            break;
                        case 'orange':
                            color = `rgb(255, ${Math.floor(165 * jitter)}, 0)`;
                            break;
                        case 'yellow':
                            color = `rgb(255, 255, ${Math.floor(100 * jitter)})`;
                            break;
                        case 'black':
                            color = `rgb(${Math.floor(50 * jitter)}, ${Math.floor(50 * jitter)}, ${Math.floor(50 * jitter)})`;
                            break;
                        case 'gray':
                            color = `rgb(${Math.floor(128 * jitter)}, ${Math.floor(128 * jitter)}, ${Math.floor(128 * jitter)})`;
                            break;
                        default:
                            color = 'red';
                    }
                    
                    // Draw pixel with fade out over time
                    const alpha = Math.max(0, 1 - progress);
                    ctx.globalAlpha = alpha;
                    ctx.fillStyle = color;
                    ctx.fillRect(
                        Math.floor(pixelCanvasX),
                        Math.floor(pixelCanvasY),
                        pixelScale,
                        pixelScale
                    );
                }
                
                ctx.globalAlpha = 1.0; // Reset alpha
            }
        }
    }

    // Clean up all bomb state (for game restart)
    reset() {
        this.bombs = [];
        this.explosions = [];
        this.destroyedAreas = new Set();
        this.lastBombTime = 0;
    }

    // Check if area was destroyed by explosion
    isAreaDestroyed(worldX, y) {
        return this.destroyedAreas.has(`${worldX},${y}`);
    }
}