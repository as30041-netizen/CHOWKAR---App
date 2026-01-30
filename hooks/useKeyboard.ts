import { useState, useEffect } from 'react';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';
import { Capacitor } from '@capacitor/core';

export interface KeyboardState {
    isOpen: boolean;
    keyboardHeight: number;
}

export const useKeyboard = (): KeyboardState => {
    const [keyboardState, setKeyboardState] = useState<KeyboardState>({
        isOpen: false,
        keyboardHeight: 0
    });

    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;

        let showListenerHandle: any;
        let hideListenerHandle: any;

        const setupListeners = async () => {
            // 1. Native Plugin Listeners
            showListenerHandle = await Keyboard.addListener('keyboardWillShow', (info) => {
                setKeyboardState({
                    isOpen: true,
                    keyboardHeight: info.keyboardHeight
                });
                document.documentElement.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`);
            });

            hideListenerHandle = await Keyboard.addListener('keyboardWillHide', () => {
                setKeyboardState({
                    isOpen: false,
                    keyboardHeight: 0
                });
                document.documentElement.style.setProperty('--keyboard-height', '0px');
            });
        };

        setupListeners();

        // 2. Fallback: Visual Viewport Resize Logic (vital for Android reliability)
        // If the viewport grows back to near-original size, assume keyboard closed.
        const originalHeight = window.innerHeight;
        const handleResize = () => {
            const currentHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
            // If height is close to original (> 85%), assume keyboard is closed
            if (currentHeight > originalHeight * 0.85) {
                setKeyboardState(prev => {
                    // Only override if it currently thinks it's open
                    if (prev.isOpen) {
                        document.documentElement.style.setProperty('--keyboard-height', '0px');
                        return { isOpen: false, keyboardHeight: 0 };
                    }
                    return prev;
                });
            }
        };

        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', handleResize);
        } else {
            window.addEventListener('resize', handleResize);
        }

        return () => {
            if (showListenerHandle) showListenerHandle.remove();
            if (hideListenerHandle) hideListenerHandle.remove();

            if (window.visualViewport) {
                window.visualViewport.removeEventListener('resize', handleResize);
            } else {
                window.removeEventListener('resize', handleResize);
            }
        };
    }, []);

    return keyboardState;
};
