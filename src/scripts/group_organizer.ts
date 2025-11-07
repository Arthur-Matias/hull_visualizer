// group-organizer.ts
import * as THREE from 'three';
import * as Types from "../types"
import { stateManager } from './state_manager';

/**
 * Organizes hull geometry faces into logical groups by stations, waterlines, and deck
 * This enables selective rendering and manipulation of different hull components
 */
export function organizeGeometryGroups(
  vertices: THREE.Vector3[],
  indices: number[],
  stations: Types.Station[],
  waterlines: number[]
): Types.GeometryGroups {
  
  // Initialize empty group structure to ensure valid return value
  const groups: Types.GeometryGroups = {
    stations: {},
    waterlines: {},
    deck: []
  };

  // Early return if no geometry data is provided
  if (vertices.length === 0 || indices.length === 0) {
    stateManager.Debug && console.warn("No vertices or indices to organize");
    return groups;
  }

  // Early return if no grouping criteria provided
  if (stations.length === 0 || waterlines.length === 0) {
    stateManager.Debug && console.warn("No stations or waterlines to organize");
    return groups;
  }

  stateManager.Debug && console.log(`Organizing ${vertices.length} vertices, ${indices.length / 3} faces into groups`);

  try {
    // Initialize station groups with empty arrays for each station position
    stations.forEach((station) => {
      const stationKey = station.position.toString();
      groups.stations[stationKey] = [];
    });

    // Initialize waterline groups with empty arrays for each waterline height
    waterlines.forEach((waterlineHeight) => {
      const waterlineKey = waterlineHeight.toString();
      groups.waterlines[waterlineKey] = [];
    });

    // Process each triangular face in the geometry
    for (let i = 0; i < indices.length; i += 3) {
      const faceIndices = [indices[i], indices[i + 1], indices[i + 2]];
      
      // Validate face indices to prevent out-of-bounds errors
      if (faceIndices.some(idx => idx >= vertices.length || idx < 0)) {
        stateManager.Debug && console.warn(`Invalid face indices at position ${i}:`, faceIndices);
        continue;
      }
      
      // Calculate face centroid for spatial classification
      const centroid = new THREE.Vector3();
      faceIndices.forEach(idx => centroid.add(vertices[idx]));
      centroid.divideScalar(3);

      // Find closest station based on Z-coordinate (longitudinal position)
      let closestStation = stations[0];
      let minStationDist = Math.abs(centroid.z - stations[0].position);
      
      stations.forEach(station => {
        const dist = Math.abs(centroid.z - station.position);
        if (dist < minStationDist) {
          minStationDist = dist;
          closestStation = station;
        }
      });

      // Find closest waterline based on Y-coordinate (vertical position)
      let closestWaterline = waterlines[0];
      let minWaterlineDist = Math.abs(centroid.y - waterlines[0]);
      
      waterlines.forEach(waterline => {
        const dist = Math.abs(centroid.y - waterline);
        if (dist < minWaterlineDist) {
          minWaterlineDist = dist;
          closestWaterline = waterline;
        }
      });

      // Assign face indices to appropriate station group
      const stationKey = closestStation.position.toString();
      if (groups.stations[stationKey]) {
        groups.stations[stationKey].push(i, i + 1, i + 2);
      }

      // Assign face indices to appropriate waterline group
      const waterlineKey = closestWaterline.toString();
      if (groups.waterlines[waterlineKey]) {
        groups.waterlines[waterlineKey].push(i, i + 1, i + 2);
      }

      // Identify deck faces as those belonging to the top waterline
      const topWaterline = waterlines[waterlines.length - 1];
      const isTopWaterline = Math.abs(centroid.y - topWaterline) < 0.01;
      if (isTopWaterline) {
        groups.deck.push(i, i + 1, i + 2);
      }
    }

    stateManager.Debug && console.log("Groups organized successfully");
    return groups;

  } catch (error) {
    stateManager.Debug && console.error("Error organizing geometry groups:", error);
    // Return empty but valid structure on error to prevent crashes
    return {
      stations: {},
      waterlines: {},
      deck: []
    };
  }
}