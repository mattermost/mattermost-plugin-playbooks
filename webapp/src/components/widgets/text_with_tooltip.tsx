// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';

import {debounce} from 'debounce';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

interface Props {
    id: string;
    text: string;
    className?: string;
}

const TextWithTooltip = (props: Props) => {
    const ref = useRef<HTMLAnchorElement|null>(null);
    const [showTooltip, setShowTooltip] = useState(false);

    const resizeListener = useMemo(() => debounce(() => {
        if (ref?.current && ref?.current?.offsetWidth < ref?.current?.scrollWidth) {
            setShowTooltip(true);
        } else {
            setShowTooltip(false);
        }
    }, 300), []);

    useEffect(() => {
        window.addEventListener('resize', resizeListener);

        // clean up function
        return () => {
            window.removeEventListener('resize', resizeListener);
        };
    }, []);

    useEffect(() => {
        resizeListener();
    });

    const setRef = useCallback((node: HTMLAnchorElement | null) => {
        ref.current = node;
        resizeListener();
    }, []);

    const text = (
        <span
            ref={setRef}
            className={props.className}
        >
            {props.text}
        </span>
    );

    if (showTooltip) {
        return (
            <WithTooltip
                id={`${props.id}_name`}
                title={props.text}
            >
                {text}
            </WithTooltip>
        );
    }

    return text;
};

export default TextWithTooltip;
