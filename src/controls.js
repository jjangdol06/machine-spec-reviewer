// 간소화된 OrbitControls — three/examples 의존성 없이 동작
import * as THREE from 'three';

export class OrbitControls {
  constructor(camera, dom) {
    this.camera = camera; this.dom = dom;
    this.target = new THREE.Vector3(0, 0.5, 0);
    this.spherical = new THREE.Spherical(5, Math.PI/3, Math.PI/4);
    this.update();
    this._dragging = false; this._panning = false;
    this._last = { x:0, y:0 };
    dom.addEventListener('mousedown', e => {
      this._dragging = true;
      this._panning = (e.button === 2 || e.shiftKey);
      this._last = { x:e.clientX, y:e.clientY };
    });
    window.addEventListener('mouseup', () => { this._dragging = false; });
    window.addEventListener('mousemove', e => this._onMove(e));
    dom.addEventListener('wheel', e => {
      e.preventDefault();
      this.spherical.radius *= (1 + e.deltaY * 0.001);
      this.spherical.radius = Math.max(0.5, Math.min(20, this.spherical.radius));
      this.update();
    }, { passive: false });
    dom.addEventListener('contextmenu', e => e.preventDefault());
  }
  _onMove(e) {
    if (!this._dragging) return;
    const dx = e.clientX - this._last.x;
    const dy = e.clientY - this._last.y;
    this._last = { x:e.clientX, y:e.clientY };
    if (this._panning) {
      const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 0);
      const up    = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 1);
      const f = this.spherical.radius * 0.0015;
      this.target.addScaledVector(right, -dx*f).addScaledVector(up, dy*f);
    } else {
      this.spherical.theta -= dx * 0.005;
      this.spherical.phi   -= dy * 0.005;
      this.spherical.phi = Math.max(0.05, Math.min(Math.PI - 0.05, this.spherical.phi));
    }
    this.update();
  }
  update() {
    const offset = new THREE.Vector3().setFromSpherical(this.spherical);
    this.camera.position.copy(this.target).add(offset);
    this.camera.lookAt(this.target);
  }
}
