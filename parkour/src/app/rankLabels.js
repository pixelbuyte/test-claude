/**
 * Floating "5TH · NAME" tags over each opponent.
 *
 * The reference experience: every runner on screen carries their live placement
 * over their head, so the race reads as a crowd of named rivals rather than
 * anonymous traffic. Done with a fixed pool of DOM nodes projected through the
 * render camera - DOM text stays crisp at any pixel ratio, costs no draw calls,
 * and inherits the HUD's font for free.
 *
 * The pool is allocated once; per frame the only DOM writes are transform
 * strings, and text only when a placement actually changes.
 */
import * as THREE from '../../vendor/three/three.module.min.js';
import { ordinal } from '../sim/math/scalar.js';

const scratch = new THREE.Vector3();

/** Label anchor height over a racer's feet - just above the head. */
const ANCHOR_Y = 2.1;

export class RankLabels {
  /**
   * @param {HTMLElement} container  the #rank-labels layer
   * @param {number} max             pool size; opponents beyond it go untagged
   */
  constructor(container, max = 9) {
    this.tags = [];
    for (let i = 0; i < max; i++) {
      const el = document.createElement('div');
      el.className = 'rank-tag';
      el.style.display = 'none';
      const place = document.createElement('span');
      place.className = 'tag-place';
      const name = document.createElement('span');
      name.className = 'tag-name';
      el.appendChild(place);
      el.appendChild(name);
      container.appendChild(el);
      this.tags.push({ el, place, name, visible: false, placeText: '', nameText: '' });
    }
  }

  /**
   * Repositions every tag for this frame.
   *
   * @param {object|null} session  live RaceSession, or null to hide everything
   * @param {object} renderer      owns the camera and viewport size
   */
  update(session, renderer) {
    let used = 0;

    if (session) {
      const cam = renderer.camera;
      const w = renderer.width;
      const h = renderer.height;
      const views = session.views;

      for (let i = 1; i < views.length && used < this.tags.length; i++) {
        const v = views[i];
        // The session already culled who is worth drawing; tags follow that.
        if (!v.view.root.visible) continue;

        scratch.set(v.render.pos.x, v.render.pos.y + ANCHOR_Y, v.render.pos.z);
        scratch.project(cam);
        // Behind the camera, or past the far plane.
        if (scratch.z < -1 || scratch.z > 1) continue;

        const x = (scratch.x * 0.5 + 0.5) * w;
        const y = (0.5 - scratch.y * 0.5) * h;
        if (x < -60 || x > w + 60 || y < -30 || y > h + 60) continue;

        const tag = this.tags[used++];
        const placeText = ordinal(v.racer.placement || i + 1);
        if (tag.placeText !== placeText) {
          tag.placeText = placeText;
          tag.place.textContent = placeText;
        }
        if (tag.nameText !== v.racer.name) {
          tag.nameText = v.racer.name;
          tag.name.textContent = v.racer.name;
        }
        // Far runners get small tags: a pack forty metres ahead collapses to a
        // few pixels of screen, and full-size labels there pile into a blur.
        const dz = v.render.pos.z - views[0].render.pos.z;
        const shrink = Math.max(0.5, Math.min(1, 1 - (dz - 12) / 90));
        tag.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%) scale(${shrink.toFixed(3)})`;
        if (!tag.visible) {
          tag.visible = true;
          tag.el.style.display = '';
        }
      }
    }

    for (let i = used; i < this.tags.length; i++) {
      if (this.tags[i].visible) {
        this.tags[i].visible = false;
        this.tags[i].el.style.display = 'none';
      }
    }
  }
}
