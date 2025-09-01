class SimpleHUD {
  private hudElement: HTMLDivElement;

  constructor() {
    this.hudElement = this.createHUD();
    this.attachHUD();
  }

  private createHUD(): HTMLDivElement {
    const hud = document.createElement('div');
    hud.id = 'simple-hud-overlay';
    hud.innerHTML = `
      <div class="hud-content">
        <h3>Simple HUD</h3>
        <p>Extension is running!</p>
        <p>Current URL: ${window.location.hostname}</p>
        <p>Time: ${new Date().toLocaleTimeString()}</p>
      </div>
    `;
    return hud;
  }

  private attachHUD(): void {
    document.body.appendChild(this.hudElement);
    
    setTimeout(() => {
      this.updateTime();
    }, 1000);
  }

  private updateTime(): void {
    const timeElement = this.hudElement.querySelector('.hud-content p:last-child');
    if (timeElement) {
      timeElement.textContent = `Time: ${new Date().toLocaleTimeString()}`;
    }
    setTimeout(() => this.updateTime(), 1000);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new SimpleHUD());
} else {
  new SimpleHUD();
}