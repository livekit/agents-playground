import { useEffect, useState } from "react";
import css from "dom-css";
import fit from "canvas-fit";
import mat4 from "gl-mat4";
import array from "new-array";
import shuffle from "shuffle-array";
import Alea from "alea";
import { createSpring } from "spring-animator";
import Delaunator from "delaunator";
import glsl from "glslify";
import { useAudiobandTrackVolume, getAudioAnalyzer } from "@/hooks/useTrackVolume";
import { createRoamingCamera, createRenderBloom,  createRenderBlur, createRenderGrid} from "@/hooks/trackVisualizer";

type VisualizerState = "listening" | "idle" | "speaking" | "thinking";
type AgentMultibandAudioVisualizerProps = {
  state: VisualizerState;
  barWidth: number;
  minBarHeight: number;
  maxBarHeight: number;
  accentColor: string;
  accentShade?: number;
  localMicTrack: any;
  borderRadius: number;
  gap: number;
};

export const AgentMultibandAudioWaveVisualizer = (
  {state,
    barWidth,
    minBarHeight,
    maxBarHeight,
    accentColor,
    accentShade,
    localMicTrack,
    borderRadius,
    gap,}:AgentMultibandAudioVisualizerProps
) => {


  let createRegl: any;
  let container: any;
  let resize: any;
  let canvas: HTMLCanvasElement;
  let ctx: any;
  let hasSetUp:boolean = false;
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

  const initRender = async () => {
    let delaunay: any,
    points: any,
    positions: any,
    positionsBuffer: any,
    renderFrequencies: any,
    renderGrid: any,
    blurredFbo: any,
    renderToBlurredFBO: any;

    // const { GUI } = await import("dat-gui");
    // const gui = new GUI();

    createRegl = (await import("regl")).default;

    const canvas = document.querySelector("canvas.viz") as HTMLCanvasElement;
    const resize = fit(canvas);
    window.addEventListener(
      "resize",
      () => {
        resize(canvas);
        if (hasSetUp) setup();
      },
      false
    );
    const camera = createRoamingCamera(canvas, [2.5, 2.5, 2.5], [0, 0, 0]);
    const regl = createRegl(canvas);



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

    function loop() {
      window.requestAnimationFrame(loop);
    }
    
    if(localMicTrack&&localMicTrack.mediaStream){
      const analyser = getAudioAnalyzer(localMicTrack)
      setup();
      
      const renderLoop = startLoop(analyser);
      setTimeout(renderLoop.cancel.bind(renderLoop), 1000);
      window.requestAnimationFrame(loop);
      camera.start();
      startLoop(analyser)
    }
  
    // gui.closed = true;
    // css(gui.domElement.parentElement, {
    //   zIndex: 11,
    //   opacity: 0,
    // });
    // const fabricGUI = gui.addFolder("fabric");
    // fabricGUI.add(settings, "dampening", 0.01, 1).step(0.01).onChange(setup);
    // fabricGUI.add(settings, "stiffness", 0.01, 1).step(0.01).onChange(setup);
    // fabricGUI.add(settings, "connectedNeighbors", 0, 7).step(1).onChange(setup);
    // fabricGUI.add(settings, "neighborWeight", 0.8, 1).step(0.01);
    // const bloomGUI = gui.addFolder("bloom");
    // bloomGUI.add(settings, "blurRadius", 0, 20).step(1);
    // bloomGUI.add(settings, "blurWeight", 0, 2).step(0.01);
    // bloomGUI.add(settings, "originalWeight", 0, 2).step(0.01);
    // const gridGUI = gui.addFolder("grid");
    // gridGUI.add(settings, "gridLines", 10, 300).step(1).onChange(setup);
    // gridGUI.add(settings, "linesAnimationOffset", 0, 100).step(1);
    // gridGUI.add(settings, "gridMaxHeight", 0.01, 0.8).step(0.01);

    hasSetUp = false;
    function setup() {
      hasSetUp = true;
      const rand = new Alea(settings.seed);
      points = [];

      blurredFbo = getFrameBuffer(canvas.width, canvas.height);
      renderToBlurredFBO = regl({ framebuffer: blurredFbo });

      renderGrid = createRenderGrid(regl, settings);

      const frequenciesCount = 1024;
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
          neighbors: new Set(),
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

    function update(analyser:any) {
      const frequencies = useAudiobandTrackVolume(localMicTrack, analyser);
      console.log("localMicTrack", localMicTrack, frequencies)
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

    function startLoop(analyser:any) {
      return regl.frame(({ time }) => {
        camera.tick({ time });
        update(analyser);
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
      canvas = container.querySelector("canvas") as HTMLCanvasElement;
      ctx = canvas.getContext("2d");
      ctx.globalCompositeOperation = "lighter";
      resize = fit(canvas);
      window.addEventListener("resize", resize);
  
      initRender();
    }
  }, [localMicTrack]);

  return (
    <div className="visualizer">
      <canvas className="viz" style={{ position: 'relative' }}></canvas>
      <div className="title-card-container">
        <canvas></canvas>
      </div>
    </div>
  );
};
