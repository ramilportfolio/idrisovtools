(() => {
  "use strict";

  const scales = [.50, .66, .82, 1];
  const fastestTarget = 1000 / 120;
  let noisePixels;

  function frameBudget() {
    let level = scales.length - 1;
    let intervalTarget = 1000 / 60;
    let duration = 0;
    let frames = 0;
    let late = 0;
    let stableWindows = 0;

    function reset() {
      duration = frames = late = stableWindows = 0;
    }

    return {
      get scale() { return scales[level]; },
      reset,
      sample(interval, work) {
        if (interval <= 0) return false;
        if (interval > 180) {
          reset();
          return false;
        }
        if (interval >= 5 && interval < intervalTarget) {
          intervalTarget = Math.max(fastestTarget, interval);
        }
        duration += interval;
        frames++;
        if (interval > intervalTarget * 1.35 || work > intervalTarget * .74) late++;
        if (duration < 1000) return false;

        const previous = level;
        if (late / frames > .25) {
          level = Math.max(0, level - 1);
          stableWindows = 0;
        } else if (late / frames < .05) {
          if (++stableWindows >= 4) {
            level = Math.min(scales.length - 1, level + 1);
            stableWindows = 0;
          }
        } else {
          stableWindows = 0;
        }
        duration = frames = late = 0;
        return level !== previous;
      }
    };
  }

  function surfaceSize(width, height, pixels, maximumScale, quality) {
    const ratio = Math.min(maximumScale, Math.sqrt(pixels / Math.max(1, width * height))) * quality;
    return [Math.max(1, Math.round(width * ratio)), Math.max(1, Math.round(height * ratio))];
  }

  function makeNoise() {
    const size = 128;
    const pixels = new Float32Array(size * size);
    let seed = 76493;
    for (let octave = 0; octave < 4; octave++) {
      const cells = 8 << octave;
      const mask = cells - 1;
      const values = new Float32Array(cells * cells);
      for (let i = 0; i < values.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        values[i] = seed / 4294967296;
      }
      const weight = .54 * .49 ** octave;
      const cellSize = cells / size;
      for (let y = 0; y < size; y++) {
        const fy = y * cellSize;
        const row = Math.floor(fy);
        const nextRow = (row + 1) & mask;
        const dy = fy - row;
        const sy = dy * dy * (3 - 2 * dy);
        for (let x = 0; x < size; x++) {
          const fx = x * cellSize;
          const column = Math.floor(fx);
          const nextColumn = (column + 1) & mask;
          const dx = fx - column;
          const sx = dx * dx * (3 - 2 * dx);
          const a = values[row * cells + column] * (1 - sx) + values[row * cells + nextColumn] * sx;
          const b = values[nextRow * cells + column] * (1 - sx) + values[nextRow * cells + nextColumn] * sx;
          pixels[y * size + x] += weight * (a * (1 - sy) + b * sy);
        }
      }
    }
    return Uint8Array.from(pixels, value => Math.round(value * 255));
  }

  function smokeTexture(gl, program) {
    noisePixels ??= makeNoise();
    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 128, 128, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, noisePixels);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.uniform1i(gl.getUniformLocation(program, "noiseMap"), 0);
    return texture;
  }

  window.SceneRendering = { frameBudget, surfaceSize, smokeTexture };
})();
