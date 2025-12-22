import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    useWindowDimensions,
    Alert
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { ScreenType } from '../../App';
import PoseOverlay from '../components/PoseOverlay';
import FormFeedbackOverlay from '../components/FormFeedbackOverlay';
import ExerciseSelector from '../components/ExerciseSelector';
import CountdownOverlay from '../components/CountdownOverlay';

import AppConfig from '../config/appConfig';
import { Pose, FormValidation } from '../types';
import { getExerciseById } from '../models/exercises';
import { workoutAnalysisService } from '../services/WorkoutAnalysisService';
import { feedbackService } from '../services/FeedbackService';
import { avatarService } from '../services/AvatarService';
import { useAppDispatch } from '../hooks/reduxHooks';
import { saveWorkout } from '../store/slices/workoutSlice';
import { useSmartCamera } from '../hooks/useSmartCamera';


interface CameraScreenProps {
    navigation: {
        navigate: (screen: ScreenType) => void;
    };
}

// Available exercises for selection
const AVAILABLE_EXERCISES = ['push-ups', 'squats', 'plank', 'bicep-curls'] as const;
type ExerciseId = typeof AVAILABLE_EXERCISES[number];

export default function CameraScreen({ navigation }: CameraScreenProps) {
    const dispatch = useAppDispatch();

    // Camera state
    const [facing, setFacing] = useState<CameraType>('front');
    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef = useRef<CameraView>(null);

    // Pose detection state
    // const [poses, setPoses] = useState<Pose[]>([]); // Replaced by hook
    const [mockPoses, setMockPoses] = useState<Pose[]>([]);
    // const [isPoseModelReady, setIsPoseModelReady] = useState(false); // Replaced by hook
    const [poseError, setPoseError] = useState<string | null>(null);

    // UI state
    const [showOverlay, setShowOverlay] = useState(false);
    const [isWorkoutActive, setIsWorkoutActive] = useState(false);
    const [showCountdown, setShowCountdown] = useState(false);
    const [showExerciseSelector, setShowExerciseSelector] = useState(false);

    // Workout state
    const [exerciseId, setExerciseId] = useState<ExerciseId>('push-ups');
    const [repCount, setRepCount] = useState(0);
    const [currentStage, setCurrentStage] = useState('');
    const [formScore, setFormScore] = useState(100);
    const [formValidation, setFormValidation] = useState<FormValidation>({
        isValid: true,
        score: 100,
        errors: []
    });

    // Timer state
    const [elapsedTime, setElapsedTime] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Stats tracking
    const [totalFormScore, setTotalFormScore] = useState(0);
    const [formScoreCount, setFormScoreCount] = useState(0);
    const prevRepCount = useRef(0);

    const { width, height } = useWindowDimensions();

    // Initialize pose detection logic removed (handled by hook)

    /**
     * Generate mock pose data for UI testing
     */
    /**
     * Generate mock pose data for UI testing
     * animate: 0 (down) to 1 (up)
     */
    const generateMockPose = useCallback((animationValue: number = 0): Pose => {
        const cx = width / 2;
        const cy = height / 2;

        const kp = (x: number, y: number, name: string = '') => ({
            x, y, score: 0.9, name
        });

        // Interpolate between down (bent elbows) and up (straight arms)
        // Pushup: Down = elbows bent ~90deg, Up = elbows straight ~180deg

        // Elbow Y position (relative to shoulder)
        // Shoulder at cy - 20
        // Down: Elbow at cy + 30 (checking original code) -> Angle ~90
        // Up: Elbow at cy - 20 (aligned with shoulder) -> Angle ~180 (actually straight arm)

        // Let's make it simple:
        // Shoulder: (cx +/- 50, cy - 100)
        // Elbow: 
        //   Down: (cx +/- 80, cy) -> ~90 deg bend
        //   Up: (cx +/- 60, cy - 50) -> extended
        // Wrist:
        //   Down: (cx +/- 50, cy + 50)
        //   Up: (cx +/- 50, cy + 50) (hands fixed)

        const shoulderY = cy - 100;
        const wristY = cy + 50;

        // Elbow interpolation
        // Down state (0)
        const elbowX_down = 90;
        const elbowY_down = cy;

        // Up state (1)
        const elbowX_up = 60; // Closer to body
        const elbowY_up = cy - 40; // Higher up

        const t = animationValue;
        const elbowX = elbowX_down * (1 - t) + elbowX_up * t;
        const elbowY = elbowY_down * (1 - t) + elbowY_up * t;

        return {
            keypoints: [
                kp(cx, cy - 150, 'nose'),
                kp(cx - 20, cy - 160, 'left_eye'),
                kp(cx + 20, cy - 160, 'right_eye'),
                kp(cx - 40, cy - 150, 'left_ear'),
                kp(cx + 40, cy - 150, 'right_ear'),
                kp(cx - 50, shoulderY, 'left_shoulder'),
                kp(cx + 50, shoulderY, 'right_shoulder'),
                kp(cx - elbowX, elbowY, 'left_elbow'),
                kp(cx + elbowX, elbowY, 'right_elbow'),
                kp(cx - 50, wristY, 'left_wrist'),
                kp(cx + 50, wristY, 'right_wrist'),
                kp(cx - 30, cy + 60, 'left_hip'),
                kp(cx + 30, cy + 60, 'right_hip'),
                kp(cx - 35, cy + 140, 'left_knee'),
                kp(cx + 35, cy + 140, 'right_knee'),
                kp(cx - 40, cy + 220, 'left_ankle'),
                kp(cx + 40, cy + 220, 'right_ankle'),
            ],
            score: 0.9,
        } as Pose;
    }, [width, height]);


    /**
     * Body Pose Detection (Python Backend)
     */
    /**
     * Unified Vision System (Gestures + Body Pose)
     */
    const {
        poses: rawPoses,
        isDetecting: isVisionActive
    } = useSmartCamera(
        AppConfig.features.enablePoseDetection,
        cameraRef
    );

    // Scale normalized poses to screen dimensions for DISPLAY
    // Scale normalized poses to screen dimensions for DISPLAY
    const poses = React.useMemo(() => {
        // Priority to real poses
        if (rawPoses && rawPoses.length > 0) {
            const isMirrored = facing === 'front';
            return rawPoses.map(pose => ({
                ...pose,
                keypoints: pose.keypoints.map(kp => ({
                    ...kp,
                    // Mirroring logic
                    x: isMirrored ? (1 - kp.x) * width : kp.x * width,
                    y: kp.y * height
                }))
            }));
        }

        // Fallback to mock poses if enabled and no real poses
        if (AppConfig.features.enableMockPoseOverlay && mockPoses.length > 0) {
            return mockPoses;
        }

        return [];
    }, [rawPoses, mockPoses, width, height, facing]);

    // Points for ACCURATE ANALYSIS (using screen aspect ratio to preserve angles)
    const analysisPoses = React.useMemo(() => {
        if (rawPoses && rawPoses.length > 0) {
            return rawPoses.map(pose => ({
                ...pose,
                keypoints: pose.keypoints.map(kp => ({
                    ...kp,
                    // Use screen dimensions to preserve correct physical angles
                    x: kp.x * width,
                    y: kp.y * height
                }))
            }));
        }
        return [];
    }, [rawPoses, width, height]);

    const isPoseModelReady = true; // Always considered ready with backend approach

    /**
     * Workout timer
     */
    useEffect(() => {
        if (isWorkoutActive) {
            timerRef.current = setInterval(() => {
                setElapsedTime(prev => prev + 1);
            }, 1000);
        } else {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [isWorkoutActive]);


    /**
     * Handle pose updates and analyze workout
     */
    useEffect(() => {
        if (!isWorkoutActive || analysisPoses.length === 0) return;

        const exercise = getExerciseById(exerciseId);
        if (!exercise) return;

        // Pass the first scaled pose for ANALYSIS (un-distorted)
        const result = workoutAnalysisService.analyze(analysisPoses[0], exercise);
        setCurrentStage(result.stage);
        setRepCount(result.reps);
        setFormScore(result.validation.score);
        setFormValidation(result.validation);

        // Track form score for average
        setTotalFormScore(prev => prev + result.validation.score);
        setFormScoreCount(prev => prev + 1);

        // Process feedback
        feedbackService.processFormValidation(result.validation);

        // Announce rep completion
        if (result.reps > prevRepCount.current) {
            feedbackService.announceRep(result.reps, result.validation.score);
            prevRepCount.current = result.reps;
        }
    }, [poses, isWorkoutActive, exerciseId]);



    /**
     * Toggle workout session
     */
    const toggleWorkout = () => {
        if (isWorkoutActive) {
            // End workout
            setIsWorkoutActive(false);
            setShowOverlay(false);
            setMockPoses([]); // Clear mock poses

            // Calculate average form score
            const avgScore = formScoreCount > 0
                ? Math.round(totalFormScore / formScoreCount)
                : 100;

            // Announce completion
            feedbackService.announceWorkoutEnd(repCount, avgScore);

            // Show workout summary
            Alert.alert(
                '🎉 Workout Complete!',
                `Exercise: ${exerciseId}\n` +
                `Time: ${formatTime(elapsedTime)}\n` +
                `Reps: ${repCount}\n` +
                `Average Form: ${avgScore}%`,
                [{ text: 'OK' }]
            );

            // Save workout to Firestore
            const exercise = getExerciseById(exerciseId);
            const caloriesBurned = Math.round(repCount * 3 + elapsedTime * 0.1); // Simple estimate
            dispatch(saveWorkout({
                exerciseId,
                exerciseName: exercise?.name || exerciseId,
                duration: elapsedTime,
                reps: repCount,
                averageFormScore: avgScore,
                caloriesBurned,
            }));

            // Update avatar progress
            avatarService.updateAfterWorkout({
                exerciseId,
                reps: repCount,
                duration: elapsedTime,
                formScore: avgScore,
            });

            // Reset for next workout
            workoutAnalysisService.reset(exerciseId);
            setRepCount(0);
            setCurrentStage('');
            setElapsedTime(0);
            setTotalFormScore(0);
            setFormScoreCount(0);
            prevRepCount.current = 0;
        } else {
            // Start countdown first
            setShowCountdown(true);
        }
    };

    const handleCountdownComplete = () => {
        setShowCountdown(false);
        setIsWorkoutActive(true);
        setShowOverlay(true);

        // Announce start
        const exercise = getExerciseById(exerciseId);
        feedbackService.announceWorkoutStart(exercise?.name || exerciseId);

        // Mock Animation Loop
        if (AppConfig.features.enableMockPoseOverlay && !AppConfig.features.enablePoseDetection) {
            console.log("Starting debug animation loop");
            let frame = 0;
            // Clear any existing mock timer
            if ((window as any).mockTimer) clearInterval((window as any).mockTimer);

            (window as any).mockTimer = setInterval(() => {
                // Cycle: Up -> Down -> Up every 4 seconds (approx)
                // 30fps simulation
                frame++;
                const t = (Math.sin(frame / 20) + 1) / 2; // 0 to 1 smooth
                setMockPoses([generateMockPose(t)]);
            }, 50);
        }
    };


    /**
     * Toggle camera facing
     */
    const toggleCameraFacing = () => {
        setFacing(current => (current === 'back' ? 'front' : 'back'));
    };

    /**
     * Cycle through available exercises (legacy, still works during workout)
     */
    const cycleExercise = () => {
        const currentIndex = AVAILABLE_EXERCISES.indexOf(exerciseId);
        const nextIndex = (currentIndex + 1) % AVAILABLE_EXERCISES.length;
        const newExercise = AVAILABLE_EXERCISES[nextIndex];

        setExerciseId(newExercise);
        workoutAnalysisService.reset(exerciseId);
        setRepCount(0);
        prevRepCount.current = 0;
    };

    /**
     * Handle exercise selection from modal
     */
    const handleExerciseSelect = (id: string) => {
        setExerciseId(id as ExerciseId);
        workoutAnalysisService.reset(exerciseId);
        setRepCount(0);
        prevRepCount.current = 0;
    };

    /**
     * Format seconds to MM:SS
     */
    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Handle permission states
    if (!permission) {
        return <View style={styles.container} />;
    }

    if (!permission.granted) {
        return (
            <View style={styles.permissionContainer}>
                <Text style={styles.permissionTitle}>📸 Camera Access Required</Text>
                <Text style={styles.permissionText}>
                    We need camera access to analyze your workout form in real-time.
                </Text>
                <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
                    <Text style={styles.permissionButtonText}>Grant Permission</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.navigate('Home')}
                >
                    <Text style={styles.backButtonText}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <CameraView
                style={styles.camera}
                facing={facing}
                ref={cameraRef}
            >
                {/* Pose Skeleton Overlay - Always show when poses detected */}
                {poses.length > 0 && (
                    <PoseOverlay
                        poses={poses}
                        width={width}
                        height={height}
                        formScore={formScore}
                    />
                )}



                {/* Form Feedback Overlay */}
                <FormFeedbackOverlay
                    validation={formValidation}
                    currentStage={currentStage}
                    isVisible={isWorkoutActive}
                />

                {/* Gesture Feedback Overlay */}

                {/* HUD - Exercise Info */}
                {isWorkoutActive && (
                    <View style={styles.hud}>
                        <TouchableOpacity onPress={cycleExercise} activeOpacity={0.7}>
                            <Text style={styles.hudExercise}>
                                {getExerciseById(exerciseId)?.name || exerciseId}
                            </Text>
                        </TouchableOpacity>

                        <View style={styles.hudRow}>
                            <Text style={styles.hudIcon}>⏱️</Text>
                            <Text style={styles.hudTimer}>{formatTime(elapsedTime)}</Text>
                        </View>

                        <View style={styles.hudDivider} />

                        <Text style={styles.hudLabel}>REPS</Text>
                        <Text style={styles.hudReps}>{repCount}</Text>
                    </View>
                )}

                {/* Status Indicators */}
                {AppConfig.features.enablePoseDetection && !isPoseModelReady && (
                    <View style={styles.statusBanner}>
                        <Text style={styles.statusText}>
                            {poseError ? `⚠️ ${poseError}` : '⏳ Loading AI...'}
                        </Text>
                    </View>
                )}

                {AppConfig.features.enableMockPoseOverlay &&
                    !AppConfig.features.enablePoseDetection && isWorkoutActive && (
                        <View style={styles.mockBanner}>
                            <Text style={styles.mockText}>📍 Demo Mode (Animating)</Text>
                        </View>
                    )}

                {/* Control Buttons */}
                <View style={styles.controlBar}>
                    <TouchableOpacity style={styles.controlButton} onPress={toggleCameraFacing}>
                        <Text style={styles.controlIcon}>🔄</Text>
                        <Text style={styles.controlText}>Flip</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.mainButton, isWorkoutActive && styles.stopButton]}
                        onPress={toggleWorkout}
                    >
                        <Text style={styles.mainButtonIcon}>
                            {isWorkoutActive ? '⏹️' : '▶️'}
                        </Text>
                        <Text style={styles.mainButtonText}>
                            {isWorkoutActive ? 'STOP' : 'START'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.controlButton}
                        onPress={() => navigation.navigate('Home')}
                    >
                        <Text style={styles.controlIcon}>✕</Text>
                        <Text style={styles.controlText}>Exit</Text>
                    </TouchableOpacity>
                </View>
            </CameraView>

            {/* Exercise Selector Modal */}
            <ExerciseSelector
                visible={showExerciseSelector}
                selectedExerciseId={exerciseId}
                onSelect={handleExerciseSelect}
                onClose={() => setShowExerciseSelector(false)}
            />

            {/* Exercise Selection Button (when not in workout) */}
            {!isWorkoutActive && (
                <View style={styles.exerciseSelectContainer}>
                    <TouchableOpacity
                        style={styles.exerciseSelectButton}
                        onPress={() => setShowExerciseSelector(true)}
                    >
                        <Text style={styles.exerciseSelectLabel}>Selected Exercise</Text>
                        <Text style={styles.exerciseSelectName}>
                            {getExerciseById(exerciseId)?.name || exerciseId}
                        </Text>
                        <Text style={styles.exerciseSelectHint}>Tap to change ▼</Text>
                    </TouchableOpacity>
                </View>
            )}

            {showCountdown && (
                <CountdownOverlay onComplete={handleCountdownComplete} />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    camera: {
        flex: 1,
    },

    // Permission Screen
    permissionContainer: {
        flex: 1,
        backgroundColor: '#0A0E27',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    permissionTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 16,
    },
    permissionText: {
        fontSize: 16,
        color: '#B0B3C1',
        textAlign: 'center',
        marginBottom: 32,
    },
    permissionButton: {
        backgroundColor: '#6C63FF',
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 12,
        marginBottom: 16,
    },
    permissionButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    backButton: {
        padding: 16,
    },
    backButtonText: {
        color: '#6C63FF',
        fontSize: 16,
    },

    // HUD
    hud: {
        position: 'absolute',
        top: 60,
        left: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        padding: 16,
        borderRadius: 16,
        minWidth: 120,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    hudExercise: {
        color: '#6C63FF',
        fontSize: 14,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    hudRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        gap: 6,
    },
    hudIcon: {
        fontSize: 16,
    },
    hudTimer: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: '600',
        fontVariant: ['tabular-nums'],
    },
    hudDivider: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        marginVertical: 12,
    },
    hudLabel: {
        color: '#B0B3C1',
        fontSize: 11,
        letterSpacing: 1,
    },
    hudReps: {
        color: '#FFFFFF',
        fontSize: 48,
        fontWeight: 'bold',
        marginTop: -4,
    },

    // Status Banners
    statusBanner: {
        position: 'absolute',
        top: 60,
        right: 100,
        backgroundColor: 'rgba(255, 180, 0, 0.9)',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    statusText: {
        color: '#000',
        fontSize: 12,
        fontWeight: '600',
    },
    mockBanner: {
        position: 'absolute',
        top: 180,
        right: 20,
        backgroundColor: 'rgba(108, 99, 255, 0.8)',
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 6,
    },
    mockText: {
        color: '#FFF',
        fontSize: 11,
    },

    // Control Bar
    controlBar: {
        position: 'absolute',
        bottom: 40,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    controlButton: {
        alignItems: 'center',
        padding: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        borderRadius: 12,
        minWidth: 60,
    },
    controlIcon: {
        fontSize: 24,
    },
    controlText: {
        color: '#FFFFFF',
        fontSize: 11,
        marginTop: 4,
    },
    mainButton: {
        backgroundColor: '#6C63FF',
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#6C63FF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 12,
        elevation: 10,
    },
    stopButton: {
        backgroundColor: '#FF4444',
        shadowColor: '#FF4444',
    },
    mainButtonIcon: {
        fontSize: 28,
    },
    mainButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: 'bold',
        marginTop: 2,
    },

    // Exercise Selector Button
    exerciseSelectContainer: {
        position: 'absolute',
        top: 80,
        left: 20,
        right: 20,
    },
    exerciseSelectButton: {
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(108, 99, 255, 0.5)',
    },
    exerciseSelectLabel: {
        color: '#B0B3C1',
        fontSize: 12,
        marginBottom: 4,
    },
    exerciseSelectName: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: 'bold',
    },
    exerciseSelectHint: {
        color: '#6C63FF',
        fontSize: 12,
        marginTop: 6,
    },
});
