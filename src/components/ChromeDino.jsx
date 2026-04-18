import React, { useEffect, useRef, useState } from 'react';

// High-fidelity Assets from Abirett3/t-rex-runner-v2
const SPRITE_1X = 'https://raw.githubusercontent.com/Abirett3/t-rex-runner-v2/master/assets/default_100_percent/100-offline-sprite.png';
const SPRITE_2X = 'https://raw.githubusercontent.com/Abirett3/t-rex-runner-v2/master/assets/default_200_percent/200-offline-sprite.png';

export default function ChromeDino() {
  const containerRef = useRef(null);
  const engineRef = useRef(null);
  const [assetsLoaded, setAssetsLoaded] = useState(false);

  useEffect(() => {
    // Porting the Chromium T-Rex Runner logic
    (function () {
      'use strict';

      function Runner(containerSelector, opt_config) {
        if (Runner.instance_) {
          Runner.instance_.stop();
          Runner.instance_ = null;
        }
        Runner.instance_ = this;
        this.containerEl = document.querySelector(containerSelector);
        this.config = opt_config || Runner.config;
        this.playing = false;
        this.crashed = false;
        this.paused = false;
        this.distanceRan = 0;
        this.highestScore = 0;
        this.time = 0;
        this.currentSpeed = this.config.SPEED;
        this.obstacles = [];
        this.imagesLoaded = 0;
        this.loadImages();
      }

      window.Runner = Runner;
      Runner.config = {
        SPEED: 4,
        MAX_SPEED: 13,
        ACCELERATION: 0.0005,
        GRAVITY: 0.6,
        INITIAL_JUMP_VELOCITY: 12,
        CLEAR_TIME: 3000,
        GAP_COEFFICIENT: 0.6,
      };

      Runner.prototype = {
        loadImages: function () {
          const sprite2x = document.getElementById('offline-resources-2x');
          this.imageSprite = sprite2x;
          
          if (this.imageSprite.complete) {
            this.init();
          } else {
            this.imageSprite.onload = () => this.init();
          }
        },
        init: function () {
          const icon = document.querySelector('.icon-offline');
          if (icon) icon.style.visibility = 'hidden';

          if (this.containerEl.querySelector('canvas')) {
            this.containerEl.querySelector('canvas').remove();
          }

          this.canvas = document.createElement('canvas');
          this.canvas.width = 600;
          this.canvas.height = 150;
          this.containerEl.appendChild(this.canvas);
          this.ctx = this.canvas.getContext('2d');
          
          this.tRex = new Trex(this.canvas);
          this.horizon = new Horizon(this.canvas);
          
          this.startListening();
          this.update();
        },
        update: function () {
          if (this.paused) return;
          this.updatePending = false;
          if (this.playing) {
            this.ctx.clearRect(0, 0, 600, 150);
            this.horizon.update(this.currentSpeed);
            this.tRex.update();
            
            // Collision detection
            if (this.horizon.obstacles.length > 0) {
              const obs = this.horizon.obstacles[0];
              // T-rex box: 50, y, 44, 47
              if (this.tRex.x + this.tRex.width - 15 > obs.x && 
                  this.tRex.x + 15 < obs.x + obs.width && 
                  this.tRex.y + this.tRex.height - 10 > obs.y) {
                this.gameOver();
              }
            }
            
            this.distanceRan += this.currentSpeed / 10;
            if (this.currentSpeed < this.config.MAX_SPEED) this.currentSpeed += this.config.ACCELERATION;
          }
          
          this.tRex.draw(this.imageSprite);
          this.horizon.draw(this.imageSprite);
          this.drawScore();
          
          if (!this.crashed) {
            this.raqId = requestAnimationFrame(() => this.update());
          }
        },
        drawScore: function() {
          this.ctx.fillStyle = '#535353';
          this.ctx.font = '12px monospace';
          this.ctx.textAlign = 'right';
          this.ctx.fillText(Math.floor(this.distanceRan).toString().padStart(5, '0'), 580, 20);
        },
        gameOver: function() {
          this.playing = false;
          this.crashed = true;
          this.ctx.fillStyle = 'rgba(255,255,255,0.7)';
          this.ctx.fillRect(0,0,600,150);
          this.ctx.fillStyle = '#535353';
          this.ctx.textAlign = 'center';
          this.ctx.font = 'bold 24px monospace';
          this.ctx.fillText('ENCRYPTION FAILED', 300, 70);
          this.ctx.font = '14px monospace';
          this.ctx.fillText('Press Space or Tap to retry', 300, 100);
          cancelAnimationFrame(this.raqId);
        },
        restart: function() {
          if (!this.crashed) return;
          this.playing = true;
          this.crashed = false;
          this.distanceRan = 0;
          this.currentSpeed = this.config.SPEED;
          this.horizon.reset();
          this.tRex.reset();
          this.update(); // RESTART THE LOOP
        },
        startListening: function () {
          this.keydownHandler = (e) => {
            if (e.code === 'Space' || e.code === 'ArrowUp') {
              if (this.crashed) {
                this.restart();
              } else if (!this.playing) {
                this.playing = true;
              }
              this.tRex.jump();
              e.preventDefault();
            }
            if (e.code === 'ArrowDown' && this.playing) {
              this.tRex.setDuck(true);
            }
          };
          this.keyupHandler = (e) => {
            if (e.code === 'ArrowDown') this.tRex.setDuck(false);
          };
          this.touchstartHandler = (e) => {
            if (this.crashed) this.restart();
            else if (!this.playing) this.playing = true;
            this.tRex.jump();
          };
          
          document.addEventListener('keydown', this.keydownHandler);
          document.addEventListener('keyup', this.keyupHandler);
          this.containerEl.addEventListener('touchstart', this.touchstartHandler);
        },
        stop: function() {
          this.paused = true;
          this.playing = false;
          cancelAnimationFrame(this.raqId);
          document.removeEventListener('keydown', this.keydownHandler);
          document.removeEventListener('keyup', this.keyupHandler);
          this.containerEl.removeEventListener('touchstart', this.touchstartHandler);
        }
      };

      // --- Trex Helper ---
      function Trex(canvas) {
        this.ctx = canvas.getContext('2d');
        this.width = 44;
        this.height = 47;
        this.x = 50;
        this.y = 103;
        this.vy = 0;
        this.jumping = false;
        this.ducking = false;
        this.animFrame = 0;
        this.animTimer = 0;
      }
      Trex.prototype = {
        jump: function() {
          if (!this.jumping) {
            this.vy = -12;
            this.jumping = true;
          }
        },
        setDuck: function(isDucking) {
          this.ducking = isDucking;
        },
        update: function() {
          if (this.jumping) {
            this.vy += 0.6;
            this.y += this.vy;
            if (this.y > 103) {
              this.y = 103;
              this.jumping = false;
              this.vy = 0;
            }
          }
          // Simple animation
          this.animTimer++;
          if (this.animTimer > 5) {
            this.animFrame = (this.animFrame + 1) % 2;
            this.animTimer = 0;
          }
        },
        draw: function(img) {
          // SPRITE POSITIONS FOR TREX (HDPI - 2X)
          // Runner.spriteDefinition.HDPI.TREX is {x: 1678, y: 2}
          let sourceX = 1678;
          if (this.jumping) {
            sourceX = 1678; // Still frame
          } else {
            sourceX = 1678 + (this.width * 2 * (this.animFrame + 2)); // Offset to running frames
          }
          
          if (this.ducking) {
            sourceX = 2203 + (this.animFrame * 59 * 2); // Ducking frames in HDPI
            this.ctx.drawImage(img, sourceX, 2, 59 * 2, 25 * 2, this.x, this.y + 22, 59, 25);
          } else {
            this.ctx.drawImage(img, sourceX, 2, this.width * 2, this.height * 2, this.x, this.y, this.width, this.height);
          }
        },
        reset: function() {
          this.y = 103;
          this.jumping = false;
          this.vy = 0;
        }
      };

      // --- Horizon / Obstacle Helper ---
      function Horizon(canvas) {
        this.ctx = canvas.getContext('2d');
        this.obstacles = [];
      }
      Horizon.prototype = {
        update: function(speed) {
          if (Math.random() < 0.015 && (this.obstacles.length === 0 || this.obstacles[this.obstacles.length-1].x < 350)) {
            const isLarge = Math.random() > 0.5;
            this.obstacles.push({ 
              x: 600, 
              y: isLarge ? 90 : 105, 
              width: isLarge ? 25 : 17, 
              height: isLarge ? 50 : 35,
              spriteX: isLarge ? 652 : 446 // HDPI CACTUS POSITIONS
            });
          }
          this.obstacles.forEach((obs, index) => {
            obs.x -= speed;
            if (obs.x < -50) this.obstacles.splice(index, 1);
          });
        },
        draw: function(img) {
          this.obstacles.forEach(obs => {
            this.ctx.drawImage(img, obs.spriteX, 2, obs.width * 2, obs.height * 2, obs.x, obs.y, obs.width, obs.height);
          });
          // Ground line
          this.ctx.strokeStyle = '#535353';
          this.ctx.lineWidth = 1;
          this.ctx.beginPath();
          this.ctx.moveTo(0, 150);
          this.ctx.lineTo(600, 150);
          this.ctx.stroke();
        },
        reset: function() { this.obstacles = []; }
      };

    })();

    const runner = new window.Runner('.runner-container');
    engineRef.current = runner;

    const checkAssets = setInterval(() => {
      const img2 = document.getElementById('offline-resources-2x');
      if (img2?.complete) {
        setAssetsLoaded(true);
        clearInterval(checkAssets);
      }
    }, 500);

    return () => {
      clearInterval(checkAssets);
      if (engineRef.current) engineRef.current.stop();
      window.Runner = null;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[9995] bg-[#050505] flex flex-col items-center justify-center font-mono overflow-hidden">
      {!assetsLoaded && (
        <div className="absolute inset-0 z-[10001] bg-black flex items-center justify-center text-emerald-500 text-xs animate-pulse">
          INITIALIZING STEALTH ASSETS...
        </div>
      )}
      
      <div className="mb-8 text-emerald-500/50 uppercase tracking-[0.5em] text-sm animate-pulse">A2Connect Stealth Sandbox v2.0</div>
      
      <div 
        className="runner-container relative bg-[#f7f7f7] rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,163,255,0.1)] transition-all duration-700 hover:scale-[1.02]"
        style={{ 
          width: '600px', 
          height: '150px',
          filter: 'invert(0.9) hue-rotate(180deg) contrast(1.2)' // Optimized AMOLED Stealth
        }}
      >
        {/* Missing icon element required by the engine */}
        <div className="icon icon-offline" style={{ position: 'absolute', opacity: 0 }}></div>
      </div>

      <div className="mt-12 text-white/30 text-xs text-center px-6 leading-relaxed bg-white/5 py-3 rounded-2xl border border-white/5 backdrop-blur-sm">
        <span className="text-emerald-500 font-bold uppercase tracking-wider block mb-1">Stealth Controls</span>
        [↑] Jump &nbsp; | &nbsp; [↓] Duck &nbsp; | &nbsp; [Space] Run
        <div className="mt-4 pt-4 border-t border-white/5 space-y-1">
          <p className="text-white/20 text-[10px] uppercase tracking-[0.4em] font-medium font-['Outfit']">
            Made with <span className="text-red-500/50 text-[10px] mx-1 animate-pulse">❤️</span> by <span className="text-white/40 font-bold ml-1 tracking-widest">Abhinav Das</span>
          </p>
          <p className="text-white/10 text-[9px] uppercase tracking-[0.5em] font-bold font-['Outfit']">
            FryLabs Studios
          </p>
        </div>
      </div>

      {/* Required Asset Container */}
      <div id="offline-resources" style={{ display: 'none' }}>
        <img id="offline-resources-1x" src={SPRITE_1X} alt="1x" crossOrigin="anonymous" />
        <img id="offline-resources-2x" src={SPRITE_2X} alt="2x" crossOrigin="anonymous" />
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .runner-container { overflow: hidden; position: relative; }
        .runner-canvas { position: absolute; top: 0; left: 0; z-index: 10; width: 100%; height: 100%; transition: opacity 0.5s; }
        .icon-offline { width: 100px; height: 100px; }
      `}} />
    </div>
  );
}
