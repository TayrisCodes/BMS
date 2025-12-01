'use client';

import { useState } from 'react';
import { useSwipeable } from 'react-swipeable';
import { cn } from '@/lib/lib/utils';
import { ArrowRight, CreditCard } from 'lucide-react';
import { Button } from '@/lib/components/ui/button';

interface SwipeableCardProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  swipeRightAction?: {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
  };
  className?: string;
}

export function SwipeableCard({
  children,
  onSwipeLeft,
  onSwipeRight,
  swipeRightAction,
  className,
}: SwipeableCardProps) {
  const [offset, setOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const handlers = useSwipeable({
    onSwiping: (e) => {
      setIsSwiping(true);
      setOffset(e.deltaX);
    },
    onSwipedLeft: () => {
      setOffset(0);
      setIsSwiping(false);
      onSwipeLeft?.();
    },
    onSwipedRight: (e) => {
      if (e.absX > 100) {
        // Swipe threshold
        onSwipeRight?.();
        if (swipeRightAction) {
          // Keep swiped state briefly to show action
          setTimeout(() => {
            setOffset(0);
            setIsSwiping(false);
          }, 200);
          return;
        }
      }
      setOffset(0);
      setIsSwiping(false);
    },
    trackMouse: false,
    trackTouch: true,
  });

  return (
    <div className={cn('relative overflow-hidden', className)} {...handlers}>
      {/* Action button (revealed on swipe right) */}
      {swipeRightAction && (
        <div
          className={cn(
            'absolute right-0 top-0 h-full flex items-center px-4 bg-primary text-primary-foreground transition-transform duration-200',
            offset > 100 ? 'translate-x-0' : 'translate-x-full',
          )}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              swipeRightAction.onClick();
              setOffset(0);
              setIsSwiping(false);
            }}
            className="text-primary-foreground hover:bg-primary-foreground/20"
          >
            {swipeRightAction.icon || <CreditCard className="h-4 w-4 mr-2" />}
            {swipeRightAction.label}
          </Button>
        </div>
      )}

      {/* Card content */}
      <div
        className={cn('bg-background transition-transform duration-200', isSwiping && 'shadow-lg')}
        style={{
          transform: `translateX(${offset}px)`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
