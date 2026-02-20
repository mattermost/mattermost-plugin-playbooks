// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled, {keyframes} from 'styled-components';

interface Props {

    /** Number of skeleton sections to display */
    sectionCount?: number;

    /** Number of items per section */
    itemsPerSection?: number;
}

/**
 * Skeleton loading component for the quicklist checklist.
 * Displays animated placeholder content while the actual data is loading.
 */
const QuicklistSkeleton = ({
    sectionCount = 2,
    itemsPerSection = 3,
}: Props): React.ReactElement => {
    return (
        <Container data-testid='quicklist-skeleton'>
            {/* Thread info skeleton */}
            <ThreadInfoSkeleton data-testid='quicklist-skeleton-thread-info'>
                <SkeletonBar
                    $width='240px'
                    $height='16px'
                />
            </ThreadInfoSkeleton>

            {/* Title skeleton */}
            <TitleSkeleton data-testid='quicklist-skeleton-title'>
                <SkeletonBar
                    $width='280px'
                    $height='24px'
                />
            </TitleSkeleton>

            {/* Section skeletons */}
            {Array.from({length: sectionCount}).map((_, sectionIndex) => (
                <SectionSkeleton
                    key={`section-${sectionIndex}`}
                    data-testid='quicklist-skeleton-section'
                >
                    <SectionHeaderSkeleton>
                        <SkeletonCircle $size='16px'/>
                        <SkeletonBar
                            $width='120px'
                            $height='20px'
                        />
                        <SkeletonBar
                            $width='24px'
                            $height='16px'
                            $marginLeft='auto'
                        />
                    </SectionHeaderSkeleton>
                    <SectionContentSkeleton>
                        {Array.from({length: itemsPerSection}).map((__, itemIndex) => (
                            <ItemSkeleton
                                key={`item-${sectionIndex}-${itemIndex}`}
                                data-testid='quicklist-skeleton-item'
                            >
                                <ItemContentSkeleton>
                                    <SkeletonCircle $size='16px'/>
                                    <ItemDetailsSkeleton>
                                        <SkeletonBar
                                            $width={getRandomWidth(140, 220)}
                                            $height='20px'
                                        />
                                        <SkeletonBar
                                            $width={getRandomWidth(180, 280)}
                                            $height='16px'
                                        />
                                    </ItemDetailsSkeleton>
                                </ItemContentSkeleton>
                            </ItemSkeleton>
                        ))}
                    </SectionContentSkeleton>
                </SectionSkeleton>
            ))}
        </Container>
    );
};

/**
 * Returns a random width within the specified range.
 * Used to create visual variety in skeleton items.
 */
const getRandomWidth = (min: number, max: number): string => {
    const widths = [min, Math.floor((min + max) / 2), max];
    return `${widths[Math.floor(Math.random() * widths.length)]}px`;
};

const skeletonFade = keyframes`
    0% {
        background-color: rgba(var(--center-channel-color-rgb), 0.08);
    }
    50% {
        background-color: rgba(var(--center-channel-color-rgb), 0.16);
    }
    100% {
        background-color: rgba(var(--center-channel-color-rgb), 0.08);
    }
`;

const Container = styled.div`
    display: flex;
    flex-direction: column;
`;

const SkeletonBar = styled.div<{
    $width: string;
    $height: string;
    $marginLeft?: string;
}>`
    width: ${(props) => props.$width};
    height: ${(props) => props.$height};
    margin-left: ${(props) => props.$marginLeft || '0'};
    border-radius: 4px;
    animation: ${skeletonFade} 1500ms infinite ease-in-out;
`;

const SkeletonCircle = styled.div<{$size: string}>`
    width: ${(props) => props.$size};
    height: ${(props) => props.$size};
    border-radius: 50%;
    flex-shrink: 0;
    animation: ${skeletonFade} 1500ms infinite ease-in-out;
`;

const ThreadInfoSkeleton = styled.div`
    margin-bottom: 16px;
`;

const TitleSkeleton = styled.div`
    margin-bottom: 16px;
`;

const SectionSkeleton = styled.div`
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 4px;
    margin-bottom: 12px;
    overflow: hidden;

    &:last-child {
        margin-bottom: 0;
    }
`;

const SectionHeaderSkeleton = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 12px 16px;
    background: rgba(var(--center-channel-color-rgb), 0.04);
    gap: 8px;
`;

const SectionContentSkeleton = styled.div`
    padding: 12px 16px;
`;

const ItemSkeleton = styled.div`
    display: flex;
    flex-direction: column;
    padding: 8px 12px;
    background: var(--center-channel-bg);
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 4px;
    margin-bottom: 8px;

    &:last-child {
        margin-bottom: 0;
    }
`;

const ItemContentSkeleton = styled.div`
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    gap: 8px;
`;

const ItemDetailsSkeleton = styled.div`
    display: flex;
    flex-direction: column;
    flex: 1;
    gap: 8px;
`;

export default QuicklistSkeleton;
