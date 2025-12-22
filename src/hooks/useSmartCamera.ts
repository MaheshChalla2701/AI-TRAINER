import { useState, useCallback, useRef, useEffect } from 'react';
import { CameraView } from 'expo-camera';
import { poseDetectionService } from '../services/PoseDetectionService';
import { Pose } from '../types';
import AppConfig from '../config/appConfig';

interface SmartCameraResult {
    poses: Pose[];
    isDetecting: boolean;
}

export const useSmartCamera = (
    isActive: boolean,
    cameraRef: React.RefObject<any>
): SmartCameraResult => {
    // State
    const [poses, setPoses] = useState<Pose[]>([]);
    const [isDetecting, setIsDetecting] = useState(false);

    // Refs for loop control (avoid state updates during capture)
    const isProcessingRef = useRef(false);
    const loopTimerRef = useRef<NodeJS.Timeout | null>(null);
    const missedFramesRef = useRef(0);

    const runDetectionLoop = useCallback(async () => {
        // If conditions not met, reschedule and try again later
        if (!isActive || !cameraRef.current || isProcessingRef.current) {
            if (isActive) {
                loopTimerRef.current = setTimeout(runDetectionLoop, 500);
            }
            return;
        }

        isProcessingRef.current = true;
        try {
            // 1. Capture Frame (Single source of truth)
            // Use low quality for speed, just like Gesture-Sense
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.3,
                base64: true,
                shutterSound: false,
            });

            if (photo && photo.base64) {
                const base64 = photo.base64;

                // 2. Process Pose
                const detectedPoses = AppConfig.features.enablePoseDetection
                    ? await poseDetectionService.detectPose(base64)
                    : [];

                // 3. Update State
                if (detectedPoses && detectedPoses.length > 0) {
                    setPoses(detectedPoses);
                    missedFramesRef.current = 0;
                } else {
                    missedFramesRef.current += 1;
                    if (missedFramesRef.current > 10) {
                        setPoses([]);
                    }
                }
            }
        } catch (err) {
            console.warn('[SmartCamera] Detection error:', err);
            // Don't clear poses on transient errors to prevent blinking
            // Just keep the last known good pose until next successful frame
        } finally {
            isProcessingRef.current = false;
            // Schedule next frame - faster loop for smoother tracking
            if (isActive) {
                loopTimerRef.current = setTimeout(runDetectionLoop, 50); // ~20fps target
            }
        }
    }, [isActive, cameraRef]);

    useEffect(() => {
        if (isActive) {
            setIsDetecting(true);
            // Initialize service
            poseDetectionService.initialize().then(() => {
                runDetectionLoop();
            });
        } else {
            setIsDetecting(false);
            if (loopTimerRef.current) {
                clearTimeout(loopTimerRef.current);
            }
            setPoses([]);
        }

        return () => {
            if (loopTimerRef.current) {
                clearTimeout(loopTimerRef.current);
            }
        };
    }, [isActive, runDetectionLoop]);

    return {
        poses,
        isDetecting
    };
};
