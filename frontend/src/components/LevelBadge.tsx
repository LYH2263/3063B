import React from 'react';
import { cn } from '../lib/utils';
import { Shield, Star, Award, Crown, Gem } from 'lucide-react';

interface LevelBadgeProps {
    level?: {
        level: number;
        name: string;
        color: string;
    };
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

const levelIcons: Record<number, React.FC<any>> = {
    1: Shield,
    2: Star,
    3: Award,
    4: Crown,
    5: Gem,
};

export const LevelBadge: React.FC<LevelBadgeProps> = ({ level, size = 'md', className }) => {
    if (!level) {
        return null;
    }

    const Icon = levelIcons[level.level] || Shield;

    const sizes = {
        sm: 'h-5 w-5 text-xs px-1.5',
        md: 'h-6 w-6 text-xs px-2',
        lg: 'h-8 w-8 text-sm px-3',
    };

    const iconSizes = {
        sm: 12,
        md: 14,
        lg: 18,
    };

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded-full font-bold text-white shadow-sm',
                sizes[size],
                className
            )}
            style={{ backgroundColor: level.color }}
        >
            <Icon size={iconSizes[size]} />
            <span>{level.name}</span>
        </span>
    );
};

export default LevelBadge;
