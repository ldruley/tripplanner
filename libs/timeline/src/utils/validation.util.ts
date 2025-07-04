import { Stop, TravelSegment } from '@trip-planner/types';

/**
 * Validate basic schedule constraints
 */
export function validateSchedule(stops: Stop[], segments: TravelSegment[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for negative durations
  for (const stop of stops) {
    if (stop.plannedDuration !== null && stop.plannedDuration !== undefined && stop.plannedDuration < 0) {
      errors.push(`Stop ${stop.id} has negative duration: ${stop.plannedDuration}`);
    }
  }

  // Check for missing travel segments between consecutive stops
  const sortedStops = [...stops].sort((a, b) => a.order - b.order);
  for (let i = 0; i < sortedStops.length - 1; i++) {
    const currentStop = sortedStops[i];
    const nextStop = sortedStops[i + 1];
    
    const segment = segments.find(s => 
      s.originStopId === currentStop.id && 
      s.destinationStopId === nextStop.id
    );
    
    if (!segment) {
      warnings.push(`Missing travel segment between stop ${currentStop.order} and ${nextStop.order}`);
    }
  }

  // Check for unrealistic travel durations
  for (const segment of segments) {
    if (segment.apiCalculatedDuration && segment.apiCalculatedDuration < 0) {
      errors.push(`Travel segment ${segment.id} has negative duration: ${segment.apiCalculatedDuration}`);
    }
    
    if (segment.apiCalculatedDuration && segment.apiCalculatedDuration > 1440) { // More than 24 hours
      warnings.push(`Travel segment ${segment.id} has very long duration: ${segment.apiCalculatedDuration} minutes`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Check if stops are in proper order
 */
export function validateStopOrder(stops: Stop[]): boolean {
  const sortedStops = [...stops].sort((a, b) => a.order - b.order);
  
  for (let i = 0; i < sortedStops.length; i++) {
    if (sortedStops[i].order !== i) {
      return false;
    }
  }
  
  return true;
}

/**
 * Check for time conflicts in planned schedule
 */
export function validateTimeConflicts(stops: Stop[]): TimeConflictResult {
  const conflicts: TimeConflict[] = [];
  const sortedStops = [...stops].sort((a, b) => a.order - b.order);
  
  for (let i = 0; i < sortedStops.length - 1; i++) {
    const currentStop = sortedStops[i];
    const nextStop = sortedStops[i + 1];
    
    if (currentStop.plannedArrivalTime && nextStop.plannedArrivalTime) {
      const currentDeparture = currentStop.calculatedDepartureTime || 
        new Date(currentStop.plannedArrivalTime.getTime() + (currentStop.plannedDuration || 60) * 60000);
      
      if (currentDeparture > nextStop.plannedArrivalTime) {
        conflicts.push({
          stopId: currentStop.id,
          nextStopId: nextStop.id,
          conflictType: 'DEPARTURE_AFTER_NEXT_ARRIVAL',
          description: `Stop ${currentStop.order} departure time is after stop ${nextStop.order} arrival time`,
        });
      }
    }
  }
  
  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
  };
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface TimeConflict {
  stopId: string;
  nextStopId: string;
  conflictType: 'DEPARTURE_AFTER_NEXT_ARRIVAL' | 'NEGATIVE_TRAVEL_TIME';
  description: string;
}

export interface TimeConflictResult {
  hasConflicts: boolean;
  conflicts: TimeConflict[];
}