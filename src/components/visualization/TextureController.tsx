import React, { useState } from 'react';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { Collapse } from 'react-collapse';


type TextureControllerDataProps = {
  dampeningData:any;  
  stiffnessData:any; 
  connectedNeighborsData:any;  
  neighborWeightData:any;
  blurRadiusData:any;
  blurWeightData:any;
  originalWeightData:any;
  gridLinesData:any;
  linesAnimationOffsetData:any;
  gridMaxHeightData:any;
};

const TextureController = ({ 
  dampeningData,  
  stiffnessData, 
  connectedNeighborsData,  
  neighborWeightData,
  blurRadiusData,
  blurWeightData,
  originalWeightData,
  gridLinesData,
  linesAnimationOffsetData,
  gridMaxHeightData
}:TextureControllerDataProps) => {
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


  const [selectedOption, setselectedOption] = useState("");

  return (
    <div>
      <button onClick={() => setselectedOption("Fabric")}>
        {"Fabric Settings"}
      </button>
      <Collapse isOpened={selectedOption === "Fabric"}>
        <div>
          <p>Dampening: {dampening}</p>
          <Slider
            min={0.01}
            max={1}
            step={0.01}
            value={dampening}
            onChange={(value:number) => { setDampening(value); dampeningData(value); }}
          />
          <p>Stiffness: {stiffness}</p>
          <Slider
            min={0.01}
            max={1}
            step={0.01}
            value={stiffness}
            onChange={(value:number) => { setStiffness(value); stiffnessData(value); }}
          />
          <p>Connected Neighbors: {connectedNeighbors}</p>
          <Slider
            min={0}
            max={7}
            step={1}
            value={connectedNeighbors}
            onChange={(value:number) => { setConnectedNeighbors(value); connectedNeighborsData(value); }}
          />
          <p>Neighbor Weight: {neighborWeight}</p>
          <Slider
            min={0.8}
            max={1}
            step={0.01}
            value={neighborWeight}
            onChange={(value:number) => {setNeighborWeight(value);  neighborWeightData(value);}}
          />
        </div>
      </Collapse>


      <button onClick={() => setselectedOption("Bloom")}>
        {"Bloom Settings"}
      </button>
      <Collapse isOpened={selectedOption === "Bloom"}>
        <div>
          <p>Blur Radius: {blurRadius}</p>
          <Slider
            min={0}
            max={20}
            step={1}
            value={blurRadius}
            onChange={(value:number) => {setBlurRadius(value); blurRadiusData(value);}}
          />
          <p>Blur Weight: {blurWeight}</p>
          <Slider
            min={0}
            max={2}
            step={0.01}
            value={blurWeight}
            onChange={(value:number) => {setBlurWeight(value); blurWeightData(value);}}
          />
          <p>Original Weight: {originalWeight}</p>
          <Slider
            min={0}
            max={2}
            step={0.01}
            value={originalWeight}
            onChange={(value:number) => {setOriginalWeight(value); originalWeightData(value);}}
          />
        </div>
      </Collapse>

      <button onClick={() => setselectedOption("Grid")}>
        {"Grid Settings"}
      </button>
      <Collapse isOpened={selectedOption === "Grid"}>
        <div>
          <p>Grid Lines: {gridLines}</p>
          <Slider
            min={10}
            max={300}
            step={1}
            value={gridLines}
            onChange={(value:number) => { setGridLines(value); gridLinesData(value); }}
          />
          <p>Lines Animation Offset: {linesAnimationOffset}</p>
          <Slider
            min={0}
            max={100}
            step={1}
            value={linesAnimationOffset}
            onChange={(value:number) => {setLinesAnimationOffset(value); linesAnimationOffsetData(value);}}
          />
          <p>Grid Max Height: {gridMaxHeight}</p>
          <Slider
            min={0.01}
            max={0.8}
            step={0.01}
            value={gridMaxHeight}
            onChange={(value:number) => {setGridMaxHeight(value); gridMaxHeightData(value);}}
          />
        </div>
      </Collapse>
    </div>
  );
};

export default TextureController;
