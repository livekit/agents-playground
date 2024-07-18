import { useEffect, useState } from "react";
import css from "dom-css";
import fit from "canvas-fit";
import mat4 from "gl-mat4";
import array from "new-array";
import shuffle from "shuffle-array";
import Alea from "alea";
import { createSpring } from "spring-animator";
import Delaunator from "delaunator";
import createPlayer from "web-audio-player";
import createCamera from "3d-view-controls";
import glsl from "glslify";

let createRegl: any;
let container: any;
let resize: any;
let canvas: any;
let ctx: any;
let instructions: any;
let button: any;

export const AgentMultibandAudioWaveVisualizer = () => {
  // create Camera
  function createRoamingCamera(canvas: any, center: any, eye: any) {
    let isRoaming = false;
    // let timeout

    const camera = createCamera(canvas, {
      zoomSpeed: 4,
    });

    camera.lookAt(center, eye, [0.52, -0.11, 50]);

    function getPositionFromRads(position: any, rads: any) {
      position[0] = Math.sin(rads) * 1.5;
      position[1] = Math.cos(rads) * 2.7;
      position[2] = (Math.sin(rads) * 0.5 + 0.5) * 3 + 0.5;
      return position;
    }

    // one revolution (6.28 rads) takes 75 seconds (or 4500 frames)
    // or 0.0014 rads per frame
    const startingSpeed = 0.0014; // rads per frame
    let currentRads = 0;
    let cameraUp = new Float32Array(3);
    let currentPosition = getPositionFromRads(new Float32Array(3), currentRads);

    function start() {
      // temporarily disabling these until I figure out how to make the camera
      // gently start moving after an interaction - i think the gentle motion
      // of the camera is an important part of the visualization
      // canvas.addEventListener('mousedown', stopRoaming)
      // window.addEventListener('wheel', stopRoaming)
      isRoaming = true;
    }

    function tick() {
      camera.tick();
      // very minor performance improvement by minimizing array creation in loop
      cameraUp[0] = camera.up[0];
      cameraUp[1] = camera.up[1];
      cameraUp[2] = 999;
      camera.up = cameraUp;

      if (isRoaming) {
        currentPosition = getPositionFromRads(currentPosition, currentRads);
        camera.center = currentPosition;
        currentRads += startingSpeed;
        currentRads %= Math.PI * 2;
      }
    }
    function getMatrix() {
      return camera.matrix;
    }
    function getCenter() {
      return camera.center;
    }
    // function stopRoaming () {
    //   clearTimeout(timeout)
    //   timeout = null
    //   isRoaming = false
    // }

    (window as any).camera = camera;
    return {
      tick,
      start,
      getMatrix,
      getCenter,
    };
  }

  // create titlecard
  const settings = {
    text: "audiofabric",
    particles: 600,
    dampening: 0.35, // 0.17
    stiffness: 0.85, // 0.9
    speed: 50,
    precision: 0.98,
    lineOpacity: 0.17,
    turnGranularity: 12,
    startSpreadMultiplier: 0.35,
    particleDieRate: 0,
    colorThreshold: 200,
    particleSize: 1,
  };

  let rand: any,
    points: any,
    pixelPicker: any,
    rAFToken: any,
    start: any,
    isFading: any;

  function createTitleCard() {
    return {
      resize: function () {
        if (isFading) return;
        start = Date.now();
        resize();
        setup();
        loop();
      },
      show: function () {
        start = Date.now();
        // setTimeout(() => {
        //   css(instructions, { opacity: 1 });
        // }, 1500);
        setup();
        loop();
        return new Promise((resolve) => {
          remove();
          activateDrawers();
          resolve(true);
          return false;
        });
      },
    };

    function remove() {
      isFading = true;
      css(canvas, {
        transition: "opacity 1500ms linear",
        opacity: 0,
      });
      // css(instructions, { opacity: 0 });
      setTimeout(() => {
        window.removeEventListener("resize", resize);
        window.cancelAnimationFrame(rAFToken);
        // container.parentElement.removeChild(container);
      }, 1700);
    }

    function loop() {
      if (!isFading && Date.now() - start > 30000) return;
      window.cancelAnimationFrame(rAFToken);
      rAFToken = window.requestAnimationFrame(loop);
      update();
      draw();
    }

    function setup() {
      const seed = (Math.random() * 1000) | 0; // 74 & 336 looks good
      rand = new Alea(seed);
      console.log(`seed: ${seed}`);
      pixelPicker = getSource();
      points = new Array(settings.particles).fill(null).map(() => {
        const rads = rand() * Math.PI * 2;
        const mag =
          Math.pow(rand(), 0.5) *
          settings.startSpreadMultiplier *
          Math.max(window.innerWidth, window.innerHeight);
        return {
          x: Math.cos(rads) * mag + ctx.canvas.width / 2,
          y: Math.sin(rads) * mag + ctx.canvas.height / 2,
          angle: createSpring(
            settings.dampening,
            settings.stiffness,
            rand() * Math.PI * 2
          ),
          speed: (rand() * settings.speed) / 40,
          entropy: rand(),
          isActive: true,
          line: [],
        };
      });
    }

    function update() {
      points.forEach((p: any) => {
        if (!p.isActive) return;
        const color = pixelPicker(p.x, p.y);
        const averageVal = getAveragePixelVal(color);
        const isOnActivePixel =
          p.line.length || averageVal < settings.colorThreshold;

        if (isOnActivePixel) {
          p.line.push([p.x, p.y]);
        }

        if (rand() < settings.precision) {
          updateNextAngle(p, pixelPicker);
        }

        const angle = p.angle.tick();
        const velX = Math.cos(angle) * p.speed;
        const velY = Math.sin(angle) * p.speed;
        p.x += velX;
        p.y += velY;

        if (rand() < settings.particleDieRate / 10) {
          p.isActive = false;
        }
      });

      let i = 0;
      while (i < points.length) {
        const p = points[i];
        if (
          !p.line.length &&
          (p.x < 0 ||
            p.y < 0 ||
            p.x > ctx.canvas.width ||
            p.y > ctx.canvas.height)
        ) {
          points.splice(i, 1);
        } else {
          i += 1;
        }
      }
    }

    function updateNextAngle(p: any, pixelPicker: any) {
      const angle = p.angle.tick(1, false);
      const currentPixelVal = getAveragePixelVal(pixelPicker(p.x, p.y));
      for (let i = 0; i <= settings.turnGranularity; i += 1) {
        const t = (i / settings.turnGranularity) * Math.PI;
        let velX = Math.cos(angle + t) * p.speed;
        let velY = Math.sin(angle + t) * p.speed;
        let pixel = pixelPicker(p.x + velX, p.y + velY);
        if (getAveragePixelVal(pixel) < currentPixelVal) {
          p.angle.updateValue(angle + t);
          break;
        }
        velX = Math.cos(angle - t) * p.speed;
        velY = Math.sin(angle - t) * p.speed;
        pixel = pixelPicker(p.x + velX, p.y + velY);
        if (getAveragePixelVal(pixel) < currentPixelVal) {
          p.angle.updateValue(angle - t);
          break;
        }
      }
    }

    function activateDrawers() {
      settings.precision = 0.4;
      points.forEach((p: any) => {
        p.isActive = true;
        p.speed *= rand() * 10;
        p.angle = createSpring(0.05, 0.9, p.angle.tick());
        p.angle.updateValue(rand() * Math.PI * 2);
      });
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (settings.particleSize) {
        points.forEach((p: any) => {
          if (!p.isActive) return;
          const radius = p.line.length ? settings.particleSize : 0;
          const opacity = 0.2 * (radius < 10 ? radius / 10 : 1);
          ctx.strokeStyle = `rgba(200, 200, 255, ${opacity})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
          ctx.stroke();
        });
      }

      ctx.beginPath();
      ctx.strokeStyle = `rgba(200, 200, 255, ${settings.lineOpacity})`;
      points.forEach((p: any) => {
        if (p.line.length > 1) {
          ctx.moveTo(p.line[0][0], p.line[0][1]);
          p.line.slice(1).forEach((pt: any) => {
            ctx.lineTo(pt[0], pt[1]);
          });
        }
      });
      ctx.stroke();
    }
  }

  // ---------

  function getAveragePixelVal(pixel: any) {
    return (pixel.r + pixel.g + pixel.b) / 3;
  }

  function getSource() {
    const hiddenCanvas = container.appendChild(
      document.createElement("canvas")
    );
    const hiddenCtx = hiddenCanvas.getContext("2d");
    fit(hiddenCanvas);
    hiddenCanvas.style.display = "none";
    hiddenCtx.fillStyle = "rgb(255, 255, 255)";
    hiddenCtx.fillRect(0, 0, hiddenCanvas.width, hiddenCanvas.height);
    printText(
      hiddenCtx,
      settings.text,
      Math.min(hiddenCanvas.width, hiddenCanvas.height) * 0.1
    );
    const picker = makePixelPicker(hiddenCanvas);
    hiddenCanvas.parentElement.removeChild(hiddenCanvas);
    return picker;
  }

  function makePixelPicker(canvas: any) {
    const imageData = canvas
      .getContext("2d")
      .getImageData(0, 0, canvas.width, canvas.height);
    return (x: any, y: any) => {
      x = x | 0;
      y = y | 0;
      const i = 4 * (x + y * imageData.width);
      return {
        r: imageData.data[i],
        g: imageData.data[i + 1],
        b: imageData.data[i + 2],
        a: imageData.data[i + 3],
      };
    };
  }

  function printText(context: any, text: any, size: any) {
    context.font = `${size}px "Open Sans"`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "rgb(0, 0, 0)";
    context.fillText(text, context.canvas.width / 2, context.canvas.height / 3);
  }

  //create audioControl
  /* function createAudioControls(audio: any, tracks: any) {
    tracks = tracks.map((t: any) => Object.assign({}, t));
    const controlsContainer = document.querySelector(
      ".controls-container"
    ) as any;
    const trackSelector = document.querySelector(".track-selector") as any;
    const titleEl = document.querySelector(".title") as any;
    const artistEl = document.querySelector(".artist") as any;
    const timeEl = document.querySelector(".elapsed-time") as any;
    const seekerEl = document.querySelector(".seeker") as any;
    const progressEl = document.querySelector(".progress") as any;
    const width = 290; // must match .controls-container width

    tracks.map((track: any, i: any) => {
      const trackEl: any = trackSelector.appendChild(
        document.createElement("li")
      );
      trackEl.classList.add("track");
      trackEl.addEventListener("click", () => {
        setTrack(tracks[i]);
        audio.play();
      });
      trackEl.innerHTML = "<span>0" + (1 + i) + ".</span> " + track.title;
      track.el = trackEl;
    });

    function setTrack(track: any) {
      audio.src = track.path;
      tracks.forEach((t: any) => t.el.classList.remove("selected"));
      track.el.classList.add("selected");
      titleEl.innerText = track.title;
      artistEl.innerText = track.artist;
    }

    setTrack(tracks[0]);

    let lastTime: any;
    function tick() {
      if (audio.currentTime !== lastTime) {
        const t = audio.currentTime / audio.duration;
        css(progressEl, "width", `${t * 100}%`);
        timeEl.innerText = formatSeconds(audio.currentTime);
      }
      lastTime = audio.currentTime;
    }

    seekerEl.addEventListener("click", (e: any) => {
      const { left } = seekerEl.getBoundingClientRect();
      const t = (e.clientX - left) / width;
      audio.currentTime = t * audio.duration;
    });

    window.addEventListener("keypress", (e: any) => {
      if (e.key === " ") {
        togglePlay();
      }
    });

    return {
      el: controlsContainer,
      tick: tick,
    };

    function togglePlay() {
      if (audio.paused) {
        audio.play();
      } else {
        audio.pause();
      }
    }
  } */

  // create createRenderBloom
  function createRenderBloom(regl: any, canvas: any) {
    const blueTextureBuffer = new Uint8Array(canvas.width * canvas.height * 4);
    for (let i = 0; i < blueTextureBuffer.length; i += 4) {
      const x = (i / 4) % canvas.width;
      const y = (i / 4 / canvas.width) | 0;
      if (x > 100 && y > 100) {
        blueTextureBuffer[i] = blueTextureBuffer[i + 1] = 0;
        blueTextureBuffer[i + 2] = blueTextureBuffer[i + 3] = 255;
      } else {
        blueTextureBuffer[i] =
          blueTextureBuffer[i + 1] =
          blueTextureBuffer[i + 2] =
            (Math.random() * 255) | 0;
        blueTextureBuffer[i + 3] = 255;
      }
    }
    const tempFbo = regl.framebuffer({
      color: regl.texture({
        shape: [canvas.width, canvas.height, 4],
        data: blueTextureBuffer,
      }),
      depth: true,
      stencil: false,
    });

    const renderBloomBlur = regl({
      vert: glsl`
        precision highp float;
  
        attribute vec2 position;
  
        varying vec2 uv;
  
        void main() {
          uv = position / 2.0 + 0.5;
          gl_Position = vec4(position, 0, 1);
        }
      `,
      frag: glsl`
        precision highp float;
  
        varying vec2 uv;
  
        uniform vec2 iResolution;
        uniform sampler2D iChannel0;
        uniform float blurMag;
  
        vec3 tex(vec2 uv);
  
        // #pragma glslify: blur = require('glsl-hash-blur', sample=tex, iterations=20);

        highp float random(vec2 co)
        {
            highp float a = 12.9898;
            highp float b = 78.233;
            highp float c = 43758.5453;
            highp float dt= dot(co.xy ,vec2(a,b));
            highp float sn= mod(dt,3.14);
            return fract(sin(sn) * c);
        }

        #ifndef TAU
          #define TAU 6.28318530718
        #endif

        vec2 mult(inout vec2 r) {
          r = fract(r * vec2(12.9898,78.233));
          return sqrt(r.x + .001) * vec2(sin(r.y * TAU), cos(r.y * TAU));
        }
        
        vec3 blur(vec2 uv, float radius, float aspect, float offset) {
          vec2 circle = vec2(radius);
          circle.x *= aspect;
          vec2 rnd = vec2(random(vec2(uv + offset)));
        
          vec3 acc = vec3(0.0);
          for (int i = 0; i < 20; i++) {
            acc += tex(uv + circle * mult(rnd)).xyz;
          }
          return acc / float(20);
        }
        
        vec3 blur(vec2 uv, float radius, float aspect) {
          return blur(uv, radius, aspect, 0.0);
        }
        
        vec3 blur(vec2 uv, float radius) {
          return blur(uv, radius, 1.0);
        }
  
        vec3 tex(vec2 uv) {
          vec3 rgb = texture2D(iChannel0, uv).rgb;
          return rgb;
        }
  
        void main() {
          float aspect = iResolution.x / iResolution.y;
          vec3 blurred = blur(uv, blurMag / 200.0, 1.0 / aspect);
          gl_FragColor = vec4(blurred, 0.8);
        }
      `,
      uniforms: {
        iResolution: () => [canvas.width, canvas.height],
        iChannel0: regl.prop("iChannel0"), // sampler2D
        blurMag: regl.prop("blurMag"),
      },
      attributes: {
        position: [-1, -1, -1, 4, 4, -1],
      },
      count: 3,
      primitive: "triangles",
    });

    const renderBloomCombine = regl({
      vert: glsl`
        precision highp float;
  
        attribute vec2 position;
  
        varying vec2 uv;
  
        void main() {
          uv = position / 2.0 + 0.5;
          gl_Position = vec4(position, 0, 1);
        }
      `,
      frag: glsl`
        precision highp float;
  
        varying vec2 uv;
  
        uniform sampler2D iChannel0;
        uniform sampler2D blurredFrame;
        uniform float blurWeight;
        uniform float originalWeight;
  
        void main () {
          vec4 blurred = texture2D(blurredFrame, uv);
          vec4 original = texture2D(iChannel0, uv);
          if (blurred.r < 0.2 && original.r < 0.2) {
            gl_FragColor = original;
          } else {
            blurred.r = pow(blurred.r, 1.9);
            blurred.g = pow(blurred.g, 2.0);
            blurred.b = pow(blurred.b, 1.5);
            vec4 weightedOriginal = originalWeight * original;
            vec4 weightedBlur = blurWeight * blurred;
            // gl_FragColor = vec4(
            //   max(weightedOriginal.r, weightedBlur.r),
            //   max(weightedOriginal.g, weightedBlur.g),
            //   max(weightedOriginal.b, weightedBlur.b),
            //   original.a
            // );
            vec4 result = weightedOriginal + weightedBlur;
            gl_FragColor = vec4(result.rgb / 1.5, result.a);
          }
        }
      `,
      uniforms: {
        iChannel0: regl.prop("iChannel0"), // sampler2D
        blurredFrame: () => tempFbo, // sampler2D
        blurWeight: regl.prop("blurWeight"),
        originalWeight: regl.prop("originalWeight"),
      },
      attributes: {
        position: [-1, -1, -1, 4, 4, -1],
      },
      count: 3,
      primitive: "triangles",
    });

    return function render({
      iChannel0,
      blurMag,
      blurWeight,
      originalWeight,
    }: any) {
      regl({ framebuffer: tempFbo })(() => {
        renderBloomBlur({ iChannel0, blurMag });
      });
      renderBloomCombine({
        iChannel0,
        blurWeight,
        originalWeight,
        blurredFrame: tempFbo,
      });
    };
  }

  // create RenderBlur
  function createRenderBlur(regl: any) {
    return regl({
      vert: glsl`
        precision highp float;
  
        attribute vec2 position;
  
        void main() {
          gl_Position = vec4(position, 0, 1);
        }
      `,
      frag: glsl`
        precision highp float;
  
        uniform vec2 iResolution;
        uniform sampler2D iChannel0;
        uniform vec2 direction;
  
        // #pragma glslify: blur = require(glsl-fast-gaussian-blur/13)

        vec4 blur(sampler2D image, vec2 uv, vec2 resolution, vec2 direction) {
          vec4 color = vec4(0.0);
          vec2 off1 = vec2(1.411764705882353) * direction;
          vec2 off2 = vec2(3.2941176470588234) * direction;
          vec2 off3 = vec2(5.176470588235294) * direction;
          color += texture2D(image, uv) * 0.1964825501511404;
          color += texture2D(image, uv + (off1 / resolution)) * 0.2969069646728344;
          color += texture2D(image, uv - (off1 / resolution)) * 0.2969069646728344;
          color += texture2D(image, uv + (off2 / resolution)) * 0.09447039785044732;
          color += texture2D(image, uv - (off2 / resolution)) * 0.09447039785044732;
          color += texture2D(image, uv + (off3 / resolution)) * 0.010381362401148057;
          color += texture2D(image, uv - (off3 / resolution)) * 0.010381362401148057;
          return color;
        }
  
        void main() {
          vec2 uv = vec2(gl_FragCoord.xy / iResolution.xy);
          vec2 perpendicularDirection = vec2(direction.x * -1.0, direction.y);
          vec4 pixel1 = blur(iChannel0, uv, iResolution.xy, direction);
          vec4 pixel2 = blur(iChannel0, uv, iResolution.xy, perpendicularDirection);
          gl_FragColor = mix(pixel1, pixel2, 0.5);
        }
      `,
      uniforms: {
        iResolution: ({ viewportWidth, viewportHeight }: any) => [
          viewportWidth,
          viewportHeight,
        ],
        iChannel0: regl.prop("iChannel0"), // sampler2D
        direction: regl.prop("direction"),
      },
      attributes: {
        position: [-1, -1, -1, 4, 4, -1],
      },
      count: 3,
      primitive: "triangles",
    });
  }

  function formatSeconds(seconds: any) {
    const minutes = (seconds / 60) | 0;
    seconds = "" + (seconds % 60 | 0);
    if (seconds.length === 1) {
      seconds = `0${seconds}`;
    }
    return `${minutes}:${seconds}`;
  }

  // create RenderGrid
  let linesOffsetsLoopToken: any;
  let lines: any = [];

  function createRenderGrid(regl: any, settings: any) {
    lines = [];

    for (let j = 1; j < settings.gridLines; j++) {
      lines.push({
        axis: "x",
        offset: createSpring(
          settings.linesDampening,
          settings.linesStiffness,
          (j / settings.gridLines) * 2 - 1
        ),
      });
      lines.push({
        axis: "y",
        offset: createSpring(
          settings.linesDampening,
          settings.linesStiffness,
          (j / settings.gridLines) * 2 - 1
        ),
      });
    }

    function getLinesPositions(linesPositions: any, lines: any) {
      const granularity = 50; // settings.gridLines
      linesPositions =
        linesPositions || new Float32Array(lines.length * granularity * 2);
      let k = 0;
      for (let line of lines) {
        const nextOffset = line.offset.tick(1, false);
        for (let q = 0; q < granularity; q++) {
          const t = (q / granularity) * 2 - 1;
          const nextT = ((q + 1) / granularity) * 2 - 1;
          linesPositions[k++] = line.axis === "x" ? nextOffset : t;
          linesPositions[k++] = line.axis === "y" ? nextOffset : t;

          linesPositions[k++] = line.axis === "x" ? nextOffset : nextT;
          linesPositions[k++] = line.axis === "y" ? nextOffset : nextT;
        }
      }
      return linesPositions;
    }

    const linesPositions = getLinesPositions([], lines);
    const linesBuffer = regl.buffer(linesPositions);
    const render = regl({
      vert: glsl`
        attribute vec2 position;

        varying vec4 fragColor;

        uniform sampler2D frequencyVals;
        uniform vec2 resolution;
        uniform mat4 projection;
        uniform mat4 view;
        uniform float gridMaxHeight;
        uniform float multiplier;

        void main() {
          vec2 lookup = (position + 1.0) / 2.0;
          float frequencyVal = texture2D(frequencyVals, lookup).x;
          vec3 rgb = clamp(sin((vec3(frequencyVal) + vec3(0.1, 0.3, 0.5)) * 1.9), 0.0, 0.95);
          float opacity = clamp(pow(frequencyVal * 1.5, 2.0), 0.0, 0.95) * multiplier;
          fragColor = vec4(rgb, opacity);
          gl_Position = projection * view * vec4(position.xy, frequencyVal * gridMaxHeight * multiplier, 1);
        }
      `,
      frag: glsl`
        precision highp float;
        varying vec4 fragColor;
        void main() {
          gl_FragColor = fragColor;
        }
      `,
      uniforms: {
        frequencyVals: regl.prop("frequencyVals"),
        gridMaxHeight: regl.prop("gridMaxHeight"),
        multiplier: regl.prop("multiplier"),
      },
      blend: {
        enable: true,
        func: {
          srcRGB: "src alpha",
          srcAlpha: 1,
          dstRGB: "one minus src alpha",
          dstAlpha: 1,
        },
        equation: {
          rgb: "add",
          alpha: "add",
        },
      },
      attributes: {
        position: linesBuffer,
      },
      count: linesPositions.length / 2,
      primitive: "lines",
    });

    clearTimeout(linesOffsetsLoopToken);
    linesOffsetsLoopToken = setTimeout(setLinesOffsetsLoop, 15000);

    let calls = 0;
    function setLinesOffsets() {
      let xVal = 1;
      let yVal = 1;
      calls += 1;
      calls = calls % 2;
      // lines.sort((a, b) => {
      //   return a.offset.tick(1, false) > b.offset.tick(1, false) ? 1 : -1
      // })
      const randomGranularity = (((Math.random() * 10) | 0) + 1) / 5;
      lines.forEach((line: any, i: any) => {
        let nextVal;
        if (calls === 0) {
          nextVal =
            (((line.axis === "x" ? xVal++ : yVal++) / settings.gridLines) * 2 -
              1) *
            randomGranularity;
        } else if (calls === 1) {
          nextVal = Math.random() * 2 - 1;
        } else {
          nextVal =
            ((line.axis === "x" ? xVal++ : yVal++) / settings.gridLines) * 2 -
            1;
        }

        setTimeout(() => {
          line.offset.updateValue(nextVal);
        }, i * settings.linesAnimationOffset);
      });
    }

    function setLinesOffsetsLoop() {
      setTimeout(() => {
        clearTimeout(linesOffsetsLoopToken);
        setLinesOffsets();
        linesOffsetsLoopToken = setLinesOffsetsLoop();
      }, 9500);
    }

    return function ({ frequencyVals, gridMaxHeight, multiplier }: any) {
      getLinesPositions(linesPositions, lines);
      linesBuffer(linesPositions);
      for (let line of lines) {
        line.offset.tick();
      }
      render({ frequencyVals, gridMaxHeight, multiplier });
    };
  }

  const initRender = async () => {
    const { GUI } = await import("dat-gui");
    const gui = new GUI();
    const createAnalyser = (await import("web-audio-analyser")).default;

    createRegl = (await import("regl")).default;

    const titleCard = createTitleCard();
    const canvas = document.querySelector("canvas.viz") as any;
    const resize = fit(canvas);
    window.addEventListener(
      "resize",
      () => {
        resize(canvas);
        if (hasSetUp) setup();
        titleCard.resize();
      },
      false
    );
    const camera = createRoamingCamera(canvas, [2.5, 2.5, 2.5], [0, 0, 0]);
    // const regl = createRegl({
    //   canvas,
    //   extensions: ['OES_standard_derivatives']
    // }); 
    const regl = createRegl(canvas);

    console.log({ regl });

    let analyser: any,
      delaunay: any,
      points: any,
      positions: any,
      positionsBuffer: any,
      renderFrequencies: any,
      renderGrid: any,
      blurredFbo: any,
      renderToBlurredFBO: any;

    const getFrameBuffer = (width: any, height: any) =>
      regl.framebuffer({
        color: regl.texture({
          shape: [width, height, 4],
        }),
        depth: false,
        stencil: false,
      });

    const fbo = getFrameBuffer(512, 512);
    const freqMapFBO = getFrameBuffer(512, 512);

    const renderToFBO = regl({ framebuffer: fbo });
    const renderToFreqMapFBO = regl({ framebuffer: freqMapFBO });

    const renderBloom = createRenderBloom(regl, canvas);
    const renderBlur = createRenderBlur(regl);

    const tracks = [
      {
        title: "715 - CRΣΣKS",
        artist: "Bon Iver",
        path: "/audio/715-creeks.mp3",
      },
      {
        title: "Another New World",
        artist: "Punch Brothers",
        path: "/audio/another-new-world.mp3",
      },
    ];

    const audio = createPlayer(tracks[0].path);
    audio.on("load", function () {
      (window as any).audio = audio;
      analyser = createAnalyser(audio.node, audio.context, {
        audible: true,
        stereo: false,
      });
      console.log("analyser", audio.node, audio.context)
      // const audioControls = createAudioControls(audio.element, tracks);

      function loop() {
        window.requestAnimationFrame(loop);
        // audioControls.tick();
      }

      analyser.analyser.fftSize = 1024 * 2;
      analyser.analyser.minDecibels = -75;
      analyser.analyser.maxDecibels = -30;
      analyser.analyser.smoothingTimeConstant = 0.5;

      setup();

      // stupid hack: the first render causes a flash of black on the page,
      // this just forces it to happen at the start of the app, instead of when
      // the music starts, which is jarring
      const renderLoop = startLoop();
      setTimeout(renderLoop.cancel.bind(renderLoop), 1000);

      titleCard
        .show()
        .then(() => new Promise((resolve) => setTimeout(resolve, 1000)))
        .then(() => {
          // css(audioControls.el, {
          //   transition: "opacity 1s linear",
          //   opacity: 1,
          // });
          css(gui.domElement.parentElement as HTMLElement, {
            transition: "opacity 1s linear",
            opacity: 1,
          });
          window.requestAnimationFrame(loop);
          audio.play();
          camera.start();
          startLoop();
        });
    });

    const settings = {
      seed: 0,

      points: 2500,
      dampening: 0.7,
      stiffness: 0.55,
      freqPow: 1.7,
      connectedNeighbors: 4,
      neighborWeight: 0.99,
      connectedBinsStride: 1,
      blurAngle: 0.25,
      blurMag: 7,

      blurRadius: 3,
      blurWeight: 0.8,
      originalWeight: 1.2,

      gridLines: 180,
      linesDampening: 0.02,
      linesStiffness: 0.9,
      linesAnimationOffset: 12,
      gridMaxHeight: 0.28,

      motionBlur: true,
      motionBlurAmount: 0.45,
    };

    gui.closed = true;
    css(gui.domElement.parentElement, {
      zIndex: 11,
      opacity: 0,
    });
    const fabricGUI = gui.addFolder("fabric");
    fabricGUI.add(settings, "dampening", 0.01, 1).step(0.01).onChange(setup);
    fabricGUI.add(settings, "stiffness", 0.01, 1).step(0.01).onChange(setup);
    fabricGUI.add(settings, "connectedNeighbors", 0, 7).step(1).onChange(setup);
    fabricGUI.add(settings, "neighborWeight", 0.8, 1).step(0.01);
    const bloomGUI = gui.addFolder("bloom");
    bloomGUI.add(settings, "blurRadius", 0, 20).step(1);
    bloomGUI.add(settings, "blurWeight", 0, 2).step(0.01);
    bloomGUI.add(settings, "originalWeight", 0, 2).step(0.01);
    const gridGUI = gui.addFolder("grid");
    gridGUI.add(settings, "gridLines", 10, 300).step(1).onChange(setup);
    gridGUI.add(settings, "linesAnimationOffset", 0, 100).step(1);
    gridGUI.add(settings, "gridMaxHeight", 0.01, 0.8).step(0.01);
    // gui.add(settings, 'motionBlur')
    // gui.add(settings, 'motionBlurAmount', 0.01, 1).step(0.01)

    let hasSetUp = false;
    function setup() {
      hasSetUp = true;
      const rand = new Alea(settings.seed);
      points = [];

      blurredFbo = getFrameBuffer(canvas.width, canvas.height);
      renderToBlurredFBO = regl({ framebuffer: blurredFbo });

      renderGrid = createRenderGrid(regl, settings);
      console.log("renderGrid", renderGrid, renderToBlurredFBO, blurredFbo)

      // fill up the points list with the freqency-tracking nodes
      const frequenciesCount = analyser.frequencies().length; // 1024
      console.log("analyser.frequencies()", analyser.frequencies())
      for (let q = 0; q < frequenciesCount; q += settings.connectedBinsStride) {
        const mag = Math.pow(rand(), 1 - q / frequenciesCount) * 0.9;
        const rads = rand() * Math.PI * 2;
        const position = [Math.cos(rads) * mag, Math.sin(rads) * mag];
        const id = points.length;
        const point: any = createPoint(id, position);
        point.frequencyBin = q;
        points.push(point);
      }

      array(Math.max(0, settings.points - points.length)).forEach(
        (_: any, i: any) => {
          const id = points.length;
          points.push(createPoint(id, [rand() * 2 - 1, rand() * 2 - 1]));
        }
      );

      function createPoint(id: any, position: any) {
        return {
          position: position,
          id: id,
          neighbors: new Set(), // gonna fill this up with the results of delaunay
          spring: createSpring(
            settings.dampening * settings.stiffness,
            settings.stiffness,
            0
          ),
        };
      }

      delaunay = new Delaunator(points.map((pt: any) => pt.position));
      for (let j = 0; j < delaunay.triangles.length; j += 3) {
        const pt1 = delaunay.triangles[j];
        const pt2 = delaunay.triangles[j + 1];
        const pt3 = delaunay.triangles[j + 2];

        points[pt1].neighbors.add(pt2);
        points[pt1].neighbors.add(pt3);
        points[pt2].neighbors.add(pt1);
        points[pt2].neighbors.add(pt3);
        points[pt3].neighbors.add(pt1);
        points[pt3].neighbors.add(pt2);
      }

      points.forEach((pt: any) => {
        pt.neighbors = shuffle(Array.from(pt.neighbors)).slice(
          0,
          settings.connectedNeighbors
        );
      });

      positions = new Float32Array(delaunay.triangles.length * 3);
      positionsBuffer = regl.buffer(positions);
      console.log("positionsBuffer", positionsBuffer)

      renderFrequencies = regl({
        vert: glsl`
          attribute vec3 position;

          varying vec4 fragColor;

          void main() {
            float actualIntensity = position.z * 1.2;
            fragColor = vec4(vec3(actualIntensity), 1);
            gl_Position = vec4(position.xy, 0, 1);
          }
        `,
        frag: glsl`
          precision highp float;
          varying vec4 fragColor;
          void main() {
            gl_FragColor = fragColor;
          }
        `,
        attributes: {
          position: positionsBuffer,
        },
        count: delaunay.triangles.length,
        primitive: "triangles",
      });
    }

    function update() {
      const frequencies = analyser.frequencies();
      // console.log("frequencies --- update", frequencies)
      points.forEach((pt: any) => {
        let value = 0;
        if (pt.frequencyBin || pt.frequencyBin === 0) {
          value = Math.pow(
            frequencies[pt.frequencyBin] / 255,
            settings.freqPow
          ); // max bin value
        }
        const neighbors = pt.neighbors;
        const neighborSum = neighbors.reduce((total: any, ptID: any) => {
          return total + points[ptID].spring.tick(1, false);
        }, 0);
        const neighborAverage = neighbors.length
          ? neighborSum / neighbors.length
          : 0;
        value = Math.max(value, neighborAverage * settings.neighborWeight);

        pt.spring.updateValue(value);
        pt.spring.tick();
      });

      for (let j = 0; j < delaunay.triangles.length; j++) {
        const ptIndex = delaunay.triangles[j];
        const point = points[ptIndex];
        positions[j * 3] = point.position[0];
        positions[j * 3 + 1] = point.position[1];
        positions[j * 3 + 2] = point.spring.tick(1, false);
      }
      positionsBuffer(positions);
    }

    const renderGlobals = regl({
      uniforms: {
        projection: ({ viewportWidth, viewportHeight }: any) =>
          mat4.perspective(
            [],
            Math.PI / 4,
            viewportWidth / viewportHeight,
            0.01,
            1000
          ),
        view: () => camera.getMatrix(),
        time: ({ time }) => time,
      },
    });

    const renderColoredQuad = regl({
      vert: glsl`
        precision highp float;
        attribute vec2 position;
        void main() {
          gl_Position = vec4(position, 0, 1);
        }
      `,
      frag: glsl`
        precision highp float;
        uniform vec4 color;
        void main () {
          gl_FragColor = color;
        }
      `,
      blend: {
        enable: true,
        func: {
          srcRGB: "src alpha",
          srcAlpha: 1,
          dstRGB: "one minus src alpha",
          dstAlpha: 1,
        },
        equation: {
          rgb: "add",
          alpha: "add",
        },
      },
      uniforms: {
        color: regl.prop("color" as never),
      },
      attributes: {
        position: [-1, -1, -1, 4, 4, -1],
      },
      count: 3,
      primitive: "triangles",
    });

    function startLoop() {
      return regl.frame(({ time }) => {
        camera.tick({ time });
        update();
        renderToFBO(() => {
          renderFrequencies();
        });
        renderToFreqMapFBO(() => {
          const rads = settings.blurAngle * Math.PI;
          const direction = [
            Math.cos(rads) * settings.blurMag,
            Math.sin(rads) * settings.blurMag,
          ];
          renderBlur({
            iChannel0: fbo,
            direction: direction,
          });
        });
        renderToBlurredFBO(() => {
          if (settings.motionBlur) {
            renderColoredQuad({
              color: [0.18, 0.18, 0.18, settings.motionBlurAmount],
            });
          } else {
            regl.clear({
              color: [0.18, 0.18, 0.18, 1],
              depth: 1,
            });
          }
          renderGlobals(() => {
            renderGrid({
              frequencyVals: freqMapFBO,
              gridMaxHeight: settings.gridMaxHeight,
              multiplier: 1,
            });
          });
        });

        renderBloom({
          iChannel0: blurredFbo,
          blurMag: settings.blurRadius,
          blurWeight: settings.blurWeight,
          originalWeight: settings.originalWeight,
        });
      });
    }
  };

  useEffect(() => {
      container = document.querySelector(".title-card-container") as any;
    if (document && container) {
      canvas = container.querySelector("canvas") as any;
      ctx = canvas.getContext("2d");
      ctx.globalCompositeOperation = "lighter";
      resize = fit(canvas);
      window.addEventListener("resize", resize);
  
      // instructions = container.querySelector(".instructions");
      // button = container.querySelector("button");
      initRender();
    }
  }, []);

  return (
    <>
      <canvas className="viz" style={{ position: 'relative' }}></canvas>
      <div className="title-card-container">
        <canvas></canvas>
        {/* <div className="instructions">
          <div>TURN YOUR SOUND ON</div>
          <button>READY</button>
        </div> */}
      </div>
      {/* <div className="controls-container">
        <div className="controls-header">
          <a
            href="https://github.com/rolyatmax/audiofabric"
            className="github-link"
          >
            <svg
              width="22px"
              height="22px"
              viewBox="0 0 30 30"
              version="1.1"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M15,0.0576923077 C6.72580645,0.0576923077 0.00806451613,6.91483516 0.00806451613,15.3791209 C0.00806451613,22.1456044 4.30645161,27.8901099 10.2580645,29.9175824 C11.0080645,30.0576923 11.25,29.5879121 11.25,29.1840659 L11.25,26.3241758 C7.08064516,27.2554945 6.20967742,24.5192308 6.20967742,24.5192308 C5.53225806,22.7472527 4.5483871,22.2774725 4.5483871,22.2774725 C3.18548387,21.3296703 4.65322581,21.3461538 4.65322581,21.3461538 C6.16129032,21.4532967 6.9516129,22.9285714 6.9516129,22.9285714 C8.29032258,25.2692308 10.4596774,24.5934066 11.3145161,24.1978022 C11.4516129,23.2087912 11.8387097,22.532967 12.266129,22.1456044 C8.93548387,21.7582418 5.43548387,20.4478022 5.43548387,14.5714286 C5.43548387,12.8983516 6.02419355,11.5302198 6.98387097,10.4587912 C6.83064516,10.0714286 6.31451613,8.51373626 7.12903226,6.40384615 C7.12903226,6.40384615 8.38709677,5.99175824 11.25,7.97802198 C12.4435484,7.64010989 13.7258065,7.46703297 15,7.45879121 C16.2741935,7.46703297 17.5564516,7.63186813 18.7580645,7.97802198 C21.6209677,6 22.8790323,6.40384615 22.8790323,6.40384615 C23.6935484,8.51373626 23.1854839,10.0714286 23.0241935,10.4587912 C23.983871,11.5302198 24.5645161,12.8983516 24.5645161,14.5714286 C24.5645161,20.456044 21.0564516,21.75 17.7177419,22.1291209 C18.2580645,22.6071429 18.75,23.5384615 18.75,24.9642857 L18.75,29.1675824 C18.75,29.5714286 18.9919355,30.0494505 19.75,29.9010989 C25.7016129,27.8736264 29.9919355,22.1291209 29.9919355,15.3626374 C29.9919355,6.91483516 23.2741935,0.0576923077 15,0.0576923077 L15,0.0576923077 Z"></path>
            </svg>
          </a>
          <div className="title"></div>
          <div className="artist"></div>
          <div className="elapsed-time"></div>
        </div>
        <div className="seeker">
          <div className="progress"></div>
        </div>
        <ul className="track-selector"></ul>
        <div className="hint">DRAG AND SCROLL TO PAN AND ZOOM</div>
      </div> */}
    </>
  );
};
