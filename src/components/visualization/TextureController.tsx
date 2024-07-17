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
            onChange={(value:number | number[]) => { setDampening(value as number); dampeningData(value); }}
          />
          <p>Stiffness: {stiffness}</p>
          <Slider
            min={0.01}
            max={1}
            step={0.01}
            value={stiffness}
            onChange={(value:number | number[]) => { setStiffness(value as number); stiffnessData(value); }}
          />
          <p>Connected Neighbors: {connectedNeighbors}</p>
          <Slider
            min={0}
            max={7}
            step={1}
            value={connectedNeighbors}
            onChange={(value:number | number[]) => { setConnectedNeighbors(value as number); connectedNeighborsData(value); }}
          />
          <p>Neighbor Weight: {neighborWeight}</p>
          <Slider
            min={0.8}
            max={1}
            step={0.01}
            value={neighborWeight}
            onChange={(value:number | number[]) => {setNeighborWeight(value as number);  neighborWeightData(value);}}
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
            onChange={(value:number | number[]) => {setBlurRadius(value as number); blurRadiusData(value);}}
          />
          <p>Blur Weight: {blurWeight}</p>
          <Slider
            min={0}
            max={2}
            step={0.01}
            value={blurWeight}
            onChange={(value:number | number[]) => {setBlurWeight(value as number); blurWeightData(value);}}
          />
          <p>Original Weight: {originalWeight}</p>
          <Slider
            min={0}
            max={2}
            step={0.01}
            value={originalWeight}
            onChange={(value:number | number[]) => {setOriginalWeight(value as number); originalWeightData(value);}}
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
            onChange={(value:number | number[]) => { setGridLines(value as number); gridLinesData(value); }}
          />
          <p>Lines Animation Offset: {linesAnimationOffset}</p>
          <Slider
            min={0}
            max={100}
            step={1}
            value={linesAnimationOffset}
            onChange={(value:number | number[]) => {setLinesAnimationOffset(value as number); linesAnimationOffsetData(value);}}
          />
          <p>Grid Max Height: {gridMaxHeight}</p>
          <Slider
            min={0.01}
            max={0.8}
            step={0.01}
            value={gridMaxHeight}
            onChange={(value:number | number[]) => {setGridMaxHeight(value as number); gridMaxHeightData(value);}}
          />
        </div>
      </Collapse>
    </div>
  );
};

export default TextureController;
