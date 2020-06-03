import React, {useState, useCallback, useRef, useEffect} from 'react';
import {Tooltip, OverlayTrigger} from 'react-bootstrap';
import {debounce} from 'debounce';

import {OVERLAY_DELAY} from 'src/utils/constants';

interface Props {
    id: string;
    text: string;
    className?: string;
}

const TextWithTooltip = (props: Props) => {
    const ref = useRef<HTMLAnchorElement|null>(null);
    const [showTooltip, setShowTooltip] = useState(false);

    const resizeListener = useCallback(debounce(() => {
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

    const setRef = useCallback((node) => {
        ref.current = node;
        resizeListener();
    }, []);

    const text = (
        <a
            ref={setRef}
            className={props.className}
        >
            {props.text}
        </a>
    );

    if (showTooltip) {
        return (
            <OverlayTrigger
                placement='top'
                delayShow={OVERLAY_DELAY}
                overlay={<Tooltip id={`${props.id}_name`}>{props.text}</Tooltip>}
            >
                {text}
            </OverlayTrigger>
        );
    }

    return text;
};

export default TextWithTooltip;
