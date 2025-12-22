import type { Pose, Keypoint } from '@tensorflow-models/pose-detection';
import { Exercise, FormValidation } from '../types';
import { calculateAngle } from '../utils/helpers';

type JointName =
  | 'left_elbow'
  | 'right_elbow'
  | 'left_knee'
  | 'right_knee'
  | 'left_shoulder'
  | 'right_shoulder';

function toPoint(kp: Keypoint) {
  return { x: kp.x, y: kp.y };
}

function getJointTriplet(pose: Pose, joint: JointName) {
  const k = pose.keypoints;
  switch (joint) {
    case 'left_elbow':
      return [k[11], k[13], k[15]].map(toPoint);
    case 'right_elbow':
      return [k[12], k[14], k[16]].map(toPoint);
    case 'left_knee':
      return [k[23], k[25], k[27]].map(toPoint);
    case 'right_knee':
      return [k[24], k[26], k[28]].map(toPoint);
    case 'left_shoulder':
      return [k[13], k[11], k[23]].map(toPoint);
    case 'right_shoulder':
      return [k[14], k[12], k[24]].map(toPoint);
  }
}

function angleForJoint(pose: Pose, joint: JointName) {
  const [a, b, c] = getJointTriplet(pose, joint);
  return calculateAngle(a, b, c);
}

function bestMatchingStage(
  pose: Pose,
  exercise: Exercise
) {
  let best = exercise.stages[0].name;
  let bestScore = -Infinity;
  for (const stage of exercise.stages) {
    let score = 0;
    for (const r of stage.angleRanges) {
      const ang = angleForJoint(pose, r.joint as JointName);
      const center = (r.min + r.max) / 2;
      const diff = Math.abs(ang - center);
      score += Math.max(0, 100 - diff);
    }
    if (score > bestScore) {
      bestScore = score;
      best = stage.name;
    }
  }
  return best;
}

class RepCounter {
  exerciseId: string;
  lastStage: string | null = null;
  reps: number = 0;
  constructor(exerciseId: string) {
    this.exerciseId = exerciseId;
  }
  update(currentStage: string, isFormValid: boolean) {
    if (!isFormValid) return this.reps; // Only count if form is good

    const prev = this.lastStage;
    this.lastStage = currentStage;
    if (this.exerciseId === 'push-ups') {
      if (prev === 'down' && currentStage === 'up') this.reps += 1;
    } else if (this.exerciseId === 'squats') {
      if (prev === 'down' && currentStage === 'up') this.reps += 1;
    } else if (this.exerciseId === 'bicep-curls') {
      if (prev === 'up' && currentStage === 'down') this.reps += 1;
    }
    return this.reps;
  }
  reset() {
    this.lastStage = null;
    this.reps = 0;
  }
}

class WorkoutAnalysisService {
  counters: { [exerciseId: string]: RepCounter } = {};
  getCounter(exerciseId: string) {
    if (!this.counters[exerciseId]) this.counters[exerciseId] = new RepCounter(exerciseId);
    return this.counters[exerciseId];
  }
  analyze(pose: Pose, exercise: Exercise) {
    const stage = bestMatchingStage(pose, exercise);

    // 1. Initial form check
    const validation: FormValidation = {
      isValid: true,
      score: 100,
      errors: [],
    };

    // TODO: Implement actual form checks from exercise.formChecks
    // For now, we assume form is valid if the key joints are detected with high confidence
    const confidenceThreshold = 0.5;
    const keyJoints = pose.keypoints.filter(kp => (kp.score || 0) > confidenceThreshold);
    if (keyJoints.length < 5) {
      validation.isValid = false;
      validation.score = 30;
    }

    // 2. Update reps ONLY if form is valid (or sufficiently good)
    const reps = this.getCounter(exercise.id).update(stage, validation.isValid);

    return { stage, reps, validation };
  }
  reset(exerciseId: string) {
    this.getCounter(exerciseId).reset();
  }
}

export const workoutAnalysisService = new WorkoutAnalysisService();
