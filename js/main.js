// Main Game Entry Point & Initialization
window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;

  // Initialize systems
  window.uiManager = new UIManager();
  window.gameEngine = new GameEngine(canvas);
  window.engine = window.gameEngine;

  // Speed controls
  document.getElementById('btn-speed-pause').addEventListener('click', () => {
    window.gameEngine.isPaused = !window.gameEngine.isPaused;
    document.getElementById('btn-speed-pause').textContent = window.gameEngine.isPaused ? '▶️ Resume' : '⏸️ Pause';
  });

  document.getElementById('btn-speed-1x').addEventListener('click', () => {
    window.gameEngine.timeScale = 1.0;
    window.gameEngine.isPaused = false;
    updateSpeedButtons('btn-speed-1x');
  });

  document.getElementById('btn-speed-2x').addEventListener('click', () => {
    window.gameEngine.timeScale = 2.0;
    window.gameEngine.isPaused = false;
    updateSpeedButtons('btn-speed-2x');
  });

  document.getElementById('btn-speed-5x').addEventListener('click', () => {
    window.gameEngine.timeScale = 5.0;
    window.gameEngine.isPaused = false;
    updateSpeedButtons('btn-speed-5x');
  });

  // Top action buttons
  const manualAimBtn = document.getElementById('btn-manual-aim');
  if (manualAimBtn) {
    manualAimBtn.addEventListener('click', () => {
      window.gameEngine.toggleManualAim();
    });
  }

  // Tactical CRT Scanlines Toggle
  const crtBtn = document.getElementById('btn-crt-toggle');
  const crtOverlay = document.getElementById('crt-overlay');
  let crtActive = false;

  function toggleCRT() {
    crtActive = !crtActive;
    document.body.classList.toggle('crt-active', crtActive);
    if (crtOverlay) {
      crtOverlay.style.display = crtActive ? 'block' : 'none';
    }
    if (crtBtn) {
      crtBtn.textContent = crtActive ? '📺 CRT: ON' : '📺 CRT: OFF';
      crtBtn.classList.toggle('active', crtActive);
    }
    if (window.soundSystem && window.soundSystem.playCRTClick) {
      window.soundSystem.playCRTClick(crtActive);
    }
  }

  if (crtBtn) {
    crtBtn.addEventListener('click', toggleCRT);
  }

  document.getElementById('btn-audio-toggle').addEventListener('click', () => {
    const isMuted = window.soundSystem.toggleMute();
    document.getElementById('btn-audio-toggle').textContent = isMuted ? '🔇 Unmute' : '🔊 Sound';
  });

  document.getElementById('btn-open-roster').addEventListener('click', () => {
    window.uiManager.openSurvivorsRoster();
  });

  document.getElementById('btn-open-research').addEventListener('click', () => {
    window.uiManager.openResearchModal();
  });

  document.getElementById('btn-open-expedition').addEventListener('click', () => {
    window.uiManager.openExpeditionModal();
  });

  document.getElementById('btn-open-help').addEventListener('click', () => {
    window.uiManager.openHelpModal();
  });

  // Keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      document.getElementById('btn-speed-pause').click();
    } else if (e.key === '1') {
      document.getElementById('btn-speed-1x').click();
    } else if (e.key === '2') {
      document.getElementById('btn-speed-2x').click();
    } else if (e.key === '3') {
      document.getElementById('btn-speed-5x').click();
    } else if (e.key === 'm' || e.key === 'M') {
      // Toggle manual crosshair aim
      window.gameEngine.toggleManualAim();
    } else if (e.key === 'c' || e.key === 'C') {
      toggleCRT();
    } else if (e.key === 'r' || e.key === 'R') {
      // Quick reload both turrets
      window.gameEngine.leftTurret.reload();
      window.gameEngine.rightTurret.reload();
    } else if (e.key === 'Escape') {
      window.uiManager.closeModal();
    }
  });

  function updateSpeedButtons(activeId) {
    ['btn-speed-1x', 'btn-speed-2x', 'btn-speed-5x'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.classList.toggle('active', id === activeId);
    });
    const pauseBtn = document.getElementById('btn-speed-pause');
    if (pauseBtn) pauseBtn.textContent = '⏸️ Pause';
  }

  // Start the engine loop
  window.gameEngine.start();
  window.gameEngine.addNotification("🏕️ Welcome Commander! Maintain ammo supplies and defend against the horde.", "info");
});
