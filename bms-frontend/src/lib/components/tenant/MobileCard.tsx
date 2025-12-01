import type { ReactNode } from 'react';
import { cn } from '@/lib/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';

interface MobileCardProps {
  children: ReactNode;
  title?: string;
  className?: string;
  onClick?: () => void;
}

export function MobileCard({ children, title, className, onClick }: MobileCardProps) {
  const content = (
    <Card
      className={cn(
        'w-full shadow-md transition-shadow',
        onClick && 'cursor-pointer hover:shadow-lg',
        className,
      )}
      onClick={onClick}
    >
      {title && (
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className={cn('p-4', title && 'pt-0')}>{children}</CardContent>
    </Card>
  );

  return content;
}
