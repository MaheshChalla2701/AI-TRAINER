import { Exercise } from '../types';

/**
 * Exercise definitions for the MVP
 * Starting with 4 core exercises: push-ups, squats, plank, bicep curls
 */

export const exercises: Exercise[] = [
    {
        id: 'push-ups',
        name: 'Push-ups',
        category: 'strength',
        muscleGroups: ['chest', 'triceps', 'shoulders', 'core'],
        keypoints: [5, 6, 7, 8, 11, 12, 13, 14, 15, 16], // Shoulders, elbows, wrists, hips, knees, ankles
        stages: [
            {
                name: 'down',
                angleRanges: [
                    {
                        joint: 'left_elbow',
                        min: 60,
                        max: 90,
                        optimal: 75
                    },
                    {
                        joint: 'right_elbow',
                        min: 60,
                        max: 90,
                        optimal: 75
                    }
                ]
            },
            {
                name: 'up',
                angleRanges: [
                    {
                        joint: 'left_elbow',
                        min: 160,
                        max: 180,
                        optimal: 170
                    },
                    {
                        joint: 'right_elbow',
                        min: 160,
                        max: 180,
                        optimal: 170
                    }
                ]
            }
        ],
        formChecks: [
            {
                name: 'body_alignment',
                description: 'Keep body straight from shoulders to ankles',
                severity: 'error',
                checkFunction: (pose) => {
                    // Check if shoulders, hips, and ankles are aligned
                    // Implementation in FormAnalyzer
                    return true;
                },
                feedback: {
                    visual: 'Keep your body straight',
                    audio: 'Straighten your back and core'
                }
            },
            {
                name: 'elbow_position',
                description: 'Elbows should be at 45-degree angle to body',
                severity: 'warning',
                checkFunction: (pose) => true,
                feedback: {
                    visual: 'Tuck your elbows in',
                    audio: 'Keep elbows closer to your body'
                }
            }
        ]
    },
    {
        id: 'squats',
        name: 'Squats',
        category: 'strength',
        muscleGroups: ['quadriceps', 'glutes', 'hamstrings', 'core'],
        keypoints: [11, 12, 13, 14, 15, 16, 23, 24, 25, 26], // Hips, knees, ankles
        stages: [
            {
                name: 'down',
                angleRanges: [
                    {
                        joint: 'left_knee',
                        min: 60,
                        max: 90,
                        optimal: 80
                    },
                    {
                        joint: 'right_knee',
                        min: 60,
                        max: 90,
                        optimal: 80
                    }
                ]
            },
            {
                name: 'up',
                angleRanges: [
                    {
                        joint: 'left_knee',
                        min: 160,
                        max: 180,
                        optimal: 170
                    },
                    {
                        joint: 'right_knee',
                        min: 160,
                        max: 180,
                        optimal: 170
                    }
                ]
            }
        ],
        formChecks: [
            {
                name: 'knee_alignment',
                description: 'Knees should not extend past toes',
                severity: 'error',
                checkFunction: (pose) => true,
                feedback: {
                    visual: 'Knees over toes!',
                    audio: 'Push your hips back more'
                }
            },
            {
                name: 'depth',
                description: 'Squat to at least 90 degrees',
                severity: 'warning',
                checkFunction: (pose) => true,
                feedback: {
                    visual: 'Go deeper',
                    audio: 'Squat lower for full range of motion'
                }
            }
        ]
    },
    {
        id: 'plank',
        name: 'Plank',
        category: 'strength',
        muscleGroups: ['core', 'shoulders', 'back'],
        keypoints: [5, 6, 11, 12, 15, 16], // Shoulders, hips, ankles
        stages: [
            {
                name: 'hold',
                angleRanges: [
                    {
                        joint: 'left_shoulder',
                        min: 80,
                        max: 100,
                        optimal: 90
                    },
                    {
                        joint: 'right_shoulder',
                        min: 80,
                        max: 100,
                        optimal: 90
                    }
                ],
                duration: 30 // Default hold time in seconds
            }
        ],
        formChecks: [
            {
                name: 'hip_sag',
                description: 'Keep hips level with shoulders',
                severity: 'error',
                checkFunction: (pose) => true,
                feedback: {
                    visual: 'Lift your hips',
                    audio: 'Engage your core and lift your hips'
                }
            },
            {
                name: 'hip_pike',
                description: 'Do not raise hips too high',
                severity: 'error',
                checkFunction: (pose) => true,
                feedback: {
                    visual: 'Lower your hips',
                    audio: 'Bring your hips down to form a straight line'
                }
            }
        ]
    },
    {
        id: 'bicep-curls',
        name: 'Bicep Curls',
        category: 'strength',
        muscleGroups: ['biceps', 'forearms'],
        keypoints: [5, 6, 7, 8, 9, 10], // Shoulders, elbows, wrists
        stages: [
            {
                name: 'up',
                angleRanges: [
                    {
                        joint: 'left_elbow',
                        min: 30,
                        max: 50,
                        optimal: 40
                    },
                    {
                        joint: 'right_elbow',
                        min: 30,
                        max: 50,
                        optimal: 40
                    }
                ]
            },
            {
                name: 'down',
                angleRanges: [
                    {
                        joint: 'left_elbow',
                        min: 160,
                        max: 180,
                        optimal: 170
                    },
                    {
                        joint: 'right_elbow',
                        min: 160,
                        max: 180,
                        optimal: 170
                    }
                ]
            }
        ],
        formChecks: [
            {
                name: 'elbow_stability',
                description: 'Keep elbows fixed at sides',
                severity: 'warning',
                checkFunction: (pose) => true,
                feedback: {
                    visual: 'Stabilize elbows',
                    audio: 'Keep your elbows close to your body'
                }
            },
            {
                name: 'controlled_movement',
                description: 'Avoid swinging or using momentum',
                severity: 'warning',
                checkFunction: (pose) => true,
                feedback: {
                    visual: 'Control the movement',
                    audio: 'Slow down and control the weight'
                }
            }
        ]
    }
];

/**
 * Get exercise by ID
 */
export function getExerciseById(id: string): Exercise | undefined {
    return exercises.find(ex => ex.id === id);
}

/**
 * Get exercises by category
 */
export function getExercisesByCategory(category: 'strength' | 'cardio' | 'flexibility'): Exercise[] {
    return exercises.filter(ex => ex.category === category);
}
