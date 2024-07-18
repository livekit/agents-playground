import { useEffect, useState } from "react";
import css from "dom-css";
import fit from "canvas-fit";
import mat4 from "gl-mat4";
import shuffle from "shuffle-array";
import Alea from "alea";
import { createSpring } from "spring-animator";
import Delaunator from "delaunator";
import createCamera from "3d-view-controls";
import glsl from "glslify";
import TextureController from "./TextureController";

let createRegl: any;
let container: any;
let resize: any;
let canvas: any;
let ctx: any;
let convertedFrequencies: any;

type VisualizerState = "listening" | "idle" | "speaking" | "thinking";
type AgentMultibandAudioVisualizerProps = {
  state: VisualizerState;
  barWidth: number;
  minBarHeight: number;
  maxBarHeight: number;
  accentColor: string;
  accentShade?: number;
  frequencies: Float32Array[];
  borderRadius: number;
  gap: number;
};

export const AgentMultibandAudioWaveVisualizer = ({
  state,
  barWidth,
  minBarHeight,
  maxBarHeight,
  accentColor,
  accentShade,
  frequencies,
  borderRadius,
  gap,
}: AgentMultibandAudioVisualizerProps) => {
  const [dampening, setDampening] = useState<number>(0.7);
  const [stiffness, setStiffness] = useState<number>(0.55);
  const [connectedNeighbors, setConnectedNeighbors] = useState<number>(4);
  const [neighborWeight, setNeighborWeight] = useState<number>(0.99);
  const [blurRadius, setBlurRadius] = useState<number>(3);
  const [blurWeight, setBlurWeight] = useState<number>(0.8);
  const [originalWeight, setOriginalWeight] = useState<number>(1.2);
  const [gridLines, setGridLines] = useState<number>(180);
  const [linesAnimationOffset, setLinesAnimationOffset] = useState<number>(12);
  const [gridMaxHeight, setGridMaxHeight] = useState<number>(0.28);

  function convertAndInterpolateFloat32ToUint8(
    float32Array: any,
    outputLength: any
  ) {
    // Create a new Uint8Array of desired length
    let uint8Array = new Uint8Array(outputLength);

    // Normalize and interpolate
    for (let i = 0; i < outputLength; i++) {
      // Calculate the corresponding index in the source array
      let srcIndex = (i / outputLength) * float32Array.length;

      // Interpolation
      let indexLow = Math.floor(srcIndex);
      let indexHigh = Math.ceil(srcIndex);
      let weightHigh = srcIndex - indexLow;
      let weightLow = 1 - weightHigh;

      // Normalize source values and interpolate
      let valueLow = (float32Array[indexLow] + 1) * 0.5;
      let valueHigh =
        (float32Array[Math.min(indexHigh, float32Array.length - 1)] + 1) * 0.5;

      let interpolatedValue = valueLow * weightLow + valueHigh * weightHigh;

      // Convert to Uint8
      uint8Array[i] = interpolatedValue * 255;
    }

    return uint8Array;
  }
  const float32Array = frequencies.map((_, idx) =>
    Math.sin((idx / 25) * 2 * Math.PI)
  ); // Example sinusoidal data
  convertedFrequencies = convertAndInterpolateFloat32ToUint8(
    float32Array,
    1024
  );

  function createRoamingCamera(canvas: any, center: any, eye: any) {
    let isRoaming = false;

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

    const startingSpeed = 0.0014;
    let currentRads = 0;
    let cameraUp = new Float32Array(3);
    let currentPosition = getPositionFromRads(new Float32Array(3), currentRads);

    function start() {
      isRoaming = true;
    }

    function tick() {
      camera.tick();
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

    (window as any).camera = camera;
    return {
      tick,
      start,
      getMatrix,
      getCenter,
    };
  }

  //create audioControl
  function createAudioControls(audio: any, tracks: any) {
    tracks = tracks.map((t: any) => Object.assign({}, t));
    const controlsContainer = document.querySelector(
      ".controls-container"
    ) as any;

    function setTrack(track: any) {
      audio.src = track.path;
    }

    setTrack(tracks[0]);

    return {
      el: controlsContainer,
    };
  }

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
        iChannel0: regl.prop("iChannel0"),
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
    // }
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
    createRegl = (await import("regl")).default;
    let hasSetUp: boolean = false;
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

    const canvas = document.querySelector("canvas.viz") as any;
    window.addEventListener(
      "resize",
      () => {
        if (hasSetUp) setup();
      },
      false
    );
    const camera = createRoamingCamera(canvas, [2.5, 2.5, 2.5], [0, 0, 0]);
    const regl = createRegl(canvas);

    let delaunay: any,
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

    setup();
    const renderLoop = startLoop();
    setTimeout(renderLoop.cancel.bind(renderLoop), 1000);
    camera.start();
    startLoop();

    gui.closed = true;
    css(gui.domElement.parentElement as HTMLElement, {
      zIndex: 11,
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

    hasSetUp = false;

    function setup() {
      hasSetUp = true;
      const rand = new Alea(settings.seed);
      points = [];

      blurredFbo = getFrameBuffer(canvas.width, canvas.height);
      renderToBlurredFBO = regl({ framebuffer: blurredFbo });

      renderGrid = createRenderGrid(regl, settings);

      // fill up the points list with the freqency-tracking nodes

      const frequenciesCount = convertedFrequencies.length; // 1024
      for (let q = 0; q < frequenciesCount; q += settings.connectedBinsStride) {
        const mag = Math.pow(rand(), 1 - q / frequenciesCount) * 0.9;
        const rads = rand() * Math.PI * 2;
        const position = [Math.cos(rads) * mag, Math.sin(rads) * mag];
        const id = points.length;
        const point: any = createPoint(id, position);
        point.frequencyBin = q;
        points.push(point);
      }

      new Array((Math.max(0, settings.points - points.length))).forEach(
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
      points.forEach((pt: any) => {
        let value = 0;
        if (pt.frequencyBin || pt.frequencyBin === 0) {
          value = Math.pow(
            convertedFrequencies[pt.frequencyBin] / 255,
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
        time: ({ time }: any) => time,
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
      return regl.frame(({ time }: any) => {
        camera.tick(); // { time }
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
    if (document) {
      container = document.querySelector(".title-card-container") as any;
      canvas = container.querySelector("canvas") as any;
      ctx = canvas.getContext("2d");
      ctx.globalCompositeOperation = "lighter";
      resize = fit(canvas);
      window.addEventListener("resize", resize);
      initRender();
    }
  }, [ dampening, stiffness, connectedNeighbors, neighborWeight, blurRadius, blurWeight, originalWeight, gridLines, linesAnimationOffset, gridMaxHeight ]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="visualizer">
      <canvas className="viz"></canvas>
      <div className="title-card-container">
        <canvas></canvas>
      </div>
      <TextureController
        dampeningData={setDampening}
        stiffnessData={setStiffness}
        connectedNeighborsData={setConnectedNeighbors}
        neighborWeightData={setNeighborWeight}
        blurRadiusData={setBlurRadius}
        blurWeightData={setBlurWeight}
        originalWeightData={setOriginalWeight}
        gridLinesData={setGridLines}
        linesAnimationOffsetData={setLinesAnimationOffset}
        gridMaxHeightData={setGridMaxHeight}
      />
    </div>
  );
};
