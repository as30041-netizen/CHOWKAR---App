import { TouchEvent, useState } from 'react';

interface UseSwipeProps {
    onSwipeRight?: () => void;
    onSwipeLeft?: () => void;
    threshold?: number;
}

export const useSwipe = ({ onSwipeRight, onSwipeLeft, threshold = 50 }: UseSwipeProps) => {
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);

    const onTouchStart = (e: TouchEvent) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e: TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > threshold;
        const isRightSwipe = distance < -threshold;

        if (isLeftSwipe && onSwipeLeft) {
            onSwipeLeft();
        }
        if (isRightSwipe && onSwipeRight) {
            onSwipeRight();
        }
    };

    // Mouse Support for Desktop Testing
    const [isMouseDown, setIsMouseDown] = useState(false);

    const onMouseDown = (e: React.MouseEvent) => {
        setIsMouseDown(true);
        setTouchEnd(null);
        setTouchStart(e.clientX);
    };

    const onMouseMove = (e: React.MouseEvent) => {
        if (!isMouseDown) return;
        setTouchEnd(e.clientX);
    };

    const onMouseUp = () => {
        setIsMouseDown(false);
        onTouchEnd(); // Reuse logic
    };

    return {
        onTouchStart,
        onTouchMove,
        onTouchEnd,
        onMouseDown,
        onMouseMove,
        onMouseUp
    };
};
