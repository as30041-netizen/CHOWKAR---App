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

        return () => {
            if (showListenerHandle) showListenerHandle.remove();
            if (hideListenerHandle) hideListenerHandle.remove();
        };
    }, []);

    return keyboardState;
};
