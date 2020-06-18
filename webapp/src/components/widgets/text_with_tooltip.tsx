import React, {useState, useCallback, useRef, useEffect} from 'react';
import {Tooltip, OverlayTrigger} from 'react-bootstrap';
import {debounce} from 'debounce';

import {OVERLAY_DELAY} from 'src/utils/constants';

interface Props {
    id: string;
    text: string;
    className?: string;
    placement?: 'top' | 'bottom' | 'right' | 'left';
}

const TextWithTooltip: React.FC<Props> = (props: Props) => {
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
        <span
            ref={setRef}
            className={props.className}
        >
            {props.text}
        </span>
    );

    if (showTooltip) {
        return (
            <OverlayTrigger
                placement={props.placement}
                delayShow={OVERLAY_DELAY}
                overlay={<Tooltip id={`${props.id}_name`}>{props.text}</Tooltip>}
            >
                {text}
            </OverlayTrigger>
        );
    }

    return text;
};

TextWithTooltip.defaultProps = {
    placement: 'top',
};

export default TextWithTooltip;
